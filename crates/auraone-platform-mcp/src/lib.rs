//! Model Context Protocol client contracts for stdio, HTTP, and SSE servers.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use thiserror::Error;
use url::Url;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum McpTransportKind {
    Stdio { command: String, args: Vec<String> },
    Http { endpoint: Url },
    Sse { endpoint: Url },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

impl JsonRpcRequest {
    pub fn new(id: u64, method: impl Into<String>, params: Option<Value>) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.into(),
            params,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Option<u64>,
    #[serde(default)]
    pub result: Option<Value>,
    #[serde(default)]
    pub error: Option<Value>,
}

#[derive(Debug, Error)]
pub enum McpError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("server returned invalid response: {0}")]
    InvalidResponse(String),
}

pub trait McpTransport {
    fn send(&mut self, request: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError>;
}

pub struct StdioMcpTransport {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl StdioMcpTransport {
    pub fn spawn(command: &str, args: &[String]) -> Result<Self, McpError> {
        let mut child = Command::new(command)
            .args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| McpError::InvalidResponse("missing child stdin".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| McpError::InvalidResponse("missing child stdout".to_string()))?;
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }
}

impl McpTransport for StdioMcpTransport {
    fn send(&mut self, request: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        let line = serde_json::to_string(request)?;
        self.stdin.write_all(line.as_bytes())?;
        self.stdin.write_all(b"\n")?;
        self.stdin.flush()?;

        let mut response = String::new();
        self.stdout.read_line(&mut response)?;
        Ok(serde_json::from_str(&response)?)
    }
}

impl Drop for StdioMcpTransport {
    fn drop(&mut self) {
        let _ = self.child.kill();
    }
}

pub struct HttpMcpTransport {
    endpoint: Url,
    client: reqwest::blocking::Client,
}

impl HttpMcpTransport {
    pub fn new(endpoint: Url) -> Self {
        Self {
            endpoint,
            client: reqwest::blocking::Client::new(),
        }
    }
}

impl McpTransport for HttpMcpTransport {
    fn send(&mut self, request: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        let response = self
            .client
            .post(self.endpoint.clone())
            .json(request)
            .send()?;
        Ok(response.error_for_status()?.json()?)
    }
}

pub struct SseMcpTransport {
    endpoint: Url,
    client: reqwest::blocking::Client,
}

impl SseMcpTransport {
    pub fn new(endpoint: Url) -> Self {
        Self {
            endpoint,
            client: reqwest::blocking::Client::new(),
        }
    }
}

impl McpTransport for SseMcpTransport {
    fn send(&mut self, request: &JsonRpcRequest) -> Result<JsonRpcResponse, McpError> {
        let response = self
            .client
            .post(self.endpoint.clone())
            .header(reqwest::header::ACCEPT, "text/event-stream")
            .json(request)
            .send()?
            .error_for_status()?;
        let content_type = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string();
        if !content_type.contains("text/event-stream") {
            return Err(McpError::InvalidResponse(format!(
                "expected text/event-stream, got {content_type}"
            )));
        }
        let body = response.text()?;
        let response_event = parse_sse_events(&body)
            .into_iter()
            .find(|event| matches!(event.event.as_deref(), None | Some("message" | "response")))
            .ok_or_else(|| McpError::InvalidResponse("missing SSE response event".to_string()))?;
        Ok(serde_json::from_str(&response_event.data)?)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseEvent {
    pub event: Option<String>,
    pub data: String,
}

pub fn parse_sse_events(input: &str) -> Vec<SseEvent> {
    let mut events = Vec::new();
    let mut event = None;
    let mut data = Vec::new();

    for line in input.lines() {
        if line.is_empty() {
            if !data.is_empty() {
                events.push(SseEvent {
                    event: event.take(),
                    data: data.join("\n"),
                });
                data.clear();
            }
            continue;
        }
        if let Some(value) = line.strip_prefix("event:") {
            event = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("data:") {
            data.push(value.trim_start().to_string());
        }
    }
    if !data.is_empty() {
        events.push(SseEvent {
            event,
            data: data.join("\n"),
        });
    }
    events
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    #[test]
    fn request_serializes_as_json_rpc() {
        let request = JsonRpcRequest::new(7, "tools/list", None);
        let encoded = serde_json::to_string(&request).unwrap();
        assert!(encoded.contains("\"jsonrpc\":\"2.0\""));
        assert!(encoded.contains("\"method\":\"tools/list\""));
    }

    #[test]
    fn parses_sse_messages() {
        let events = parse_sse_events("event: message\ndata: {\"ok\":true}\n\n");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event.as_deref(), Some("message"));
        assert_eq!(events[0].data, "{\"ok\":true}");
    }

    #[test]
    fn sse_transport_posts_request_and_reads_json_rpc_event() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 4096];
            let read = stream.read(&mut request).unwrap();
            let request_text = String::from_utf8_lossy(&request[..read]);
            assert!(request_text.starts_with("POST /mcp"));
            assert!(request_text.contains("text/event-stream"));
            assert!(request_text.contains("tools/list"));

            let event = json!({
                "jsonrpc": "2.0",
                "id": 42,
                "result": {"tools": []}
            });
            let body = format!("event: response\ndata: {event}\n\n");
            let response = format!(
                "HTTP/1.1 200 OK\r\ncontent-type: text/event-stream\r\ncontent-length: {}\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
        });

        let endpoint = Url::parse(&format!("http://{addr}/mcp")).unwrap();
        let mut transport = SseMcpTransport::new(endpoint);
        let response = transport
            .send(&JsonRpcRequest::new(42, "tools/list", None))
            .unwrap();
        assert_eq!(response.id, Some(42));
        assert_eq!(response.result.unwrap(), json!({"tools": []}));
        server.join().unwrap();
    }
}
