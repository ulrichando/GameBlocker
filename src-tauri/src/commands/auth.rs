//! Authentication Tauri commands.

use crate::config::{ConfigError, ConfigManager};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub is_configured: bool,
    pub is_authenticated: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupResult {
    pub success: bool,
    pub master_password: Option<String>,
    pub error: Option<String>,
}

/// Check if the app is configured and authentication status
#[tauri::command]
pub async fn get_auth_status() -> Result<AuthStatus, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;

    Ok(AuthStatus {
        is_configured: manager.config_exists(),
        is_authenticated: false, // Will be managed by app state
    })
}

/// Initialize the app with a password (first run)
#[tauri::command]
pub async fn setup_password(password: String) -> Result<SetupResult, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;

    if manager.config_exists() {
        return Ok(SetupResult {
            success: false,
            master_password: None,
            error: Some("App is already configured".to_string()),
        });
    }

    match manager.initialize(&password) {
        Ok(_) => {
            let master = manager.get_master_password().ok();
            Ok(SetupResult {
                success: true,
                master_password: master,
                error: None,
            })
        }
        Err(e) => Ok(SetupResult {
            success: false,
            master_password: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Verify the password
#[tauri::command]
pub async fn verify_password(password: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    manager.verify_password(&password).map_err(|e| e.to_string())
}

/// Change the password
#[tauri::command]
pub async fn change_password(old_password: String, new_password: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;

    match manager.change_password(&old_password, &new_password) {
        Ok(()) => Ok(true),
        Err(ConfigError::InvalidPassword) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Reset password using master recovery password
#[tauri::command]
pub async fn reset_with_master(master_password: String, new_password: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;

    match manager.reset_with_master_password(&master_password, &new_password) {
        Ok(()) => Ok(true),
        Err(ConfigError::InvalidPassword) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Get the master recovery password (requires authentication)
#[tauri::command]
pub async fn get_master_password(password: String) -> Result<Option<String>, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;

    // Verify password first
    if !manager.verify_password(&password).map_err(|e| e.to_string())? {
        return Ok(None);
    }

    manager.get_master_password().map(Some).map_err(|e| e.to_string())
}

/// Enable uninstall protection (called after setup)
#[tauri::command]
pub async fn enable_uninstall_protection() -> Result<bool, String> {
    crate::security::uninstall_protection::enable_protection()
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Disable uninstall protection (requires password)
#[tauri::command]
pub async fn disable_uninstall_protection(password: String) -> Result<bool, String> {
    // Verify password first
    crate::security::uninstall_protection::verify_uninstall_password(&password)
        .map_err(|e| e.to_string())?;

    crate::security::uninstall_protection::disable_protection()
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Uninstall the application (requires password)
#[tauri::command]
pub async fn uninstall_app(password: String) -> Result<bool, String> {
    crate::security::uninstall_protection::uninstall_with_password(&password)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Quit the application (requires password)
#[tauri::command]
pub async fn quit_with_password(password: String, app: tauri::AppHandle) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;

    // Verify password first
    if !manager.verify_password(&password).map_err(|e| e.to_string())? {
        return Ok(false);
    }

    // Password correct, exit the app
    app.exit(0);
    Ok(true)
}
