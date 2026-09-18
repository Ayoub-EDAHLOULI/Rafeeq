import { invoke } from "@tauri-apps/api/core";

export interface ModelProfile {
  id: string;
  name: string;
  model_file: string;
  created_at: number;
}

export function saveProfile(
  name: string,
  modelFile: string,
): Promise<ModelProfile> {
  return invoke<ModelProfile>("save_profile", { name, modelFile });
}

export function listProfiles(): Promise<ModelProfile[]> {
  return invoke<ModelProfile[]>("list_profiles");
}

export function deleteProfile(id: string): Promise<void> {
  return invoke<void>("delete_profile", { id });
}
