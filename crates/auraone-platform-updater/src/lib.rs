use base64::{engine::general_purpose::STANDARD, Engine};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum UpdaterError {
    #[error("manifest signature failed")]
    Signature,
    #[error("rollout disabled by kill switch")]
    KillSwitch,
    #[error("invalid manifest: {0}")]
    Invalid(String),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Stable,
    Beta,
    Nightly,
}

impl Default for Channel {
    fn default() -> Self {
        Self::Stable
    }
}

impl Channel {
    pub fn path_segment(self) -> &'static str {
        match self {
            Self::Stable => "stable",
            Self::Beta => "beta",
            Self::Nightly => "nightly",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlatformArtifact {
    pub signature: String,
    pub url: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Rollout {
    pub percentage: u8,
    pub mandatory: bool,
    pub min_version: String,
    #[serde(default)]
    pub kill_switch: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UpdateManifest {
    #[serde(default = "default_schema_version")]
    pub schema_version: String,
    #[serde(default)]
    pub flagship: String,
    pub version: String,
    pub notes: String,
    pub pub_date: String,
    pub platforms: BTreeMap<String, PlatformArtifact>,
    #[serde(default)]
    pub checksums: BTreeMap<String, String>,
    pub rollout: Rollout,
    #[serde(default)]
    pub channel: Channel,
    #[serde(default = "default_manifest_signature_algorithm")]
    pub manifest_signature_algorithm: String,
    pub manifest_signature: String,
}

fn default_schema_version() -> String {
    "1.0.0".to_string()
}

fn default_manifest_signature_algorithm() -> String {
    "ed25519".to_string()
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum UpdateState {
    Available { version: String, mandatory: bool },
    NotRolledOut,
    Killed,
    VerificationFailed(String),
}

impl UpdateManifest {
    pub fn signing_payload(&self) -> Result<Vec<u8>, UpdaterError> {
        let mut clone = self.clone();
        clone.manifest_signature.clear();
        let value =
            serde_json::to_value(&clone).map_err(|e| UpdaterError::Invalid(e.to_string()))?;
        Ok(canonical_json(&value).into_bytes())
    }
}

pub fn verify_manifest(manifest: &UpdateManifest, pubkey_base64: &str) -> Result<(), UpdaterError> {
    validate_manifest(manifest)?;
    let pubkey_bytes = STANDARD
        .decode(pubkey_base64)
        .map_err(|_| UpdaterError::Signature)?;
    let key = VerifyingKey::from_bytes(
        pubkey_bytes
            .as_slice()
            .try_into()
            .map_err(|_| UpdaterError::Signature)?,
    )
    .map_err(|_| UpdaterError::Signature)?;
    let signature_bytes = STANDARD
        .decode(&manifest.manifest_signature)
        .map_err(|_| UpdaterError::Signature)?;
    let signature = Signature::from_slice(&signature_bytes).map_err(|_| UpdaterError::Signature)?;
    key.verify(&manifest.signing_payload()?, &signature)
        .map_err(|_| UpdaterError::Signature)
}

pub fn validate_manifest(manifest: &UpdateManifest) -> Result<(), UpdaterError> {
    if manifest.schema_version != "1.0.0" {
        return Err(UpdaterError::Invalid("schema_version must be 1.0.0".into()));
    }
    if manifest.manifest_signature_algorithm != "ed25519" {
        return Err(UpdaterError::Invalid(
            "manifest_signature_algorithm must be ed25519".into(),
        ));
    }
    if manifest.rollout.percentage > 100 {
        return Err(UpdaterError::Invalid(
            "rollout percentage must be <= 100".into(),
        ));
    }
    if manifest.platforms.is_empty() {
        return Err(UpdaterError::Invalid("platforms must not be empty".into()));
    }
    for (platform, artifact) in &manifest.platforms {
        if artifact.signature.trim().is_empty() {
            return Err(UpdaterError::Invalid(format!(
                "{platform} is missing artifact signature"
            )));
        }
        if !artifact.url.starts_with("https://updates.auraone.ai/")
            && !artifact.url.starts_with("https://updates2.auraone.ai/")
        {
            return Err(UpdaterError::Invalid(format!(
                "{platform} does not use an AuraOne update URL"
            )));
        }
    }
    Ok(())
}

pub fn rollout_state(
    manifest: &UpdateManifest,
    install_id: &str,
) -> Result<UpdateState, UpdaterError> {
    if manifest.rollout.kill_switch || manifest.rollout.percentage == 0 {
        return Ok(UpdateState::Killed);
    }
    let hash = Sha256::digest(install_id.as_bytes());
    let bucket = hash[0] % 100;
    if bucket < manifest.rollout.percentage {
        Ok(UpdateState::Available {
            version: manifest.version.clone(),
            mandatory: manifest.rollout.mandatory,
        })
    } else {
        Ok(UpdateState::NotRolledOut)
    }
}

pub fn evaluate_update(
    manifest: &UpdateManifest,
    pubkey_base64: &str,
    current_version: &str,
    install_id: &str,
) -> UpdateState {
    if let Err(error) = verify_manifest(manifest, pubkey_base64) {
        return UpdateState::VerificationFailed(error.to_string());
    }
    if manifest.rollout.kill_switch || manifest.rollout.percentage == 0 {
        return UpdateState::Killed;
    }
    let Ok(target) = semver::Version::parse(&manifest.version) else {
        return UpdateState::VerificationFailed("manifest version is not semver".into());
    };
    let Ok(current) = semver::Version::parse(current_version) else {
        return UpdateState::VerificationFailed("current version is not semver".into());
    };
    if target <= current {
        return UpdateState::NotRolledOut;
    }
    let mandatory = manifest.rollout.mandatory
        || semver::Version::parse(&manifest.rollout.min_version)
            .map(|min| current < min)
            .unwrap_or(false);
    if matches!(
        rollout_state(manifest, install_id),
        Ok(UpdateState::Available { .. })
    ) {
        UpdateState::Available {
            version: manifest.version.clone(),
            mandatory,
        }
    } else {
        UpdateState::NotRolledOut
    }
}

fn canonical_json(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(bool) => bool.to_string(),
        Value::Number(number) => number.to_string(),
        Value::String(text) => {
            serde_json::to_string(text).expect("string serialization cannot fail")
        }
        Value::Array(items) => {
            let parts = items.iter().map(canonical_json).collect::<Vec<_>>();
            format!("[{}]", parts.join(","))
        }
        Value::Object(map) => {
            let mut entries = map.iter().collect::<Vec<_>>();
            entries.sort_by(|(left, _), (right, _)| left.cmp(right));
            let parts = entries
                .into_iter()
                .map(|(key, value)| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(key).expect("string serialization cannot fail"),
                        canonical_json(value)
                    )
                })
                .collect::<Vec<_>>();
            format!("{{{}}}", parts.join(","))
        }
    }
}

pub fn user_visible_message(manifest: &UpdateManifest, state: &UpdateState) -> String {
    match state {
        UpdateState::Available { version, mandatory } if *mandatory => format!(
            "A mandatory AuraOne Open Studio update to {version} is available on {}.",
            manifest.channel.path_segment()
        ),
        UpdateState::Available { version, .. } => format!(
            "AuraOne Open Studio {version} is available on {}.",
            manifest.channel.path_segment()
        ),
        UpdateState::NotRolledOut => format!(
            "No update is assigned to this install on {} yet.",
            manifest.channel.path_segment()
        ),
        UpdateState::Killed => {
            "Updates are temporarily disabled by the platform kill switch.".to_string()
        }
        UpdateState::VerificationFailed(reason) => format!("Update verification failed: {reason}."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use rand::rngs::OsRng;

    fn manifest() -> UpdateManifest {
        UpdateManifest {
            schema_version: "1.0.0".into(),
            flagship: "rubric-studio-open".into(),
            version: "0.4.2".into(),
            notes: "Release".into(),
            pub_date: "2026-06-14T18:00:00Z".into(),
            platforms: BTreeMap::from([(
                "darwin-aarch64".into(),
                PlatformArtifact {
                    signature: "artifact-signature".into(),
                    url: "https://updates.auraone.ai/rubric/stable/app.tar.gz".into(),
                },
            )]),
            checksums: BTreeMap::from([("app.tar.gz".into(), "a".repeat(64))]),
            rollout: Rollout {
                percentage: 100,
                mandatory: false,
                min_version: "0.3.0".into(),
                kill_switch: false,
            },
            channel: Channel::Stable,
            manifest_signature_algorithm: "ed25519".into(),
            manifest_signature: String::new(),
        }
    }

    #[test]
    fn verifies_signed_manifest() {
        let signing = SigningKey::generate(&mut OsRng);
        let mut manifest = manifest();
        let signature = signing.sign(&manifest.signing_payload().unwrap());
        manifest.manifest_signature = STANDARD.encode(signature.to_bytes());
        assert!(verify_manifest(
            &manifest,
            &STANDARD.encode(signing.verifying_key().to_bytes())
        )
        .is_ok());
        let state = evaluate_update(
            &manifest,
            &STANDARD.encode(signing.verifying_key().to_bytes()),
            "0.4.1",
            "install",
        );
        assert_eq!(
            user_visible_message(&manifest, &state),
            "AuraOne Open Studio 0.4.2 is available on stable."
        );
    }

    #[test]
    fn kill_switch_returns_killed() {
        let mut manifest = manifest();
        manifest.rollout.kill_switch = true;
        assert_eq!(
            rollout_state(&manifest, "install").unwrap(),
            UpdateState::Killed
        );
    }

    #[test]
    fn tampered_manifest_fails_verification() {
        let signing = SigningKey::generate(&mut OsRng);
        let mut manifest = manifest();
        let signature = signing.sign(&manifest.signing_payload().unwrap());
        manifest.manifest_signature = STANDARD.encode(signature.to_bytes());
        manifest.notes = "tampered".into();

        assert!(matches!(
            evaluate_update(
                &manifest,
                &STANDARD.encode(signing.verifying_key().to_bytes()),
                "0.4.1",
                "install"
            ),
            UpdateState::VerificationFailed(_)
        ));
    }
}
