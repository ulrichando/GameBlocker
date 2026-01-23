//! Cross-platform service management for background daemon.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("Service installation failed: {0}")]
    InstallFailed(String),
    #[error("Service removal failed: {0}")]
    RemoveFailed(String),
    #[error("Service control failed: {0}")]
    ControlFailed(String),
    #[error("Platform not supported")]
    NotSupported,
}

/// Service status
#[derive(Debug, Clone, PartialEq)]
pub enum ServiceStatus {
    Running,
    Stopped,
    NotInstalled,
    Unknown,
}

/// Service manager trait for cross-platform implementation
pub trait ServiceManager {
    /// Install the service
    fn install(&self) -> Result<(), ServiceError>;

    /// Uninstall the service
    fn uninstall(&self) -> Result<(), ServiceError>;

    /// Start the service
    fn start(&self) -> Result<(), ServiceError>;

    /// Stop the service
    fn stop(&self) -> Result<(), ServiceError>;

    /// Get service status
    fn status(&self) -> ServiceStatus;

    /// Check if service is installed
    fn is_installed(&self) -> bool;
}

/// Get the platform-specific service manager
#[cfg(target_os = "linux")]
pub fn get_service_manager() -> Box<dyn ServiceManager> {
    Box::new(super::linux::LinuxServiceManager::new())
}

#[cfg(target_os = "windows")]
pub fn get_service_manager() -> Box<dyn ServiceManager> {
    Box::new(super::windows::WindowsServiceManager::new())
}

#[cfg(target_os = "macos")]
pub fn get_service_manager() -> Box<dyn ServiceManager> {
    Box::new(super::macos::MacOSServiceManager::new())
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
pub fn get_service_manager() -> Box<dyn ServiceManager> {
    Box::new(StubServiceManager)
}

/// Stub service manager for unsupported platforms
#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
struct StubServiceManager;

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
impl ServiceManager for StubServiceManager {
    fn install(&self) -> Result<(), ServiceError> {
        Err(ServiceError::NotSupported)
    }

    fn uninstall(&self) -> Result<(), ServiceError> {
        Err(ServiceError::NotSupported)
    }

    fn start(&self) -> Result<(), ServiceError> {
        Err(ServiceError::NotSupported)
    }

    fn stop(&self) -> Result<(), ServiceError> {
        Err(ServiceError::NotSupported)
    }

    fn status(&self) -> ServiceStatus {
        ServiceStatus::NotInstalled
    }

    fn is_installed(&self) -> bool {
        false
    }
}
