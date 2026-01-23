//! IPC protocol for daemon-GUI communication.
//! Uses Unix domain sockets on Linux/macOS and named pipes on Windows.

use serde::{Deserialize, Serialize};

/// Socket path for Unix domain socket
#[cfg(unix)]
pub const SOCKET_PATH: &str = "/run/gameblocker/gameblocker.sock";

/// Named pipe path for Windows
#[cfg(windows)]
pub const PIPE_NAME: &str = r"\\.\pipe\gameblocker";

/// Request messages from GUI to daemon
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DaemonRequest {
    /// Get daemon status
    GetStatus,
    /// Update blocking configuration
    UpdateConfig {
        game_blocking: Option<bool>,
        ai_blocking: Option<bool>,
        dns_blocking: Option<bool>,
        browser_blocking: Option<bool>,
    },
    /// Trigger an immediate blocking check
    RunBlockingCheck,
    /// Apply current blocking settings (hosts file, firewall)
    ApplyBlocking,
    /// Enable firewall-level DoH blocking
    EnableFirewall,
    /// Disable firewall-level DoH blocking
    DisableFirewall,
    /// Graceful shutdown (only for development/testing)
    Shutdown,
    /// Ping to check if daemon is alive
    Ping,
}

/// Response messages from daemon to GUI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DaemonResponse {
    /// Daemon status
    Status {
        running: bool,
        blocking_active: bool,
        game_blocking: bool,
        ai_blocking: bool,
        dns_blocking: bool,
        browser_blocking: bool,
        firewall_active: bool,
        blocked_count: u32,
        uptime_secs: u64,
    },
    /// Operation succeeded
    Ok,
    /// Blocked processes list from blocking check
    BlockedProcesses {
        processes: Vec<BlockedProcessInfo>,
    },
    /// Error occurred
    Error {
        message: String,
    },
    /// Pong response to ping
    Pong,
}

/// Information about a blocked process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedProcessInfo {
    pub pid: u32,
    pub name: String,
}

/// Read a message from a stream (length-prefixed JSON)
pub fn read_message<T: for<'de> Deserialize<'de>>(
    reader: &mut impl std::io::Read,
) -> std::io::Result<T> {
    // Read 4-byte length prefix
    let mut len_bytes = [0u8; 4];
    reader.read_exact(&mut len_bytes)?;
    let len = u32::from_le_bytes(len_bytes) as usize;

    // Sanity check on message size (max 1MB)
    if len > 1024 * 1024 {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Message too large",
        ));
    }

    // Read message bytes
    let mut buffer = vec![0u8; len];
    reader.read_exact(&mut buffer)?;

    // Parse JSON
    serde_json::from_slice(&buffer).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
    })
}

/// Write a message to a stream (length-prefixed JSON)
pub fn write_message<T: Serialize>(
    writer: &mut impl std::io::Write,
    message: &T,
) -> std::io::Result<()> {
    let json = serde_json::to_vec(message).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
    })?;

    // Write 4-byte length prefix
    let len = json.len() as u32;
    writer.write_all(&len.to_le_bytes())?;

    // Write message
    writer.write_all(&json)?;
    writer.flush()?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_roundtrip() {
        let request = DaemonRequest::UpdateConfig {
            game_blocking: Some(true),
            ai_blocking: Some(false),
            dns_blocking: None,
            browser_blocking: None,
        };

        let mut buffer = Vec::new();
        write_message(&mut buffer, &request).unwrap();

        let mut cursor = Cursor::new(buffer);
        let decoded: DaemonRequest = read_message(&mut cursor).unwrap();

        match decoded {
            DaemonRequest::UpdateConfig { game_blocking, ai_blocking, .. } => {
                assert_eq!(game_blocking, Some(true));
                assert_eq!(ai_blocking, Some(false));
            }
            _ => panic!("Wrong message type"),
        }
    }
}
