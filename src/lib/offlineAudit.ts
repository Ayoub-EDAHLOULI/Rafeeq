import { invoke } from "@tauri-apps/api/core";

export interface OfflineAudit {
  is_offline: boolean;
  network_capable_plugins: string[];
}

export function getOfflineAudit(): Promise<OfflineAudit> {
  return invoke<OfflineAudit>("offline_audit");
}
