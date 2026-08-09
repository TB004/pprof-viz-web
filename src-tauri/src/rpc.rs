// Copyright (C) 2026 Tizian Bahr
// SPDX-License-Identifier: GPL-3.0-or-later

use std::net::SocketAddr;
use std::pin::Pin;
use std::sync::{Arc, OnceLock};
use std::task::{Context, Poll};
use std::time::Duration;

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls_platform_verifier::ConfigVerifierExt;

use bytes::Bytes;
use connectrpc::ConnectError;
use connectrpc::StreamMessage;
use connectrpc::client::{
    BoxFuture, CallOptions, ClientConfig, ClientTransport, HttpClient, ServerStream,
};
use http::header::{AUTHORIZATION, HeaderValue};
use http::{Request, Response};
use http_body::Body;
use http_body::Frame;
use tokio::sync::mpsc;

use crate::proto::proto::__buffa::view::AllResponseView;
use crate::proto::proto::{
    AllResponse, CollectorServiceClient, MetadataResponse, StreamConfigRequest,
};
use crate::settings::HttpVersion;

const PING_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, thiserror::Error)]
pub enum AgentRpcError {
    #[error("invalid url: {0}")]
    Url(String),
    #[error("invalid auth token")]
    AuthToken,
    #[error("rpc: {0}")]
    Rpc(String),
    #[error("tls: {0}")]
    Tls(String),
}

// ---------- HTTP/3 transport ----------

/// Response body that streams data from an h3 receive stream via a channel.
pub struct Http3Body {
    rx: mpsc::Receiver<Result<Bytes, String>>,
}

impl Body for Http3Body {
    type Data = Bytes;
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn poll_frame(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        match self.rx.poll_recv(cx) {
            Poll::Ready(Some(Ok(bytes))) => Poll::Ready(Some(Ok(Frame::data(bytes)))),
            Poll::Ready(Some(Err(e))) => Poll::Ready(Some(Err(e.into()))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}

/// HTTP/3 (QUIC) transport that implements [`ClientTransport`] for connectrpc.
/// Creates a fresh QUIC connection per RPC call.
#[derive(Clone)]
pub struct Http3Transport {
    /// IPv4 endpoint for targets that resolve to an IPv4 address.
    endpoint_v4: quinn::Endpoint,
    /// IPv6 endpoint for targets that resolve to an IPv6 address (e.g. [::1] for localhost).
    endpoint_v6: Option<quinn::Endpoint>,
    /// "hostname:port" used for both DNS resolution and QUIC SNI.
    authority: Arc<str>,
    server_name: Arc<str>,
}

impl ClientTransport for Http3Transport {
    type ResponseBody = Http3Body;
    type Error = ConnectError;

    fn send(
        &self,
        request: Request<connectrpc::client::ClientBody>,
    ) -> BoxFuture<'static, Result<Response<Http3Body>, ConnectError>> {
        let endpoint_v4 = self.endpoint_v4.clone();
        let endpoint_v6 = self.endpoint_v6.clone();
        let authority = Arc::clone(&self.authority);
        let server_name = Arc::clone(&self.server_name);

        Box::pin(async move {
            // Async DNS resolution — prefer IPv4 because QUIC servers commonly bind
            // to 0.0.0.0 (IPv4 only). On macOS, "localhost" resolves to [::1] first,
            // which would cause a handshake timeout against an IPv4-only QUIC server.
            let addrs: Vec<SocketAddr> = tokio::net::lookup_host(authority.as_ref())
                .await
                .map_err(|e| ConnectError::unavailable(format!("DNS resolution failed: {e}")))?
                .collect();
            let addr = addrs
                .iter()
                .find(|a| a.is_ipv4())
                .or_else(|| addrs.first())
                .copied()
                .ok_or_else(|| ConnectError::unavailable("DNS returned no addresses"))?;

            // Pick the endpoint whose address family matches the resolved address.
            // A QUIC/UDP socket bound to 0.0.0.0 cannot connect to an IPv6 address.
            let endpoint = if addr.is_ipv6() {
                endpoint_v6.ok_or_else(|| {
                    ConnectError::unavailable(
                        "resolved to IPv6 but no IPv6 QUIC endpoint is available",
                    )
                })?
            } else {
                endpoint_v4
            };

            // QUIC handshake
            let conn = endpoint
                .connect(addr, server_name.as_ref())
                .map_err(|e| ConnectError::unavailable(format!("QUIC connect: {e}")))?
                .await
                .map_err(|e| ConnectError::unavailable(format!("QUIC handshake: {e}")))?;

            // h3 session
            let h3_conn = h3_quinn::Connection::new(conn);
            let (driver, mut send_request) = h3::client::new(h3_conn)
                .await
                .map_err(|e| ConnectError::unavailable(format!("h3 session: {e}")))?;

            // Drive the h3 connection in the background.
            // pin_mut! is needed because Connection::poll_close takes Pin<&mut Self>.
            tokio::spawn(async move {
                futures_util::pin_mut!(driver);
                futures_util::future::poll_fn(|cx| driver.as_mut().poll_close(cx)).await;
            });

            // Collect request body
            use http_body_util::BodyExt;
            let (parts, body) = request.into_parts();
            let body_bytes = body
                .collect()
                .await
                .map_err(|e| ConnectError::internal(format!("request body error: {e}")))?
                .to_bytes();

            // h3 only accepts a unit body in the headers; data is sent separately
            let req = Request::from_parts(parts, ());

            // Open request stream and send
            let mut stream = send_request
                .send_request(req)
                .await
                .map_err(|e| ConnectError::unavailable(format!("h3 send request: {e}")))?;

            if !body_bytes.is_empty() {
                stream
                    .send_data(body_bytes)
                    .await
                    .map_err(|e| ConnectError::internal(format!("h3 send data: {e}")))?;
            }
            stream
                .finish()
                .await
                .map_err(|e| ConnectError::internal(format!("h3 finish: {e}")))?;

            // Receive response headers
            let response = stream
                .recv_response()
                .await
                .map_err(|e| ConnectError::unavailable(format!("h3 recv response: {e}")))?;

            let (resp_parts, _) = response.into_parts();

            // Bridge h3 body streaming into a channel.
            // `send_request` is kept alive here so h3 does not initiate a
            // GOAWAY/close while the server is still streaming response frames.
            // It is dropped only when this task exits (stream fully consumed).
            let (tx, rx) = mpsc::channel(64);
            tokio::spawn(async move {
                let _keep = send_request;
                loop {
                    match stream.recv_data().await {
                        Ok(Some(mut data)) => {
                            use bytes::Buf;
                            let chunk = data.copy_to_bytes(data.remaining());
                            if tx.send(Ok(chunk)).await.is_err() {
                                break;
                            }
                        }
                        Ok(None) => break,
                        Err(e) => {
                            let _ = tx.send(Err(e.to_string())).await;
                            break;
                        }
                    }
                }
            });

            Ok(Response::from_parts(resp_parts, Http3Body { rx }))
        })
    }
}

// ---------- unified stream ----------

/// A server-streaming response from either an HTTP/2 or HTTP/3 transport.
pub enum AgentStream {
    H2(ServerStream<<HttpClient as ClientTransport>::ResponseBody, AllResponseView<'static>>),
    H3(ServerStream<Http3Body, AllResponseView<'static>>),
}

impl AgentStream {
    pub async fn message(&mut self) -> Result<Option<StreamMessage<AllResponse>>, ConnectError> {
        match self {
            Self::H2(s) => s.message().await,
            Self::H3(s) => s.message().await,
        }
    }
}

// ---------- agent client ----------

/// Dispatch a method body to whichever transport variant is active.
/// Both arms are identical because the body expression is generic over
/// the concrete `inner` type; the macro expands it twice so the compiler
/// can monomorphise each arm separately.
macro_rules! dispatch {
    ($self:expr, $inner:ident => $body:expr) => {
        match $self {
            Self::H2 { inner: $inner } => $body,
            Self::H3 { inner: $inner } => $body,
        }
    };
}

pub enum AgentClient {
    H2 {
        inner: CollectorServiceClient<HttpClient>,
    },
    H3 {
        inner: CollectorServiceClient<Http3Transport>,
    },
}

impl AgentClient {
    /// `allow_insecure_tls` skips certificate verification entirely. It exists
    /// for development agents presenting a self-signed certificate; on any
    /// other connection it hands the profile's bearer token to whatever
    /// answers, so it is opt-in per profile and never the default.
    pub fn connect(
        url: &str,
        token: Option<&str>,
        http_version: HttpVersion,
        allow_insecure_tls: bool,
    ) -> Result<Self, AgentRpcError> {
        let uri: http::Uri = url
            .parse()
            .map_err(|e: http::uri::InvalidUri| AgentRpcError::Url(e.to_string()))?;

        let auth_header: Option<HeaderValue> = token
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .map(|t| {
                HeaderValue::from_str(&format!("Bearer {t}")).map_err(|_| AgentRpcError::AuthToken)
            })
            .transpose()?;

        match http_version {
            HttpVersion::Http2 => {
                let transport = match uri.scheme_str() {
                    Some("http") => HttpClient::plaintext_http2_only(),
                    Some("https") => HttpClient::with_tls(tls_config(allow_insecure_tls)?),
                    Some(other) => {
                        return Err(AgentRpcError::Url(format!("unsupported scheme '{other}'")));
                    }
                    None => return Err(AgentRpcError::Url("missing scheme".into())),
                };

                let mut config = ClientConfig::new(uri);
                if let Some(value) = auth_header {
                    config = config.with_default_header(AUTHORIZATION, value);
                }
                Ok(Self::H2 {
                    inner: CollectorServiceClient::new(transport, config),
                })
            }

            HttpVersion::Http3 => {
                if uri.scheme_str() != Some("https") {
                    return Err(AgentRpcError::Url("HTTP/3 requires an https:// URL".into()));
                }

                let host = uri
                    .host()
                    .ok_or_else(|| AgentRpcError::Url("missing host".into()))?;
                let port = uri.port_u16().unwrap_or(443);
                let authority: Arc<str> = format!("{host}:{port}").into();
                let server_name: Arc<str> = host.into();

                let quic_config = h3_quinn_client_config(allow_insecure_tls)?;
                let mut endpoint_v4 =
                    quinn::Endpoint::client("0.0.0.0:0".parse().expect("valid IPv4 addr"))
                        .map_err(|e| AgentRpcError::Rpc(format!("QUIC endpoint (v4): {e}")))?;
                endpoint_v4.set_default_client_config(quic_config.clone());

                // IPv6 endpoint is best-effort — some environments disable it.
                let endpoint_v6 =
                    quinn::Endpoint::client("[::]:0".parse().expect("valid IPv6 addr"))
                        .ok()
                        .map(|mut ep| {
                            ep.set_default_client_config(quic_config);
                            ep
                        });

                let transport = Http3Transport {
                    endpoint_v4,
                    endpoint_v6,
                    authority,
                    server_name,
                };
                let mut config = ClientConfig::new(uri);
                if let Some(value) = auth_header {
                    config = config.with_default_header(AUTHORIZATION, value);
                }
                Ok(Self::H3 {
                    inner: CollectorServiceClient::new(transport, config),
                })
            }
        }
    }

    pub async fn ping(&self) -> Result<(), AgentRpcError> {
        dispatch!(self, inner => inner
            .ping_with_options(
                buffa_types::Empty::default(),
                CallOptions::default().with_timeout(PING_TIMEOUT),
            )
            .await
            .map(|_| ())
            .map_err(|e| AgentRpcError::Rpc(e.to_string())))
    }

    pub async fn snapshot_all(&self) -> Result<AllResponse, AgentRpcError> {
        dispatch!(self, inner => inner
            .snapshot_all(buffa_types::Empty::default())
            .await
            .map(|r| r.into_owned())
            .map_err(|e| AgentRpcError::Rpc(e.to_string())))
    }

    pub async fn get_metadata(&self) -> Result<MetadataResponse, AgentRpcError> {
        dispatch!(self, inner => inner
            .get_metadata(buffa_types::Empty::default())
            .await
            .map(|r| r.into_owned())
            .map_err(|e| AgentRpcError::Rpc(e.to_string())))
    }

    pub async fn stream_all(
        &self,
        interval_seconds: u32,
        number_of_cycles: u32,
    ) -> Result<AgentStream, AgentRpcError> {
        let req = StreamConfigRequest {
            interval_seconds,
            number_of_cycles,
            ..Default::default()
        };
        match self {
            Self::H2 { inner } => inner.stream_all(req).await.map(AgentStream::H2),
            Self::H3 { inner } => inner.stream_all(req).await.map(AgentStream::H3),
        }
        .map_err(|e| AgentRpcError::Rpc(e.to_string()))
    }
}

// ---------- tauri commands ----------

#[tauri::command]
#[specta::specta]
pub async fn agent_ping(
    url: String,
    token: Option<String>,
    http_version: HttpVersion,
    allow_insecure_tls: bool,
) -> Result<(), String> {
    let client = AgentClient::connect(&url, token.as_deref(), http_version, allow_insecure_tls)
        .map_err(|e| e.to_string())?;
    client.ping().await.map_err(|e| e.to_string())
}

// ---------- TLS helpers ----------

/// Installs the aws-lc-rs crypto provider as the process default exactly once.
fn ensure_provider() {
    static INIT: OnceLock<()> = OnceLock::new();
    INIT.get_or_init(|| {
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    });
}

/// Accepts any server certificate without validation.
/// Used for local/dev agents that present self-signed certificates.
#[derive(Debug)]
struct NoVerifier;

impl ServerCertVerifier for NoVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer,
        _intermediates: &[CertificateDer],
        _server_name: &ServerName,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        rustls::crypto::aws_lc_rs::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

/// TLS configuration for HTTP/2, cached per verification mode.
fn tls_config(allow_insecure: bool) -> Result<Arc<rustls::ClientConfig>, AgentRpcError> {
    static VERIFYING: OnceLock<Arc<rustls::ClientConfig>> = OnceLock::new();
    static INSECURE: OnceLock<Arc<rustls::ClientConfig>> = OnceLock::new();

    if allow_insecure {
        return Ok(INSECURE
            .get_or_init(|| {
                ensure_provider();
                Arc::new(
                    rustls::ClientConfig::builder()
                        .dangerous()
                        .with_custom_certificate_verifier(Arc::new(NoVerifier))
                        .with_no_client_auth(),
                )
            })
            .clone());
    }

    if let Some(config) = VERIFYING.get() {
        return Ok(config.clone());
    }
    ensure_provider();
    let config = Arc::new(
        rustls::ClientConfig::with_platform_verifier()
            .map_err(|e| AgentRpcError::Tls(e.to_string()))?,
    );
    Ok(VERIFYING.get_or_init(|| config).clone())
}

/// QUIC/TLS configuration for HTTP/3, cached per verification mode.
/// ALPN is set to `h3` as required by the QUIC transport.
fn h3_quinn_client_config(allow_insecure: bool) -> Result<quinn::ClientConfig, AgentRpcError> {
    static VERIFYING: OnceLock<Arc<quinn::crypto::rustls::QuicClientConfig>> = OnceLock::new();
    static INSECURE: OnceLock<Arc<quinn::crypto::rustls::QuicClientConfig>> = OnceLock::new();

    let cached = if allow_insecure {
        &INSECURE
    } else {
        &VERIFYING
    };
    if let Some(config) = cached.get() {
        return Ok(quinn::ClientConfig::new(config.clone()));
    }

    ensure_provider();
    let mut tls = if allow_insecure {
        rustls::ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoVerifier))
            .with_no_client_auth()
    } else {
        rustls::ClientConfig::with_platform_verifier()
            .map_err(|e| AgentRpcError::Tls(e.to_string()))?
    };
    tls.alpn_protocols = vec![b"h3".to_vec()];
    let quic_tls = Arc::new(
        quinn::crypto::rustls::QuicClientConfig::try_from(tls)
            .map_err(|e| AgentRpcError::Tls(format!("QUIC TLS config: {e}")))?,
    );
    Ok(quinn::ClientConfig::new(
        cached.get_or_init(|| quic_tls).clone(),
    ))
}
