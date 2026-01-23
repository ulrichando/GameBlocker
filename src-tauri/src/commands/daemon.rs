//! Tauri commands for daemon management.

use crate::daemon::{client, service};
use serde::{Deserialize, Serialize};

/// Daemon status returned to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonStatus {
    pub installed: bool,
    pub running: bool,
    pub blocking_active: bool,
    pub game_blocking: bool,
    pub ai_blocking: bool,
    pub dns_blocking: bool,
    pub browser_blocking: bool,
    pub firewall_active: bool,
    pub blocked_count: u32,
    pub uptime_secs: u64,
}

/// Check if daemon is installed
#[tauri::command]
pub async fn is_daemon_installed() -> bool {
    let manager = service::get_service_manager();
    manager.is_installed()
}

/// Check if daemon is running
#[tauri::command]
pub async fn is_daemon_running() -> bool {
    client::is_daemon_running()
}

/// Get full daemon status
#[tauri::command]
pub async fn get_daemon_status() -> Result<DaemonStatus, String> {
    let manager = service::get_service_manager();
    let installed = manager.is_installed();

    if !installed {
        return Ok(DaemonStatus {
            installed: false,
            running: false,
            blocking_active: false,
            game_blocking: false,
            ai_blocking: false,
            dns_blocking: false,
            browser_blocking: false,
            firewall_active: false,
            blocked_count: 0,
            uptime_secs: 0,
        });
    }

    match client::get_status() {
        Ok(status) => Ok(DaemonStatus {
            installed: true,
            running: status.running,
            blocking_active: status.blocking_active,
            game_blocking: status.game_blocking,
            ai_blocking: status.ai_blocking,
            dns_blocking: status.dns_blocking,
            browser_blocking: status.browser_blocking,
            firewall_active: status.firewall_active,
            blocked_count: status.blocked_count,
            uptime_secs: status.uptime_secs,
        }),
        Err(_) => {
            // Daemon installed but not responding - might be stopped
            let service_status = manager.status();
            Ok(DaemonStatus {
                installed: true,
                running: service_status == service::ServiceStatus::Running,
                blocking_active: false,
                game_blocking: false,
                ai_blocking: false,
                dns_blocking: false,
                browser_blocking: false,
                firewall_active: false,
                blocked_count: 0,
                uptime_secs: 0,
            })
        }
    }
}

/// Install the daemon service (requires root)
#[tauri::command]
pub async fn install_daemon() -> Result<(), String> {
    let manager = service::get_service_manager();
    manager.install().map_err(|e| e.to_string())
}

/// Uninstall the daemon service (requires root)
#[tauri::command]
pub async fn uninstall_daemon() -> Result<(), String> {
    let manager = service::get_service_manager();
    manager.uninstall().map_err(|e| e.to_string())
}

/// Start the daemon service
#[tauri::command]
pub async fn start_daemon() -> Result<(), String> {
    let manager = service::get_service_manager();
    manager.start().map_err(|e| e.to_string())
}

/// Stop the daemon service
#[tauri::command]
pub async fn stop_daemon() -> Result<(), String> {
    let manager = service::get_service_manager();
    manager.stop().map_err(|e| e.to_string())
}

/// Update blocking configuration via daemon
#[tauri::command]
pub async fn daemon_update_config(
    game_blocking: Option<bool>,
    ai_blocking: Option<bool>,
    dns_blocking: Option<bool>,
    browser_blocking: Option<bool>,
) -> Result<(), String> {
    client::update_config(game_blocking, ai_blocking, dns_blocking, browser_blocking)
        .map_err(|e| e.to_string())
}

/// Run blocking check via daemon
#[tauri::command]
pub async fn daemon_run_blocking_check() -> Result<Vec<crate::commands::blocking::BlockedProcess>, String> {
    let processes = client::run_blocking_check().map_err(|e| e.to_string())?;

    Ok(processes
        .into_iter()
        .map(|p| crate::commands::blocking::BlockedProcess {
            pid: p.pid,
            name: p.name,
        })
        .collect())
}

/// Apply blocking settings via daemon
#[tauri::command]
pub async fn daemon_apply_blocking() -> Result<(), String> {
    client::apply_blocking().map_err(|e| e.to_string())
}

/// Enable firewall blocking via daemon
#[tauri::command]
pub async fn daemon_enable_firewall() -> Result<(), String> {
    client::enable_firewall().map_err(|e| e.to_string())
}

/// Disable firewall blocking via daemon
#[tauri::command]
pub async fn daemon_disable_firewall() -> Result<(), String> {
    client::disable_firewall().map_err(|e| e.to_string())
}
