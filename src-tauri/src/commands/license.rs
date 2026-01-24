//! License and subscription management commands.
//! Handles communication with the ParentShield web platform.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;

// Platform API URL
const API_BASE_URL: &str = "https://parentshield.app/api/v1/app";

// License state (cached locally)
static LICENSE_STATE: Lazy<Mutex<LicenseState>> = Lazy::new(|| {
    Mutex::new(LicenseState::default())
});

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LicenseState {
    pub access_token: Option<String>,
    pub user_id: Option<String>,
    pub plan: String,
    pub features: Features,
    pub expires_at: Option<String>,
    pub last_checked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Features {
    pub website_blocking: bool,
    pub game_blocking: bool,
    pub max_blocks: i32,
    pub web_dashboard: bool,
    pub activity_reports: bool,
    pub schedules: bool,
    pub tamper_protection: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub success: bool,
    pub access_token: Option<String>,
    pub user_id: Option<String>,
    pub plan: Option<String>,
    pub features: Option<Features>,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseCheckResponse {
    pub valid: bool,
    pub plan: String,
    pub expires_at: Option<String>,
    pub features: Features,
    pub message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformLoginResult {
    pub success: bool,
    pub plan: Option<String>,
    pub message: Option<String>,
}

/// Login to the ParentShield platform
#[tauri::command]
pub async fn platform_login(email: String, password: String) -> Result<PlatformLoginResult, String> {
    let device_id = get_device_id();

    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/auth/login", API_BASE_URL))
        .json(&serde_json::json!({
            "email": email,
            "password": password,
            "device_id": device_id
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Ok(PlatformLoginResult {
            success: false,
            plan: None,
            message: Some("Failed to connect to platform".to_string()),
        });
    }

    let login_response: LoginResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if login_response.success {
        // Store the license state
        let mut state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;
        state.access_token = login_response.access_token;
        state.user_id = login_response.user_id;
        state.plan = login_response.plan.clone().unwrap_or_else(|| "none".to_string());
        state.features = login_response.features.unwrap_or_default();
        state.last_checked = Some(chrono::Utc::now().to_rfc3339());

        // Save to local storage
        save_license_state(&state)?;
    }

    Ok(PlatformLoginResult {
        success: login_response.success,
        plan: login_response.plan,
        message: login_response.message,
    })
}

/// Logout from the platform
#[tauri::command]
pub async fn platform_logout() -> Result<bool, String> {
    let mut state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;
    *state = LicenseState::default();
    save_license_state(&state)?;
    Ok(true)
}

/// Check the current license status
#[tauri::command]
pub async fn check_license() -> Result<LicenseState, String> {
    let state = LICENSE_STATE.lock().map_err(|e| e.to_string())?.clone();

    // If we have a token, verify it with the server
    if let Some(ref token) = state.access_token {
        let device_id = get_device_id();

        let client = reqwest::Client::new();
        let response = client
            .post(&format!("{}/license/check", API_BASE_URL))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "device_id": device_id
            }))
            .send()
            .await;

        match response {
            Ok(resp) if resp.status().is_success() => {
                let check_response: LicenseCheckResponse = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse response: {}", e))?;

                // Update the state
                let mut state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;
                state.plan = check_response.plan;
                state.features = check_response.features;
                state.expires_at = check_response.expires_at;
                state.last_checked = Some(chrono::Utc::now().to_rfc3339());
                save_license_state(&state)?;

                return Ok(state.clone());
            }
            Ok(resp) if resp.status().as_u16() == 401 => {
                // Token expired, clear state
                let mut state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;
                state.access_token = None;
                state.plan = "none".to_string();
                state.features = Features::default();
                save_license_state(&state)?;
                return Ok(state.clone());
            }
            _ => {
                // Network error, use cached state
                return Ok(state);
            }
        }
    }

    Ok(state)
}

/// Get the current cached license state without network check
#[tauri::command]
pub fn get_license_state() -> Result<LicenseState, String> {
    let state = LICENSE_STATE.lock().map_err(|e| e.to_string())?.clone();
    Ok(state)
}

/// Check if a specific feature is available
#[tauri::command]
pub fn is_feature_available(feature: String) -> Result<bool, String> {
    let state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;

    let available = match feature.as_str() {
        "website_blocking" => state.features.website_blocking,
        "game_blocking" => state.features.game_blocking,
        "web_dashboard" => state.features.web_dashboard,
        "activity_reports" => state.features.activity_reports,
        "schedules" => state.features.schedules,
        _ => false,
    };

    Ok(available)
}

/// Get the maximum number of blocks allowed
#[tauri::command]
pub fn get_max_blocks() -> Result<i32, String> {
    let state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;
    Ok(state.features.max_blocks)
}

/// Initialize license state from local storage
pub fn init_license_state() -> Result<(), String> {
    if let Ok(saved_state) = load_license_state() {
        let mut state = LICENSE_STATE.lock().map_err(|e| e.to_string())?;
        *state = saved_state;
    }
    Ok(())
}

// Helper functions

fn get_device_id() -> String {
    // Generate or retrieve a unique device ID
    // In production, use a more robust method
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let mut hasher = DefaultHasher::new();
    hostname.hash(&mut hasher);

    format!("{:x}", hasher.finish())
}

fn get_license_file_path() -> Result<std::path::PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not find config directory".to_string())?;
    let app_dir = config_dir.join("ParentShield");
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("license.json"))
}

fn save_license_state(state: &LicenseState) -> Result<(), String> {
    let path = get_license_file_path()?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

fn load_license_state() -> Result<LicenseState, String> {
    let path = get_license_file_path()?;
    if !path.exists() {
        return Ok(LicenseState::default());
    }
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}
