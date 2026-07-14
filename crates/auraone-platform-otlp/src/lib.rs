//! OTLP JSON/protobuf receiver primitives for Agent Studio Open.

use bytes::Bytes;
use http::HeaderMap;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;
use tonic::{Request, Response, Status};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OtlpReceiverConfig {
    pub bind_addr: String,
    pub allow_remote_bind: bool,
    pub max_body_bytes: usize,
}

impl Default for OtlpReceiverConfig {
    fn default() -> Self {
        Self {
            bind_addr: "127.0.0.1:4318".to_string(),
            allow_remote_bind: false,
            max_body_bytes: 8 * 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpanEnvelope {
    pub trace_id: String,
    pub span_id: String,
    pub name: String,
    pub attributes: Value,
}

#[derive(Debug, Error)]
pub enum OtlpError {
    #[error("remote bind requires explicit opt in")]
    RemoteBindDenied,
    #[error("request body exceeds configured limit")]
    BodyTooLarge,
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("missing resourceSpans array")]
    MissingResourceSpans,
}

pub fn validate_bind(config: &OtlpReceiverConfig) -> Result<(), OtlpError> {
    if !config.allow_remote_bind
        && !(config.bind_addr.starts_with("127.0.0.1:")
            || config.bind_addr.starts_with("localhost:")
            || config.bind_addr.starts_with("[::1]:"))
    {
        return Err(OtlpError::RemoteBindDenied);
    }
    Ok(())
}

pub fn parse_otlp_json(
    body: &[u8],
    config: &OtlpReceiverConfig,
) -> Result<Vec<SpanEnvelope>, OtlpError> {
    if body.len() > config.max_body_bytes {
        return Err(OtlpError::BodyTooLarge);
    }
    let value: Value = serde_json::from_slice(body)?;
    let resource_spans = value
        .get("resourceSpans")
        .and_then(Value::as_array)
        .ok_or(OtlpError::MissingResourceSpans)?;
    let mut spans = Vec::new();
    for resource in resource_spans {
        for scope in resource
            .get("scopeSpans")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
        {
            for span in scope
                .get("spans")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                spans.push(SpanEnvelope {
                    trace_id: span
                        .get("traceId")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    span_id: span
                        .get("spanId")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    name: span
                        .get("name")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    attributes: span
                        .get("attributes")
                        .cloned()
                        .unwrap_or(Value::Array(vec![])),
                });
            }
        }
    }
    Ok(spans)
}

pub fn classify_http_otlp(headers: &HeaderMap, body: Bytes) -> &'static str {
    let content_type = headers
        .get(http::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if content_type.contains("json") || body.first() == Some(&b'{') {
        "otlp-json"
    } else {
        "otlp-proto"
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum HttpOtlpExport {
    Json(Vec<SpanEnvelope>),
    Proto(Bytes),
}

pub fn accept_http_otlp(
    headers: &HeaderMap,
    body: Bytes,
    config: &OtlpReceiverConfig,
) -> Result<HttpOtlpExport, OtlpError> {
    if body.len() > config.max_body_bytes {
        return Err(OtlpError::BodyTooLarge);
    }
    match classify_http_otlp(headers, body.clone()) {
        "otlp-json" => parse_otlp_json(&body, config).map(HttpOtlpExport::Json),
        _ => Ok(HttpOtlpExport::Proto(body)),
    }
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct ExportTraceServiceRequest {
    #[prost(bytes = "vec", tag = "1")]
    pub opaque_payload: Vec<u8>,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct ExportTraceServiceResponse {}

pub fn tonic_accept_opaque(
    request: Request<ExportTraceServiceRequest>,
) -> Result<Response<ExportTraceServiceResponse>, Status> {
    if request.into_inner().opaque_payload.len() > OtlpReceiverConfig::default().max_body_bytes {
        return Err(Status::resource_exhausted(
            "OTLP payload exceeds receiver limit",
        ));
    }
    Ok(Response::new(ExportTraceServiceResponse {}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn denies_remote_bind_by_default() {
        let config = OtlpReceiverConfig {
            bind_addr: "0.0.0.0:4318".to_string(),
            ..Default::default()
        };
        assert!(matches!(
            validate_bind(&config),
            Err(OtlpError::RemoteBindDenied)
        ));
    }

    #[test]
    fn parses_otlp_json_spans() {
        let body = br#"{"resourceSpans":[{"scopeSpans":[{"spans":[{"traceId":"a","spanId":"b","name":"mcp.call","attributes":[]}]}]}]}"#;
        let spans = parse_otlp_json(body, &OtlpReceiverConfig::default()).unwrap();
        assert_eq!(spans[0].name, "mcp.call");
    }

    #[test]
    fn accepts_http_json_and_proto_exports() {
        let mut json_headers = HeaderMap::new();
        json_headers.insert(
            http::header::CONTENT_TYPE,
            "application/json".parse().unwrap(),
        );
        let json_body = Bytes::from_static(
            br#"{"resourceSpans":[{"scopeSpans":[{"spans":[{"traceId":"a","spanId":"b","name":"http.export","attributes":[]}]}]}]}"#,
        );
        let json_export =
            accept_http_otlp(&json_headers, json_body, &OtlpReceiverConfig::default()).unwrap();
        assert!(
            matches!(json_export, HttpOtlpExport::Json(spans) if spans[0].name == "http.export")
        );

        let mut proto_headers = HeaderMap::new();
        proto_headers.insert(
            http::header::CONTENT_TYPE,
            "application/x-protobuf".parse().unwrap(),
        );
        let proto_body = Bytes::from_static(&[0x0a, 0x03, 0x01, 0x02, 0x03]);
        let proto_export = accept_http_otlp(
            &proto_headers,
            proto_body.clone(),
            &OtlpReceiverConfig::default(),
        )
        .unwrap();
        assert_eq!(proto_export, HttpOtlpExport::Proto(proto_body));
    }

    #[test]
    fn tonic_receiver_accepts_proto_payload_and_rejects_oversized_payload() {
        assert!(tonic_accept_opaque(Request::new(ExportTraceServiceRequest {
            opaque_payload: vec![1, 2, 3],
        }))
        .is_ok());

        let rejected = match tonic_accept_opaque(Request::new(ExportTraceServiceRequest {
            opaque_payload: vec![0; OtlpReceiverConfig::default().max_body_bytes + 1],
        })) {
            Ok(_) => panic!("oversized payload should fail"),
            Err(error) => error,
        };
        assert_eq!(rejected.code(), tonic::Code::ResourceExhausted);
    }
}
