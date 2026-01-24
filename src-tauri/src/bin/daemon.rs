//! ParentShield daemon binary entry point.
//!
//! This binary runs as a systemd service with root privileges to:
//! - Continuously monitor and terminate blocked processes
//! - Manage hosts file blocking without password prompts
//! - Apply firewall rules for DoH blocking
//! - Communicate with the GUI via Unix domain socket

use parentshield_lib::daemon::runner;
use std::process::ExitCode;

fn main() -> ExitCode {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("parentshield=info".parse().unwrap()),
        )
        .with_target(false)
        .init();

    tracing::info!("ParentShield daemon starting...");

    // Check if running as root
    #[cfg(unix)]
    {
        if !nix::unistd::geteuid().is_root() {
            tracing::error!("Daemon must run as root. Use 'sudo' or run via systemd.");
            return ExitCode::from(1);
        }
    }

    // Run the daemon
    match runner::run_daemon() {
        Ok(_) => {
            tracing::info!("Daemon exited normally");
            ExitCode::SUCCESS
        }
        Err(e) => {
            tracing::error!("Daemon error: {}", e);
            ExitCode::from(1)
        }
    }
}
