//! macOS service management using launchd.

use super::{ServiceError, ServiceManager, ServiceStatus};
use std::fs;
use std::process::Command;

const SERVICE_LABEL: &str = "com.gameblocker.daemon";
const PLIST_PATH: &str = "/Library/LaunchDaemons/com.gameblocker.daemon.plist";

pub struct MacOSServiceManager {
    exe_path: String,
}

impl MacOSServiceManager {
    pub fn new() -> Self {
        let exe_path = std::env::current_exe()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "/Applications/GameBlocker.app/Contents/MacOS/GameBlocker".to_string());

        Self { exe_path }
    }
}

impl ServiceManager for MacOSServiceManager {
    fn install(&self) -> Result<(), ServiceError> {
        let plist_content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/gameblocker.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/gameblocker.error.log</string>
</dict>
</plist>
"#,
            SERVICE_LABEL, self.exe_path
        );

        fs::write(PLIST_PATH, plist_content)
            .map_err(|e| ServiceError::InstallFailed(e.to_string()))?;

        // Load the daemon
        let output = Command::new("launchctl")
            .args(["load", "-w", PLIST_PATH])
            .output()
            .map_err(|e| ServiceError::InstallFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ServiceError::InstallFailed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        tracing::info!("GameBlocker launchd daemon installed");
        Ok(())
    }

    fn uninstall(&self) -> Result<(), ServiceError> {
        // Unload the daemon
        let _ = Command::new("launchctl")
            .args(["unload", PLIST_PATH])
            .output();

        // Remove plist file
        fs::remove_file(PLIST_PATH)
            .map_err(|e| ServiceError::RemoveFailed(e.to_string()))?;

        tracing::info!("GameBlocker launchd daemon uninstalled");
        Ok(())
    }

    fn start(&self) -> Result<(), ServiceError> {
        let output = Command::new("launchctl")
            .args(["start", SERVICE_LABEL])
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
        let output = Command::new("launchctl")
            .args(["stop", SERVICE_LABEL])
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
        let output = Command::new("launchctl")
            .args(["list", SERVICE_LABEL])
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    // Parse output to check if running
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    if stdout.contains("PID") {
                        ServiceStatus::Running
                    } else {
                        ServiceStatus::Stopped
                    }
                } else {
                    ServiceStatus::NotInstalled
                }
            }
            Err(_) => ServiceStatus::Unknown,
        }
    }

    fn is_installed(&self) -> bool {
        std::path::Path::new(PLIST_PATH).exists()
    }
}
