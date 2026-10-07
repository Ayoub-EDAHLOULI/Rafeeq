import { invoke } from "@tauri-apps/api/core";

export interface SystemStats {
  used_memory_bytes: number;
  total_memory_bytes: number;
  cpu_usage_percent: number;
}

export function getSystemStats(): Promise<SystemStats> {
  return invoke<SystemStats>("system_stats");
}
