import { invoke } from "@tauri-apps/api/core";

export interface LoadedDocument {
  file_name: string;
  content: string;
  truncated: boolean;
}

export function pickDocument(): Promise<LoadedDocument | null> {
  return invoke<LoadedDocument | null>("pick_document");
}
