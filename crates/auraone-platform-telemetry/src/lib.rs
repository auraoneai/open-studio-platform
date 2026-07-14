use chrono::{DateTime, Utc};
use regex::Regex;
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, VecDeque};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, TelemetryError>;

pub const TELEMETRY_SCHEMA_URL: &str = "https://schemas.auraone.ai/open-studio/telemetry/v1.json";
pub const DEFAULT_TELEMETRY_ENDPOINT: &str = "https://o.auraone.ai/v1/events";

#[derive(Debug, thiserror::Error)]
pub enum TelemetryError {
    #[error("telemetry schema validation failed: {0}")]
    Validation(String),
    #[error("telemetry transport failed: {0}")]
    Transport(String),
    #[error("serialization failed: {0}")]
    Serde(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Flagship {
    RubricStudioOpen,
    RoboticsStudioOpen,
    AgentStudioOpen,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Channel {
    Stable,
    Beta,
    Nightly,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Os {
    Darwin,
    Windows,
    Linux,
}

#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Arch {
    X86_64,
    Aarch64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppContext {
    pub flagship: Flagship,
    pub version: Version,
    pub channel: Channel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceContext {
    pub install_id: Uuid,
    pub os: Os,
    pub os_version: String,
    pub arch: Arch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    #[serde(rename = "$schema")]
    pub schema: String,
    pub event_id: Uuid,
    pub event_name: String,
    pub event_version: u32,
    pub app: AppContext,
    pub device: DeviceContext,
    pub session_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub payload: Value,
}

impl TelemetryEvent {
    pub fn new(
        event_name: impl Into<String>,
        app: AppContext,
        device: DeviceContext,
        session_id: Uuid,
        payload: Value,
    ) -> Self {
        Self {
            schema: TELEMETRY_SCHEMA_URL.to_string(),
            event_id: Uuid::new_v4(),
            event_name: event_name.into(),
            event_version: 1,
            app,
            device,
            session_id,
            timestamp: Utc::now(),
            payload,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDefinition {
    pub name: String,
    pub description: String,
    pub owner: String,
    pub since: Version,
    pub allowed_payload_keys: Vec<String>,
}

pub fn event_registry() -> BTreeMap<String, EventDefinition> {
    [
        EventDefinition {
            name: "app_launched".to_string(),
            description: "The app started.".to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec![],
        },
        EventDefinition {
            name: "welcome_wizard_completed".to_string(),
            description: "The user finished the welcome wizard and chose privacy opt-ins."
                .to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["telemetry_opt_in".to_string(), "crash_opt_in".to_string()],
        },
        EventDefinition {
            name: "update_check_performed".to_string(),
            description: "The app checked for an update.".to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["channel".to_string(), "result".to_string()],
        },
        EventDefinition {
            name: "update_applied".to_string(),
            description: "The app updated to a new version.".to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["from_version".to_string(), "to_version".to_string()],
        },
        EventDefinition {
            name: "feature_used".to_string(),
            description: "A registered feature was used.".to_string(),
            owner: "per-flagship".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["feature_id".to_string()],
        },
        EventDefinition {
            name: "error_encountered".to_string(),
            description: "A non-crash error was encountered by category only.".to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["category".to_string()],
        },
        EventDefinition {
            name: "session_ended".to_string(),
            description: "A session ended.".to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["duration_seconds".to_string()],
        },
        EventDefinition {
            name: "intake_packet_exported".to_string(),
            description: "An intake packet was created and separately uploaded.".to_string(),
            owner: "platform".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["product".to_string(), "file_count".to_string()],
        },
        EventDefinition {
            name: "robotics_dataset_opened".to_string(),
            description: "Robotics Studio Open opened a dataset format.".to_string(),
            owner: "robotics-studio-open".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["format".to_string(), "episode_bucket".to_string()],
        },
        EventDefinition {
            name: "robotics_feature_used".to_string(),
            description: "A Robotics Studio Open feature was used.".to_string(),
            owner: "robotics-studio-open".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["feature_id".to_string()],
        },
        EventDefinition {
            name: "robotics_export_completed".to_string(),
            description: "Robotics Studio Open completed an export.".to_string(),
            owner: "robotics-studio-open".to_string(),
            since: Version::new(0, 1, 0),
            allowed_payload_keys: vec!["target".to_string(), "payload_role_count".to_string()],
        },
        EventDefinition {
            name: "agent_protocol_surface_used".to_string(),
            description: "Agent Studio Open used a protocol surface.".to_string(),
            owner: "agent-studio-open".to_string(),
            since: Version::new(0, 3, 0),
            allowed_payload_keys: vec!["surface".to_string()],
        },
    ]
    .into_iter()
    .map(|definition| (definition.name.clone(), definition))
    .collect()
}

pub fn schema_json() -> Value {
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": TELEMETRY_SCHEMA_URL,
        "type": "object",
        "required": ["$schema", "event_id", "event_name", "event_version", "app", "device", "session_id", "timestamp", "payload"],
        "properties": {
            "$schema": { "const": TELEMETRY_SCHEMA_URL },
            "event_name": { "pattern": "^[a-z][a-z0-9_]*$" },
            "app": {
                "properties": {
                    "flagship": { "enum": ["rubric-studio-open", "robotics-studio-open", "agent-studio-open"] },
                    "channel": { "enum": ["stable", "beta", "nightly"] }
                }
            },
            "device": {
                "properties": {
                    "os": { "enum": ["darwin", "windows", "linux"] },
                    "arch": { "enum": ["x86_64", "aarch64"] }
                }
            }
        }
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrubReport {
    pub event: TelemetryEvent,
    pub redacted_fields: Vec<String>,
}

pub fn scrub_forbidden_fields(event: &TelemetryEvent) -> Result<ScrubReport> {
    let mut event = event.clone();
    let mut redacted = Vec::new();
    scrub_value(&mut event.payload, "$.payload", &mut redacted);
    Ok(ScrubReport {
        event,
        redacted_fields: redacted,
    })
}

pub fn validate_event(event: &TelemetryEvent) -> Result<()> {
    if event.schema != TELEMETRY_SCHEMA_URL {
        return Err(TelemetryError::Validation(
            "unexpected telemetry schema URL".to_string(),
        ));
    }
    let snake = Regex::new(r"^[a-z][a-z0-9_]*$").unwrap();
    if !snake.is_match(&event.event_name) {
        return Err(TelemetryError::Validation(
            "event_name must be snake_case".to_string(),
        ));
    }
    let registry = event_registry();
    let Some(definition) = registry.get(&event.event_name) else {
        return Err(TelemetryError::Validation(format!(
            "event `{}` is not registered",
            event.event_name
        )));
    };
    let payload = event
        .payload
        .as_object()
        .ok_or_else(|| TelemetryError::Validation("payload must be an object".to_string()))?;
    for key in payload.keys() {
        if !definition.allowed_payload_keys.contains(key) {
            return Err(TelemetryError::Validation(format!(
                "payload key `{key}` is not registered for `{}`",
                event.event_name
            )));
        }
    }
    reject_forbidden_value(&event.payload)?;
    Ok(())
}

fn scrub_value(value: &mut Value, path: &str, redacted: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            let keys = map.keys().cloned().collect::<Vec<_>>();
            for key in keys {
                let child_path = format!("{path}.{key}");
                if forbidden_key(&key) {
                    map.insert(key, Value::String("<REDACTED>".to_string()));
                    redacted.push(child_path);
                } else if let Some(child) = map.get_mut(&key) {
                    scrub_value(child, &child_path, redacted);
                }
            }
        }
        Value::Array(items) => {
            for (idx, child) in items.iter_mut().enumerate() {
                scrub_value(child, &format!("{path}[{idx}]"), redacted);
            }
        }
        Value::String(text) if forbidden_text(text) => {
            *value = Value::String("<REDACTED>".to_string());
            redacted.push(path.to_string());
        }
        _ => {}
    }
}

fn reject_forbidden_value(value: &Value) -> Result<()> {
    match value {
        Value::Object(map) => {
            for (key, value) in map {
                if forbidden_key(key) {
                    return Err(TelemetryError::Validation(format!(
                        "forbidden telemetry key `{key}`"
                    )));
                }
                reject_forbidden_value(value)?;
            }
        }
        Value::Array(items) => {
            for item in items {
                reject_forbidden_value(item)?;
            }
        }
        Value::String(text) if forbidden_text(text) => {
            return Err(TelemetryError::Validation(
                "forbidden telemetry string value".to_string(),
            ));
        }
        _ => {}
    }
    Ok(())
}

fn forbidden_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    matches!(
        key.as_str(),
        "content"
            | "text"
            | "prompt"
            | "response"
            | "path"
            | "file_path"
            | "hostname"
            | "ip"
            | "email"
            | "display_name"
            | "api_key"
            | "token"
            | "secret"
            | "tool_arguments"
            | "server_name"
            | "trace"
    )
}

fn forbidden_text(text: &str) -> bool {
    if text.contains('/') || text.contains('\\') {
        return true;
    }
    Regex::new(r"(?i)(sk-(proj-)?[a-z0-9_-]{12,}|anthropic-[a-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,})")
        .unwrap()
        .is_match(text)
        || Regex::new(r"(?i)\b([a-z0-9-]+\.)+[a-z]{2,}\b").unwrap().is_match(text)
}

pub trait TelemetryTransport: Send + Sync {
    fn send_batch(&self, events: &[TelemetryEvent]) -> Result<()>;
}

#[derive(Clone)]
pub struct HttpTelemetryTransport {
    endpoint: String,
    client: reqwest::blocking::Client,
}

impl HttpTelemetryTransport {
    pub fn new(endpoint: impl Into<String>) -> Result<Self> {
        Ok(Self {
            endpoint: endpoint.into(),
            client: reqwest::blocking::Client::builder()
                .build()
                .map_err(|error| TelemetryError::Transport(error.to_string()))?,
        })
    }
}

impl TelemetryTransport for HttpTelemetryTransport {
    fn send_batch(&self, events: &[TelemetryEvent]) -> Result<()> {
        self.client
            .post(&self.endpoint)
            .json(&json!({ "events": events }))
            .send()
            .map_err(|error| TelemetryError::Transport(error.to_string()))?
            .error_for_status()
            .map_err(|error| TelemetryError::Transport(error.to_string()))?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventLogEntry {
    pub event: TelemetryEvent,
    pub sent: bool,
    pub redacted_fields: Vec<String>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct EventLog {
    entries: Vec<EventLogEntry>,
}

impl EventLog {
    pub fn entries(&self) -> &[EventLogEntry] {
        &self.entries
    }

    pub fn export_json(&self) -> Result<String> {
        Ok(serde_json::to_string_pretty(&self.entries)?)
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

pub struct TelemetryClient<T: TelemetryTransport> {
    enabled: bool,
    transport: T,
    log: EventLog,
    queue: VecDeque<TelemetryEvent>,
    max_batch_size: usize,
}

impl<T: TelemetryTransport> TelemetryClient<T> {
    pub fn new_default_off(transport: T) -> Self {
        Self {
            enabled: false,
            transport,
            log: EventLog::default(),
            queue: VecDeque::new(),
            max_batch_size: 100,
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.queue.clear();
            self.log.clear();
        }
    }

    pub fn record(&mut self, event: TelemetryEvent) -> Result<()> {
        let scrubbed = scrub_forbidden_fields(&event)?;
        validate_event(&scrubbed.event)?;
        self.log.entries.push(EventLogEntry {
            event: scrubbed.event.clone(),
            sent: false,
            redacted_fields: scrubbed.redacted_fields.clone(),
        });
        if self.enabled {
            self.queue.push_back(scrubbed.event);
            if self.queue.len() >= self.max_batch_size {
                self.flush();
            }
        }
        Ok(())
    }

    pub fn flush(&mut self) {
        if !self.enabled || self.queue.is_empty() {
            return;
        }
        let events = self.queue.drain(..).collect::<Vec<_>>();
        if self.transport.send_batch(&events).is_ok() {
            for log_entry in &mut self.log.entries {
                if events
                    .iter()
                    .any(|event| event.event_id == log_entry.event.event_id)
                {
                    log_entry.sent = true;
                }
            }
        }
    }

    pub fn event_log(&self) -> &EventLog {
        &self.log
    }
}

#[derive(Clone, Default)]
pub struct MemoryTransport {
    sent: Arc<Mutex<Vec<TelemetryEvent>>>,
}

impl MemoryTransport {
    pub fn sent(&self) -> Vec<TelemetryEvent> {
        self.sent
            .lock()
            .expect("telemetry transport poisoned")
            .clone()
    }
}

impl TelemetryTransport for MemoryTransport {
    fn send_batch(&self, events: &[TelemetryEvent]) -> Result<()> {
        self.sent
            .lock()
            .expect("telemetry transport poisoned")
            .extend_from_slice(events);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app() -> AppContext {
        AppContext {
            flagship: Flagship::RubricStudioOpen,
            version: Version::parse("0.1.0").unwrap(),
            channel: Channel::Stable,
        }
    }

    fn device() -> DeviceContext {
        DeviceContext {
            install_id: Uuid::new_v4(),
            os: Os::Darwin,
            os_version: "14.4".to_string(),
            arch: Arch::Aarch64,
        }
    }

    #[test]
    fn default_off_records_visible_log_but_does_not_send() {
        let transport = MemoryTransport::default();
        let mut client = TelemetryClient::new_default_off(transport.clone());
        let event = TelemetryEvent::new("app_launched", app(), device(), Uuid::new_v4(), json!({}));

        client.record(event).unwrap();
        client.flush();

        assert!(!client.is_enabled());
        assert_eq!(client.event_log().entries().len(), 1);
        assert_eq!(transport.sent().len(), 0);
    }

    #[test]
    fn enabled_client_sends_and_marks_event_log() {
        let transport = MemoryTransport::default();
        let mut client = TelemetryClient::new_default_off(transport.clone());
        client.set_enabled(true);

        let event = TelemetryEvent::new(
            "feature_used",
            app(),
            device(),
            Uuid::new_v4(),
            json!({ "feature_id": "rubric_tree_opened" }),
        );
        client.record(event).unwrap();
        client.flush();

        assert_eq!(transport.sent().len(), 1);
        assert!(client.event_log().entries()[0].sent);
    }

    #[test]
    fn forbidden_fields_are_scrubbed_before_validation() {
        let transport = MemoryTransport::default();
        let mut client = TelemetryClient::new_default_off(transport);
        let event = TelemetryEvent::new(
            "feature_used",
            app(),
            device(),
            Uuid::new_v4(),
            json!({
                "feature_id": "rubric_tree_opened",
                "prompt": "sk-proj-secretsecretsecret"
            }),
        );

        assert!(client.record(event).is_err());

        let event = TelemetryEvent::new(
            "error_encountered",
            app(),
            device(),
            Uuid::new_v4(),
            json!({ "category": "validation_error" }),
        );
        client.record(event).unwrap();
        assert_eq!(client.event_log().entries().len(), 1);
    }

    #[test]
    fn disabling_clears_queue_and_visible_log() {
        let transport = MemoryTransport::default();
        let mut client = TelemetryClient::new_default_off(transport);
        client
            .record(TelemetryEvent::new(
                "app_launched",
                app(),
                device(),
                Uuid::new_v4(),
                json!({}),
            ))
            .unwrap();
        client.set_enabled(false);
        assert!(client.event_log().entries().is_empty());
    }
}
