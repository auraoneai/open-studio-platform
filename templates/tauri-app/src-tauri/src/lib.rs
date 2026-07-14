pub fn inherited_capabilities() -> &'static [&'static str] {
    &[
        "secure-csp",
        "keychain-api",
        "signed-update-manifest",
        "telemetry-event-log",
        "crash-reporting-opt-in",
        "auraonepkg-intake",
        "auraone-url-scheme",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_shared_trust_capabilities() {
        assert!(inherited_capabilities().contains(&"keychain-api"));
        assert!(inherited_capabilities().contains(&"auraonepkg-intake"));
    }
}
