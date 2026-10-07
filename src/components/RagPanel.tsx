import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { listRagIndexes, type IndexDoneEvent, type RagIndexSummary } from "../lib/rag";

interface RagPanelProps {
  activeIndexId: string | null;
  onSelectIndex: (id: string | null) => void;
}

const STATUS_SUFFIX: Partial<Record<RagIndexSummary["status"], string>> = {
  indexing: " · indexing",
  paused: " · paused",
  not_indexed: " · not indexed",
};

export default function RagPanel({ activeIndexId, onSelectIndex }: RagPanelProps) {
  const [indexes, setIndexes] = useState<RagIndexSummary[]>([]);

  function refresh() {
    listRagIndexes()
      .then(setIndexes)
      .catch(() => {});
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const unlistenDone = listen<IndexDoneEvent>("rag-index-done", refresh);
    const unlistenPaused = listen("rag-index-paused", refresh);
    const unlistenError = listen("rag-index-error", refresh);

    return () => {
      unlistenDone.then((f) => f());
      unlistenPaused.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  if (indexes.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-subText">
        No folders yet. Add one in Knowledge base before asking questions
        here.
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Searching
      </span>
      {indexes.map((index) => {
        const isIndexed = index.status === "indexed";
        const isActive = index.id === activeIndexId;
        return (
          <button
            key={index.id}
            type="button"
            aria-pressed={isActive}
            disabled={!isIndexed}
            onClick={() => onSelectIndex(isActive ? null : index.id)}
            className={`h-10 rounded-full border px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              isActive
                ? "border-primary bg-panel2 text-accentFg"
                : isIndexed
                  ? "border-border bg-card text-text hover:bg-inputBg"
                  : "border-dashed border-border text-faint"
            }`}
          >
            {index.name}
            {STATUS_SUFFIX[index.status] ?? ""}
          </button>
        );
      })}
    </div>
  );
}
