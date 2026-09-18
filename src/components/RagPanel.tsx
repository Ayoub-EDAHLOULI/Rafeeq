import { useEffect, useState } from "react";
import type { ModelInfo } from "../types/model";
import { scanModels } from "../lib/scanModels";
import {
  deleteRagIndex,
  getLoadedEmbeddingModel,
  listRagIndexes,
  loadEmbeddingModel,
  pickAndIndexFolder,
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
  const [indexName, setIndexName] = useState("");
  const [isIndexing, setIsIndexing] = useState(false);
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
    if (!indexName.trim()) return;
    setError(null);
    setIsIndexing(true);
    try {
      const summary = await pickAndIndexFolder(indexName.trim());
      if (summary) {
        setIndexName("");
        refresh();
        onSelectIndex(summary.id);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsIndexing(false);
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
                        ({index.chunk_count} chunks)
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

          <div className="flex items-center gap-2">
            <input
              value={indexName}
              onChange={(e) => setIndexName(e.target.value)}
              placeholder="Index name"
              className="min-w-0 flex-1 rounded-lg border border-border bg-inputBg px-3 py-1.5 text-sm text-text placeholder:text-subText focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleIndexFolder}
              disabled={!indexName.trim() || isIndexing}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isIndexing ? "Indexing…" : "Index folder…"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
