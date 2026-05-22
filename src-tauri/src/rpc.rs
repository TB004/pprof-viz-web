//! ConnectRPC client wrapping the agent service.
//!
//! Auto h1/h2 over plaintext (`http://`) or TLS (`https://`). The TLS root
//! store is `webpki-roots` (Mozilla's CA bundle) — fits a developer tool
//! that talks to arbitrary `https://` agents without native cert plumbing.
//!
//! Per-call timeouts are scoped to the unary `ping` command. Streaming
//! calls (`stream_all`) deliberately have no deadline — they are expected
//! to run indefinitely until the user stops the collection.

use std::sync::{Arc, OnceLock};
use std::time::Duration;

use connectrpc::client::{CallOptions, ClientConfig, ClientTransport, HttpClient, ServerStream};
use http::header::{AUTHORIZATION, HeaderValue};

use crate::proto::proto::__buffa::view::AllResponseView;
use crate::proto::proto::{AgentServiceClient, AllResponse, MetadataResponse, StreamConfigRequest};

const PING_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, thiserror::Error)]
pub enum AgentRpcError {
    #[error("invalid url: {0}")]
    Url(String),
    #[error("invalid auth token")]
    AuthToken,
    #[error("rpc: {0}")]
    Rpc(String),
}

pub struct AgentClient {
    inner: AgentServiceClient<HttpClient>,
}

impl AgentClient {
    pub fn connect(url: &str, token: Option<&str>) -> Result<Self, AgentRpcError> {
        let uri: http::Uri = url
            .parse()
            .map_err(|e: http::uri::InvalidUri| AgentRpcError::Url(e.to_string()))?;

        let transport = match uri.scheme_str() {
            Some("http") => HttpClient::plaintext(),
            Some("https") => HttpClient::with_tls(tls_config()),
            Some(other) => return Err(AgentRpcError::Url(format!("unsupported scheme '{other}'"))),
            None => return Err(AgentRpcError::Url("missing scheme".into())),
        };

        let mut config = ClientConfig::new(uri);
        if let Some(token) = token.map(str::trim).filter(|t| !t.is_empty()) {
            let value = HeaderValue::from_str(&format!("Bearer {token}"))
                .map_err(|_| AgentRpcError::AuthToken)?;
            config = config.with_default_header(AUTHORIZATION, value);
        }

        Ok(Self {
            inner: AgentServiceClient::new(transport, config),
        })
    }

    pub async fn ping(&self) -> Result<(), AgentRpcError> {
        self.inner
            .ping_with_options(
                buffa_types::Empty::default(),
                CallOptions::default().with_timeout(PING_TIMEOUT),
            )
            .await
            .map(|_| ())
            .map_err(|e| AgentRpcError::Rpc(e.to_string()))
    }

    pub async fn snapshot_all(&self) -> Result<AllResponse, AgentRpcError> {
        let resp = self
            .inner
            .snapshot_all(buffa_types::Empty::default())
            .await
            .map_err(|e| AgentRpcError::Rpc(e.to_string()))?;
        Ok(resp.into_owned())
    }

    pub async fn get_metadata(&self) -> Result<MetadataResponse, AgentRpcError> {
        let resp = self
            .inner
            .get_metadata(buffa_types::Empty::default())
            .await
            .map_err(|e| AgentRpcError::Rpc(e.to_string()))?;
        Ok(resp.into_owned())
    }

    pub async fn stream_all(
        &self,
        interval_seconds: u32,
        number_of_cycles: u32,
    ) -> Result<
        ServerStream<<HttpClient as ClientTransport>::ResponseBody, AllResponseView<'static>>,
        AgentRpcError,
    > {
        let req = StreamConfigRequest {
            interval_seconds,
            number_of_cycles,
            ..Default::default()
        };
        self.inner
            .stream_all(req)
            .await
            .map_err(|e| AgentRpcError::Rpc(e.to_string()))
    }
}

#[tauri::command]
#[specta::specta]
pub async fn agent_ping(url: String, token: Option<String>) -> Result<(), String> {
    let client = AgentClient::connect(&url, token.as_deref()).map_err(|e| e.to_string())?;
    client.ping().await.map_err(|e| e.to_string())
}

/// Lazily-initialised, process-wide TLS configuration.
///
/// Uses webpki-roots' Mozilla CA bundle for verification. The `ring` crypto
/// provider must be installed exactly once per process — we do that here
/// alongside the config build.
fn tls_config() -> Arc<rustls::ClientConfig> {
    static CONFIG: OnceLock<Arc<rustls::ClientConfig>> = OnceLock::new();
    CONFIG
        .get_or_init(|| {
            let _ = rustls::crypto::aws_lc_rs::default_provider();

            let mut roots = rustls::RootCertStore::empty();
            roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

            let config = rustls::ClientConfig::builder()
                .with_root_certificates(roots)
                .with_no_client_auth();
            Arc::new(config)
        })
        .clone()
}
