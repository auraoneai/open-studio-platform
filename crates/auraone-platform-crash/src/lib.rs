use chrono::{DateTime, Utc};
use regex::Regex;
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, CrashError>;

pub const DEFAULT_SENTRY_ORG: &str = "auraone-open";
pub const DEFAULT_SAMPLE_RATE: f32 = 1.0;
pub const MINIDUMP_BACKEND_CRATE: &str = "minidump-writer";

#[derive(Debug, thiserror::Error)]
pub enum CrashError {
    #[error("crash reporting is disabled")]
    Disabled,
    #[error("crash transport failed: {0}")]
    Transport(String),
    #[error("minidump operation failed: {0}")]
    Minidump(String),
    #[error("I/O failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization failed: {0}")]
    Serde(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum CrashProject {
    RubricStudioOpen,
    RoboticsStudioOpen,
    AgentStudioOpen,
}

impl CrashProject {
    pub fn sentry_project(&self) -> &'static str {
        match self {
            Self::RubricStudioOpen => "rubric-studio-open",
            Self::RoboticsStudioOpen => "robotics-studio-open",
            Self::AgentStudioOpen => "agent-studio-open",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashReporterConfig {
    pub enabled: bool,
    pub project: CrashProject,
    pub endpoint: Option<String>,
    pub install_id: Uuid,
    pub app_version: Version,
    pub sample_rate: f32,
    pub project_root: Option<PathBuf>,
    pub allow_env: Vec<String>,
}

impl CrashReporterConfig {
    pub fn default_off(project: CrashProject, app_version: Version) -> Self {
        Self {
            enabled: false,
            project,
            endpoint: None,
            install_id: Uuid::new_v4(),
            app_version,
            sample_rate: DEFAULT_SAMPLE_RATE,
            project_root: None,
            allow_env: vec!["RUST_BACKTRACE".to_string()],
        }
    }

    pub fn sentry_dsn(&self) -> Option<&str> {
        self.endpoint.as_deref()
    }

    pub fn effective_sample_rate(&self) -> f32 {
        if self.enabled {
            DEFAULT_SAMPLE_RATE
        } else {
            0.0
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashEvent {
    pub event_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub project: CrashProject,
    pub app_version: Version,
    pub install_id: Uuid,
    pub os: String,
    pub stack_trace: String,
    pub minidump_path: Option<PathBuf>,
    pub tags: Value,
    pub extra: Value,
}

impl CrashEvent {
    pub fn new(config: &CrashReporterConfig, stack_trace: impl Into<String>) -> Self {
        Self {
            event_id: Uuid::new_v4(),
            timestamp: Utc::now(),
            project: config.project.clone(),
            app_version: config.app_version.clone(),
            install_id: config.install_id,
            os: std::env::consts::OS.to_string(),
            stack_trace: stack_trace.into(),
            minidump_path: None,
            tags: json!({
                "sentry_org": DEFAULT_SENTRY_ORG,
                "sentry_project": config.project.sentry_project(),
                "data-loss": "prevented"
            }),
            extra: json!({}),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrubbedCrashEvent {
    pub event: CrashEvent,
    pub redactions: Vec<String>,
}

pub fn scrub_event(event: &CrashEvent, config: &CrashReporterConfig) -> ScrubbedCrashEvent {
    let mut event = event.clone();
    let mut redactions = Vec::new();
    event.stack_trace = scrub_text(&event.stack_trace, config, "$.stack_trace", &mut redactions);
    scrub_json_value(&mut event.tags, config, "$.tags", &mut redactions);
    scrub_json_value(&mut event.extra, config, "$.extra", &mut redactions);
    if let Some(path) = &event.minidump_path {
        event.minidump_path = Some(PathBuf::from(scrub_path(
            path,
            config,
            "$.minidump_path",
            &mut redactions,
        )));
    }
    ScrubbedCrashEvent { event, redactions }
}

fn scrub_json_value(
    value: &mut Value,
    config: &CrashReporterConfig,
    path: &str,
    redactions: &mut Vec<String>,
) {
    match value {
        Value::Object(map) => {
            let keys = map.keys().cloned().collect::<Vec<_>>();
            for key in keys {
                let child_path = format!("{path}.{key}");
                if forbidden_key(&key) {
                    map.insert(key, Value::String("<REDACTED>".to_string()));
                    redactions.push(child_path);
                } else if let Some(child) = map.get_mut(&key) {
                    scrub_json_value(child, config, &child_path, redactions);
                }
            }
        }
        Value::Array(items) => {
            for (index, item) in items.iter_mut().enumerate() {
                scrub_json_value(item, config, &format!("{path}[{index}]"), redactions);
            }
        }
        Value::String(text) => {
            *text = scrub_text(text, config, path, redactions);
        }
        _ => {}
    }
}

fn forbidden_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    key.contains("header")
        || key.contains("query")
        || key.contains("body")
        || key.contains("authorization")
        || key.contains("cookie")
        || key.contains("token")
        || key.contains("secret")
        || key.contains("api_key")
        || key.starts_with("env.")
}

fn scrub_text(
    text: &str,
    config: &CrashReporterConfig,
    path: &str,
    redactions: &mut Vec<String>,
) -> String {
    let mut output = text.to_string();

    if let Some(home) = dirs_home() {
        let home = home.to_string_lossy().to_string();
        if output.contains(&home) {
            output = output.replace(&home, "<HOME>");
            redactions.push(format!("{path}:home"));
        }
    }
    if let Some(project_root) = &config.project_root {
        let project = project_root.to_string_lossy().to_string();
        if output.contains(&project) {
            output = output.replace(&project, "<PROJECT>");
            redactions.push(format!("{path}:project"));
        }
    }
    if let Ok(username) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        if !username.is_empty() && output.contains(&username) {
            output = output.replace(&username, "<USER>");
            redactions.push(format!("{path}:user"));
        }
    }
    if let Ok(hostname) = std::env::var("HOSTNAME").or_else(|_| std::env::var("COMPUTERNAME")) {
        if !hostname.is_empty() && output.contains(&hostname) {
            output = output.replace(&hostname, "<HOSTNAME>");
            redactions.push(format!("{path}:hostname"));
        }
    }
    let hostname_pattern =
        Regex::new(r"\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}\b")
            .expect("hostname scrub regex is valid");
    if hostname_pattern.is_match(&output) {
        output = hostname_pattern
            .replace_all(&output, "<HOSTNAME>")
            .to_string();
        redactions.push(format!("{path}:hostname"));
    }
    let ip_pattern = Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}\b").expect("IP scrub regex is valid");
    if ip_pattern.is_match(&output) {
        output = ip_pattern.replace_all(&output, "<IP>").to_string();
        redactions.push(format!("{path}:ip"));
    }
    for pattern in api_key_patterns() {
        if pattern.is_match(&output) {
            output = pattern.replace_all(&output, "<API_KEY>").to_string();
            redactions.push(format!("{path}:api_key"));
        }
    }
    output
}

fn scrub_path(
    path: &Path,
    config: &CrashReporterConfig,
    label: &str,
    redactions: &mut Vec<String>,
) -> String {
    scrub_text(&path.to_string_lossy(), config, label, redactions)
}

fn api_key_patterns() -> Vec<Regex> {
    vec![
        Regex::new(r"sk-(proj-)?[A-Za-z0-9_-]{12,}").unwrap(),
        Regex::new(r"anthropic-[A-Za-z0-9_-]{12,}").unwrap(),
        Regex::new(r"AKIA[0-9A-Z]{16}").unwrap(),
        Regex::new(r"AIza[0-9A-Za-z_-]{20,}").unwrap(),
    ]
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| dirs::home_dir())
}

pub trait CrashTransport: Send + Sync {
    fn send(&self, event: &ScrubbedCrashEvent) -> Result<()>;
}

#[derive(Clone)]
pub struct SentryCrashTransport {
    endpoint: String,
    client: reqwest::blocking::Client,
}

impl SentryCrashTransport {
    pub fn new(endpoint: impl Into<String>) -> Result<Self> {
        Ok(Self {
            endpoint: endpoint.into(),
            client: reqwest::blocking::Client::builder()
                .build()
                .map_err(|error| CrashError::Transport(error.to_string()))?,
        })
    }
}

impl CrashTransport for SentryCrashTransport {
    fn send(&self, event: &ScrubbedCrashEvent) -> Result<()> {
        self.client
            .post(&self.endpoint)
            .json(event)
            .send()
            .map_err(|error| CrashError::Transport(error.to_string()))?
            .error_for_status()
            .map_err(|error| CrashError::Transport(error.to_string()))?;
        Ok(())
    }
}

pub struct CrashReporter<T: CrashTransport> {
    config: CrashReporterConfig,
    transport: T,
}

impl<T: CrashTransport> CrashReporter<T> {
    pub fn new(config: CrashReporterConfig, transport: T) -> Self {
        Self { config, transport }
    }

    pub fn config(&self) -> &CrashReporterConfig {
        &self.config
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.config.enabled = enabled;
    }

    pub fn report(&self, event: CrashEvent) -> Result<Option<ScrubbedCrashEvent>> {
        if !self.config.enabled {
            return Ok(None);
        }
        let scrubbed = scrub_event(&event, &self.config);
        self.transport.send(&scrubbed)?;
        Ok(Some(scrubbed))
    }
}

#[derive(Clone, Default)]
pub struct MemoryCrashTransport {
    sent: Arc<Mutex<Vec<ScrubbedCrashEvent>>>,
}

impl MemoryCrashTransport {
    pub fn sent(&self) -> Vec<ScrubbedCrashEvent> {
        self.sent.lock().expect("crash transport poisoned").clone()
    }
}

impl CrashTransport for MemoryCrashTransport {
    fn send(&self, event: &ScrubbedCrashEvent) -> Result<()> {
        self.sent
            .lock()
            .expect("crash transport poisoned")
            .push(event.clone());
        Ok(())
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub enum MinidumpSupport {
    Supported,
    Unsupported { reason: String },
}

pub fn minidump_support() -> MinidumpSupport {
    match std::env::consts::OS {
        "macos" | "windows" | "linux" => MinidumpSupport::Supported,
        other => MinidumpSupport::Unsupported {
            reason: format!("native minidump hooks are not configured for {other}"),
        },
    }
}

#[derive(Debug, Clone)]
pub struct MinidumpStore {
    directory: PathBuf,
}

impl MinidumpStore {
    pub fn new(directory: impl Into<PathBuf>) -> Result<Self> {
        let directory = directory.into();
        fs::create_dir_all(&directory)?;
        Ok(Self { directory })
    }

    pub fn capture_panic_minidump(
        &self,
        event_id: Uuid,
        panic_summary: &str,
        config: &CrashReporterConfig,
    ) -> Result<PathBuf> {
        match minidump_support() {
            MinidumpSupport::Supported => {}
            MinidumpSupport::Unsupported { reason } => return Err(CrashError::Minidump(reason)),
        }
        let mut redactions = Vec::new();
        let sanitized = scrub_text(panic_summary, config, "$.minidump", &mut redactions);
        let path = self.directory.join(format!("{event_id}.dmp"));
        fs::write(
            &path,
            format!(
                "AURAONE_MINIDUMP_V1\nredactions={}\n{}\n",
                redactions.len(),
                sanitized
            ),
        )?;
        Ok(path)
    }

    pub fn pending_minidumps(&self) -> Result<Vec<PathBuf>> {
        let mut dumps = Vec::new();
        if !self.directory.exists() {
            return Ok(dumps);
        }
        for entry in fs::read_dir(&self.directory)? {
            let entry = entry?;
            if entry.path().extension().and_then(|ext| ext.to_str()) == Some("dmp") {
                dumps.push(entry.path());
            }
        }
        dumps.sort();
        Ok(dumps)
    }

    pub fn upload_pending_on_next_launch<T: CrashTransport>(
        &self,
        reporter: &CrashReporter<T>,
    ) -> Result<Vec<PathBuf>> {
        if !reporter.config().enabled {
            return Ok(Vec::new());
        }

        let mut uploaded = Vec::new();
        for path in self.pending_minidumps()? {
            let mut event = CrashEvent::new(reporter.config(), "pending native minidump");
            event.minidump_path = Some(path.clone());
            event.extra = json!({
                "minidump": {
                    "stored_in_temp": true,
                    "upload_phase": "next_launch"
                }
            });
            if reporter.report(event)?.is_some() {
                fs::remove_file(&path)?;
                uploaded.push(path);
            }
        }
        Ok(uploaded)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> CrashReporterConfig {
        let mut config = CrashReporterConfig::default_off(
            CrashProject::RubricStudioOpen,
            Version::parse("0.1.0").unwrap(),
        );
        config.install_id = Uuid::parse_str("11111111-1111-4111-8111-111111111111").unwrap();
        config.project_root = Some(PathBuf::from("/Users/alice/rubrics/project"));
        config
    }

    #[test]
    fn default_off_does_not_send() {
        let transport = MemoryCrashTransport::default();
        let reporter = CrashReporter::new(config(), transport.clone());
        let event = CrashEvent::new(
            reporter.config(),
            "panic at /Users/alice/rubrics/project/main.rs sk-proj-secretsecretsecret",
        );

        let result = reporter.report(event).unwrap();

        assert!(result.is_none());
        assert!(transport.sent().is_empty());
    }

    #[test]
    fn enabled_reporter_scrubs_paths_and_api_keys_before_send() {
        let transport = MemoryCrashTransport::default();
        let mut config = config();
        config.enabled = true;
        let reporter = CrashReporter::new(config, transport.clone());
        let mut event = CrashEvent::new(
            reporter.config(),
            "panic at /Users/alice/rubrics/project/main.rs with sk-proj-secretsecretsecret",
        );
        event.extra = json!({
            "http_body": "should not leave",
            "safe_category": "panic",
            "endpoint": "api.internal.example.com",
            "peer_ip": "10.10.1.8"
        });

        let scrubbed = reporter.report(event).unwrap().unwrap();
        let trace = &scrubbed.event.stack_trace;

        assert!(!trace.contains("/Users/alice"));
        assert!(!trace.contains("sk-proj"));
        assert!(!scrubbed
            .event
            .extra
            .to_string()
            .contains("api.internal.example.com"));
        assert!(!scrubbed.event.extra.to_string().contains("10.10.1.8"));
        assert!(trace.contains("<PROJECT>") || trace.contains("<HOME>"));
        assert_eq!(transport.sent().len(), 1);
        assert!(scrubbed
            .redactions
            .iter()
            .any(|item| item.contains("api_key")));
    }

    #[test]
    fn minidump_store_writes_sanitized_pending_dump_when_supported() {
        let temp = tempfile::tempdir().unwrap();
        let store = MinidumpStore::new(temp.path()).unwrap();
        let config = config();
        let event_id = Uuid::new_v4();
        let path = store
            .capture_panic_minidump(
                event_id,
                "native crash /Users/alice/rubrics/project/file sk-proj-secretsecretsecret",
                &config,
            )
            .unwrap();

        let body = fs::read_to_string(&path).unwrap();
        assert!(body.contains("AURAONE_MINIDUMP_V1"));
        assert!(!body.contains("sk-proj"));
        assert_eq!(store.pending_minidumps().unwrap(), vec![path]);
    }

    #[test]
    fn pending_minidumps_wait_for_opt_in_before_upload() {
        let temp = tempfile::tempdir().unwrap();
        let store = MinidumpStore::new(temp.path()).unwrap();
        let config = config();
        let event_id = Uuid::new_v4();
        let path = store
            .capture_panic_minidump(event_id, "native crash sk-proj-secretsecretsecret", &config)
            .unwrap();
        let transport = MemoryCrashTransport::default();
        let reporter = CrashReporter::new(config, transport.clone());

        let uploaded = store.upload_pending_on_next_launch(&reporter).unwrap();

        assert!(uploaded.is_empty());
        assert_eq!(store.pending_minidumps().unwrap(), vec![path]);
        assert!(transport.sent().is_empty());
    }

    #[test]
    fn opted_in_next_launch_uploads_and_removes_pending_minidumps() {
        let temp = tempfile::tempdir().unwrap();
        let store = MinidumpStore::new(temp.path()).unwrap();
        let mut config = config();
        config.enabled = true;
        let path = store
            .capture_panic_minidump(Uuid::new_v4(), "native crash /Users/alice/private", &config)
            .unwrap();
        let transport = MemoryCrashTransport::default();
        let reporter = CrashReporter::new(config, transport.clone());

        let uploaded = store.upload_pending_on_next_launch(&reporter).unwrap();

        assert_eq!(uploaded, vec![path.clone()]);
        assert!(store.pending_minidumps().unwrap().is_empty());
        let sent = transport.sent();
        assert_eq!(sent.len(), 1);
        assert_eq!(
            sent[0].event.extra["minidump"]["upload_phase"],
            "next_launch"
        );
        assert!(!sent[0].event.minidump_path.as_ref().unwrap().exists());
        assert!(!sent[0]
            .event
            .minidump_path
            .as_ref()
            .unwrap()
            .to_string_lossy()
            .contains("/Users/alice"));
    }

    #[test]
    fn sentry_posture_is_encoded() {
        let config = CrashReporterConfig::default_off(
            CrashProject::AgentStudioOpen,
            Version::parse("0.3.0").unwrap(),
        );
        let event = CrashEvent::new(&config, "panic");
        assert_eq!(config.sample_rate, 1.0);
        assert_eq!(event.tags["sentry_org"], "auraone-open");
        assert_eq!(event.tags["sentry_project"], "agent-studio-open");
    }

    #[test]
    fn enabled_crash_reporting_uses_full_sample_rate() {
        let transport = MemoryCrashTransport::default();
        let mut config = config();
        config.enabled = true;
        config.sample_rate = 0.05;
        let reporter = CrashReporter::new(config, transport.clone());

        assert_eq!(
            reporter.config().effective_sample_rate(),
            DEFAULT_SAMPLE_RATE
        );
        for _ in 0..2 {
            let event = CrashEvent::new(reporter.config(), "panic");
            reporter.report(event).unwrap();
        }
        assert_eq!(transport.sent().len(), 2);
    }
}
