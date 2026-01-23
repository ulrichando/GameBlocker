//! Linux process blocking using procfs.

use super::{ProcessBlocker, ProcessError, ProcessInfo};
use nix::sys::signal::{kill, Signal};
use nix::unistd::Pid;
use procfs::process::all_processes;

pub struct LinuxProcessBlocker;

impl LinuxProcessBlocker {
    pub fn new() -> Self {
        Self
    }
}

impl ProcessBlocker for LinuxProcessBlocker {
    fn list_processes(&self) -> Result<Vec<ProcessInfo>, ProcessError> {
        let processes = all_processes()
            .map_err(|e| ProcessError::ListFailed(e.to_string()))?;

        let mut result = Vec::new();

        for process in processes.flatten() {
            if let Ok(stat) = process.stat() {
                let exe_path = process.exe().ok().map(|p| p.display().to_string());

                result.push(ProcessInfo {
                    pid: stat.pid as u32,
                    name: stat.comm.clone(),
                    exe_path,
                });
            }
        }

        Ok(result)
    }

    fn terminate_process(&self, pid: u32) -> Result<(), ProcessError> {
        let pid = Pid::from_raw(pid as i32);

        // First try SIGTERM for graceful shutdown
        match kill(pid, Signal::SIGTERM) {
            Ok(()) => {
                // Give process time to terminate gracefully
                std::thread::sleep(std::time::Duration::from_millis(100));

                // Check if still running and force kill
                if kill(pid, None).is_ok() {
                    kill(pid, Signal::SIGKILL)
                        .map_err(|e| ProcessError::TerminateFailed(e.to_string()))?;
                }
                Ok(())
            }
            Err(nix::errno::Errno::ESRCH) => Err(ProcessError::NotFound),
            Err(nix::errno::Errno::EPERM) => Err(ProcessError::AccessDenied),
            Err(e) => Err(ProcessError::TerminateFailed(e.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_processes() {
        let blocker = LinuxProcessBlocker::new();
        let processes = blocker.list_processes().unwrap();

        // Should find at least one process (ourselves)
        assert!(!processes.is_empty());

        // Find our own process
        let our_pid = std::process::id();
        assert!(processes.iter().any(|p| p.pid == our_pid));
    }
}
