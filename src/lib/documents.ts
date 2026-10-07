import { invoke } from "@tauri-apps/api/core";

export interface LoadedDocument {
  file_name: string;
  content: string;
  truncated: boolean;
  token_count: number;
  context_size: number;
}

export function pickDocument(): Promise<LoadedDocument | null> {
  return invoke<LoadedDocument | null>("pick_document");
}
