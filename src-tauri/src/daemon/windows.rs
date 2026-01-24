//! Windows service management.

use super::{ServiceError, ServiceManager, ServiceStatus};
use std::process::Command;

const SERVICE_NAME: &str = "ParentShield";

pub struct WindowsServiceManager {
    exe_path: String,
}

impl WindowsServiceManager {
    pub fn new() -> Self {
        let exe_path = std::env::current_exe()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "C:\\Program Files\\ParentShield\\parentshield.exe".to_string());

        Self { exe_path }
    }
}

impl ServiceManager for WindowsServiceManager {
    fn install(&self) -> Result<(), ServiceError> {
        // Create Windows service using sc.exe
        let output = Command::new("sc.exe")
            .args([
                "create",
                SERVICE_NAME,
                &format!("binPath= \"{}\" --daemon", self.exe_path),
                "start= auto",
                "DisplayName= ParentShield Parental Control",
            ])
            .output()
            .map_err(|e| ServiceError::InstallFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ServiceError::InstallFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        // Configure recovery options (restart on failure)
        let _ = Command::new("sc.exe")
            .args([
                "failure",
                SERVICE_NAME,
                "reset= 86400",
                "actions= restart/5000/restart/10000/restart/30000",
            ])
            .output();

        // Set description
        let _ = Command::new("sc.exe")
            .args([
                "description",
                SERVICE_NAME,
                "ParentShield parental control service for blocking games and AI services.",
            ])
            .output();

        tracing::info!("ParentShield Windows service installed");
        Ok(())
    }

    fn uninstall(&self) -> Result<(), ServiceError> {
        // Stop service first
        let _ = self.stop();

        // Delete service
        let output = Command::new("sc.exe")
            .args(["delete", SERVICE_NAME])
            .output()
            .map_err(|e| ServiceError::RemoveFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ServiceError::RemoveFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        tracing::info!("ParentShield Windows service uninstalled");
        Ok(())
    }

    fn start(&self) -> Result<(), ServiceError> {
        let output = Command::new("sc.exe")
            .args(["start", SERVICE_NAME])
            .output()
            .map_err(|e| ServiceError::ControlFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ServiceError::ControlFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        Ok(())
    }

    fn stop(&self) -> Result<(), ServiceError> {
        let output = Command::new("sc.exe")
            .args(["stop", SERVICE_NAME])
            .output()
            .map_err(|e| ServiceError::ControlFailed(e.to_string()))?;

        if !output.status.success() {
            // Ignore if already stopped
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.contains("not started") {
                return Err(ServiceError::ControlFailed(stderr.to_string()));
            }
        }

        Ok(())
    }

    fn status(&self) -> ServiceStatus {
        let output = Command::new("sc.exe")
            .args(["query", SERVICE_NAME])
            .output();

        match output {
            Ok(out) => {
                let status = String::from_utf8_lossy(&out.stdout);
                if status.contains("RUNNING") {
                    ServiceStatus::Running
                } else if status.contains("STOPPED") {
                    ServiceStatus::Stopped
                } else if status.contains("does not exist") {
                    ServiceStatus::NotInstalled
                } else {
                    ServiceStatus::Unknown
                }
            }
            Err(_) => ServiceStatus::NotInstalled,
        }
    }

    fn is_installed(&self) -> bool {
        let output = Command::new("sc.exe")
            .args(["query", SERVICE_NAME])
            .output();

        match output {
            Ok(out) => !String::from_utf8_lossy(&out.stdout).contains("does not exist"),
            Err(_) => false,
        }
    }
}
