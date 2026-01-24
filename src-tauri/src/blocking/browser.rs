//! Browser configuration to disable DNS-over-HTTPS (DoH).
//! DoH bypasses /etc/hosts blocking, so we need to disable it for effective blocking.

use std::fs;
use std::io;
use std::path::PathBuf;
use tracing::{info, warn};

/// Disable DNS-over-HTTPS in all detected browsers
pub fn disable_doh_all_browsers() -> io::Result<Vec<String>> {
    let mut disabled_in = Vec::new();

    // Firefox
    match disable_firefox_doh() {
        Ok(profiles) => {
            for profile in profiles {
                disabled_in.push(format!("Firefox ({})", profile));
            }
        }
        Err(e) => warn!("Could not configure Firefox: {}", e),
    }

    // Chrome/Chromium
    match disable_chrome_doh() {
        Ok(browsers) => disabled_in.extend(browsers),
        Err(e) => warn!("Could not configure Chrome/Chromium: {}", e),
    }

    if disabled_in.is_empty() {
        info!("No browsers were configured (none found or already configured)");
    } else {
        info!("Disabled DoH in: {:?}", disabled_in);
    }

    Ok(disabled_in)
}

/// Re-enable DNS-over-HTTPS in all browsers
pub fn enable_doh_all_browsers() -> io::Result<Vec<String>> {
    let mut enabled_in = Vec::new();

    match enable_firefox_doh() {
        Ok(profiles) => {
            for profile in profiles {
                enabled_in.push(format!("Firefox ({})", profile));
            }
        }
        Err(e) => warn!("Could not restore Firefox: {}", e),
    }

    match enable_chrome_doh() {
        Ok(browsers) => enabled_in.extend(browsers),
        Err(e) => warn!("Could not restore Chrome/Chromium: {}", e),
    }

    Ok(enabled_in)
}

/// Disable DoH in Firefox by adding user.js preferences
fn disable_firefox_doh() -> io::Result<Vec<String>> {
    let firefox_dir = get_firefox_dir()?;
    let mut configured_profiles = Vec::new();

    // Find all Firefox profiles
    let profiles_ini = firefox_dir.join("profiles.ini");
    if !profiles_ini.exists() {
        return Err(io::Error::new(io::ErrorKind::NotFound, "Firefox not installed"));
    }

    // Read profiles.ini to find profile directories
    let content = fs::read_to_string(&profiles_ini)?;

    for line in content.lines() {
        if line.starts_with("Path=") {
            let profile_path = line.trim_start_matches("Path=");
            let profile_dir = if profile_path.starts_with('/') {
                PathBuf::from(profile_path)
            } else {
                firefox_dir.join(profile_path)
            };

            if profile_dir.exists() {
                let user_js = profile_dir.join("user.js");

                // Read existing user.js or create new
                let mut content = if user_js.exists() {
                    fs::read_to_string(&user_js)?
                } else {
                    String::new()
                };

                // Check if already configured
                if content.contains("network.trr.mode") {
                    // Update existing setting
                    let lines: Vec<&str> = content.lines()
                        .filter(|l| !l.contains("network.trr.mode"))
                        .collect();
                    content = lines.join("\n");
                    if !content.is_empty() && !content.ends_with('\n') {
                        content.push('\n');
                    }
                }

                // Add DoH disable setting (mode 5 = DoH disabled)
                content.push_str("\n// ParentShield: Disable DNS-over-HTTPS for website blocking\n");
                content.push_str("user_pref(\"network.trr.mode\", 5);\n");

                fs::write(&user_js, content)?;

                let profile_name = profile_dir.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                configured_profiles.push(profile_name);
                info!("Configured Firefox profile: {:?}", profile_dir);
            }
        }
    }

    Ok(configured_profiles)
}

/// Re-enable DoH in Firefox
fn enable_firefox_doh() -> io::Result<Vec<String>> {
    let firefox_dir = get_firefox_dir()?;
    let mut restored_profiles = Vec::new();

    let profiles_ini = firefox_dir.join("profiles.ini");
    if !profiles_ini.exists() {
        return Ok(restored_profiles);
    }

    let content = fs::read_to_string(&profiles_ini)?;

    for line in content.lines() {
        if line.starts_with("Path=") {
            let profile_path = line.trim_start_matches("Path=");
            let profile_dir = if profile_path.starts_with('/') {
                PathBuf::from(profile_path)
            } else {
                firefox_dir.join(profile_path)
            };

            let user_js = profile_dir.join("user.js");
            if user_js.exists() {
                let content = fs::read_to_string(&user_js)?;

                // Remove ParentShield DoH settings
                let lines: Vec<&str> = content.lines()
                    .filter(|l| !l.contains("ParentShield") && !l.contains("network.trr.mode"))
                    .collect();

                let new_content = lines.join("\n");

                if new_content.trim().is_empty() {
                    // Remove empty user.js
                    fs::remove_file(&user_js)?;
                } else {
                    fs::write(&user_js, new_content)?;
                }

                let profile_name = profile_dir.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                restored_profiles.push(profile_name);
            }
        }
    }

    Ok(restored_profiles)
}

/// All Chromium-based browsers and their config paths
fn get_chromium_browsers() -> Vec<(&'static str, &'static str, &'static str)> {
    // (Browser name, policy dir suffix, user config dir name)
    vec![
        ("Chrome", "opt/chrome", "google-chrome"),
        ("Chromium", "chromium", "chromium"),
        ("Brave", "brave", "BraveSoftware/Brave-Browser"),
        ("Edge", "microsoft-edge", "microsoft-edge"),
        ("Opera", "opera", "opera"),
        ("Vivaldi", "vivaldi", "vivaldi"),
        ("Opera GX", "opera-gx", "opera-gx"),
    ]
}

/// Disable DoH in all Chromium-based browsers via policies and user config
fn disable_chrome_doh() -> io::Result<Vec<String>> {
    let mut configured = Vec::new();

    let policy_content = r#"{
    "DnsOverHttpsMode": "off",
    "BuiltInDnsClientEnabled": false
}"#;

    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default();

    for (browser_name, policy_suffix, config_dir_name) in get_chromium_browsers() {
        // Try system-wide policy (requires root)
        let policy_dir = PathBuf::from(format!("/etc/{}/policies/managed", policy_suffix));
        if fs::create_dir_all(&policy_dir).is_ok() {
            let policy_file = policy_dir.join("parentshield.json");
            if fs::write(&policy_file, policy_content).is_ok() {
                configured.push(browser_name.to_string());
                info!("Created {} policy: {:?}", browser_name, policy_file);
            }
        }

        // Try user-level config
        let user_config = home.join(".config").join(config_dir_name);
        if user_config.exists() {
            let local_state = user_config.join("Local State");
            if local_state.exists() {
                if modify_chromium_local_state(&local_state, true).is_ok() {
                    let entry = format!("{} (user)", browser_name);
                    if !configured.contains(&browser_name.to_string()) && !configured.contains(&entry) {
                        configured.push(entry);
                    }
                    info!("Configured {} user profile: {:?}", browser_name, local_state);
                }
            }
        }

        // Flatpak locations
        let flatpak_config = home.join(".var/app").join(format!("com.{}.Browser", browser_name.to_lowercase().replace(" ", "")));
        if flatpak_config.exists() {
            let local_state = flatpak_config.join("config").join(config_dir_name).join("Local State");
            if local_state.exists() {
                if modify_chromium_local_state(&local_state, true).is_ok() {
                    configured.push(format!("{} (Flatpak)", browser_name));
                }
            }
        }

        // Snap locations
        let snap_config = home.join("snap").join(browser_name.to_lowercase().replace(" ", "-")).join("current/.config").join(config_dir_name);
        if snap_config.exists() {
            let local_state = snap_config.join("Local State");
            if local_state.exists() {
                if modify_chromium_local_state(&local_state, true).is_ok() {
                    configured.push(format!("{} (Snap)", browser_name));
                }
            }
        }
    }

    Ok(configured)
}

/// Modify Chromium Local State file to enable/disable DoH
fn modify_chromium_local_state(local_state: &PathBuf, disable: bool) -> io::Result<()> {
    let content = fs::read_to_string(local_state)?;

    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    if let Some(obj) = json.as_object_mut() {
        if disable {
            obj.insert(
                "dns_over_https".to_string(),
                serde_json::json!({
                    "mode": "off",
                    "templates": ""
                }),
            );
        } else {
            // Restore to automatic (browser default)
            obj.insert(
                "dns_over_https".to_string(),
                serde_json::json!({
                    "mode": "automatic",
                    "templates": ""
                }),
            );
        }

        let new_content = serde_json::to_string_pretty(&json)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        fs::write(local_state, new_content)?;
    }

    Ok(())
}

/// Re-enable DoH in all Chromium-based browsers
fn enable_chrome_doh() -> io::Result<Vec<String>> {
    let mut restored = Vec::new();

    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_default();

    for (browser_name, policy_suffix, config_dir_name) in get_chromium_browsers() {
        // Remove system policy
        let policy_file = PathBuf::from(format!("/etc/{}/policies/managed/parentshield.json", policy_suffix));
        if policy_file.exists() {
            if fs::remove_file(&policy_file).is_ok() {
                restored.push(browser_name.to_string());
            }
        }

        // Restore user config
        let user_config = home.join(".config").join(config_dir_name);
        if user_config.exists() {
            let local_state = user_config.join("Local State");
            if local_state.exists() {
                if modify_chromium_local_state(&local_state, false).is_ok() {
                    let entry = format!("{} (user)", browser_name);
                    if !restored.contains(&browser_name.to_string()) && !restored.contains(&entry) {
                        restored.push(entry);
                    }
                }
            }
        }

        // Flatpak
        let flatpak_config = home.join(".var/app").join(format!("com.{}.Browser", browser_name.to_lowercase().replace(" ", "")));
        let flatpak_local_state = flatpak_config.join("config").join(config_dir_name).join("Local State");
        if flatpak_local_state.exists() {
            if modify_chromium_local_state(&flatpak_local_state, false).is_ok() {
                restored.push(format!("{} (Flatpak)", browser_name));
            }
        }

        // Snap
        let snap_config = home.join("snap").join(browser_name.to_lowercase().replace(" ", "-")).join("current/.config").join(config_dir_name);
        let snap_local_state = snap_config.join("Local State");
        if snap_local_state.exists() {
            if modify_chromium_local_state(&snap_local_state, false).is_ok() {
                restored.push(format!("{} (Snap)", browser_name));
            }
        }
    }

    Ok(restored)
}

/// Get Firefox directory path
fn get_firefox_dir() -> io::Result<PathBuf> {
    let home = std::env::var_os("HOME")
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "HOME not set"))?;

    let firefox_dir = PathBuf::from(home).join(".mozilla/firefox");

    if firefox_dir.exists() {
        Ok(firefox_dir)
    } else {
        Err(io::Error::new(io::ErrorKind::NotFound, "Firefox directory not found"))
    }
}

/// Check if DoH is currently disabled
pub fn is_doh_disabled() -> bool {
    // Check Firefox
    if let Ok(firefox_dir) = get_firefox_dir() {
        let profiles_ini = firefox_dir.join("profiles.ini");
        if let Ok(content) = fs::read_to_string(&profiles_ini) {
            for line in content.lines() {
                if line.starts_with("Path=") {
                    let profile_path = line.trim_start_matches("Path=");
                    let profile_dir = if profile_path.starts_with('/') {
                        PathBuf::from(profile_path)
                    } else {
                        firefox_dir.join(profile_path)
                    };

                    let user_js = profile_dir.join("user.js");
                    if user_js.exists() {
                        if let Ok(content) = fs::read_to_string(&user_js) {
                            if content.contains("network.trr.mode\", 5") {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }

    // Check Chrome policies
    let policy_file = PathBuf::from("/etc/opt/chrome/policies/managed/parentshield.json");
    if policy_file.exists() {
        return true;
    }

    false
}
