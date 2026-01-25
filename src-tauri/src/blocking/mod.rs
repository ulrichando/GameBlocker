pub mod blocklists;
pub mod browser;
pub mod hosts;
pub mod network;
pub mod process;

pub use blocklists::*;
pub use browser::*;
pub use hosts::*;

// Re-export network blocking functions for Linux
#[cfg(target_os = "linux")]
pub use network::linux::{
    apply_network_blocking, block_doh_providers, is_doh_blocked, remove_network_blocking,
    unblock_doh_providers,
    // Direct functions for daemon (running as root)
    apply_network_blocking_direct, block_doh_providers_direct, remove_network_blocking_direct,
    unblock_doh_providers_direct,
};

// Stub implementations for non-Linux platforms
#[cfg(not(target_os = "linux"))]
pub fn is_doh_blocked() -> bool {
    false // Network firewall blocking not implemented on this platform
}

#[cfg(not(target_os = "linux"))]
pub fn apply_network_blocking() -> Result<(), Box<dyn std::error::Error>> {
    Ok(()) // No-op on non-Linux
}

#[cfg(not(target_os = "linux"))]
pub fn remove_network_blocking() -> Result<(), Box<dyn std::error::Error>> {
    Ok(()) // No-op on non-Linux
}

#[cfg(not(target_os = "linux"))]
pub fn block_doh_providers() -> Result<(), Box<dyn std::error::Error>> {
    Ok(()) // No-op on non-Linux
}

#[cfg(not(target_os = "linux"))]
pub fn unblock_doh_providers() -> Result<(), Box<dyn std::error::Error>> {
    Ok(()) // No-op on non-Linux
}
