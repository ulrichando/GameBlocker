//! Schedule management Tauri commands.

use crate::config::{ConfigManager, ScheduleEntry};
use crate::scheduler;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleInfo {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub days: Vec<u8>,
    pub start_minutes: u16,
    pub end_minutes: u16,
    pub blocking_enabled: bool,
}

impl From<ScheduleEntry> for ScheduleInfo {
    fn from(entry: ScheduleEntry) -> Self {
        Self {
            id: entry.id.to_string(),
            name: entry.name,
            enabled: entry.enabled,
            days: entry.days,
            start_minutes: entry.start_minutes,
            end_minutes: entry.end_minutes,
            blocking_enabled: entry.blocking_enabled,
        }
    }
}

impl From<ScheduleInfo> for ScheduleEntry {
    fn from(info: ScheduleInfo) -> Self {
        Self {
            id: Uuid::parse_str(&info.id).unwrap_or_else(|_| Uuid::new_v4()),
            name: info.name,
            enabled: info.enabled,
            days: info.days,
            start_minutes: info.start_minutes,
            end_minutes: info.end_minutes,
            blocking_enabled: info.blocking_enabled,
        }
    }
}

/// Get all schedules
#[tauri::command]
pub async fn get_schedules() -> Result<Vec<ScheduleInfo>, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let config = manager.load().map_err(|e| e.to_string())?;

    Ok(config.schedules.into_iter().map(ScheduleInfo::from).collect())
}

/// Add a new schedule
#[tauri::command]
pub async fn add_schedule(schedule: ScheduleInfo) -> Result<ScheduleInfo, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let mut entry: ScheduleEntry = schedule.into();
    entry.id = Uuid::new_v4(); // Generate new ID

    config.schedules.push(entry.clone());
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(ScheduleInfo::from(entry))
}

/// Update an existing schedule
#[tauri::command]
pub async fn update_schedule(schedule: ScheduleInfo) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let id = Uuid::parse_str(&schedule.id).map_err(|e| e.to_string())?;

    if let Some(entry) = config.schedules.iter_mut().find(|s| s.id == id) {
        entry.name = schedule.name;
        entry.enabled = schedule.enabled;
        entry.days = schedule.days;
        entry.start_minutes = schedule.start_minutes;
        entry.end_minutes = schedule.end_minutes;
        entry.blocking_enabled = schedule.blocking_enabled;

        manager.save(&config).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Delete a schedule
#[tauri::command]
pub async fn delete_schedule(id: String) -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let original_len = config.schedules.len();

    config.schedules.retain(|s| s.id != uuid);

    if config.schedules.len() != original_len {
        manager.save(&config).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Add a preset schedule template
#[tauri::command]
pub async fn add_preset_schedule(preset: String) -> Result<ScheduleInfo, String> {
    let entry = match preset.as_str() {
        "school" => scheduler::create_school_hours_schedule(),
        "bedtime" => scheduler::create_bedtime_schedule(),
        "weekend" => scheduler::create_weekend_gaming_schedule(),
        _ => return Err("Unknown preset".to_string()),
    };

    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let mut config = manager.load().map_err(|e| e.to_string())?;

    config.schedules.push(entry.clone());
    manager.save(&config).map_err(|e| e.to_string())?;

    Ok(ScheduleInfo::from(entry))
}

/// Check if blocking should be active now
#[tauri::command]
pub async fn should_block_now() -> Result<bool, String> {
    let manager = ConfigManager::new().map_err(|e| e.to_string())?;
    let config = manager.load().map_err(|e| e.to_string())?;

    Ok(scheduler::should_block_now(&config.schedules))
}
