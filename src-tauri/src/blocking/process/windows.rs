//! Windows process blocking using Windows API.

use super::{ProcessBlocker, ProcessError, ProcessInfo};

#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::CloseHandle,
    System::{
        Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32,
            TH32CS_SNAPPROCESS,
        },
        Threading::{OpenProcess, TerminateProcess, PROCESS_QUERY_INFORMATION, PROCESS_TERMINATE},
    },
};

pub struct WindowsProcessBlocker;

impl WindowsProcessBlocker {
    pub fn new() -> Self {
        Self
    }
}

#[cfg(target_os = "windows")]
impl ProcessBlocker for WindowsProcessBlocker {
    fn list_processes(&self) -> Result<Vec<ProcessInfo>, ProcessError> {
        let mut processes = Vec::new();

        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
                .map_err(|e| ProcessError::ListFailed(e.to_string()))?;

            let mut entry = PROCESSENTRY32 {
                dwSize: std::mem::size_of::<PROCESSENTRY32>() as u32,
                ..Default::default()
            };

            if Process32First(snapshot, &mut entry).is_ok() {
                loop {
                    let name = String::from_utf8_lossy(
                        &entry.szExeFile.iter()
                            .take_while(|&&c| c != 0)
                            .map(|&c| c as u8)
                            .collect::<Vec<_>>()
                    ).to_string();

                    processes.push(ProcessInfo {
                        pid: entry.th32ProcessID,
                        name,
                        exe_path: None, // Would need additional API calls
                    });

                    if Process32Next(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }

            let _ = CloseHandle(snapshot);
        }

        Ok(processes)
    }

    fn terminate_process(&self, pid: u32) -> Result<(), ProcessError> {
        unsafe {
            let handle = OpenProcess(PROCESS_TERMINATE | PROCESS_QUERY_INFORMATION, false, pid)
                .map_err(|e| {
                    if e.code().0 as u32 == 5 {
                        // ERROR_ACCESS_DENIED
                        ProcessError::AccessDenied
                    } else {
                        ProcessError::TerminateFailed(e.to_string())
                    }
                })?;

            let result = TerminateProcess(handle, 1);
            let _ = CloseHandle(handle);

            result.map_err(|e| ProcessError::TerminateFailed(e.to_string()))
        }
    }
}

#[cfg(not(target_os = "windows"))]
impl ProcessBlocker for WindowsProcessBlocker {
    fn list_processes(&self) -> Result<Vec<ProcessInfo>, ProcessError> {
        Err(ProcessError::ListFailed("Not on Windows".to_string()))
    }

    fn terminate_process(&self, _pid: u32) -> Result<(), ProcessError> {
        Err(ProcessError::TerminateFailed("Not on Windows".to_string()))
    }
}
