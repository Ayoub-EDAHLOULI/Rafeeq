import { invoke } from "@tauri-apps/api/core";

export function loadEmbeddingModel(fileName: string): Promise<void> {
  return invoke<void>("load_embedding_model", { fileName });
}

export function getLoadedEmbeddingModel(): Promise<string | null> {
  return invoke<string | null>("loaded_embedding_model");
}

export type IndexStatus = "not_indexed" | "indexing" | "indexed";

export interface RagIndexSummary {
  id: string;
  name: string;
  folder_path: string;
  chunk_count: number;
  status: IndexStatus;
  skipped_files?: string[];
}

export function addFolder(): Promise<RagIndexSummary | null> {
  return invoke<RagIndexSummary | null>("add_folder");
}

export function indexFolder(id: string): Promise<RagIndexSummary> {
  return invoke<RagIndexSummary>("index_folder", { id });
}

export function listRagIndexes(): Promise<RagIndexSummary[]> {
  return invoke<RagIndexSummary[]>("list_rag_indexes");
}

export function deleteRagIndex(id: string): Promise<void> {
  return invoke<void>("delete_rag_index", { id });
}

export function renameRagIndex(id: string, name: string): Promise<void> {
  return invoke<void>("rename_rag_index", { id, name });
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
