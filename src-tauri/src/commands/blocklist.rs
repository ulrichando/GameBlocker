//! Blocklist management Tauri commands.

use crate::blocking::blocklists;
use crate::config::ConfigManager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlocklistItem {
    pub value: String,
    pub is_default: bool,
    pub is_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlocklistCategory {
    pub name: String,
    pub items: Vec<BlocklistItem>,
}

/// Get all blocklist items organized by category
#[tauri::command]
pub async fn get_blocklists() -> Result<Vec<BlocklistCategory>, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let config = manager.load().map_err(|e| e.to_string())?;

    let default_processes = blocklists::get_default_gaming_processes();
    let default_ai = blocklists::get_default_ai_domains();
    let default_gaming_sites = blocklists::get_default_gaming_domains();

    let mut categories = Vec::new();

    // Gaming Processes
    let mut process_items: Vec<BlocklistItem> = default_processes
        .iter()
        .map(|p| BlocklistItem {
            value: p.clone(),
            is_default: true,
            is_allowed: config.allowed_processes.contains(p),
        })
        .collect();

    for p in &config.blocked_processes {
        if !default_processes.contains(p) {
            process_items.push(BlocklistItem {
                value: p.clone(),
                is_default: false,
                is_allowed: false,
            });
        }
    }

    categories.push(BlocklistCategory {
        name: "Gaming Processes".to_string(),
        items: process_items,
    });

    // AI Services
    let ai_items: Vec<BlocklistItem> = default_ai
        .iter()
        .map(|d| BlocklistItem {
            value: d.clone(),
            is_default: true,
            is_allowed: config.allowed_domains.contains(d),
        })
        .collect();

    categories.push(BlocklistCategory {
        name: "AI Services".to_string(),
        items: ai_items,
    });

    // Gaming Websites
    let mut gaming_items: Vec<BlocklistItem> = default_gaming_sites
        .iter()
        .map(|d| BlocklistItem {
            value: d.clone(),
            is_default: true,
            is_allowed: config.allowed_domains.contains(d),
        })
        .collect();

    for d in &config.blocked_domains {
        if !default_ai.contains(d) && !default_gaming_sites.contains(d) {
            gaming_items.push(BlocklistItem {
                value: d.clone(),
                is_default: false,
                is_allowed: false,
            });
        }
    }

    categories.push(BlocklistCategory {
        name: "Gaming Websites".to_string(),
        items: gaming_items,
    });

    Ok(categories)
}

/// Add a custom blocked process
#[tauri::command]
pub async fn add_blocked_process(process: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let process_lower = process.to_lowercase();
    config.blocked_processes.insert(process_lower);
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(true)
}

/// Remove a custom blocked process
#[tauri::command]
pub async fn remove_blocked_process(process: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let process_lower = process.to_lowercase();
    let removed = config.blocked_processes.remove(&process_lower);
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(removed)
}

/// Add a custom blocked domain
#[tauri::command]
pub async fn add_blocked_domain(domain: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let domain_lower = domain.to_lowercase();
    config.blocked_domains.insert(domain_lower);
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(true)
}

/// Remove a custom blocked domain
#[tauri::command]
pub async fn remove_blocked_domain(domain: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let domain_lower = domain.to_lowercase();
    let removed = config.blocked_domains.remove(&domain_lower);
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(removed)
}

/// Add an item to the whitelist (allow list)
#[tauri::command]
pub async fn add_to_whitelist(item: String, item_type: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let item_lower = item.to_lowercase();

    match item_type.as_str() {
        "process" => {
            config.allowed_processes.insert(item_lower);
        }
        "domain" => {
            config.allowed_domains.insert(item_lower);
        }
        _ => return Err("Invalid item type".to_string()),
    }

    manager.save(&config).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Remove an item from the whitelist
#[tauri::command]
pub async fn remove_from_whitelist(item: String, item_type: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let item_lower = item.to_lowercase();

    let removed = match item_type.as_str() {
        "process" => config.allowed_processes.remove(&item_lower),
        "domain" => config.allowed_domains.remove(&item_lower),
        _ => return Err("Invalid item type".to_string()),
    };

    manager.save(&config).map_err(|e| e.to_string())?;
    Ok(removed)
}
