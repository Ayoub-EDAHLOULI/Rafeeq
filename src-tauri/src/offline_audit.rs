use serde::Serialize;

/// Plugins registered with the Tauri builder that are known to be capable of
/// reaching the network (HTTP client, shell execution, updater, etc.).
/// Kept as a literal, hand-maintained list rather than introspected at
/// runtime, so adding a network-capable plugin later requires a deliberate
/// edit here — this file is the single place to check when reviewing
/// whether the "zero network calls" claim still holds.
const NETWORK_CAPABLE_PLUGINS: &[&str] = &[];

#[derive(Serialize)]
pub struct OfflineAudit {
    /// True when no network-capable plugin is registered.
    is_offline: bool,
    network_capable_plugins: &'static [&'static str],
}

#[tauri::command]
pub fn offline_audit() -> OfflineAudit {
    OfflineAudit {
        is_offline: NETWORK_CAPABLE_PLUGINS.is_empty(),
        network_capable_plugins: NETWORK_CAPABLE_PLUGINS,
    }
}
