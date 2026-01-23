//! Schedule evaluation engine for time-based blocking rules.

use crate::config::ScheduleEntry;
use chrono::{Datelike, Local, Timelike};

/// Check if blocking should be active based on current schedules
pub fn should_block_now(schedules: &[ScheduleEntry]) -> bool {
    if schedules.is_empty() {
        return true; // No schedules = always blocking
    }

    let now = Local::now();
    let current_day = now.weekday().num_days_from_sunday() as u8;
    let current_minutes = (now.hour() * 60 + now.minute()) as u16;

    for schedule in schedules {
        if !schedule.enabled {
            continue;
        }

        // Check if current day is in schedule
        if !schedule.days.contains(&current_day) {
            continue;
        }

        // Check if current time is in schedule window
        if schedule.start_minutes <= schedule.end_minutes {
            // Normal time range (e.g., 9:00 - 17:00)
            if current_minutes >= schedule.start_minutes && current_minutes < schedule.end_minutes {
                return schedule.blocking_enabled;
            }
        } else {
            // Overnight range (e.g., 22:00 - 06:00)
            if current_minutes >= schedule.start_minutes || current_minutes < schedule.end_minutes {
                return schedule.blocking_enabled;
            }
        }
    }

    // Default to blocking if no schedule matches
    true
}

/// Get minutes until the next schedule change
pub fn minutes_until_change(schedules: &[ScheduleEntry]) -> Option<u32> {
    if schedules.is_empty() {
        return None;
    }

    let now = Local::now();
    let current_day = now.weekday().num_days_from_sunday() as u8;
    let current_minutes = (now.hour() * 60 + now.minute()) as u16;

    let mut min_minutes = u32::MAX;

    for schedule in schedules {
        if !schedule.enabled {
            continue;
        }

        // Check same-day transitions
        if schedule.days.contains(&current_day) {
            if current_minutes < schedule.start_minutes {
                let diff = (schedule.start_minutes - current_minutes) as u32;
                min_minutes = min_minutes.min(diff);
            }
            if current_minutes < schedule.end_minutes {
                let diff = (schedule.end_minutes - current_minutes) as u32;
                min_minutes = min_minutes.min(diff);
            }
        }

        // Check next day transitions
        let next_day = (current_day + 1) % 7;
        if schedule.days.contains(&next_day) {
            let minutes_until_midnight = 24 * 60 - current_minutes as u32;
            let diff = minutes_until_midnight + schedule.start_minutes as u32;
            min_minutes = min_minutes.min(diff);
        }
    }

    if min_minutes == u32::MAX {
        None
    } else {
        Some(min_minutes)
    }
}

/// Create a school hours schedule (Mon-Fri, 8:00-15:00, blocking enabled)
pub fn create_school_hours_schedule() -> ScheduleEntry {
    ScheduleEntry {
        id: uuid::Uuid::new_v4(),
        name: "School Hours".to_string(),
        enabled: true,
        days: vec![1, 2, 3, 4, 5], // Mon-Fri
        start_minutes: 8 * 60,     // 8:00 AM
        end_minutes: 15 * 60,      // 3:00 PM
        blocking_enabled: true,
    }
}

/// Create a bedtime schedule (Every day, 21:00-07:00, blocking enabled)
pub fn create_bedtime_schedule() -> ScheduleEntry {
    ScheduleEntry {
        id: uuid::Uuid::new_v4(),
        name: "Bedtime".to_string(),
        enabled: true,
        days: vec![0, 1, 2, 3, 4, 5, 6], // Every day
        start_minutes: 21 * 60,          // 9:00 PM
        end_minutes: 7 * 60,             // 7:00 AM
        blocking_enabled: true,
    }
}

/// Create a weekend gaming window (Sat-Sun, 14:00-18:00, blocking disabled)
pub fn create_weekend_gaming_schedule() -> ScheduleEntry {
    ScheduleEntry {
        id: uuid::Uuid::new_v4(),
        name: "Weekend Gaming".to_string(),
        enabled: true,
        days: vec![0, 6], // Sat-Sun
        start_minutes: 14 * 60, // 2:00 PM
        end_minutes: 18 * 60, // 6:00 PM
        blocking_enabled: false, // Blocking disabled during this window
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_schedules_always_block() {
        assert!(should_block_now(&[]));
    }

    #[test]
    fn test_create_presets() {
        let school = create_school_hours_schedule();
        assert!(school.enabled);
        assert_eq!(school.days, vec![1, 2, 3, 4, 5]);

        let bedtime = create_bedtime_schedule();
        assert!(bedtime.enabled);
        assert_eq!(bedtime.days.len(), 7);

        let weekend = create_weekend_gaming_schedule();
        assert!(!weekend.blocking_enabled);
    }
}
