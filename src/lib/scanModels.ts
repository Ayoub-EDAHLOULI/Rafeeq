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

export function openModelsDir(): Promise<void> {
  return invoke<void>("open_models_dir");
}

export function loadModel(fileName: string): Promise<void> {
  return invoke<void>("load_model", { fileName });
}

export function unloadModel(): Promise<void> {
  return invoke<void>("unload_model");
}

export function getLoadedModel(): Promise<string | null> {
  return invoke<string | null>("loaded_model");
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export function sendMessage(
  requestId: string,
  history: ChatTurn[],
): Promise<void> {
  return invoke<void>("send_message", { requestId, history });
}

export function stopGeneration(): Promise<void> {
  return invoke<void>("stop_generation");
}
