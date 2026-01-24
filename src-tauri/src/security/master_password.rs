//! Master recovery password generation using NATO phonetic alphabet.
//! The master password is derived from hardware fingerprint and never stored.

use sha2::{Digest, Sha256};

/// NATO phonetic alphabet words for human-readable password generation
const NATO_ALPHABET: [&str; 26] = [
    "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT", "GOLF", "HOTEL",
    "INDIA", "JULIET", "KILO", "LIMA", "MIKE", "NOVEMBER", "OSCAR", "PAPA",
    "QUEBEC", "ROMEO", "SIERRA", "TANGO", "UNIFORM", "VICTOR", "WHISKEY",
    "XRAY", "YANKEE", "ZULU",
];

/// Generate a master recovery password from hardware fingerprint
/// Format: "WORD-WORD-NNNN-WORD" (e.g., "ALPHA-BRAVO-1234-DELTA")
/// This password is computed on-demand and never stored on the device.
pub fn generate_master_password(machine_id: &str, installation_timestamp: u64) -> String {
    // Create a deterministic hash from machine info
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    hasher.update(installation_timestamp.to_le_bytes());
    hasher.update(b"parentshield-master-recovery-v1");

    let hash = hasher.finalize();

    // Extract parts from the hash
    let word1_idx = (hash[0] as usize) % NATO_ALPHABET.len();
    let word2_idx = (hash[1] as usize) % NATO_ALPHABET.len();
    let word3_idx = (hash[2] as usize) % NATO_ALPHABET.len();

    // Generate 4-digit number from hash bytes
    let number = ((hash[3] as u16) << 8 | hash[4] as u16) % 10000;

    format!(
        "{}-{}-{:04}-{}",
        NATO_ALPHABET[word1_idx],
        NATO_ALPHABET[word2_idx],
        number,
        NATO_ALPHABET[word3_idx]
    )
}

/// Verify a master password against the expected value
pub fn verify_master_password(
    input: &str,
    machine_id: &str,
    installation_timestamp: u64,
) -> bool {
    let expected = generate_master_password(machine_id, installation_timestamp);

    // Case-insensitive comparison
    input.to_uppercase().trim() == expected
}

/// Get the machine identifier for master password generation
#[cfg(target_os = "linux")]
pub fn get_machine_id() -> Option<String> {
    // Try /etc/machine-id first (systemd)
    if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
        return Some(id.trim().to_string());
    }

    // Fallback to /var/lib/dbus/machine-id
    if let Ok(id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
        return Some(id.trim().to_string());
    }

    None
}

#[cfg(target_os = "windows")]
pub fn get_machine_id() -> Option<String> {
    // Use Windows registry MachineGuid
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(guid) = key.get_value::<String, _>("MachineGuid") {
            return Some(guid);
        }
    }

    None
}

#[cfg(target_os = "macos")]
pub fn get_machine_id() -> Option<String> {
    // Use IOKit to get hardware UUID
    use std::process::Command;

    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .ok()?;

    let output_str = String::from_utf8_lossy(&output.stdout);

    // Parse the UUID from ioreg output
    for line in output_str.lines() {
        if line.contains("IOPlatformUUID") {
            if let Some(uuid) = line.split('"').nth(3) {
                return Some(uuid.to_string());
            }
        }
    }

    None
}

#[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
pub fn get_machine_id() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_master_password_format() {
        let password = generate_master_password("test-machine-id", 1234567890);

        // Check format: WORD-WORD-NNNN-WORD
        let parts: Vec<&str> = password.split('-').collect();
        assert_eq!(parts.len(), 4);

        // Check that words are from NATO alphabet
        assert!(NATO_ALPHABET.contains(&parts[0]));
        assert!(NATO_ALPHABET.contains(&parts[1]));
        assert!(NATO_ALPHABET.contains(&parts[3]));

        // Check that number is 4 digits
        assert_eq!(parts[2].len(), 4);
        assert!(parts[2].parse::<u16>().is_ok());
    }

    #[test]
    fn test_master_password_deterministic() {
        let password1 = generate_master_password("test-machine", 1000);
        let password2 = generate_master_password("test-machine", 1000);

        assert_eq!(password1, password2);
    }

    #[test]
    fn test_master_password_unique() {
        let password1 = generate_master_password("machine-1", 1000);
        let password2 = generate_master_password("machine-2", 1000);

        assert_ne!(password1, password2);
    }

    #[test]
    fn test_verify_master_password() {
        let machine_id = "test-machine";
        let timestamp = 1234567890u64;
        let password = generate_master_password(machine_id, timestamp);

        assert!(verify_master_password(&password, machine_id, timestamp));
        assert!(verify_master_password(&password.to_lowercase(), machine_id, timestamp));
        assert!(!verify_master_password("WRONG-PASSWORD-1234-TEST", machine_id, timestamp));
    }
}
