import { invoke } from "@tauri-apps/api/core";
import type { ModelInfo } from "../types/model";

interface RawModelInfo {
  name: string;
  file_name: string;
  size_bytes: number;
  quant: string | null;
}

export async function scanModels(): Promise<ModelInfo[]> {
  const raw = await invoke<RawModelInfo[]>("scan_models");
  return raw.map((m) => ({
    name: m.name,
    fileName: m.file_name,
    sizeBytes: m.size_bytes,
    quant: m.quant,
  }));
}

export function getModelsDir(): Promise<string> {
  return invoke<string>("models_dir");
}
