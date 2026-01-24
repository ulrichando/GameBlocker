//! GameBlocker - Cross-platform parental control software.

pub mod blocking;
pub mod commands;
pub mod config;
pub mod daemon;
pub mod scheduler;
pub mod security;

use commands::{
    auth::*, blocking::*, blocklist::*, daemon::*, schedule::*,
};
use daemon::service::{get_service_manager, ServiceStatus};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("gameblocker=info".parse().unwrap()),
        )
        .init();

    tracing::info!("Starting GameBlocker");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            // Ensure daemon is running on app startup
            std::thread::spawn(|| {
                ensure_daemon_running();
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            get_auth_status,
            setup_password,
            verify_password,
            change_password,
            reset_with_master,
            get_master_password,
            // Blocking commands
            get_blocking_status,
            set_game_blocking,
            set_ai_blocking,
            set_dns_blocking,
            set_browser_blocking,
            run_blocking_check,
            list_processes,
            apply_blocking,
            disable_browser_doh,
            enable_browser_doh,
            is_doh_disabled,
            enable_firewall_blocking,
            disable_firewall_blocking,
            is_firewall_blocking_active,
            // Schedule commands
            get_schedules,
            add_schedule,
            update_schedule,
            delete_schedule,
            add_preset_schedule,
            should_block_now,
            // Blocklist commands
            get_blocklists,
            add_blocked_process,
            remove_blocked_process,
            add_blocked_domain,
            remove_blocked_domain,
            add_to_whitelist,
            remove_from_whitelist,
            // Daemon commands
            is_daemon_installed,
            is_daemon_running,
            get_daemon_status,
            install_daemon,
            uninstall_daemon,
            start_daemon,
            stop_daemon,
            daemon_update_config,
            daemon_run_blocking_check,
            daemon_apply_blocking,
            daemon_enable_firewall,
            daemon_disable_firewall,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Ensure the daemon is running on app startup.
/// This checks if the daemon is installed and running, and attempts to start it if not.
fn ensure_daemon_running() {
    let manager = get_service_manager();

    if !manager.is_installed() {
        tracing::info!("Daemon not installed, skipping auto-start");
        return;
    }

    let status = manager.status();
    match status {
        ServiceStatus::Running => {
            tracing::info!("Daemon is already running");
        }
        ServiceStatus::Stopped => {
            tracing::info!("Daemon is stopped, attempting to start...");
            match manager.start() {
                Ok(()) => {
                    tracing::info!("Daemon started successfully");
                }
                Err(e) => {
                    tracing::warn!("Failed to start daemon: {}", e);
                }
            }
        }
        ServiceStatus::NotInstalled => {
            tracing::info!("Daemon service file exists but systemd reports not installed");
        }
        ServiceStatus::Unknown => {
            tracing::warn!("Daemon status unknown, attempting to start...");
            if let Err(e) = manager.start() {
                tracing::warn!("Failed to start daemon: {}", e);
            }
        }
    }
}
