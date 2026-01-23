//! macOS network configuration using pf and scutil.

use std::fs;
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum MacOSNetworkError {
    #[error("Command failed: {0}")]
    CommandFailed(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Root privileges required")]
    RootRequired,
}

const PF_RULES_PATH: &str = "/etc/pf.anchors/gameblocker";

/// Configure DNS redirect using pf
pub fn setup_dns_redirect(proxy_port: u16) -> Result<(), MacOSNetworkError> {
    // Create pf rules file
    let rules = format!(
        r#"# GameBlocker DNS redirect rules
rdr pass on lo0 proto udp from any to any port 53 -> 127.0.0.1 port {}
"#,
        proxy_port
    );

    fs::write(PF_RULES_PATH, &rules)?;

    // Load the anchor
    let output = Command::new("pfctl")
        .args(["-a", "gameblocker", "-f", PF_RULES_PATH])
        .output()
        .map_err(|e| MacOSNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!(
            "Failed to load pf rules: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    // Enable pf if not already enabled
    let _ = Command::new("pfctl").args(["-e"]).output();

    // Also set system DNS via scutil
    let _ = Command::new("networksetup")
        .args(["-setdnsservers", "Wi-Fi", "127.0.0.1"])
        .output();

    tracing::info!("DNS redirect configured via pf");
    Ok(())
}

/// Remove DNS redirect
pub fn remove_dns_redirect() -> Result<(), MacOSNetworkError> {
    // Flush the anchor
    let _ = Command::new("pfctl")
        .args(["-a", "gameblocker", "-F", "all"])
        .output();

    // Remove rules file
    let _ = fs::remove_file(PF_RULES_PATH);

    // Restore DHCP DNS
    let _ = Command::new("networksetup")
        .args(["-setdnsservers", "Wi-Fi", "empty"])
        .output();

    Ok(())
}

/// Block common VPN ports using pf
pub fn block_vpn_ports() -> Result<(), MacOSNetworkError> {
    let rules = r#"# GameBlocker VPN blocking rules
block out proto udp to any port 1194   # OpenVPN
block out proto tcp to any port 1194   # OpenVPN
block out proto udp to any port 500    # IKEv2
block out proto udp to any port 4500   # IKEv2 NAT-T
block out proto udp to any port 51820  # WireGuard
block out proto udp to any port 1701   # L2TP
"#;

    let vpn_rules_path = "/etc/pf.anchors/gameblocker-vpn";
    fs::write(vpn_rules_path, rules)?;

    let output = Command::new("pfctl")
        .args(["-a", "gameblocker-vpn", "-f", vpn_rules_path])
        .output()
        .map_err(|e| MacOSNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!(
            "Failed to load VPN blocking rules: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    tracing::info!("VPN ports blocked via pf");
    Ok(())
}

/// Unblock VPN ports
pub fn unblock_vpn_ports() -> Result<(), MacOSNetworkError> {
    let _ = Command::new("pfctl")
        .args(["-a", "gameblocker-vpn", "-F", "all"])
        .output();

    let _ = fs::remove_file("/etc/pf.anchors/gameblocker-vpn");

    Ok(())
}
