//! Local DNS proxy server for domain filtering.
//! Intercepts DNS queries and blocks requests for blocked domains.

use crate::blocking::blocklists;
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use thiserror::Error;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;

/// DNS proxy configuration
pub const DNS_PROXY_PORT: u16 = 5353;
pub const UPSTREAM_DNS: &str = "8.8.8.8:53";

/// Errors that can occur during DNS proxy operations
#[derive(Error, Debug)]
pub enum DnsProxyError {
    #[error("Failed to bind socket: {0}")]
    BindFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("DNS parsing error: {0}")]
    ParseError(String),
}

/// DNS proxy server state
pub struct DnsProxy {
    blocked_domains: Arc<RwLock<HashSet<String>>>,
    allowed_domains: Arc<RwLock<HashSet<String>>>,
    upstream_dns: SocketAddr,
    running: Arc<RwLock<bool>>,
}

impl DnsProxy {
    /// Create a new DNS proxy
    pub fn new(blocked: HashSet<String>, allowed: HashSet<String>) -> Self {
        Self {
            blocked_domains: Arc::new(RwLock::new(blocked)),
            allowed_domains: Arc::new(RwLock::new(allowed)),
            upstream_dns: UPSTREAM_DNS.parse().unwrap(),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Update blocked domains list
    pub async fn update_blocked(&self, domains: HashSet<String>) {
        let mut blocked = self.blocked_domains.write().await;
        *blocked = domains;
    }

    /// Update allowed domains list
    pub async fn update_allowed(&self, domains: HashSet<String>) {
        let mut allowed = self.allowed_domains.write().await;
        *allowed = domains;
    }

    /// Check if a domain should be blocked
    async fn should_block(&self, domain: &str) -> bool {
        let blocked = self.blocked_domains.read().await;
        let allowed = self.allowed_domains.read().await;
        blocklists::is_domain_blocked(domain, &blocked, &allowed)
    }

    /// Start the DNS proxy server
    pub async fn start(&self, bind_addr: &str) -> Result<(), DnsProxyError> {
        let socket = UdpSocket::bind(bind_addr)
            .await
            .map_err(|e| DnsProxyError::BindFailed(e.to_string()))?;

        tracing::info!("DNS proxy listening on {}", bind_addr);

        {
            let mut running = self.running.write().await;
            *running = true;
        }

        let mut buf = [0u8; 512];

        loop {
            {
                let running = self.running.read().await;
                if !*running {
                    break;
                }
            }

            match socket.recv_from(&mut buf).await {
                Ok((len, src)) => {
                    let query = buf[..len].to_vec();

                    // Parse domain from DNS query
                    if let Some(domain) = parse_dns_domain(&query) {
                        if self.should_block(&domain).await {
                            tracing::info!("Blocked DNS query for: {}", domain);
                            // Send NXDOMAIN response
                            if let Some(response) = create_nxdomain_response(&query) {
                                let _ = socket.send_to(&response, src).await;
                            }
                            continue;
                        }
                    }

                    // Forward to upstream DNS
                    let upstream = UdpSocket::bind("0.0.0.0:0").await?;
                    upstream.send_to(&query, self.upstream_dns).await?;

                    let mut response_buf = [0u8; 512];
                    match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        upstream.recv_from(&mut response_buf),
                    )
                    .await
                    {
                        Ok(Ok((response_len, _))) => {
                            let _ = socket.send_to(&response_buf[..response_len], src).await;
                        }
                        _ => {
                            tracing::warn!("Upstream DNS timeout");
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("DNS proxy receive error: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Stop the DNS proxy server
    pub async fn stop(&self) {
        let mut running = self.running.write().await;
        *running = false;
    }
}

/// Parse domain name from DNS query packet
fn parse_dns_domain(query: &[u8]) -> Option<String> {
    // DNS header is 12 bytes
    if query.len() < 13 {
        return None;
    }

    let mut pos = 12;
    let mut domain_parts = Vec::new();

    while pos < query.len() {
        let len = query[pos] as usize;
        if len == 0 {
            break;
        }

        pos += 1;
        if pos + len > query.len() {
            return None;
        }

        if let Ok(part) = std::str::from_utf8(&query[pos..pos + len]) {
            domain_parts.push(part.to_string());
        }
        pos += len;
    }

    if domain_parts.is_empty() {
        None
    } else {
        Some(domain_parts.join("."))
    }
}

/// Create an NXDOMAIN response for a blocked domain
fn create_nxdomain_response(query: &[u8]) -> Option<Vec<u8>> {
    if query.len() < 12 {
        return None;
    }

    let mut response = query.to_vec();

    // Set response flags
    // QR=1 (response), OPCODE=0, AA=0, TC=0, RD=1, RA=1, Z=0, RCODE=3 (NXDOMAIN)
    response[2] = 0x81; // QR=1, RD=1
    response[3] = 0x83; // RA=1, RCODE=3

    // Set answer count to 0
    response[6] = 0;
    response[7] = 0;

    Some(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dns_domain() {
        // Simulated DNS query for "example.com"
        // Header (12 bytes) + question section
        let mut query = vec![0u8; 12]; // Header
        query.extend_from_slice(&[7]); // Length of "example"
        query.extend_from_slice(b"example");
        query.extend_from_slice(&[3]); // Length of "com"
        query.extend_from_slice(b"com");
        query.extend_from_slice(&[0]); // Null terminator
        query.extend_from_slice(&[0, 1, 0, 1]); // QTYPE and QCLASS

        let domain = parse_dns_domain(&query);
        assert_eq!(domain, Some("example.com".to_string()));
    }

    #[test]
    fn test_create_nxdomain_response() {
        let query = vec![0u8; 12];
        let response = create_nxdomain_response(&query).unwrap();

        assert_eq!(response[2], 0x81);
        assert_eq!(response[3], 0x83);
    }
}
