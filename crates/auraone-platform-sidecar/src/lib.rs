use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use thiserror::Error;

pub type Result<T> = std::result::Result<T, SidecarError>;

#[derive(Debug, Error)]
pub enum SidecarError {
    #[error("sidecar I/O failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("sidecar JSON serialization failed: {0}")]
    Json(#[from] serde_json::Error),
    #[error("sidecar timed out after {0} ms")]
    Timeout(u64),
    #[error("sidecar exited with status {status}: {stderr}")]
    Crashed { status: i32, stderr: String },
    #[error("sidecar stdout was empty")]
    EmptyStdout,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SidecarSpec {
    pub program: String,
    pub args: Vec<String>,
    pub timeout: Duration,
    pub max_stdout_bytes: usize,
}

impl SidecarSpec {
    pub fn new(program: impl Into<String>) -> Self {
        Self {
            program: program.into(),
            args: Vec::new(),
            timeout: Duration::from_millis(50),
            max_stdout_bytes: 1024 * 1024,
        }
    }

    pub fn args(mut self, args: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.args = args.into_iter().map(Into::into).collect();
        self
    }

    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct JsonLineEnvelope<T> {
    pub protocol: String,
    pub request_id: String,
    pub method: String,
    pub payload: T,
}

impl<T> JsonLineEnvelope<T> {
    pub fn new(request_id: impl Into<String>, method: impl Into<String>, payload: T) -> Self {
        Self {
            protocol: "auraone-sidecar-jsonl-v1".to_string(),
            request_id: request_id.into(),
            method: method.into(),
            payload,
        }
    }
}

pub struct SidecarClient {
    spec: SidecarSpec,
}

impl SidecarClient {
    pub fn new(spec: SidecarSpec) -> Self {
        Self { spec }
    }

    pub fn request<T, R>(&self, request: &JsonLineEnvelope<T>) -> Result<JsonLineEnvelope<R>>
    where
        T: Serialize,
        R: DeserializeOwned,
    {
        let mut child = Command::new(&self.spec.program)
            .args(&self.spec.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        if let Some(stdin) = child.stdin.as_mut() {
            serde_json::to_writer(&mut *stdin, request)?;
            stdin.write_all(b"\n")?;
        }
        drop(child.stdin.take());

        let start = Instant::now();
        loop {
            if start.elapsed() > self.spec.timeout {
                let _ = child.kill();
                let _ = child.wait();
                return Err(SidecarError::Timeout(self.spec.timeout.as_millis() as u64));
            }
            if let Some(status) = child.try_wait()? {
                let output = child.wait_with_output()?;
                if !status.success() {
                    return Err(SidecarError::Crashed {
                        status: status.code().unwrap_or(-1),
                        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
                    });
                }
                if output.stdout.is_empty() {
                    return Err(SidecarError::EmptyStdout);
                }
                let stdout = if output.stdout.len() > self.spec.max_stdout_bytes {
                    &output.stdout[..self.spec.max_stdout_bytes]
                } else {
                    &output.stdout
                };
                let line = stdout
                    .split(|byte| *byte == b'\n')
                    .next()
                    .ok_or(SidecarError::EmptyStdout)?;
                return Ok(serde_json::from_slice(line)?);
            }
            thread::sleep(Duration::from_millis(2));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Serialize, Deserialize, Eq, PartialEq)]
    struct Payload {
        value: String,
    }

    #[cfg(unix)]
    fn round_trip_spec() -> SidecarSpec {
        SidecarSpec::new("sh")
            .args([
                "-c",
                "while IFS= read -r line; do printf '%s\n' \"$line\"; break; done",
            ])
            .timeout(Duration::from_millis(250))
    }

    #[cfg(windows)]
    fn round_trip_spec() -> SidecarSpec {
        SidecarSpec::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "$line = [Console]::In.ReadLine(); [Console]::Out.WriteLine($line)",
            ])
            .timeout(Duration::from_millis(250))
    }

    #[cfg(unix)]
    fn crash_spec() -> SidecarSpec {
        SidecarSpec::new("sh")
            .args(["-c", "echo sidecar-failed >&2; exit 17"])
            .timeout(Duration::from_millis(250))
    }

    #[cfg(windows)]
    fn crash_spec() -> SidecarSpec {
        SidecarSpec::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Write-Error sidecar-failed; exit 17",
            ])
            .timeout(Duration::from_millis(250))
    }

    #[cfg(unix)]
    fn timeout_spec() -> SidecarSpec {
        SidecarSpec::new("sh")
            .args(["-c", "sleep 1"])
            .timeout(Duration::from_millis(10))
    }

    #[cfg(windows)]
    fn timeout_spec() -> SidecarSpec {
        SidecarSpec::new("powershell")
            .args(["-NoProfile", "-Command", "Start-Sleep -Seconds 1"])
            .timeout(Duration::from_millis(10))
    }

    #[test]
    fn json_line_sidecar_round_trip() {
        let client = SidecarClient::new(round_trip_spec());
        let request = JsonLineEnvelope::new(
            "req-1",
            "echo",
            Payload {
                value: "rubric".to_string(),
            },
        );

        let response: JsonLineEnvelope<Payload> = client.request(&request).unwrap();

        assert_eq!(response, request);
    }

    #[test]
    fn sidecar_crash_is_reported_without_panicking() {
        let client = SidecarClient::new(crash_spec());
        let request = JsonLineEnvelope::new(
            "req-2",
            "crash",
            Payload {
                value: "robotics".to_string(),
            },
        );

        assert!(matches!(
            client.request::<_, Payload>(&request),
            Err(SidecarError::Crashed { status: 17, .. })
        ));
    }

    #[test]
    fn sidecar_timeout_is_reported_without_panicking() {
        let client = SidecarClient::new(timeout_spec());
        let request = JsonLineEnvelope::new(
            "req-3",
            "timeout",
            Payload {
                value: "agent".to_string(),
            },
        );

        assert!(matches!(
            client.request::<_, Payload>(&request),
            Err(SidecarError::Timeout(10))
        ));
    }
}
