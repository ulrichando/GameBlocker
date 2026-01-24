//! Uninstall protection - prevents removal without parent password.
//!
//! This module implements various protection mechanisms to prevent
//! children from uninstalling or disabling the parental control software.

use crate::config::ConfigManager;
use crate::security::crypto;
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ProtectionError {
    #[error("Access denied - incorrect password")]
    AccessDenied,
    #[error("Protection operation failed: {0}")]
    OperationFailed(String),
    #[error("Config error: {0}")]
    ConfigError(String),
}

/// Verify parent password before allowing uninstall
pub fn verify_uninstall_password(password: &str) -> Result<bool, ProtectionError> {
    let manager = ConfigManager::new().map_err(|e| ProtectionError::ConfigError(e.to_string()))?;
    let config = manager.load().map_err(|e| ProtectionError::ConfigError(e.to_string()))?;

    let valid = crypto::verify_password(password, &config.password_hash)
        .map_err(|e| ProtectionError::ConfigError(e.to_string()))?;

    if valid {
        Ok(true)
    } else {
        Err(ProtectionError::AccessDenied)
    }
}

/// Enable all protection mechanisms
pub fn enable_protection() -> Result<(), ProtectionError> {
    #[cfg(target_os = "windows")]
    enable_windows_protection()?;

    #[cfg(target_os = "macos")]
    enable_macos_protection()?;

    #[cfg(target_os = "linux")]
    enable_linux_protection()?;

    Ok(())
}

/// Disable protection (requires password verification first)
pub fn disable_protection() -> Result<(), ProtectionError> {
    #[cfg(target_os = "windows")]
    disable_windows_protection()?;

    #[cfg(target_os = "macos")]
    disable_macos_protection()?;

    #[cfg(target_os = "linux")]
    disable_linux_protection()?;

    Ok(())
}

// =============================================================================
// Windows Protection
// =============================================================================

#[cfg(target_os = "windows")]
fn enable_windows_protection() -> Result<(), ProtectionError> {
    // 1. Protect the service from being stopped
    protect_windows_service()?;

    // 2. Add registry keys to prevent uninstall from Add/Remove Programs
    protect_windows_registry()?;

    // 3. Set file permissions to prevent deletion
    protect_windows_files()?;

    tracing::info!("Windows uninstall protection enabled");
    Ok(())
}

#[cfg(target_os = "windows")]
fn disable_windows_protection() -> Result<(), ProtectionError> {
    // Remove registry protection
    let _ = Command::new("reg")
        .args([
            "delete",
            r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ParentShield",
            "/v",
            "NoRemove",
            "/f",
        ])
        .output();

    // Remove file protection
    let _ = Command::new("icacls")
        .args([
            r"C:\Program Files\ParentShield",
            "/reset",
            "/t",
        ])
        .output();

    tracing::info!("Windows uninstall protection disabled");
    Ok(())
}

#[cfg(target_os = "windows")]
fn protect_windows_service() -> Result<(), ProtectionError> {
    // Configure service to restart on failure and prevent stopping
    let output = Command::new("sc.exe")
        .args([
            "failure",
            "ParentShield",
            "reset=",
            "0",
            "actions=",
            "restart/1000/restart/1000/restart/1000",
        ])
        .output()
        .map_err(|e| ProtectionError::OperationFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!("Failed to set service failure actions");
    }

    // Set service to auto-restart
    let _ = Command::new("sc.exe")
        .args(["config", "ParentShield", "start=", "auto"])
        .output();

    Ok(())
}

#[cfg(target_os = "windows")]
fn protect_windows_registry() -> Result<(), ProtectionError> {
    // Add NoRemove flag to prevent uninstall from Add/Remove Programs UI
    // Users can still use our custom uninstaller with password

    let output = Command::new("reg")
        .args([
            "add",
            r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ParentShield",
            "/v",
            "NoRemove",
            "/t",
            "REG_DWORD",
            "/d",
            "1",
            "/f",
        ])
        .output()
        .map_err(|e| ProtectionError::OperationFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!("Failed to set NoRemove registry key");
    }

    // Also set NoModify to prevent repair/modify
    let _ = Command::new("reg")
        .args([
            "add",
            r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ParentShield",
            "/v",
            "NoModify",
            "/t",
            "REG_DWORD",
            "/d",
            "1",
            "/f",
        ])
        .output();

    Ok(())
}

#[cfg(target_os = "windows")]
fn protect_windows_files() -> Result<(), ProtectionError> {
    // Set restrictive ACLs on program files
    // Only SYSTEM and Administrators can modify
    let _ = Command::new("icacls")
        .args([
            r"C:\Program Files\ParentShield",
            "/inheritance:r",
            "/grant:r",
            "SYSTEM:(OI)(CI)F",
            "/grant:r",
            "Administrators:(OI)(CI)F",
            "/t",
        ])
        .output();

    Ok(())
}

// =============================================================================
// macOS Protection
// =============================================================================

#[cfg(target_os = "macos")]
fn enable_macos_protection() -> Result<(), ProtectionError> {
    // 1. Protect LaunchDaemon plist
    protect_macos_daemon()?;

    // 2. Set immutable flag on critical files
    protect_macos_files()?;

    // 3. Add to System Preferences protection
    protect_macos_system()?;

    tracing::info!("macOS uninstall protection enabled");
    Ok(())
}

#[cfg(target_os = "macos")]
fn disable_macos_protection() -> Result<(), ProtectionError> {
    // Remove immutable flags
    let _ = Command::new("chflags")
        .args(["nouchg", "/Library/LaunchDaemons/com.parentshield.daemon.plist"])
        .output();

    let _ = Command::new("chflags")
        .args(["-R", "nouchg", "/Applications/ParentShield.app"])
        .output();

    tracing::info!("macOS uninstall protection disabled");
    Ok(())
}

#[cfg(target_os = "macos")]
fn protect_macos_daemon() -> Result<(), ProtectionError> {
    // Set immutable flag on the plist file
    let output = Command::new("chflags")
        .args(["uchg", "/Library/LaunchDaemons/com.parentshield.daemon.plist"])
        .output()
        .map_err(|e| ProtectionError::OperationFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!("Failed to set immutable flag on daemon plist");
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn protect_macos_files() -> Result<(), ProtectionError> {
    // Set immutable flag on the app bundle
    let _ = Command::new("chflags")
        .args(["-R", "uchg", "/Applications/ParentShield.app"])
        .output();

    // Set ownership to root
    let _ = Command::new("chown")
        .args(["-R", "root:wheel", "/Applications/ParentShield.app"])
        .output();

    Ok(())
}

#[cfg(target_os = "macos")]
fn protect_macos_system() -> Result<(), ProtectionError> {
    // Note: Full system protection would require MDM enrollment
    // which is beyond the scope of a standalone app.
    // We implement what we can without MDM.

    Ok(())
}

// =============================================================================
// Linux Protection
// =============================================================================

#[cfg(target_os = "linux")]
fn enable_linux_protection() -> Result<(), ProtectionError> {
    // 1. Protect systemd service file
    protect_linux_service()?;

    // 2. Set immutable attribute on critical files
    protect_linux_files()?;

    // 3. Create dpkg/rpm diversion to prevent package removal
    protect_linux_package()?;

    tracing::info!("Linux uninstall protection enabled");
    Ok(())
}

#[cfg(target_os = "linux")]
fn disable_linux_protection() -> Result<(), ProtectionError> {
    // Remove immutable attributes
    let _ = Command::new("chattr")
        .args(["-i", "/etc/systemd/system/parentshield-daemon.service"])
        .output();

    let _ = Command::new("chattr")
        .args(["-i", "/usr/bin/parentshield"])
        .output();

    let _ = Command::new("chattr")
        .args(["-i", "/usr/bin/parentshield-daemon"])
        .output();

    // Remove dpkg hold
    let _ = Command::new("apt-mark")
        .args(["unhold", "parentshield"])
        .output();

    tracing::info!("Linux uninstall protection disabled");
    Ok(())
}

#[cfg(target_os = "linux")]
fn protect_linux_service() -> Result<(), ProtectionError> {
    // Set immutable attribute on service file
    let output = Command::new("chattr")
        .args(["+i", "/etc/systemd/system/parentshield-daemon.service"])
        .output()
        .map_err(|e| ProtectionError::OperationFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!("Failed to set immutable flag on service file (may need root)");
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn protect_linux_files() -> Result<(), ProtectionError> {
    // Set immutable attribute on binaries
    let _ = Command::new("chattr")
        .args(["+i", "/usr/bin/parentshield"])
        .output();

    let _ = Command::new("chattr")
        .args(["+i", "/usr/bin/parentshield-daemon"])
        .output();

    // Protect config directory
    let _ = Command::new("chattr")
        .args(["+i", "/etc/parentshield"])
        .output();

    Ok(())
}

#[cfg(target_os = "linux")]
fn protect_linux_package() -> Result<(), ProtectionError> {
    // Put package on hold to prevent apt/dnf from removing it
    // For Debian/Ubuntu
    let _ = Command::new("apt-mark")
        .args(["hold", "parentshield"])
        .output();

    // For RHEL/Fedora
    let _ = Command::new("dnf")
        .args(["versionlock", "add", "parentshield"])
        .output();

    Ok(())
}

// =============================================================================
// Password-Protected Uninstall
// =============================================================================

/// Perform a password-protected uninstall
pub fn uninstall_with_password(password: &str) -> Result<(), ProtectionError> {
    // First verify the password
    verify_uninstall_password(password)?;

    // Disable protection
    disable_protection()?;

    // Perform platform-specific uninstall
    #[cfg(target_os = "windows")]
    uninstall_windows()?;

    #[cfg(target_os = "macos")]
    uninstall_macos()?;

    #[cfg(target_os = "linux")]
    uninstall_linux()?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn uninstall_windows() -> Result<(), ProtectionError> {
    // Stop and remove service
    let _ = Command::new("sc.exe").args(["stop", "ParentShield"]).output();
    let _ = Command::new("sc.exe").args(["delete", "ParentShield"]).output();

    // Remove from registry
    let _ = Command::new("reg")
        .args([
            "delete",
            r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ParentShield",
            "/f",
        ])
        .output();

    // Remove program files
    let _ = Command::new("rmdir")
        .args(["/s", "/q", r"C:\Program Files\ParentShield"])
        .output();

    tracing::info!("ParentShield uninstalled from Windows");
    Ok(())
}

#[cfg(target_os = "macos")]
fn uninstall_macos() -> Result<(), ProtectionError> {
    // Unload and remove daemon
    let _ = Command::new("launchctl")
        .args(["unload", "/Library/LaunchDaemons/com.parentshield.daemon.plist"])
        .output();

    let _ = Command::new("rm")
        .args(["-f", "/Library/LaunchDaemons/com.parentshield.daemon.plist"])
        .output();

    // Remove app
    let _ = Command::new("rm")
        .args(["-rf", "/Applications/ParentShield.app"])
        .output();

    // Remove config
    let _ = Command::new("rm")
        .args(["-rf", "/Library/Application Support/com.parentshield.app"])
        .output();

    tracing::info!("ParentShield uninstalled from macOS");
    Ok(())
}

#[cfg(target_os = "linux")]
fn uninstall_linux() -> Result<(), ProtectionError> {
    // Stop and disable service
    let _ = Command::new("systemctl")
        .args(["stop", "parentshield-daemon"])
        .output();

    let _ = Command::new("systemctl")
        .args(["disable", "parentshield-daemon"])
        .output();

    // Try apt first, then dnf
    let apt_result = Command::new("apt")
        .args(["remove", "-y", "parentshield"])
        .output();

    if apt_result.is_err() || !apt_result.unwrap().status.success() {
        let _ = Command::new("dnf")
            .args(["remove", "-y", "parentshield"])
            .output();
    }

    // Clean up config
    let _ = Command::new("rm")
        .args(["-rf", "/etc/parentshield"])
        .output();

    tracing::info!("ParentShield uninstalled from Linux");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protection_error_display() {
        let err = ProtectionError::AccessDenied;
        assert!(err.to_string().contains("incorrect password"));
    }
}
