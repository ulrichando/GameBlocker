//! Linux service management using systemd.

use super::{ServiceError, ServiceManager, ServiceStatus};
use std::fs;
use std::process::Command;

const SERVICE_NAME: &str = "parentshield";
const SERVICE_FILE: &str = "/etc/systemd/system/parentshield.service";

pub struct LinuxServiceManager {
    daemon_path: String,
}

impl LinuxServiceManager {
    pub fn new() -> Self {
        // The daemon binary is installed alongside the main binary
        let daemon_path = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
            .map(|dir| dir.join("parentshield-daemon").display().to_string())
            .unwrap_or_else(|| "/opt/parentshield/parentshield-daemon".to_string());

        Self { daemon_path }
    }
}

impl ServiceManager for LinuxServiceManager {
    fn install(&self) -> Result<(), ServiceError> {
        let service_content = format!(
            r#"[Unit]
Description=ParentShield Parental Control Daemon
After=network.target

[Service]
Type=simple
ExecStart={}
Restart=always
RestartSec=5
User=root

# Create runtime directory for socket
RuntimeDirectory=parentshield
RuntimeDirectoryMode=0755

# Prevent manual stop (parental control)
RefuseManualStop=true

[Install]
WantedBy=multi-user.target
"#,
            self.daemon_path
        );

        fs::write(SERVICE_FILE, service_content)
            .map_err(|e| ServiceError::InstallFailed(e.to_string()))?;

        // Reload systemd
        Command::new("systemctl")
            .args(["daemon-reload"])
            .output()
            .map_err(|e| ServiceError::InstallFailed(e.to_string()))?;

        // Enable service
        let output = Command::new("systemctl")
            .args(["enable", SERVICE_NAME])
            .output()
            .map_err(|e| ServiceError::InstallFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ServiceError::InstallFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        tracing::info!("ParentShield service installed");
        Ok(())
    }

    fn uninstall(&self) -> Result<(), ServiceError> {
        // Stop service first
        let _ = self.stop();

        // Disable service
        let _ = Command::new("systemctl")
            .args(["disable", SERVICE_NAME])
            .output();

        // Remove service file
        fs::remove_file(SERVICE_FILE)
            .map_err(|e| ServiceError::RemoveFailed(e.to_string()))?;

        // Reload systemd
        let _ = Command::new("systemctl").args(["daemon-reload"]).output();

        tracing::info!("ParentShield service uninstalled");
        Ok(())
    }

    fn start(&self) -> Result<(), ServiceError> {
        let output = Command::new("systemctl")
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
        let output = Command::new("systemctl")
            .args(["stop", SERVICE_NAME])
            .output()
            .map_err(|e| ServiceError::ControlFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ServiceError::ControlFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        Ok(())
    }

    fn status(&self) -> ServiceStatus {
        let output = Command::new("systemctl")
            .args(["is-active", SERVICE_NAME])
            .output();

        match output {
            Ok(out) => {
                let status = String::from_utf8_lossy(&out.stdout);
                if status.trim() == "active" {
                    ServiceStatus::Running
                } else if status.trim() == "inactive" {
                    ServiceStatus::Stopped
                } else {
                    ServiceStatus::Unknown
                }
            }
            Err(_) => ServiceStatus::NotInstalled,
        }
    }

    fn is_installed(&self) -> bool {
        std::path::Path::new(SERVICE_FILE).exists()
    }
}
