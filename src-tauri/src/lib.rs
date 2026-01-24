//! ParentShield - Cross-platform parental control software.

pub mod blocking;
pub mod commands;
pub mod config;
pub mod daemon;
pub mod scheduler;
pub mod security;

use commands::{
    auth::*, blocking::*, blocklist::*, daemon::*, license::*, schedule::*,
};
use daemon::service::{get_service_manager, ServiceStatus};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

/// Set up signal handlers to ignore terminate signals (Unix only)
#[cfg(unix)]
fn setup_signal_protection() {
    // Ignore SIGTERM, SIGINT, SIGHUP - app can only be closed via password
    unsafe {
        libc::signal(libc::SIGTERM, libc::SIG_IGN);
        libc::signal(libc::SIGINT, libc::SIG_IGN);
        libc::signal(libc::SIGHUP, libc::SIG_IGN);
    }

    tracing::info!("Signal protection enabled - app will resist termination signals");
}

/// Set up process protection on Windows
#[cfg(windows)]
fn setup_signal_protection() {
    use windows::Win32::System::Threading::{SetProcessShutdownParameters, SHUTDOWN_NORETRY};

    // Set high priority for shutdown (last to be closed)
    unsafe {
        let _ = SetProcessShutdownParameters(0x4FF, SHUTDOWN_NORETRY);
    }

    tracing::info!("Windows process protection enabled");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("parentshield=info".parse().unwrap()),
        )
        .init();

    tracing::info!("Starting ParentShield");

    // Set up protection against being killed
    setup_signal_protection();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Create system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show ParentShield", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Create system tray icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("ParentShield - Parental Control")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            // Show window and emit event to request password
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                // Emit quit request event to frontend
                                let _ = window.emit("quit-requested", ());
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Double-click to show window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Initialize license state from local storage
            if let Err(e) = commands::license::init_license_state() {
                tracing::warn!("Failed to initialize license state: {}", e);
            }

            // Ensure daemon is running on app startup
            std::thread::spawn(|| {
                ensure_daemon_running();
                // Enable uninstall protection after startup
                if let Err(e) = security::uninstall_protection::enable_protection() {
                    tracing::warn!("Failed to enable uninstall protection: {}", e);
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Hide the window instead of closing
                let _ = window.hide();
                // Prevent the window from actually closing
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            get_auth_status,
            setup_password,
            verify_password,
            change_password,
            reset_with_master,
            get_master_password,
            quit_with_password,
            enable_uninstall_protection,
            disable_uninstall_protection,
            uninstall_app,
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
            // License commands
            platform_login,
            platform_logout,
            check_license,
            get_license_state,
            is_feature_available,
            get_max_blocks,
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
