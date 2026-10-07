import { invoke } from "@tauri-apps/api/core";

export function loadEmbeddingModel(fileName: string): Promise<void> {
  return invoke<void>("load_embedding_model", { fileName });
}

export function getLoadedEmbeddingModel(): Promise<string | null> {
  return invoke<string | null>("loaded_embedding_model");
}

export type IndexStatus = "not_indexed" | "indexing" | "paused" | "indexed";

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

// Starts (or resumes, if the folder was previously paused) background
// indexing for a folder and returns immediately. Progress and completion
// are reported via the "rag-index-progress" / "rag-index-done" /
// "rag-index-paused" / "rag-index-error" events, listened to directly with
// @tauri-apps/api/event's `listen` where needed.
export function indexFolder(id: string): Promise<void> {
  return invoke<void>("index_folder", { id });
}

// Requests that an in-progress indexing job stop after its current file,
// keeping whatever chunks it has already embedded. Takes effect on the
// "rag-index-paused" event, not instantly.
export function pauseIndexing(id: string): Promise<void> {
  return invoke<void>("pause_indexing", { id });
}

// Discards a paused job's partial progress, resetting the folder to Not
// indexed so the next "Index now" starts from scratch.
export function discardIndexProgress(id: string): Promise<void> {
  return invoke<void>("discard_index_progress", { id });
}

export interface IndexProgressEvent {
  id: string;
  files_done: number;
  files_total: number;
}

export interface IndexDoneEvent {
  id: string;
  chunk_count: number;
}

export interface IndexPausedEvent {
  id: string;
}

export interface IndexErrorEvent {
  id: string;
  message: string;
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
