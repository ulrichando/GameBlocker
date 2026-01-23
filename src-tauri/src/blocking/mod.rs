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
