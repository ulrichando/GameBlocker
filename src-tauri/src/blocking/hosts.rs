//! Hosts file-based domain blocking for Linux and macOS.
//! Adds blocked domains to /etc/hosts pointing to 127.0.0.1.

use std::collections::HashSet;
use std::fs;
use std::io::{self, Write};
use std::process::Command;
use tracing::{info, error};

const HOSTS_PATH: &str = "/etc/hosts";
const MARKER_START: &str = "# GameBlocker START - DO NOT EDIT THIS SECTION";
const MARKER_END: &str = "# GameBlocker END";

/// Block domains by adding them to /etc/hosts
pub fn block_domains(domains: &HashSet<String>) -> io::Result<()> {
    info!("Blocking {} domains via hosts file", domains.len());

    if domains.is_empty() {
        info!("No domains to block");
        return Ok(());
    }

    // Read current hosts file
    let content = fs::read_to_string(HOSTS_PATH)?;

    // Remove any existing GameBlocker section
    let cleaned = remove_gameblocker_section(&content);

    // Build new GameBlocker section
    let mut new_section = String::new();
    new_section.push_str(&format!("\n{}\n", MARKER_START));

    for domain in domains {
        new_section.push_str(&format!("127.0.0.1 {}\n", domain));
        new_section.push_str(&format!("127.0.0.1 www.{}\n", domain));
        new_section.push_str(&format!("::1 {}\n", domain));
        new_section.push_str(&format!("::1 www.{}\n", domain));
    }

    new_section.push_str(&format!("{}\n", MARKER_END));

    // Write back using pkexec for root access
    let new_content = format!("{}{}", cleaned.trim_end(), new_section);
    write_hosts_file(&new_content)?;

    // Flush DNS cache
    flush_dns_cache();

    Ok(())
}

/// Unblock all domains by removing GameBlocker section from /etc/hosts
pub fn unblock_all_domains() -> io::Result<()> {
    let content = fs::read_to_string(HOSTS_PATH)?;
    let cleaned = remove_gameblocker_section(&content);
    write_hosts_file(&cleaned)?;
    flush_dns_cache();
    Ok(())
}

/// Remove the GameBlocker section from hosts content
fn remove_gameblocker_section(content: &str) -> String {
    let mut result = String::new();
    let mut in_section = false;

    for line in content.lines() {
        if line.contains(MARKER_START) {
            in_section = true;
            continue;
        }
        if line.contains(MARKER_END) {
            in_section = false;
            continue;
        }
        if !in_section {
            result.push_str(line);
            result.push('\n');
        }
    }

    result
}

/// Write to hosts file with elevated privileges (cross-platform)
fn write_hosts_file(content: &str) -> io::Result<()> {
    // Try direct write first (might work if running as root)
    info!("Attempting to write hosts file...");
    if fs::write(HOSTS_PATH, content).is_ok() {
        info!("Successfully wrote hosts file directly");
        return Ok(());
    }

    info!("Direct write failed, requesting elevated access...");

    #[cfg(target_os = "macos")]
    {
        write_hosts_file_macos(content)
    }

    #[cfg(target_os = "linux")]
    {
        write_hosts_file_linux(content)
    }

    #[cfg(target_os = "windows")]
    {
        write_hosts_file_windows(content)
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "Hosts file modification not supported on this platform",
        ))
    }
}

/// Write hosts file on Linux using pkexec
#[cfg(target_os = "linux")]
fn write_hosts_file_linux(content: &str) -> io::Result<()> {
    // Check if pkexec is available
    let pkexec_check = Command::new("which")
        .arg("pkexec")
        .output();

    if pkexec_check.is_err() || !pkexec_check.unwrap().status.success() {
        error!("pkexec not found. Install polkit to enable website blocking.");
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "pkexec not found. Install polkit package to enable website blocking.",
        ));
    }

    let mut child = Command::new("pkexec")
        .args(["tee", HOSTS_PATH])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            error!("Failed to spawn pkexec: {}", e);
            io::Error::new(
                io::ErrorKind::Other,
                format!("Failed to start pkexec. Make sure a polkit authentication agent is running: {}", e),
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(content.as_bytes())?;
    }

    let output = child.wait_with_output()?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        let exit_code = output.status.code().unwrap_or(-1);
        error!("pkexec failed with exit code {}: {}", exit_code, err_msg);

        let user_msg = if exit_code == 126 {
            "Authentication was cancelled. Please authenticate to enable website blocking."
        } else if exit_code == 127 {
            "pkexec command not found. Install polkit package."
        } else {
            "Failed to modify hosts file. Make sure a polkit agent is running (e.g., polkit-gnome-authentication-agent-1)."
        };

        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            user_msg,
        ));
    }

    info!("Successfully wrote hosts file via pkexec");
    Ok(())
}

/// Write hosts file on macOS using osascript for admin privileges
#[cfg(target_os = "macos")]
fn write_hosts_file_macos(content: &str) -> io::Result<()> {
    use std::env;

    // Write content to a temporary file first
    let temp_path = env::temp_dir().join("gameblocker_hosts_temp");
    fs::write(&temp_path, content)?;

    // Use osascript to copy with admin privileges
    let script = format!(
        r#"do shell script "cp '{}' '{}'" with administrator privileges"#,
        temp_path.display(),
        HOSTS_PATH
    );

    let output = Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| {
            error!("Failed to run osascript: {}", e);
            io::Error::new(io::ErrorKind::Other, "Failed to request admin privileges")
        })?;

    // Clean up temp file
    let _ = fs::remove_file(&temp_path);

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        error!("osascript failed: {}", err_msg);

        if err_msg.contains("canceled") || err_msg.contains("cancelled") {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "Authentication was cancelled. Please authenticate to enable website blocking.",
            ));
        }

        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Failed to modify hosts file. Please grant administrator access.",
        ));
    }

    info!("Successfully wrote hosts file via osascript");
    Ok(())
}

/// Write hosts file on Windows (hosts file location is different)
#[cfg(target_os = "windows")]
fn write_hosts_file_windows(content: &str) -> io::Result<()> {
    // Windows hosts file is at C:\Windows\System32\drivers\etc\hosts
    // Tauri apps on Windows can request admin via manifest, but for now
    // we'll try direct write which works if app is run as admin
    let windows_hosts = r"C:\Windows\System32\drivers\etc\hosts";

    fs::write(windows_hosts, content).map_err(|e| {
        error!("Failed to write Windows hosts file: {}", e);
        io::Error::new(
            io::ErrorKind::PermissionDenied,
            "Failed to modify hosts file. Please run GameBlocker as Administrator.",
        )
    })?;

    info!("Successfully wrote Windows hosts file");
    Ok(())
}

/// Flush DNS cache (cross-platform)
fn flush_dns_cache() {
    #[cfg(target_os = "linux")]
    flush_dns_cache_linux();

    #[cfg(target_os = "macos")]
    flush_dns_cache_macos();

    #[cfg(target_os = "windows")]
    flush_dns_cache_windows();

    info!("DNS cache flush completed. Note: Browsers with DNS-over-HTTPS enabled will bypass hosts file blocking.");
}

#[cfg(target_os = "linux")]
fn flush_dns_cache_linux() {
    // Try systemd-resolved (modern systems)
    if let Ok(output) = Command::new("resolvectl")
        .args(["flush-caches"])
        .output()
    {
        if output.status.success() {
            info!("Flushed DNS cache via resolvectl");
            return;
        }
    }

    // Fallback to old systemd-resolve command
    let _ = Command::new("systemd-resolve")
        .args(["--flush-caches"])
        .output();

    // Try nscd if available
    let _ = Command::new("nscd")
        .args(["-i", "hosts"])
        .output();
}

#[cfg(target_os = "macos")]
fn flush_dns_cache_macos() {
    // Flush DNS cache on macOS
    let _ = Command::new("dscacheutil")
        .args(["-flushcache"])
        .output();

    // Also restart mDNSResponder for good measure
    let _ = Command::new("killall")
        .args(["-HUP", "mDNSResponder"])
        .output();

    info!("Flushed DNS cache via dscacheutil and mDNSResponder");
}

#[cfg(target_os = "windows")]
fn flush_dns_cache_windows() {
    // Flush DNS cache on Windows
    let _ = Command::new("ipconfig")
        .args(["/flushdns"])
        .output();

    info!("Flushed DNS cache via ipconfig /flushdns");
}

/// Check if GameBlocker section exists in hosts file
pub fn is_blocking_active() -> bool {
    if let Ok(content) = fs::read_to_string(HOSTS_PATH) {
        content.contains(MARKER_START)
    } else {
        false
    }
}

/// Get currently blocked domains from hosts file
pub fn get_blocked_domains() -> HashSet<String> {
    let mut domains = HashSet::new();

    if let Ok(content) = fs::read_to_string(HOSTS_PATH) {
        let mut in_section = false;

        for line in content.lines() {
            if line.contains(MARKER_START) {
                in_section = true;
                continue;
            }
            if line.contains(MARKER_END) {
                break;
            }
            if in_section {
                // Parse "127.0.0.1 domain.com" format
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let domain = parts[1].trim_start_matches("www.");
                    domains.insert(domain.to_string());
                }
            }
        }
    }

    domains
}

/// Block domains by directly writing to /etc/hosts (for daemon running as root)
/// This function does not use pkexec - it assumes the caller has root privileges.
pub fn block_domains_direct(domains: &HashSet<String>) -> io::Result<()> {
    info!("Blocking {} domains via hosts file (direct write)", domains.len());

    if domains.is_empty() {
        info!("No domains to block");
        return Ok(());
    }

    // Read current hosts file
    let content = fs::read_to_string(HOSTS_PATH)?;

    // Remove any existing GameBlocker section
    let cleaned = remove_gameblocker_section(&content);

    // Build new GameBlocker section
    let mut new_section = String::new();
    new_section.push_str(&format!("\n{}\n", MARKER_START));

    for domain in domains {
        new_section.push_str(&format!("127.0.0.1 {}\n", domain));
        new_section.push_str(&format!("127.0.0.1 www.{}\n", domain));
        new_section.push_str(&format!("::1 {}\n", domain));
        new_section.push_str(&format!("::1 www.{}\n", domain));
    }

    new_section.push_str(&format!("{}\n", MARKER_END));

    // Write directly (assumes running as root)
    let new_content = format!("{}{}", cleaned.trim_end(), new_section);
    fs::write(HOSTS_PATH, new_content)?;

    info!("Successfully wrote hosts file directly");

    // Flush DNS cache
    flush_dns_cache();

    Ok(())
}

/// Unblock all domains by directly writing to /etc/hosts (for daemon running as root)
pub fn unblock_all_domains_direct() -> io::Result<()> {
    let content = fs::read_to_string(HOSTS_PATH)?;
    let cleaned = remove_gameblocker_section(&content);
    fs::write(HOSTS_PATH, cleaned)?;
    flush_dns_cache();
    Ok(())
}
