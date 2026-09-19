import { invoke } from "@tauri-apps/api/core";

export function loadEmbeddingModel(fileName: string): Promise<void> {
  return invoke<void>("load_embedding_model", { fileName });
}

export function getLoadedEmbeddingModel(): Promise<string | null> {
  return invoke<string | null>("loaded_embedding_model");
}

export interface RagIndexSummary {
  id: string;
  name: string;
  folder_path: string;
  chunk_count: number;
  skipped_files?: string[];
}

export function pickAndIndexFolder(
  name: string,
): Promise<RagIndexSummary | null> {
  return invoke<RagIndexSummary | null>("pick_and_index_folder", { name });
}

export function listRagIndexes(): Promise<RagIndexSummary[]> {
  return invoke<RagIndexSummary[]>("list_rag_indexes");
}

export function deleteRagIndex(id: string): Promise<void> {
  return invoke<void>("delete_rag_index", { id });
}

export interface RagResult {
  source_file: string;
  text: string;
  score: number;
}

export function ragSearch(
  indexId: string,
  query: string,
  topK: number,
): Promise<RagResult[]> {
  return invoke<RagResult[]>("rag_search", { indexId, query, topK });
}
