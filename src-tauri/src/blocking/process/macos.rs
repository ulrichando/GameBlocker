//! macOS process blocking using sysctl and libproc.

use super::{ProcessBlocker, ProcessError, ProcessInfo};
use std::process::Command;

pub struct MacOSProcessBlocker;

impl MacOSProcessBlocker {
    pub fn new() -> Self {
        Self
    }
}

impl ProcessBlocker for MacOSProcessBlocker {
    fn list_processes(&self) -> Result<Vec<ProcessInfo>, ProcessError> {
        // Use ps command for simplicity and reliability
        let output = Command::new("ps")
            .args(["-axo", "pid,comm"])
            .output()
            .map_err(|e| ProcessError::ListFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ProcessError::ListFailed("ps command failed".to_string()));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut processes = Vec::new();

        for line in stdout.lines().skip(1) {
            // Skip header
            let parts: Vec<&str> = line.trim().splitn(2, ' ').collect();
            if parts.len() == 2 {
                if let Ok(pid) = parts[0].trim().parse::<u32>() {
                    let name = parts[1].trim().to_string();
                    // Extract just the process name from path
                    let name = name.rsplit('/').next().unwrap_or(&name).to_string();

                    processes.push(ProcessInfo {
                        pid,
                        name,
                        exe_path: Some(parts[1].trim().to_string()),
                    });
                }
            }
        }

        Ok(processes)
    }

    fn terminate_process(&self, pid: u32) -> Result<(), ProcessError> {
        // Use kill command
        let output = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output()
            .map_err(|e| ProcessError::TerminateFailed(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("No such process") {
                return Err(ProcessError::NotFound);
            }
            if stderr.contains("Operation not permitted") {
                return Err(ProcessError::AccessDenied);
            }

            // Try SIGKILL
            let kill_output = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output()
                .map_err(|e| ProcessError::TerminateFailed(e.to_string()))?;

            if !kill_output.status.success() {
                return Err(ProcessError::TerminateFailed(
                    String::from_utf8_lossy(&kill_output.stderr).to_string(),
                ));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_list_processes() {
        let blocker = MacOSProcessBlocker::new();
        let processes = blocker.list_processes().unwrap();

        // Should find at least one process
        assert!(!processes.is_empty());
    }
}
