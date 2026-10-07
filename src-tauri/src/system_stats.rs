use std::sync::Mutex;

use serde::Serialize;
use sysinfo::System;
use tauri::State;

/// Holds a `System` across calls so CPU usage can be computed as a delta
/// between refreshes, per sysinfo's own guidance (a fresh `System` has no
/// prior sample, so its first CPU reading is meaningless). The frontend
/// polls this on a multi-second interval, which is well past sysinfo's
/// minimum 200ms refresh spacing, so no artificial delay is needed here.
pub struct SystemStatsState {
    system: Mutex<System>,
}

impl SystemStatsState {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
        }
    }
}

#[derive(Serialize)]
pub struct SystemStats {
    used_memory_bytes: u64,
    total_memory_bytes: u64,
    cpu_usage_percent: f32,
}

#[tauri::command]
pub fn system_stats(state: State<SystemStatsState>) -> Result<SystemStats, String> {
    let mut system = state.system.lock().map_err(|e| e.to_string())?;
    system.refresh_memory();
    system.refresh_cpu_usage();

    Ok(SystemStats {
        used_memory_bytes: system.used_memory(),
        total_memory_bytes: system.total_memory(),
        cpu_usage_percent: system.global_cpu_usage(),
    })
}
