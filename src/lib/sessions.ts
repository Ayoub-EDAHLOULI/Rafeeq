import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage } from "../types/message";

export interface SessionSummary {
  id: string;
  title: string;
  mode: string;
  model_file: string;
  updated_at: number;
}

export interface Session {
  id: string;
  title: string;
  mode: string;
  model_file: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

export function saveSession(
  id: string,
  title: string,
  mode: string,
  modelFile: string,
  messages: ChatMessage[],
  createdAt: number,
): Promise<void> {
  return invoke<void>("save_session", {
    id,
    title,
    mode,
    modelFile,
    messages,
    createdAt,
  });
}

export function listSessions(): Promise<SessionSummary[]> {
  return invoke<SessionSummary[]>("list_sessions");
}

export function loadSession(id: string): Promise<Session> {
  return invoke<Session>("load_session", { id });
}

export function deleteSession(id: string): Promise<void> {
  return invoke<void>("delete_session", { id });
}
