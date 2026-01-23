//! Encrypted configuration storage system.
//! Stores all settings in an encrypted file that can only be read on the same machine.

use crate::security::{crypto, master_password};
use chrono::{DateTime, Utc};
use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use thiserror::Error;
use uuid::Uuid;

/// Errors that can occur during configuration operations
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Failed to get config directory")]
    NoConfigDir,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Crypto error: {0}")]
    CryptoError(#[from] crypto::CryptoError),
    #[error("Configuration not initialized")]
    NotInitialized,
    #[error("Invalid password")]
    InvalidPassword,
    #[error("Machine ID not available")]
    NoMachineId,
}

/// Schedule entry for time-based blocking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleEntry {
    pub id: Uuid,
    pub name: String,
    pub enabled: bool,
    /// Days of week (0 = Sunday, 6 = Saturday)
    pub days: Vec<u8>,
    /// Start time in minutes from midnight
    pub start_minutes: u16,
    /// End time in minutes from midnight
    pub end_minutes: u16,
    /// Whether blocking is enabled during this time window
    pub blocking_enabled: bool,
}

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Version for config migration
    pub version: u32,
    /// Installation timestamp (Unix epoch seconds)
    pub installation_timestamp: u64,
    /// Installation UUID
    pub installation_id: String,
    /// Hashed parent password
    pub password_hash: String,
    /// Whether game blocking is enabled
    pub game_blocking_enabled: bool,
    /// Whether AI service blocking is enabled
    pub ai_blocking_enabled: bool,
    /// Whether DNS blocking is enabled
    pub dns_blocking_enabled: bool,
    /// Whether browser blocking is enabled
    #[serde(default)]
    pub browser_blocking_enabled: bool,
    /// Custom blocked processes
    pub blocked_processes: HashSet<String>,
    /// Custom blocked domains
    pub blocked_domains: HashSet<String>,
    /// Custom allowed processes (whitelist)
    pub allowed_processes: HashSet<String>,
    /// Custom allowed domains (whitelist)
    pub allowed_domains: HashSet<String>,
    /// Schedule entries
    pub schedules: Vec<ScheduleEntry>,
    /// Whether to show notifications on block
    pub show_notifications: bool,
    /// Whether to start minimized to tray
    pub start_minimized: bool,
    /// Whether to start at system boot
    pub start_at_boot: bool,
    /// UI theme (light/dark/system)
    pub theme: String,
    /// Last modified timestamp
    pub last_modified: DateTime<Utc>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: 2,
            installation_timestamp: Utc::now().timestamp() as u64,
            installation_id: Uuid::new_v4().to_string(),
            password_hash: String::new(),
            // Game blocking disabled by default - user must enable it
            game_blocking_enabled: false,
            ai_blocking_enabled: false,
            dns_blocking_enabled: false,
            browser_blocking_enabled: false,
            blocked_processes: HashSet::new(),
            blocked_domains: HashSet::new(),
            allowed_processes: HashSet::new(),
            allowed_domains: HashSet::new(),
            schedules: Vec::new(),
            show_notifications: true,
            start_minimized: false,
            start_at_boot: true,
            theme: "system".to_string(),
            last_modified: Utc::now(),
        }
    }
}

/// Configuration manager with encryption support
pub struct ConfigManager {
    config_path: PathBuf,
    machine_id: String,
    secret: String,
}

impl ConfigManager {
    /// Create a new config manager
    pub fn new() -> Result<Self, ConfigError> {
        // Use a fixed system-wide config path that works for both GUI and daemon
        // This ensures the daemon (running as root) can read the same config as the GUI
        let config_dir = Self::get_config_dir()?;
        fs::create_dir_all(&config_dir)?;

        let config_path = config_dir.join("config.enc");

        let machine_id = master_password::get_machine_id()
            .ok_or(ConfigError::NoMachineId)?;

        // Use a combination of machine ID and a static secret for key derivation
        let secret = format!("gameblocker-{}", &machine_id[..8.min(machine_id.len())]);

        Ok(Self {
            config_path,
            machine_id,
            secret,
        })
    }

    /// Get the config directory - uses a fixed path that works for both user and root
    fn get_config_dir() -> Result<PathBuf, ConfigError> {
        // First try the standard user config directory
        if let Some(project_dirs) = ProjectDirs::from("com", "gameblocker", "GameBlocker") {
            let config_dir = project_dirs.config_dir().to_path_buf();
            // If the config already exists here, use it
            if config_dir.join("config.enc").exists() {
                return Ok(config_dir);
            }
            // If we're not running as root, use the user's config dir
            #[cfg(unix)]
            if !nix::unistd::geteuid().is_root() {
                return Ok(config_dir);
            }
            #[cfg(not(unix))]
            return Ok(config_dir);
        }

        // Fallback: check common user config locations (for daemon running as root)
        #[cfg(unix)]
        {
            // Try to find existing config in /home/*/config/gameblocker/
            if let Ok(entries) = fs::read_dir("/home") {
                for entry in entries.flatten() {
                    let user_config = entry.path()
                        .join(".config")
                        .join("gameblocker");
                    if user_config.join("config.enc").exists() {
                        return Ok(user_config);
                    }
                }
            }
        }

        // Last resort: use /etc/gameblocker for system-wide config
        let system_config = PathBuf::from("/etc/gameblocker");
        Ok(system_config)
    }

    /// Get the encryption key
    fn get_key(&self) -> zeroize::Zeroizing<[u8; 32]> {
        crypto::derive_key(&self.machine_id, &self.secret)
    }

    /// Check if configuration exists
    pub fn config_exists(&self) -> bool {
        self.config_path.exists()
    }

    /// Initialize a new configuration with a password
    pub fn initialize(&self, password: &str) -> Result<AppConfig, ConfigError> {
        let password_hash = crypto::hash_password(password)?;

        let mut config = AppConfig::default();
        config.password_hash = password_hash;

        self.save(&config)?;

        Ok(config)
    }

    /// Load and decrypt the configuration
    pub fn load(&self) -> Result<AppConfig, ConfigError> {
        if !self.config_exists() {
            return Err(ConfigError::NotInitialized);
        }

        let encrypted_data = fs::read(&self.config_path)?;
        let key = self.get_key();
        let decrypted_data = crypto::decrypt(&encrypted_data, &key)?;
        let mut config: AppConfig = serde_json::from_slice(&decrypted_data)?;

        // Migrate old configs to version 2
        if config.version < 2 {
            config.version = 2;
            // Save the migrated config
            let _ = self.save(&config);
        }

        Ok(config)
    }

    /// Encrypt and save the configuration
    pub fn save(&self, config: &AppConfig) -> Result<(), ConfigError> {
        let mut config = config.clone();
        config.last_modified = Utc::now();

        let json_data = serde_json::to_vec_pretty(&config)?;
        let key = self.get_key();
        let encrypted_data = crypto::encrypt(&json_data, &key)?;

        fs::write(&self.config_path, encrypted_data)?;

        Ok(())
    }

    /// Verify the password against stored hash
    pub fn verify_password(&self, password: &str) -> Result<bool, ConfigError> {
        let config = self.load()?;
        Ok(crypto::verify_password(password, &config.password_hash)?)
    }

    /// Change the password
    pub fn change_password(&self, old_password: &str, new_password: &str) -> Result<(), ConfigError> {
        if !self.verify_password(old_password)? {
            return Err(ConfigError::InvalidPassword);
        }

        let mut config = self.load()?;
        config.password_hash = crypto::hash_password(new_password)?;
        self.save(&config)?;

        Ok(())
    }

    /// Get the master recovery password
    pub fn get_master_password(&self) -> Result<String, ConfigError> {
        let config = self.load()?;
        Ok(master_password::generate_master_password(
            &self.machine_id,
            config.installation_timestamp,
        ))
    }

    /// Verify master password and reset to new password
    pub fn reset_with_master_password(
        &self,
        master: &str,
        new_password: &str,
    ) -> Result<(), ConfigError> {
        let config = self.load()?;

        if !master_password::verify_master_password(
            master,
            &self.machine_id,
            config.installation_timestamp,
        ) {
            return Err(ConfigError::InvalidPassword);
        }

        let mut config = config;
        config.password_hash = crypto::hash_password(new_password)?;
        self.save(&config)?;

        Ok(())
    }

    /// Get the config file path (for debugging)
    pub fn config_path(&self) -> &PathBuf {
        &self.config_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_manager() -> (ConfigManager, tempfile::TempDir) {
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("config.enc");

        let manager = ConfigManager {
            config_path,
            machine_id: "test-machine-id".to_string(),
            secret: "test-secret".to_string(),
        };

        (manager, temp_dir)
    }

    #[test]
    fn test_initialize_and_load() {
        let (manager, _temp) = create_test_manager();

        let config = manager.initialize("test_password").unwrap();
        // Game blocking is disabled by default
        assert!(!config.game_blocking_enabled);
        assert!(!config.password_hash.is_empty());

        let loaded = manager.load().unwrap();
        assert_eq!(loaded.installation_id, config.installation_id);
    }

    #[test]
    fn test_password_verification() {
        let (manager, _temp) = create_test_manager();

        manager.initialize("correct_password").unwrap();

        assert!(manager.verify_password("correct_password").unwrap());
        assert!(!manager.verify_password("wrong_password").unwrap());
    }

    #[test]
    fn test_change_password() {
        let (manager, _temp) = create_test_manager();

        manager.initialize("old_password").unwrap();
        manager.change_password("old_password", "new_password").unwrap();

        assert!(!manager.verify_password("old_password").unwrap());
        assert!(manager.verify_password("new_password").unwrap());
    }
}
