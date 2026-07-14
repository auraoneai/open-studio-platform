use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use hex::ToHex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs::File;
use std::io::{Read, Seek, Write};
use std::path::Path;
use thiserror::Error;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::ZipArchive;

pub const INTAKE_SCHEMA_URL: &str = "https://schemas.auraone.ai/open-studio/intake-packet/v1.json";
pub const DEFAULT_DESTINATION: &str = "https://intake.auraone.ai/v1/packets/";

#[derive(Debug, Error)]
pub enum IntakeError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("zip error: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("privacy violation: {0}")]
    Privacy(String),
    #[error("invalid manifest: {0}")]
    InvalidManifest(String),
    #[error("transport error: {0}")]
    Transport(String),
}

#[derive(Clone, Debug, Serialize, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum Product {
    RubricStudioOpen,
    RoboticsStudioOpen,
    AgentStudioOpen,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Creator {
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Redaction {
    pub file_paths: bool,
    pub hostnames: bool,
    pub api_keys: bool,
    pub user_pii_other_than_explicit_intake: bool,
    pub custom_rules_applied: Vec<String>,
}

impl Default for Redaction {
    fn default() -> Self {
        Self {
            file_paths: true,
            hostnames: true,
            api_keys: true,
            user_pii_other_than_explicit_intake: true,
            custom_rules_applied: vec![],
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Consent {
    pub user_acknowledged_preview: bool,
    pub user_acknowledged_transport: bool,
    pub timestamp: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PayloadEntry {
    pub path: String,
    pub role: String,
    pub sha256: String,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Provenance {
    pub engine_libs: BTreeMap<String, String>,
    pub os: String,
    pub os_version: String,
    pub app_install_id_hash: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Transport {
    pub destination: String,
    pub intended_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IntakeManifest {
    #[serde(rename = "$schema")]
    pub schema: String,
    pub manifest_version: String,
    pub product: Product,
    pub product_version: String,
    pub platform_version: String,
    pub created_at: DateTime<Utc>,
    pub project_id: Uuid,
    pub creator: Creator,
    pub intent: String,
    pub redaction: Redaction,
    pub consent: Consent,
    pub payload_manifest: Vec<PayloadEntry>,
    pub provenance: Provenance,
    pub transport: Transport,
}

pub struct PayloadFile {
    pub relative_path: String,
    pub role: String,
    pub bytes: Vec<u8>,
}

pub struct PacketPreview {
    pub manifest: IntakeManifest,
    pub file_count: usize,
    pub total_size_bytes: u64,
    pub files: Vec<(String, String)>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IntakeUploadResponse {
    pub packet_id: Uuid,
    pub received_at: DateTime<Utc>,
    pub cloud_url: String,
    pub import_status: String,
    pub next_step: String,
}

pub trait IntakeTransport: Send + Sync {
    fn upload(
        &self,
        packet: Vec<u8>,
        install_id_hash: &str,
        product: Product,
    ) -> Result<IntakeUploadResponse, IntakeError>;
}

pub struct HttpIntakeTransport {
    endpoint: String,
    client: reqwest::blocking::Client,
}

impl HttpIntakeTransport {
    pub fn new(endpoint: impl Into<String>) -> Result<Self, IntakeError> {
        Ok(Self {
            endpoint: endpoint.into(),
            client: reqwest::blocking::Client::builder()
                .build()
                .map_err(|error| IntakeError::Transport(error.to_string()))?,
        })
    }

    pub fn with_mtls_identity(
        endpoint: impl Into<String>,
        identity_pem: &[u8],
    ) -> Result<Self, IntakeError> {
        let identity = reqwest::Identity::from_pem(identity_pem)
            .map_err(|error| IntakeError::Transport(error.to_string()))?;
        Ok(Self {
            endpoint: endpoint.into(),
            client: reqwest::blocking::Client::builder()
                .identity(identity)
                .build()
                .map_err(|error| IntakeError::Transport(error.to_string()))?,
        })
    }
}

impl IntakeTransport for HttpIntakeTransport {
    fn upload(
        &self,
        packet: Vec<u8>,
        install_id_hash: &str,
        product: Product,
    ) -> Result<IntakeUploadResponse, IntakeError> {
        submit_packet_typed(
            &self.client,
            &self.endpoint,
            packet,
            install_id_hash,
            product,
        )
    }
}

pub struct CloudImportClient<T: IntakeTransport> {
    transport: T,
}

impl<T: IntakeTransport> CloudImportClient<T> {
    pub fn new(transport: T) -> Self {
        Self { transport }
    }

    pub fn send(
        &self,
        packet: Vec<u8>,
        install_id_hash: &str,
        product: Product,
    ) -> Result<IntakeUploadResponse, IntakeError> {
        self.transport.upload(packet, install_id_hash, product)
    }
}

pub struct IntakePacketBuilder {
    product: Product,
    product_version: String,
    platform_version: String,
    creator: Creator,
    intent: String,
    provenance: Provenance,
    payloads: Vec<PayloadFile>,
}

impl IntakePacketBuilder {
    pub fn new(
        product: Product,
        product_version: impl Into<String>,
        platform_version: impl Into<String>,
        creator: Creator,
        intent: impl Into<String>,
        provenance: Provenance,
    ) -> Self {
        Self {
            product,
            product_version: product_version.into(),
            platform_version: platform_version.into(),
            creator,
            intent: intent.into(),
            provenance,
            payloads: vec![],
        }
    }

    pub fn add_payload(
        mut self,
        relative_path: impl Into<String>,
        role: impl Into<String>,
        bytes: Vec<u8>,
    ) -> Self {
        self.payloads.push(PayloadFile {
            relative_path: relative_path.into(),
            role: role.into(),
            bytes,
        });
        self
    }

    pub fn build_preview(&self) -> Result<PacketPreview, IntakeError> {
        let mut payload_manifest = vec![];
        let mut total_size_bytes = 0u64;
        let mut files = vec![];
        for payload in &self.payloads {
            validate_payload_path(&payload.relative_path)?;
            validate_payload_role(&payload.role)?;
            validate_product_payload(&self.product, &payload.relative_path)?;
            reject_forbidden_bytes(&payload.bytes)?;
            total_size_bytes += payload.bytes.len() as u64;
            let digest = Sha256::digest(&payload.bytes).encode_hex::<String>();
            let path = format!("payload/{}", payload.relative_path.trim_start_matches('/'));
            payload_manifest.push(PayloadEntry {
                path: path.clone(),
                role: payload.role.clone(),
                sha256: digest,
                size_bytes: payload.bytes.len() as u64,
            });
            files.push((path, String::from_utf8_lossy(&payload.bytes).to_string()));
        }
        let now = Utc::now();
        let manifest = IntakeManifest {
            schema: INTAKE_SCHEMA_URL.into(),
            manifest_version: "1.0.0".into(),
            product: self.product.clone(),
            product_version: self.product_version.clone(),
            platform_version: self.platform_version.clone(),
            created_at: now,
            project_id: Uuid::new_v4(),
            creator: self.creator.clone(),
            intent: self.intent.clone(),
            redaction: Redaction::default(),
            consent: Consent {
                user_acknowledged_preview: true,
                user_acknowledged_transport: true,
                timestamp: now,
            },
            payload_manifest,
            provenance: self.provenance.clone(),
            transport: Transport {
                destination: DEFAULT_DESTINATION.into(),
                intended_at: now,
            },
        };
        validate_manifest(&manifest)?;
        Ok(PacketPreview {
            manifest,
            file_count: self.payloads.len(),
            total_size_bytes,
            files,
        })
    }

    pub fn write_packet(
        &self,
        out_path: impl AsRef<Path>,
        signing_key: &SigningKey,
    ) -> Result<IntakeManifest, IntakeError> {
        let preview = self.build_preview()?;
        let manifest_json = serde_json::to_vec_pretty(&preview.manifest)?;
        let signature = signing_key.sign(&manifest_json).to_bytes();
        let file = File::create(out_path)?;
        let mut zip = zip::ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zip.start_file("manifest.json", options)?;
        zip.write_all(&manifest_json)?;
        for payload in &self.payloads {
            zip.start_file(
                format!("payload/{}", payload.relative_path.trim_start_matches('/')),
                options,
            )?;
            zip.write_all(&payload.bytes)?;
        }
        zip.start_file("signatures/manifest.sig", options)?;
        zip.write_all(&signature)?;
        zip.finish()?;
        Ok(preview.manifest)
    }
}

pub fn validate_manifest(manifest: &IntakeManifest) -> Result<(), IntakeError> {
    if manifest.schema != INTAKE_SCHEMA_URL {
        return Err(IntakeError::InvalidManifest("unexpected schema".into()));
    }
    if manifest.manifest_version != "1.0.0" {
        return Err(IntakeError::InvalidManifest(
            "unexpected manifest version".into(),
        ));
    }
    if !manifest.redaction.file_paths
        || !manifest.redaction.hostnames
        || !manifest.redaction.api_keys
        || !manifest.redaction.user_pii_other_than_explicit_intake
    {
        return Err(IntakeError::InvalidManifest(
            "mandatory redaction flags must be true".into(),
        ));
    }
    if !manifest.consent.user_acknowledged_preview || !manifest.consent.user_acknowledged_transport
    {
        return Err(IntakeError::InvalidManifest(
            "intake consent is required".into(),
        ));
    }
    Ok(())
}

pub fn validate_packet_reader<R: Read + Seek>(
    reader: R,
    verifying_key: Option<&VerifyingKey>,
) -> Result<IntakeManifest, IntakeError> {
    let mut archive = ZipArchive::new(reader)?;
    let manifest_bytes = read_zip_file(&mut archive, "manifest.json")?;
    let manifest: IntakeManifest = serde_json::from_slice(&manifest_bytes)?;
    validate_manifest(&manifest)?;

    for entry in &manifest.payload_manifest {
        let bytes = read_zip_file(&mut archive, &entry.path)?;
        reject_forbidden_bytes(&bytes)?;
        let digest = Sha256::digest(&bytes).encode_hex::<String>();
        if digest != entry.sha256 {
            return Err(IntakeError::InvalidManifest(format!(
                "sha256 mismatch for {}",
                entry.path
            )));
        }
        if bytes.len() as u64 != entry.size_bytes {
            return Err(IntakeError::InvalidManifest(format!(
                "size mismatch for {}",
                entry.path
            )));
        }
    }

    if let Some(verifying_key) = verifying_key {
        let signature_bytes = read_zip_file(&mut archive, "signatures/manifest.sig")?;
        let signature = Signature::from_slice(&signature_bytes)
            .map_err(|_| IntakeError::InvalidManifest("invalid manifest signature".into()))?;
        verifying_key
            .verify(&manifest_bytes, &signature)
            .map_err(|_| {
                IntakeError::InvalidManifest("manifest signature verification failed".into())
            })?;
    }
    Ok(manifest)
}

pub fn validate_packet_path(
    path: impl AsRef<Path>,
    verifying_key: Option<&VerifyingKey>,
) -> Result<IntakeManifest, IntakeError> {
    validate_packet_reader(File::open(path)?, verifying_key)
}

fn read_zip_file<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> Result<Vec<u8>, IntakeError> {
    let mut file = archive.by_name(name)?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    Ok(bytes)
}

pub fn submit_packet(
    endpoint: &str,
    packet: Vec<u8>,
    install_id_hash: &str,
    product: &str,
) -> Result<serde_json::Value, IntakeError> {
    let part = reqwest::blocking::multipart::Part::bytes(packet)
        .file_name("packet.auraonepkg")
        .mime_str("application/zip")
        .map_err(|e| IntakeError::Transport(e.to_string()))?;
    let form = reqwest::blocking::multipart::Form::new()
        .part("packet", part)
        .text("install_id_hash", install_id_hash.to_string())
        .text("product", product.to_string());
    let client = reqwest::blocking::Client::new();
    let response = client
        .post(endpoint)
        .multipart(form)
        .send()
        .map_err(|e| IntakeError::Transport(e.to_string()))?;
    response
        .json()
        .map_err(|e| IntakeError::Transport(e.to_string()))
}

fn submit_packet_typed(
    client: &reqwest::blocking::Client,
    endpoint: &str,
    packet: Vec<u8>,
    install_id_hash: &str,
    product: Product,
) -> Result<IntakeUploadResponse, IntakeError> {
    let product = serde_json::to_value(product)?
        .as_str()
        .unwrap_or_default()
        .to_string();
    let part = reqwest::blocking::multipart::Part::bytes(packet)
        .file_name("packet.auraonepkg")
        .mime_str("application/zip")
        .map_err(|e| IntakeError::Transport(e.to_string()))?;
    let form = reqwest::blocking::multipart::Form::new()
        .part("packet", part)
        .text("install_id_hash", install_id_hash.to_string())
        .text("product", product);
    client
        .post(endpoint)
        .multipart(form)
        .send()
        .map_err(|e| IntakeError::Transport(e.to_string()))?
        .error_for_status()
        .map_err(|e| IntakeError::Transport(e.to_string()))?
        .json()
        .map_err(|e| IntakeError::Transport(e.to_string()))
}

fn validate_payload_path(path: &str) -> Result<(), IntakeError> {
    if path.starts_with('/') || path.contains("..") || path.contains('\\') {
        return Err(IntakeError::Privacy(format!("unsafe payload path: {path}")));
    }
    Ok(())
}

fn validate_payload_role(role: &str) -> Result<(), IntakeError> {
    if role_registry().contains(role) {
        Ok(())
    } else {
        Err(IntakeError::InvalidManifest(format!(
            "unknown role prefix: {role}"
        )))
    }
}

fn validate_product_payload(product: &Product, path: &str) -> Result<(), IntakeError> {
    if product == &Product::RoboticsStudioOpen && is_raw_robotics_media(path) {
        return Err(IntakeError::Privacy(format!(
            "robotics intake must reference raw media externally, not embed it: {path}"
        )));
    }
    Ok(())
}

fn is_raw_robotics_media(path: &str) -> bool {
    let path = path.to_ascii_lowercase();
    [".mp4", ".mov", ".mkv", ".avi", ".bag", ".db3", ".sqlite3"]
        .iter()
        .any(|extension| path.ends_with(extension))
}

pub fn role_registry() -> BTreeSet<&'static str> {
    [
        "rubric_definition",
        "rubric_criterion",
        "rubric_sample",
        "rubric_calibration_set",
        "rubric_judge_card",
        "rubric_eval_run_manifest",
        "robotics_reviewed_subset_manifest",
        "robotics_episode_reference",
        "robotics_failure_cluster",
        "robotics_intervention_note",
        "robotics_embodiment_card",
        "robotics_sensor_qa_report",
        "agent_mcp_server_metadata",
        "agent_trace_card",
        "agent_regression_test_suite",
        "agent_otel_spans",
    ]
    .into_iter()
    .collect()
}

pub fn intake_schema_json() -> serde_json::Value {
    serde_json::json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": INTAKE_SCHEMA_URL,
        "type": "object",
        "required": ["$schema", "manifest_version", "product", "product_version", "platform_version", "created_at", "project_id", "creator", "intent", "redaction", "consent", "payload_manifest", "provenance", "transport"],
        "properties": {
            "$schema": { "const": INTAKE_SCHEMA_URL },
            "product": { "enum": ["rubric-studio-open", "robotics-studio-open", "agent-studio-open"] },
            "transport": { "properties": { "destination": { "const": DEFAULT_DESTINATION } } }
        }
    })
}

fn reject_forbidden_bytes(bytes: &[u8]) -> Result<(), IntakeError> {
    let text = String::from_utf8_lossy(bytes);
    let forbidden = [
        "sk-",
        "AKIA",
        "AIza",
        "/Users/",
        "/home/",
        "\\Users\\",
        "-----BEGIN",
        ".local",
        ".internal",
    ];
    if forbidden.iter().any(|needle| text.contains(needle)) {
        return Err(IntakeError::Privacy(
            "payload contains a forbidden secret, path, or key marker".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::OsRng;

    fn provenance() -> Provenance {
        Provenance {
            engine_libs: BTreeMap::from([("rubric-spec".into(), "0.5.3".into())]),
            os: "darwin".into(),
            os_version: "14.4".into(),
            app_install_id_hash: "a".repeat(64),
        }
    }

    #[test]
    fn writes_valid_packet_with_manifest_and_signature() {
        let dir = tempfile::tempdir().unwrap();
        let key = SigningKey::generate(&mut OsRng);
        let builder = IntakePacketBuilder::new(
            Product::RubricStudioOpen,
            "0.1.0",
            "0.1.0",
            Creator {
                display_name: "Reviewer".into(),
                email: None,
            },
            "Please review this rubric",
            provenance(),
        )
        .add_payload(
            "rubric.toml",
            "rubric_definition",
            b"title = \"Safety\"".to_vec(),
        );
        let manifest = builder
            .write_packet(dir.path().join("test.auraonepkg"), &key)
            .unwrap();
        assert_eq!(manifest.payload_manifest[0].role, "rubric_definition");
        assert!(dir.path().join("test.auraonepkg").exists());
        let validated = validate_packet_path(
            dir.path().join("test.auraonepkg"),
            Some(&key.verifying_key()),
        )
        .unwrap();
        assert_eq!(validated.project_id, manifest.project_id);
    }

    #[test]
    fn rejects_api_keys_and_paths() {
        let builder = IntakePacketBuilder::new(
            Product::RubricStudioOpen,
            "0.1.0",
            "0.1.0",
            Creator {
                display_name: "Reviewer".into(),
                email: None,
            },
            "Please review this rubric",
            provenance(),
        )
        .add_payload(
            "rubric.toml",
            "rubric_definition",
            b"sk-abcdefghijklmnopqrstuvwxyz".to_vec(),
        );
        assert!(builder.build_preview().is_err());
    }

    #[test]
    fn rejects_privacy_markers_and_raw_robotics_media() {
        let cases = [
            (
                "payload.txt",
                "rubric_definition",
                b"/Users/alice/project".to_vec(),
            ),
            (
                "payload.txt",
                "rubric_definition",
                b"builder.internal".to_vec(),
            ),
            (
                "payload.txt",
                "rubric_definition",
                [b"-----BEGIN ".as_slice(), b"PRIVATE KEY-----".as_slice()].concat(),
            ),
        ];

        for (path, role, bytes) in cases {
            let builder = IntakePacketBuilder::new(
                Product::RubricStudioOpen,
                "0.1.0",
                "0.1.0",
                Creator {
                    display_name: "Reviewer".into(),
                    email: None,
                },
                "Please review this rubric",
                provenance(),
            )
            .add_payload(path, role, bytes);
            assert!(matches!(
                builder.build_preview(),
                Err(IntakeError::Privacy(_))
            ));
        }

        let builder = IntakePacketBuilder::new(
            Product::RoboticsStudioOpen,
            "0.1.0",
            "0.1.0",
            Creator {
                display_name: "Reviewer".into(),
                email: None,
            },
            "Please review this robotics sample",
            provenance(),
        )
        .add_payload(
            "front-camera.mp4",
            "robotics_episode_reference",
            b"raw video bytes".to_vec(),
        );
        assert!(matches!(
            builder.build_preview(),
            Err(IntakeError::Privacy(_))
        ));
    }

    #[test]
    fn role_registry_covers_robotics_v11_and_agent_v12_roles() {
        let roles = role_registry();
        assert!(roles.contains("robotics_reviewed_subset_manifest"));
        assert!(roles.contains("robotics_sensor_qa_report"));
        assert!(roles.contains("agent_otel_spans"));
        assert!(validate_payload_role("robotics_reviewed_subset_manifest").is_ok());
        assert!(validate_payload_role("robotics_episode_reference").is_ok());
        assert!(validate_payload_role("unknown_agent_payload").is_err());
    }

    #[test]
    fn cloud_import_client_uses_transport_contract() {
        struct MockTransport;
        impl IntakeTransport for MockTransport {
            fn upload(
                &self,
                packet: Vec<u8>,
                install_id_hash: &str,
                product: Product,
            ) -> Result<IntakeUploadResponse, IntakeError> {
                assert_eq!(packet, vec![1, 2, 3]);
                assert_eq!(install_id_hash.len(), 64);
                assert_eq!(product, Product::RubricStudioOpen);
                Ok(IntakeUploadResponse {
                    packet_id: Uuid::new_v4(),
                    received_at: Utc::now(),
                    cloud_url: "https://auraone.ai/cloud/projects/packet?source=open".into(),
                    import_status: "queued".into(),
                    next_step: "Open this URL to sign in and complete your hand-off.".into(),
                })
            }
        }

        let response = CloudImportClient::new(MockTransport)
            .send(vec![1, 2, 3], &"a".repeat(64), Product::RubricStudioOpen)
            .unwrap();
        assert_eq!(response.import_status, "queued");
    }
}
