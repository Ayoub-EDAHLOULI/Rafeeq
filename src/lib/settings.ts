import { invoke } from "@tauri-apps/api/core";

export type ThemeSetting = "system" | "light" | "dark";

export interface AppSettings {
  theme: ThemeSetting;
  keep_history: boolean;
  cpu_threads: number;
  max_response_tokens: number;
  default_temperature: number;
  chunk_size: number;
  chunk_overlap: number;
  passages_per_question: number;
  relevance_threshold: number;
}

export function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>("save_settings", { settings });
}

export function deleteAllSessions(): Promise<void> {
  return invoke<void>("delete_all_sessions");
}

export function getAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}
