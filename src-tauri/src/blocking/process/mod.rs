//! Cross-platform process blocking engine.

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "windows")]
mod windows;

use std::collections::HashSet;
use thiserror::Error;

/// Errors that can occur during process operations
#[derive(Error, Debug)]
pub enum ProcessError {
    #[error("Failed to list processes: {0}")]
    ListFailed(String),
    #[error("Failed to terminate process: {0}")]
    TerminateFailed(String),
    #[error("Access denied")]
    AccessDenied,
    #[error("Process not found")]
    NotFound,
}

/// Information about a running process
#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub exe_path: Option<String>,
}

/// Process blocker trait for cross-platform implementation
pub trait ProcessBlocker: Send + Sync {
    /// List all running processes
    fn list_processes(&self) -> Result<Vec<ProcessInfo>, ProcessError>;

    /// Terminate a process by PID
    fn terminate_process(&self, pid: u32) -> Result<(), ProcessError>;

    /// Find and terminate processes matching blocked list
    fn block_processes(
        &self,
        blocked: &HashSet<String>,
        allowed: &HashSet<String>,
    ) -> Result<Vec<ProcessInfo>, ProcessError> {
        let processes = self.list_processes()?;
        let mut blocked_processes = Vec::new();

        for process in processes {
            if super::blocklists::is_process_blocked(&process.name, blocked, allowed) {
                if let Err(e) = self.terminate_process(process.pid) {
                    tracing::warn!("Failed to terminate {}: {}", process.name, e);
                } else {
                    tracing::info!("Blocked process: {} (PID: {})", process.name, process.pid);
                    blocked_processes.push(process);
                }
            }
        }

        Ok(blocked_processes)
    }
}

/// Create a platform-specific process blocker
#[cfg(target_os = "linux")]
pub fn create_blocker() -> Box<dyn ProcessBlocker> {
    Box::new(linux::LinuxProcessBlocker::new())
}

#[cfg(target_os = "windows")]
pub fn create_blocker() -> Box<dyn ProcessBlocker> {
    Box::new(windows::WindowsProcessBlocker::new())
}

#[cfg(target_os = "macos")]
pub fn create_blocker() -> Box<dyn ProcessBlocker> {
    Box::new(macos::MacOSProcessBlocker::new())
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
pub fn create_blocker() -> Box<dyn ProcessBlocker> {
    Box::new(StubProcessBlocker)
}

/// Stub blocker for unsupported platforms
#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
struct StubProcessBlocker;

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
impl ProcessBlocker for StubProcessBlocker {
    fn list_processes(&self) -> Result<Vec<ProcessInfo>, ProcessError> {
        Ok(Vec::new())
    }

    fn terminate_process(&self, _pid: u32) -> Result<(), ProcessError> {
        Err(ProcessError::TerminateFailed("Unsupported platform".to_string()))
    }
}
