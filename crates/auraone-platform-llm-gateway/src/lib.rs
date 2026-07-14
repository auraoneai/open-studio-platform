//! Uniform LLM gateway interface for Agent Studio Open.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Provider {
    OpenAi,
    Anthropic,
    Gemini,
    Ollama,
    Custom(String),
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SecretRef {
    pub keychain_service: String,
    pub keychain_account: String,
}

impl std::fmt::Debug for SecretRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SecretRef")
            .field("keychain_service", &self.keychain_service)
            .field("keychain_account", &"<redacted>")
            .finish()
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GatewayRequest {
    pub provider: Provider,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<ToolDefinition>,
    pub stream: bool,
    pub secret: Option<SecretRef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GatewayResponse {
    pub provider: Provider,
    pub model: String,
    pub message: ChatMessage,
    pub tool_calls: Vec<ToolCall>,
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum StreamEvent {
    Delta {
        content: String,
    },
    ToolCallDelta {
        id: String,
        name: String,
        arguments_json: String,
    },
    Done {
        usage: Option<TokenUsage>,
    },
}

#[derive(Debug, Error)]
pub enum GatewayError {
    #[error("provider API key must be supplied through the platform keychain")]
    MissingSecretRef,
    #[error("model must be set")]
    MissingModel,
    #[error("messages must not be empty")]
    MissingMessages,
}

pub fn validate_gateway_request(request: &GatewayRequest) -> Result<(), GatewayError> {
    if request.model.trim().is_empty() {
        return Err(GatewayError::MissingModel);
    }
    if request.messages.is_empty() {
        return Err(GatewayError::MissingMessages);
    }
    if !matches!(request.provider, Provider::Ollama) && request.secret.is_none() {
        return Err(GatewayError::MissingSecretRef);
    }
    Ok(())
}

pub trait LlmGateway {
    fn complete(&self, request: GatewayRequest) -> Result<GatewayResponse, GatewayError>;
    fn stream(
        &self,
        request: GatewayRequest,
    ) -> Result<Box<dyn Iterator<Item = StreamEvent>>, GatewayError>;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_ref_debug_redacts_account() {
        let secret = SecretRef {
            keychain_service: "agentstudio".to_string(),
            keychain_account: "sk-test".to_string(),
        };
        assert!(!format!("{secret:?}").contains("sk-test"));
    }

    #[test]
    fn validates_byo_key_for_remote_provider() {
        let request = GatewayRequest {
            provider: Provider::OpenAi,
            model: "gpt-4.1".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "hi".to_string(),
            }],
            tools: vec![],
            stream: false,
            secret: None,
        };
        assert!(matches!(
            validate_gateway_request(&request),
            Err(GatewayError::MissingSecretRef)
        ));
    }
}
