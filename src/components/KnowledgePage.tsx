import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  addFolder,
  deleteRagIndex,
  discardIndexProgress,
  indexFolder,
  listRagIndexes,
  pauseIndexing,
  renameRagIndex,
  type IndexDoneEvent,
  type IndexErrorEvent,
  type IndexPausedEvent,
  type IndexProgressEvent,
  type RagIndexSummary,
} from "../lib/rag";

const STATUS_LABEL: Record<RagIndexSummary["status"], string> = {
  not_indexed: "Not indexed",
  indexing: "Indexing",
  paused: "Paused",
  indexed: "Indexed",
};

interface FolderCardProps {
  folder: RagIndexSummary;
  progress: IndexProgressEvent | null;
  onIndex: (id: string) => void;
  onPause: (id: string) => void;
  onDiscard: (id: string) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function FolderCard({
  folder,
  progress,
  onIndex,
  onPause,
  onDiscard,
  onRemove,
  onRename,
}: FolderCardProps) {
  const isIndexed = folder.status === "indexed";
  const isIndexing = folder.status === "indexing";
  const isPaused = folder.status === "paused";
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
                : isIndexing || isPaused
                  ? "bg-panel2 text-accentFg"
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
        {(isIndexing || isPaused) && progress && (
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.round((progress.files_done / Math.max(progress.files_total, 1)) * 100)}%`,
                }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs text-subText">
              {progress.files_done} of {progress.files_total} files
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {isIndexed && !isIndexing && (
          <span className="font-mono text-sm text-subText">
            {folder.chunk_count.toLocaleString()} chunks
          </span>
        )}
        {isIndexing ? (
          <button
            type="button"
            onClick={() => onPause(folder.id)}
            className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-inputBg"
          >
            Pause
          </button>
        ) : isPaused ? (
          <>
            <button
              type="button"
              onClick={() => onDiscard(folder.id)}
              className="h-11 rounded-lg border border-border px-4 text-sm font-semibold text-text transition-colors hover:bg-inputBg"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => onIndex(folder.id)}
              className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Resume
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onIndex(folder.id)}
            className={`h-11 rounded-lg px-4 text-sm font-semibold transition-colors ${
              isIndexed
                ? "border border-border text-text hover:bg-inputBg"
                : "bg-primary text-white hover:opacity-90"
            }`}
          >
            {isIndexed ? "Re-index" : "Index now"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(folder.id)}
          aria-label={`Remove ${folder.name} from the knowledge base`}
          disabled={isIndexing}
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
  const [progressById, setProgressById] = useState<
    Record<string, IndexProgressEvent>
  >({});
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

  useEffect(() => {
    const unlistenProgress = listen<IndexProgressEvent>(
      "rag-index-progress",
      (event) => {
        setProgressById((prev) => ({
          ...prev,
          [event.payload.id]: event.payload,
        }));
      },
    );

    const unlistenDone = listen<IndexDoneEvent>("rag-index-done", (event) => {
      setProgressById((prev) => {
        const { [event.payload.id]: _removed, ...rest } = prev;
        return rest;
      });
      refresh();
    });

    const unlistenPaused = listen<IndexPausedEvent>(
      "rag-index-paused",
      () => {
        refresh();
      },
    );

    const unlistenError = listen<IndexErrorEvent>(
      "rag-index-error",
      (event) => {
        setProgressById((prev) => {
          const { [event.payload.id]: _removed, ...rest } = prev;
          return rest;
        });
        setError(event.payload.message);
        refresh();
      },
    );

    return () => {
      unlistenProgress.then((f) => f());
      unlistenDone.then((f) => f());
      unlistenPaused.then((f) => f());
      unlistenError.then((f) => f());
    };
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
    try {
      await indexFolder(id);
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  async function handlePause(id: string) {
    try {
      await pauseIndexing(id);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleDiscard(id: string) {
    setError(null);
    try {
      await discardIndexProgress(id);
      setProgressById((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
      refresh();
    } catch (err) {
      setError(String(err));
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
              progress={progressById[folder.id] ?? null}
              onIndex={handleIndex}
              onPause={handlePause}
              onDiscard={handleDiscard}
              onRemove={handleRemove}
              onRename={handleRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
