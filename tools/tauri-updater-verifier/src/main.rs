use base64::{engine::general_purpose::STANDARD, Engine};
use minisign_verify::{PublicKey, Signature};
use std::{env, fs, process};

fn main() {
    if let Err(error) = verify() {
        eprintln!("tauri-updater-verifier: {error}");
        process::exit(1);
    }
}

fn verify() -> Result<(), Box<dyn std::error::Error>> {
    let mut arguments = env::args().skip(1);
    let public_key = arguments
        .next()
        .ok_or("usage: tauri-updater-verifier <public-key-base64> <artifact> <signature>")?;
    let artifact = arguments
        .next()
        .ok_or("usage: tauri-updater-verifier <public-key-base64> <artifact> <signature>")?;
    let signature = arguments
        .next()
        .ok_or("usage: tauri-updater-verifier <public-key-base64> <artifact> <signature>")?;
    if arguments.next().is_some() {
        return Err("unexpected extra arguments".into());
    }

    verify_signature(
        &public_key,
        &fs::read(&artifact)?,
        fs::read_to_string(signature)?.trim(),
    )?;
    println!("Verified Tauri updater signature: {artifact}");
    Ok(())
}

fn verify_signature(
    public_key: &str,
    artifact: &[u8],
    signature: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let public_key_text = String::from_utf8(STANDARD.decode(public_key)?)?;
    let signature_text = String::from_utf8(STANDARD.decode(signature)?)?;
    let public_key = PublicKey::decode(&public_key_text)?;
    let signature = Signature::decode(&signature_text)?;
    public_key.verify(artifact, &signature, true)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::verify_signature;

    const PUBLIC_KEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEI3N0Q2OEQzQTRDM0M2RUIKUldUcnhzT2swMmg5dHh1ckdDcmpVa3ZJSmFhUXFNQi9PMGMvd2docTNLNDVjbU9VdmpXYk55UEMK";
    const SIGNATURE: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUcnhzT2swMmg5dHpKSXFUZmtpR0FqcEFlbVRCbWdMWG10YlF1RjlkZzZobmszdlBrSVBTcit4T0FYdk1zK3gxaGpGZ210U3E2enA1QlQ5V2tpdVNTMW5XU1Byd2tjSUFnPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzgzOTAxNjcyCWZpbGU6YXJ0aWZhY3QuYmluCk5ScWRSZlVKUXk2K2FueWl1YVd4SzhnRXV6Q1V6LzNOUGFRYXVYZU5JMGxSdFVXVHN1SDhubEM4aXJ0ZkxvYXRwSXgyWlZPUk8vdXNkaTlXTEFGRUN3PT0K";
    const ARTIFACT: &[u8] = b"AuraOne Tauri updater fixture\n";

    #[test]
    fn accepts_tauri_cli_signature_format() {
        verify_signature(PUBLIC_KEY, ARTIFACT, SIGNATURE).unwrap();
    }

    #[test]
    fn rejects_tampered_artifact() {
        assert!(verify_signature(PUBLIC_KEY, b"tampered\n", SIGNATURE).is_err());
    }
}
