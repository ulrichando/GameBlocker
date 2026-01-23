//! Linux network configuration using iptables.

use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LinuxNetworkError {
    #[error("Command failed: {0}")]
    CommandFailed(String),
    #[error("iptables not available")]
    IptablesNotAvailable,
}

/// Known DNS-over-HTTPS provider IPs that bypass hosts file blocking
const DOH_PROVIDER_IPS: &[&str] = &[
    // Cloudflare DNS
    "1.1.1.1",
    "1.0.0.1",
    "2606:4700:4700::1111",
    "2606:4700:4700::1001",
    // Google DNS
    "8.8.8.8",
    "8.8.4.4",
    "2001:4860:4860::8888",
    "2001:4860:4860::8844",
    // Quad9
    "9.9.9.9",
    "149.112.112.112",
    "2620:fe::fe",
    "2620:fe::9",
    // OpenDNS
    "208.67.222.222",
    "208.67.220.220",
    // NextDNS
    "45.90.28.0",
    "45.90.30.0",
    // AdGuard DNS
    "94.140.14.14",
    "94.140.15.15",
    // CleanBrowsing
    "185.228.168.168",
    "185.228.169.168",
    // Comodo Secure DNS
    "8.26.56.26",
    "8.20.247.20",
];

/// Chain name for GameBlocker rules
const CHAIN_NAME: &str = "GAMEBLOCKER";

/// Configure DNS redirect to local proxy using iptables
pub fn setup_dns_redirect(proxy_port: u16) -> Result<(), LinuxNetworkError> {
    // Check if iptables is available
    let check = Command::new("which")
        .arg("iptables")
        .output()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    if !check.status.success() {
        return Err(LinuxNetworkError::IptablesNotAvailable);
    }

    // Redirect DNS (port 53) to local proxy
    let output = Command::new("iptables")
        .args([
            "-t",
            "nat",
            "-A",
            "OUTPUT",
            "-p",
            "udp",
            "--dport",
            "53",
            "-j",
            "REDIRECT",
            "--to-port",
            &proxy_port.to_string(),
        ])
        .output()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        return Err(LinuxNetworkError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    tracing::info!("DNS redirect configured via iptables");
    Ok(())
}

/// Remove DNS redirect rules
pub fn remove_dns_redirect(proxy_port: u16) -> Result<(), LinuxNetworkError> {
    let output = Command::new("iptables")
        .args([
            "-t",
            "nat",
            "-D",
            "OUTPUT",
            "-p",
            "udp",
            "--dport",
            "53",
            "-j",
            "REDIRECT",
            "--to-port",
            &proxy_port.to_string(),
        ])
        .output()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        tracing::warn!(
            "Failed to remove iptables rule: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    Ok(())
}

/// Block common VPN ports (included in the main blocking script)
fn build_vpn_block_script() -> String {
    let vpn_ports = [
        ("1194", "udp"),  // OpenVPN
        ("1194", "tcp"),  // OpenVPN
        ("500", "udp"),   // IKEv2/IPSec
        ("4500", "udp"),  // IKEv2 NAT-T
        ("51820", "udp"), // WireGuard
        ("1701", "udp"),  // L2TP
    ];

    let mut script = String::new();
    for (port, protocol) in vpn_ports {
        script.push_str(&format!(
            "iptables -A OUTPUT -p {} --dport {} -j DROP 2>/dev/null || true\n",
            protocol, port
        ));
    }
    script
}

/// Build script to unblock VPN ports
fn build_vpn_unblock_script() -> String {
    let vpn_ports = [
        ("1194", "udp"),
        ("1194", "tcp"),
        ("500", "udp"),
        ("4500", "udp"),
        ("51820", "udp"),
        ("1701", "udp"),
    ];

    let mut script = String::new();
    for (port, protocol) in vpn_ports {
        script.push_str(&format!(
            "iptables -D OUTPUT -p {} --dport {} -j DROP 2>/dev/null || true\n",
            protocol, port
        ));
    }
    script
}

/// Block common VPN ports
pub fn block_vpn_ports() -> Result<(), LinuxNetworkError> {
    let script = build_vpn_block_script();
    run_iptables_batch(&script)?;
    tracing::info!("VPN ports blocked");
    Ok(())
}

/// Unblock VPN ports
pub fn unblock_vpn_ports() -> Result<(), LinuxNetworkError> {
    let script = build_vpn_unblock_script();
    let _ = run_iptables_batch(&script); // Ignore errors on unblock
    Ok(())
}

/// Run a batch of iptables/ip6tables commands with a single pkexec call
fn run_iptables_batch(script: &str) -> Result<(), LinuxNetworkError> {
    // Check if pkexec is available
    let pkexec_check = Command::new("which")
        .arg("pkexec")
        .output();

    if pkexec_check.is_err() || !pkexec_check.unwrap().status.success() {
        tracing::error!("pkexec not found. Install polkit to enable firewall blocking.");
        return Err(LinuxNetworkError::CommandFailed(
            "pkexec not found. Install polkit package.".to_string(),
        ));
    }

    // Run the script with pkexec sh -c
    let child = Command::new("pkexec")
        .args(["sh", "-c", script])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    let output = child.wait_with_output()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let exit_code = output.status.code().unwrap_or(-1);

        if exit_code == 126 {
            tracing::warn!("Authentication was cancelled");
            return Err(LinuxNetworkError::CommandFailed(
                "Authentication was cancelled".to_string(),
            ));
        }

        // Log but don't fail for minor iptables errors (chain exists, rule not found, etc.)
        if !stderr.is_empty() {
            tracing::debug!("iptables batch output: {}", stderr);
        }
    }

    Ok(())
}

/// Build script to create the GameBlocker chain if it doesn't exist
fn build_ensure_chain_script() -> String {
    format!(
        r#"
# Create chains (ignore error if they exist)
iptables -N {chain} 2>/dev/null || true
ip6tables -N {chain} 2>/dev/null || true

# Add jump to chain from OUTPUT if not already there
iptables -C OUTPUT -j {chain} 2>/dev/null || iptables -I OUTPUT 1 -j {chain}
ip6tables -C OUTPUT -j {chain} 2>/dev/null || ip6tables -I OUTPUT 1 -j {chain}
"#,
        chain = CHAIN_NAME
    )
}

/// Block all known DNS-over-HTTPS providers to enforce hosts file blocking
pub fn block_doh_providers() -> Result<(), LinuxNetworkError> {
    tracing::info!("Blocking DNS-over-HTTPS providers...");

    // Build a single script with all iptables commands
    let mut script = build_ensure_chain_script();

    // Add rules to block DoH providers on port 443
    for ip in DOH_PROVIDER_IPS {
        if ip.contains(':') {
            // IPv6 address
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        } else {
            // IPv4 address
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        }
    }

    // Also block DNS (port 53) to these IPs to force local resolver
    for ip in DOH_PROVIDER_IPS {
        if ip.contains(':') {
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        } else {
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        }
    }

    // Execute all commands with a single pkexec call
    run_iptables_batch(&script)?;

    tracing::info!("DoH providers blocked successfully");
    Ok(())
}

/// Remove all GameBlocker firewall rules
pub fn unblock_doh_providers() -> Result<(), LinuxNetworkError> {
    tracing::info!("Removing DoH blocking rules...");

    // Build a single script to remove all rules
    let script = format!(
        r#"
# Flush the chains (ignore errors if they don't exist)
iptables -F {chain} 2>/dev/null || true
ip6tables -F {chain} 2>/dev/null || true

# Remove jump from OUTPUT
iptables -D OUTPUT -j {chain} 2>/dev/null || true
ip6tables -D OUTPUT -j {chain} 2>/dev/null || true

# Delete the chains
iptables -X {chain} 2>/dev/null || true
ip6tables -X {chain} 2>/dev/null || true
"#,
        chain = CHAIN_NAME
    );

    // Execute with a single pkexec call
    run_iptables_batch(&script)?;

    tracing::info!("DoH blocking rules removed");
    Ok(())
}

/// Check if DoH blocking is currently active
pub fn is_doh_blocked() -> bool {
    let output = Command::new("iptables")
        .args(["-L", CHAIN_NAME])
        .output();

    if let Ok(result) = output {
        if result.status.success() {
            let stdout = String::from_utf8_lossy(&result.stdout);
            return stdout.contains("DROP");
        }
    }
    false
}

/// Apply full network blocking (DoH + VPN) with a single authentication prompt
pub fn apply_network_blocking() -> Result<(), LinuxNetworkError> {
    tracing::info!("Applying full network blocking (DoH + VPN)...");

    // Build a combined script for all blocking rules
    let mut script = build_ensure_chain_script();

    // Add DoH blocking rules
    for ip in DOH_PROVIDER_IPS {
        if ip.contains(':') {
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        } else {
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        }
    }

    // Add VPN blocking rules
    script.push_str(&build_vpn_block_script());

    // Execute everything with a single pkexec call
    run_iptables_batch(&script)?;

    tracing::info!("Full network blocking applied successfully");
    Ok(())
}

/// Remove all network blocking rules with a single authentication prompt
pub fn remove_network_blocking() -> Result<(), LinuxNetworkError> {
    tracing::info!("Removing all network blocking rules...");

    // Build a combined script to remove all rules
    let script = format!(
        r#"
# Flush the GameBlocker chains
iptables -F {chain} 2>/dev/null || true
ip6tables -F {chain} 2>/dev/null || true

# Remove jump from OUTPUT
iptables -D OUTPUT -j {chain} 2>/dev/null || true
ip6tables -D OUTPUT -j {chain} 2>/dev/null || true

# Delete the chains
iptables -X {chain} 2>/dev/null || true
ip6tables -X {chain} 2>/dev/null || true

# Remove VPN port blocks
{vpn_unblock}
"#,
        chain = CHAIN_NAME,
        vpn_unblock = build_vpn_unblock_script()
    );

    // Execute with a single pkexec call
    run_iptables_batch(&script)?;

    tracing::info!("All network blocking rules removed");
    Ok(())
}

// ============================================================================
// Direct functions for daemon (running as root, no pkexec needed)
// ============================================================================

/// Run iptables commands directly (for daemon running as root)
fn run_iptables_direct(script: &str) -> Result<(), LinuxNetworkError> {
    let child = Command::new("sh")
        .args(["-c", script])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    let output = child.wait_with_output()
        .map_err(|e| LinuxNetworkError::CommandFailed(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.is_empty() {
            tracing::debug!("iptables direct output: {}", stderr);
        }
    }

    Ok(())
}

/// Block DoH providers directly (for daemon running as root)
pub fn block_doh_providers_direct() -> Result<(), LinuxNetworkError> {
    tracing::info!("Blocking DNS-over-HTTPS providers (direct)...");

    let mut script = build_ensure_chain_script();

    for ip in DOH_PROVIDER_IPS {
        if ip.contains(':') {
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        } else {
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        }
    }

    for ip in DOH_PROVIDER_IPS {
        if ip.contains(':') {
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        } else {
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        }
    }

    run_iptables_direct(&script)?;

    tracing::info!("DoH providers blocked successfully (direct)");
    Ok(())
}

/// Remove DoH blocking rules directly (for daemon running as root)
pub fn unblock_doh_providers_direct() -> Result<(), LinuxNetworkError> {
    tracing::info!("Removing DoH blocking rules (direct)...");

    let script = format!(
        r#"
iptables -F {chain} 2>/dev/null || true
ip6tables -F {chain} 2>/dev/null || true
iptables -D OUTPUT -j {chain} 2>/dev/null || true
ip6tables -D OUTPUT -j {chain} 2>/dev/null || true
iptables -X {chain} 2>/dev/null || true
ip6tables -X {chain} 2>/dev/null || true
"#,
        chain = CHAIN_NAME
    );

    run_iptables_direct(&script)?;

    tracing::info!("DoH blocking rules removed (direct)");
    Ok(())
}

/// Apply full network blocking directly (for daemon running as root)
pub fn apply_network_blocking_direct() -> Result<(), LinuxNetworkError> {
    tracing::info!("Applying full network blocking (direct)...");

    let mut script = build_ensure_chain_script();

    for ip in DOH_PROVIDER_IPS {
        if ip.contains(':') {
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "ip6tables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        } else {
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 443 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p udp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
            script.push_str(&format!(
                "iptables -A {chain} -d {ip} -p tcp --dport 53 -j DROP 2>/dev/null || true\n",
                chain = CHAIN_NAME, ip = ip
            ));
        }
    }

    script.push_str(&build_vpn_block_script());

    run_iptables_direct(&script)?;

    tracing::info!("Full network blocking applied (direct)");
    Ok(())
}

/// Remove all network blocking rules directly (for daemon running as root)
pub fn remove_network_blocking_direct() -> Result<(), LinuxNetworkError> {
    tracing::info!("Removing all network blocking rules (direct)...");

    let script = format!(
        r#"
iptables -F {chain} 2>/dev/null || true
ip6tables -F {chain} 2>/dev/null || true
iptables -D OUTPUT -j {chain} 2>/dev/null || true
ip6tables -D OUTPUT -j {chain} 2>/dev/null || true
iptables -X {chain} 2>/dev/null || true
ip6tables -X {chain} 2>/dev/null || true
{vpn_unblock}
"#,
        chain = CHAIN_NAME,
        vpn_unblock = build_vpn_unblock_script()
    );

    run_iptables_direct(&script)?;

    tracing::info!("All network blocking rules removed (direct)");
    Ok(())
}
