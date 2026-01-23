//! Windows network configuration using netsh and Windows Firewall.

use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WindowsNetworkError {
    #[error("Command failed: {0}")]
    CommandFailed(String),
    #[error("Administrator privileges required")]
    AdminRequired,
}

/// Configure DNS settings to use local proxy
pub fn setup_dns_redirect(proxy_port: u16) -> Result<(), WindowsNetworkError> {
    // Get active network adapters and set DNS
    let output = Command::new("netsh")
        .args([
            "interface",
            "ip",
            "set",
            "dns",
            "name=\"Local Area Connection\"",
            "static",
            &format!("127.0.0.1:{}", proxy_port),
        ])
        .output()
        .map_err(|e| WindowsNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        // Try Wi-Fi adapter
        let wifi_output = Command::new("netsh")
            .args([
                "interface",
                "ip",
                "set",
                "dns",
                "name=\"Wi-Fi\"",
                "static",
                "127.0.0.1",
            ])
            .output()
            .map_err(|e| WindowsNetworkError::CommandFailed(e.to_string()))?;

        if !wifi_output.status.success() {
            return Err(WindowsNetworkError::CommandFailed(
                String::from_utf8_lossy(&wifi_output.stderr).to_string(),
            ));
        }
    }

    tracing::info!("DNS redirect configured via netsh");
    Ok(())
}

/// Remove DNS redirect and restore DHCP
pub fn remove_dns_redirect() -> Result<(), WindowsNetworkError> {
    // Restore DHCP DNS
    let _ = Command::new("netsh")
        .args([
            "interface",
            "ip",
            "set",
            "dns",
            "name=\"Local Area Connection\"",
            "dhcp",
        ])
        .output();

    let _ = Command::new("netsh")
        .args(["interface", "ip", "set", "dns", "name=\"Wi-Fi\"", "dhcp"])
        .output();

    Ok(())
}

/// Block common VPN ports using Windows Firewall
pub fn block_vpn_ports() -> Result<(), WindowsNetworkError> {
    let vpn_rules = [
        ("BlockOpenVPN-UDP", "UDP", "1194"),
        ("BlockOpenVPN-TCP", "TCP", "1194"),
        ("BlockIKEv2", "UDP", "500"),
        ("BlockIKEv2-NAT", "UDP", "4500"),
        ("BlockWireGuard", "UDP", "51820"),
        ("BlockL2TP", "UDP", "1701"),
    ];

    for (name, protocol, port) in vpn_rules {
        let output = Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "add",
                "rule",
                &format!("name={}", name),
                "dir=out",
                "action=block",
                &format!("protocol={}", protocol),
                &format!("remoteport={}", port),
            ])
            .output()
            .map_err(|e| WindowsNetworkError::CommandFailed(e.to_string()))?;

        if !output.status.success() {
            tracing::warn!(
                "Failed to add firewall rule {}: {}",
                name,
                String::from_utf8_lossy(&output.stderr)
            );
        }
    }

    tracing::info!("VPN ports blocked via Windows Firewall");
    Ok(())
}

/// Unblock VPN ports
pub fn unblock_vpn_ports() -> Result<(), WindowsNetworkError> {
    let rule_names = [
        "BlockOpenVPN-UDP",
        "BlockOpenVPN-TCP",
        "BlockIKEv2",
        "BlockIKEv2-NAT",
        "BlockWireGuard",
        "BlockL2TP",
    ];

    for name in rule_names {
        let _ = Command::new("netsh")
            .args([
                "advfirewall",
                "firewall",
                "delete",
                "rule",
                &format!("name={}", name),
            ])
            .output();
    }

    Ok(())
}
