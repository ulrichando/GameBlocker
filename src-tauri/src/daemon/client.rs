//! Client for communicating with the GameBlocker daemon from the GUI.

use crate::daemon::ipc::{
    read_message, write_message, DaemonRequest, DaemonResponse, SOCKET_PATH,
};
use std::io::{BufReader, BufWriter};
use std::os::unix::net::UnixStream;
use std::time::Duration;

/// Check if the daemon is running by attempting to connect
pub fn is_daemon_running() -> bool {
    match UnixStream::connect(SOCKET_PATH) {
        Ok(stream) => {
            // Try to ping
            if let Ok(response) = send_request_internal(stream, DaemonRequest::Ping) {
                matches!(response, DaemonResponse::Pong)
            } else {
                false
            }
        }
        Err(_) => false,
    }
}

/// Send a request to the daemon and get a response
pub fn send_request(request: DaemonRequest) -> Result<DaemonResponse, DaemonClientError> {
    let stream = UnixStream::connect(SOCKET_PATH).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound
            || e.kind() == std::io::ErrorKind::ConnectionRefused
        {
            DaemonClientError::DaemonNotRunning
        } else {
            DaemonClientError::ConnectionFailed(e.to_string())
        }
    })?;

    send_request_internal(stream, request)
}

fn send_request_internal(
    stream: UnixStream,
    request: DaemonRequest,
) -> Result<DaemonResponse, DaemonClientError> {
    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .ok();

    let mut reader = BufReader::new(stream.try_clone().map_err(|e| {
        DaemonClientError::ConnectionFailed(e.to_string())
    })?);
    let mut writer = BufWriter::new(stream);

    // Send request
    write_message(&mut writer, &request).map_err(|e| {
        DaemonClientError::SendFailed(e.to_string())
    })?;

    // Read response
    let response: DaemonResponse = read_message(&mut reader).map_err(|e| {
        DaemonClientError::ReceiveFailed(e.to_string())
    })?;

    Ok(response)
}

/// Get daemon status
pub fn get_status() -> Result<DaemonStatus, DaemonClientError> {
    match send_request(DaemonRequest::GetStatus)? {
        DaemonResponse::Status {
            running,
            blocking_active,
            game_blocking,
            ai_blocking,
            dns_blocking,
            browser_blocking,
            firewall_active,
            blocked_count,
            uptime_secs,
        } => Ok(DaemonStatus {
            running,
            blocking_active,
            game_blocking,
            ai_blocking,
            dns_blocking,
            browser_blocking,
            firewall_active,
            blocked_count,
            uptime_secs,
        }),
        DaemonResponse::Error { message } => Err(DaemonClientError::DaemonError(message)),
        _ => Err(DaemonClientError::UnexpectedResponse),
    }
}

/// Update blocking configuration via daemon
pub fn update_config(
    game_blocking: Option<bool>,
    ai_blocking: Option<bool>,
    dns_blocking: Option<bool>,
    browser_blocking: Option<bool>,
) -> Result<(), DaemonClientError> {
    match send_request(DaemonRequest::UpdateConfig {
        game_blocking,
        ai_blocking,
        dns_blocking,
        browser_blocking,
    })? {
        DaemonResponse::Ok => Ok(()),
        DaemonResponse::Error { message } => Err(DaemonClientError::DaemonError(message)),
        _ => Err(DaemonClientError::UnexpectedResponse),
    }
}

/// Run blocking check via daemon
pub fn run_blocking_check() -> Result<Vec<crate::daemon::ipc::BlockedProcessInfo>, DaemonClientError> {
    match send_request(DaemonRequest::RunBlockingCheck)? {
        DaemonResponse::BlockedProcesses { processes } => Ok(processes),
        DaemonResponse::Error { message } => Err(DaemonClientError::DaemonError(message)),
        _ => Err(DaemonClientError::UnexpectedResponse),
    }
}

/// Apply blocking settings via daemon
pub fn apply_blocking() -> Result<(), DaemonClientError> {
    match send_request(DaemonRequest::ApplyBlocking)? {
        DaemonResponse::Ok => Ok(()),
        DaemonResponse::Error { message } => Err(DaemonClientError::DaemonError(message)),
        _ => Err(DaemonClientError::UnexpectedResponse),
    }
}

/// Enable firewall blocking via daemon
pub fn enable_firewall() -> Result<(), DaemonClientError> {
    match send_request(DaemonRequest::EnableFirewall)? {
        DaemonResponse::Ok => Ok(()),
        DaemonResponse::Error { message } => Err(DaemonClientError::DaemonError(message)),
        _ => Err(DaemonClientError::UnexpectedResponse),
    }
}

/// Disable firewall blocking via daemon
pub fn disable_firewall() -> Result<(), DaemonClientError> {
    match send_request(DaemonRequest::DisableFirewall)? {
        DaemonResponse::Ok => Ok(()),
        DaemonResponse::Error { message } => Err(DaemonClientError::DaemonError(message)),
        _ => Err(DaemonClientError::UnexpectedResponse),
    }
}

/// Daemon status information
#[derive(Debug, Clone)]
pub struct DaemonStatus {
    pub running: bool,
    pub blocking_active: bool,
    pub game_blocking: bool,
    pub ai_blocking: bool,
    pub dns_blocking: bool,
    pub browser_blocking: bool,
    pub firewall_active: bool,
    pub blocked_count: u32,
    pub uptime_secs: u64,
}

/// Client errors
#[derive(Debug, thiserror::Error)]
pub enum DaemonClientError {
    #[error("Daemon is not running")]
    DaemonNotRunning,
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    #[error("Failed to send request: {0}")]
    SendFailed(String),
    #[error("Failed to receive response: {0}")]
    ReceiveFailed(String),
    #[error("Daemon error: {0}")]
    DaemonError(String),
    #[error("Unexpected response from daemon")]
    UnexpectedResponse,
}
