import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ModelInfo } from "../types/model";
import { scanModels } from "../lib/scanModels";
import {
  addFolder,
  deleteRagIndex,
  getLoadedEmbeddingModel,
  indexFolder,
  listRagIndexes,
  loadEmbeddingModel,
  type IndexDoneEvent,
  type IndexErrorEvent,
  type RagIndexSummary,
} from "../lib/rag";

interface RagPanelProps {
  activeIndexId: string | null;
  onSelectIndex: (id: string | null) => void;
}

export default function RagPanel({
  activeIndexId,
  onSelectIndex,
}: RagPanelProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [indexes, setIndexes] = useState<RagIndexSummary[]>([]);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    scanModels()
      .then(setModels)
      .catch(() => {});
    getLoadedEmbeddingModel()
      .then(setEmbeddingModel)
      .catch(() => {});
    listRagIndexes()
      .then(setIndexes)
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const unlistenDone = listen<IndexDoneEvent>("rag-index-done", (event) => {
      if (event.payload.id === indexingId) {
        setIndexingId(null);
        onSelectIndex(event.payload.id);
      }
      refresh();
    });

    const unlistenError = listen<IndexErrorEvent>(
      "rag-index-error",
      (event) => {
        if (event.payload.id === indexingId) {
          setIndexingId(null);
          setError(event.payload.message);
        }
        refresh();
      },
    );

    return () => {
      unlistenDone.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, [indexingId]);

  async function handleLoadEmbeddingModel(fileName: string) {
    setError(null);
    setIsLoadingModel(true);
    try {
      await loadEmbeddingModel(fileName);
      setEmbeddingModel(fileName);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoadingModel(false);
    }
  }

  async function handleIndexFolder() {
    setError(null);
    try {
      const added = await addFolder();
      if (added) {
        setIndexingId(added.id);
        refresh();
        await indexFolder(added.id);
      }
    } catch (err) {
      setError(String(err));
      setIndexingId(null);
    }
  }

  async function handleDeleteIndex(id: string) {
    try {
      await deleteRagIndex(id);
      if (id === activeIndexId) onSelectIndex(null);
      refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3">
      {error && <p className="text-xs text-danger">{error}</p>}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-subText">
          Embedding model
        </p>
        {embeddingModel ? (
          <p className="font-mono text-xs text-text">{embeddingModel}</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-subText">
            No models found. Sideload a small embedding model (e.g.
            nomic-embed-text) into your models folder.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {models.map((model) => (
              <button
                key={model.fileName}
                type="button"
                onClick={() => handleLoadEmbeddingModel(model.fileName)}
                disabled={isLoadingModel}
                className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-inputBg disabled:opacity-50"
              >
                {isLoadingModel ? "Loading…" : model.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {embeddingModel && (
        <>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-subText">
              Indexes
            </p>
            {indexes.length === 0 ? (
              <p className="text-sm text-subText">No folders indexed yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {indexes.map((index) => (
                  <div
                    key={index.id}
                    className={`group flex items-center gap-2 rounded-lg border py-1.5 pl-3 pr-1.5 ${
                      index.id === activeIndexId
                        ? "border-primary/60 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onSelectIndex(
                          index.id === activeIndexId ? null : index.id,
                        )
                      }
                      className="text-sm font-medium text-text"
                    >
                      {index.name}{" "}
                      <span className="text-xs text-subText">
                        (
                        {index.status === "indexing"
                          ? "indexing…"
                          : index.status === "not_indexed"
                            ? "not indexed"
                            : `${index.chunk_count} chunks`}
                        )
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteIndex(index.id)}
                      aria-label="Delete index"
                      className="rounded px-1 text-xs text-subText opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleIndexFolder}
            disabled={indexingId !== null}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {indexingId !== null ? "Indexing…" : "Index a folder…"}
          </button>
        </>
      )}
    </div>
  );
}
