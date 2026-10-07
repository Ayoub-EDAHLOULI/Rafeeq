import { useEffect, useState } from "react";
import type { ModelInfo } from "../types/model";
import { scanModels } from "../lib/scanModels";
import { getLoadedEmbeddingModel, loadEmbeddingModel } from "../lib/rag";
import { getSettings, saveSettings, type AppSettings } from "../lib/settings";

export default function KnowledgeSettingsPanel() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [embeddingModel, setEmbeddingModel] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scanModels()
      .then(setModels)
      .catch(() => {});
    getLoadedEmbeddingModel()
      .then(setEmbeddingModel)
      .catch(() => {});
    getSettings()
      .then(setSettings)
      .catch(() => {});
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

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      saveSettings(next).catch(() => {});
      return next;
    });
  }

  const embeddingCandidates = models.filter((m) => m.modelType !== "chat");

  return (
    <aside
      aria-label="Indexing settings"
      className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border bg-card px-5 py-5"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        Indexing
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor="knowledge-embedding-model" className="text-sm font-medium text-text">
          Embedding model
        </label>
        {embeddingModel ? (
          <div className="rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs text-text">
            {embeddingModel}
          </div>
        ) : embeddingCandidates.length === 0 ? (
          <p className="text-xs leading-relaxed text-subText">
            No embedding model found. Sideload one (e.g. nomic-embed-text)
            into your models folder.
          </p>
        ) : (
          <select
            id="knowledge-embedding-model"
            value=""
            onChange={(e) => {
              if (e.target.value) handleLoadEmbeddingModel(e.target.value);
            }}
            disabled={isLoadingModel}
            className="h-11 rounded-lg border border-border bg-background px-3 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>
              {isLoadingModel ? "Loading…" : "Select a model"}
            </option>
            {embeddingCandidates.map((model) => (
              <option key={model.fileName} value={model.fileName}>
                {model.name}
              </option>
            ))}
          </select>
        )}
        <span className="text-xs leading-relaxed text-subText">
          Turns your documents into searchable vectors. Changing it means
          re-indexing every folder.
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="knowledge-chunk-size" className="text-sm font-medium text-text">
            Chunk size
          </label>
          <span className="font-mono text-sm text-subText">
            {settings?.chunk_size ?? 300} tokens
          </span>
        </div>
        <input
          id="knowledge-chunk-size"
          type="range"
          min={100}
          max={1000}
          step={50}
          value={settings?.chunk_size ?? 300}
          onChange={(e) =>
            updateSettings({ chunk_size: Number(e.target.value) })
          }
          className="w-full accent-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="knowledge-chunk-overlap" className="text-sm font-medium text-text">
            Overlap
          </label>
          <span className="font-mono text-sm text-subText">
            {settings?.chunk_overlap ?? 50} tokens
          </span>
        </div>
        <input
          id="knowledge-chunk-overlap"
          type="range"
          min={0}
          max={200}
          step={10}
          value={settings?.chunk_overlap ?? 50}
          onChange={(e) =>
            updateSettings({ chunk_overlap: Number(e.target.value) })
          }
          className="w-full accent-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="knowledge-passages" className="text-sm font-medium text-text">
            Passages per question
          </label>
          <span className="font-mono text-sm text-subText">
            {settings?.passages_per_question ?? 5}
          </span>
        </div>
        <input
          id="knowledge-passages"
          type="range"
          min={1}
          max={10}
          step={1}
          value={settings?.passages_per_question ?? 5}
          onChange={(e) =>
            updateSettings({ passages_per_question: Number(e.target.value) })
          }
          className="w-full accent-primary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="knowledge-threshold" className="text-sm font-medium text-text">
            Relevance threshold
          </label>
          <span className="font-mono text-sm text-subText">
            {(settings?.relevance_threshold ?? 0.3).toFixed(2)}
          </span>
        </div>
        <input
          id="knowledge-threshold"
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={settings?.relevance_threshold ?? 0.3}
          onChange={(e) =>
            updateSettings({ relevance_threshold: Number(e.target.value) })
          }
          className="w-full accent-primary"
        />
        <span className="text-xs leading-relaxed text-subText">
          Below this, a question is treated as not found in your documents
          rather than answered. Raise it if answers feel loosely related;
          lower it if relevant questions get rejected.
        </span>
      </div>

      <div className="h-px bg-border" />

      <div className="rounded-lg border border-border bg-background px-3.5 py-3 text-sm leading-relaxed text-subText">
        In the RAG tab, each answer lists the files and passages it was
        drawn from, so you can check it.
      </div>
    </aside>
  );
}
