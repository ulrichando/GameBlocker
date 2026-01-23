//! Blocking control Tauri commands.

use crate::blocking::{self, process};
use crate::config::ConfigManager;
use crate::daemon::client;
use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockingStatus {
    pub game_blocking_enabled: bool,
    pub ai_blocking_enabled: bool,
    pub dns_blocking_enabled: bool,
    pub browser_blocking_enabled: bool,
    pub currently_blocking: bool,
    pub firewall_blocking_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockedProcess {
    pub pid: u32,
    pub name: String,
}

/// Get current blocking status
#[tauri::command]
pub async fn get_blocking_status() -> Result<BlockingStatus, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let config = manager.load().map_err(|e| e.to_string())?;

    // Check if we're currently in an active blocking period
    let currently_blocking = crate::scheduler::should_block_now(&config.schedules);

    // Check if firewall blocking is active
    #[cfg(target_os = "linux")]
    let firewall_blocking_active = blocking::is_doh_blocked();
    #[cfg(not(target_os = "linux"))]
    let firewall_blocking_active = false;

    Ok(BlockingStatus {
        game_blocking_enabled: config.game_blocking_enabled,
        ai_blocking_enabled: config.ai_blocking_enabled,
        dns_blocking_enabled: config.dns_blocking_enabled,
        browser_blocking_enabled: config.browser_blocking_enabled,
        currently_blocking,
        firewall_blocking_active,
    })
}

/// Toggle game blocking
#[tauri::command]
pub async fn set_game_blocking(enabled: bool) -> Result<bool, String> {
    info!("set_game_blocking called with enabled={}", enabled);

    // Try to use daemon first (no password prompt needed)
    if client::is_daemon_running() {
        info!("Using daemon for game blocking toggle");
        client::update_config(Some(enabled), None, None, None)
            .map_err(|e| e.to_string())?;
        return Ok(enabled);
    }

    // Daemon not running - save config and apply with pkexec
    info!("Daemon not running, saving config and applying blocking");
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    config.game_blocking_enabled = enabled;
    manager.save(&config).map_err(|e| e.to_string())?;

    // Apply blocking (single pkexec call)
    apply_blocking_with_pkexec().map_err(|e| e.to_string())?;

    Ok(enabled)
}

/// Toggle AI service blocking
#[tauri::command]
pub async fn set_ai_blocking(enabled: bool) -> Result<bool, String> {
    info!("set_ai_blocking called with enabled={}", enabled);

    // Try to use daemon first
    if client::is_daemon_running() {
        info!("Using daemon for AI blocking toggle");
        client::update_config(None, Some(enabled), None, None)
            .map_err(|e| e.to_string())?;
        return Ok(enabled);
    }

    // Daemon not running - save config and apply
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    config.ai_blocking_enabled = enabled;
    manager.save(&config).map_err(|e| e.to_string())?;

    apply_blocking_with_pkexec().map_err(|e| e.to_string())?;

    Ok(enabled)
}

/// Toggle browser blocking
#[tauri::command]
pub async fn set_browser_blocking(enabled: bool) -> Result<bool, String> {
    info!("set_browser_blocking called with enabled={}", enabled);

    // Try to use daemon first
    if client::is_daemon_running() {
        info!("Using daemon for browser blocking toggle");
        client::update_config(None, None, None, Some(enabled))
            .map_err(|e| e.to_string())?;
        return Ok(enabled);
    }

    // Daemon not running - just save config
    info!("Daemon not running, saving config only");
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    config.browser_blocking_enabled = enabled;
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(enabled)
}

/// Toggle DNS/network blocking
#[tauri::command]
pub async fn set_dns_blocking(enabled: bool) -> Result<bool, String> {
    info!("set_dns_blocking called with enabled={}", enabled);

    // Try to use daemon first
    if client::is_daemon_running() {
        info!("Using daemon for DNS blocking toggle");
        client::update_config(None, None, Some(enabled), None)
            .map_err(|e| e.to_string())?;
        return Ok(enabled);
    }

    // Daemon not running - save config and apply
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    config.dns_blocking_enabled = enabled;
    manager.save(&config).map_err(|e| e.to_string())?;

    apply_blocking_with_pkexec().map_err(|e| e.to_string())?;

    Ok(enabled)
}


/// Run a blocking check now (scan and terminate blocked processes)
#[tauri::command]
pub async fn run_blocking_check() -> Result<Vec<BlockedProcess>, String> {
    // Try to use daemon first (it runs continuously with root)
    if client::is_daemon_running() {
        info!("Using daemon for blocking check");
        let processes = client::run_blocking_check().map_err(|e| e.to_string())?;
        return Ok(processes
            .into_iter()
            .map(|p| BlockedProcess {
                pid: p.pid,
                name: p.name,
            })
            .collect());
    }

    // Daemon not running - process blocking requires root privileges
    // Just return empty list (can't terminate processes without root)
    info!("Daemon not running, skipping process blocking check");
    Ok(Vec::new())
}

/// List running processes
#[tauri::command]
pub async fn list_processes() -> Result<Vec<BlockedProcess>, String> {
    let blocker = process::create_blocker();
    let processes = blocker.list_processes().map_err(|e| e.to_string())?;

    Ok(processes
        .into_iter()
        .map(|p| BlockedProcess {
            pid: p.pid,
            name: p.name,
        })
        .collect())
}

/// Apply current blocking settings (call on app start/login)
#[tauri::command]
pub async fn apply_blocking() -> Result<(), String> {
    // Try to use daemon first (runs as root, no password prompt)
    if client::is_daemon_running() {
        info!("Using daemon for apply_blocking");
        client::apply_blocking().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Daemon not running - apply blocking with single pkexec call
    info!("Daemon not running, applying blocking with pkexec");
    apply_blocking_with_pkexec().map_err(|e| e.to_string())?;
    Ok(())
}

/// Apply all blocking with a single pkexec call (for when daemon isn't running)
fn apply_blocking_with_pkexec() -> std::io::Result<()> {
    let manager = ConfigManager::new().map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
    })?;
    let config = manager.load().map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::Other, e.to_string())
    })?;

    let should_block = crate::scheduler::should_block_now(&config.schedules);
    let any_blocking = config.game_blocking_enabled || config.ai_blocking_enabled || config.dns_blocking_enabled;

    if !should_block || !any_blocking {
        info!("Blocking not active, clearing hosts file");
        return blocking::unblock_all_domains();
    }

    // Build domains to block
    let mut domains: std::collections::HashSet<String> = std::collections::HashSet::new();

    if config.game_blocking_enabled {
        domains.extend(blocking::get_default_gaming_domains());
    }
    if config.ai_blocking_enabled {
        domains.extend(blocking::get_default_ai_domains());
    }
    if config.dns_blocking_enabled {
        domains.extend(config.blocked_domains.clone());
    }

    // Remove allowed domains
    for allowed in &config.allowed_domains {
        domains.remove(allowed);
    }

    if domains.is_empty() {
        return blocking::unblock_all_domains();
    }

    info!("Blocking {} domains via hosts file", domains.len());
    blocking::block_domains(&domains)
}

/// Disable DNS-over-HTTPS in all browsers for effective blocking
#[tauri::command]
pub async fn disable_browser_doh() -> Result<Vec<String>, String> {
    use tracing::info;
    info!("Disabling DNS-over-HTTPS in browsers...");

    blocking::disable_doh_all_browsers().map_err(|e| e.to_string())
}

/// Re-enable DNS-over-HTTPS in all browsers
#[tauri::command]
pub async fn enable_browser_doh() -> Result<Vec<String>, String> {
    use tracing::info;
    info!("Re-enabling DNS-over-HTTPS in browsers...");

    blocking::enable_doh_all_browsers().map_err(|e| e.to_string())
}

/// Check if DoH is currently disabled
#[tauri::command]
pub async fn is_doh_disabled() -> Result<bool, String> {
    Ok(blocking::is_doh_disabled())
}

/// Enable firewall-level blocking (blocks DoH providers to enforce hosts file)
#[tauri::command]
pub async fn enable_firewall_blocking() -> Result<bool, String> {
    info!("Enabling firewall-level DoH blocking...");

    // Try to use daemon first (runs as root, no password prompt)
    if client::is_daemon_running() {
        info!("Using daemon for firewall blocking");
        client::enable_firewall().map_err(|e| e.to_string())?;
        return Ok(true);
    }

    // Daemon not running - firewall requires root
    info!("Daemon not running - install and start the background service first");
    Err("Please install and start the background service to enable firewall blocking".to_string())
}

/// Disable firewall-level blocking
#[tauri::command]
pub async fn disable_firewall_blocking() -> Result<bool, String> {
    info!("Disabling firewall-level DoH blocking...");

    // Try to use daemon first
    if client::is_daemon_running() {
        info!("Using daemon to disable firewall blocking");
        client::disable_firewall().map_err(|e| e.to_string())?;
        return Ok(false);
    }

    // Daemon not running - firewall requires root
    info!("Daemon not running - firewall is already disabled");
    Ok(false)
}

/// Check if firewall blocking is currently active
#[tauri::command]
pub async fn is_firewall_blocking_active() -> Result<bool, String> {
    #[cfg(target_os = "linux")]
    {
        Ok(blocking::is_doh_blocked())
    }

    #[cfg(not(target_os = "linux"))]
    {
        Ok(false)
    }
}
