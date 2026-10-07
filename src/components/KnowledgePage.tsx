import { useEffect, useState } from "react";
import {
  addFolder,
  deleteRagIndex,
  indexFolder,
  listRagIndexes,
  renameRagIndex,
  type RagIndexSummary,
} from "../lib/rag";

const STATUS_LABEL: Record<RagIndexSummary["status"], string> = {
  not_indexed: "Not indexed",
  indexing: "Indexing",
  indexed: "Indexed",
};

interface FolderCardProps {
  folder: RagIndexSummary;
  isBusy: boolean;
  onIndex: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function FolderCard({
  folder,
  isBusy,
  onIndex,
  onRemove,
  onRename,
}: FolderCardProps) {
  const isIndexed = folder.status === "indexed";
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(folder.name);

  function commitRename() {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== folder.name) onRename(folder.id, trimmed);
    else setDraftName(folder.name);
    setIsEditingName(false);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-xl border bg-card px-5 py-4 ${
        isIndexed ? "border-primary/60" : "border-border"
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel2 text-accentFg">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </svg>
      </div>

      <div className="min-w-[240px] flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {isEditingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") {
                  setDraftName(folder.name);
                  setIsEditingName(false);
                }
              }}
              className="min-w-0 rounded-md border border-border bg-background px-2 py-0.5 text-base font-semibold text-text focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingName(true)}
              title="Rename"
              className="text-base font-semibold text-text hover:text-accentFg"
            >
              {folder.name}
            </button>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              isIndexed
                ? "bg-primary/10 text-accentFg"
                : "bg-panel2 text-subText"
            }`}
          >
            {isIndexed && <span className="h-1.5 w-1.5 rounded-full bg-dot" />}
            {STATUS_LABEL[folder.status]}
          </span>
        </div>
        <div className="mt-1 truncate font-mono text-xs text-faint">
          {folder.folder_path}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {isIndexed && (
          <span className="font-mono text-sm text-subText">
            {folder.chunk_count.toLocaleString()} chunks
          </span>
        )}
        <button
          type="button"
          onClick={() => onIndex(folder.id)}
          disabled={isBusy}
          className={`h-11 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isIndexed
              ? "border border-border text-text hover:bg-inputBg"
              : "bg-primary text-white hover:opacity-90"
          }`}
        >
          {isBusy ? "Indexing…" : isIndexed ? "Re-index" : "Index now"}
        </button>
        <button
          type="button"
          onClick={() => onRemove(folder.id)}
          aria-label={`Remove ${folder.name} from the knowledge base`}
          disabled={isBusy}
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-subText transition-colors hover:bg-inputBg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const [folders, setFolders] = useState<RagIndexSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listRagIndexes()
      .then((result) => {
        setFolders(result);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setIsLoading(false);
      });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddFolder() {
    setError(null);
    setIsAdding(true);
    try {
      const added = await addFolder();
      if (added) refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRename(id: string, name: string) {
    setError(null);
    try {
      await renameRagIndex(id, name);
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleIndex(id: string) {
    setError(null);
    setIndexingId(id);
    try {
      await indexFolder(id);
      refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setIndexingId(null);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deleteRagIndex(id);
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-9 py-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-text">
            Knowledge base
          </h1>
          <p className="mt-1.5 max-w-xl text-subText">
            Index folders of documents on this device, then ask questions
            about them in the RAG tab. Supported files: .txt, .md, .docx,
            .pdf.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddFolder}
          disabled={isAdding}
          className="flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add folder
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-subText">Loading…</p>
        </div>
      ) : folders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-base font-medium text-text">
            No folders yet
          </p>
          <p className="max-w-md text-sm text-subText">
            Add a folder of documents to start building a searchable
            knowledge base for the RAG tab.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              isBusy={indexingId === folder.id}
              onIndex={handleIndex}
              onRemove={handleRemove}
              onRename={handleRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
