import type { ModelInfo } from "../types/model";
import { formatBytes } from "../lib/formatBytes";

interface ModelDetailsPanelProps {
  model: ModelInfo;
  modelsDir: string;
}

const TYPE_LABEL: Record<ModelInfo["modelType"], string> = {
  chat: "Chat",
  embedding: "Embedding",
  unknown: "Unknown",
};

export default function ModelDetailsPanel({
  model,
  modelsDir,
}: ModelDetailsPanelProps) {
  return (
    <aside
      aria-label="Model details"
      className="flex w-80 shrink-0 flex-col gap-4 overflow-hidden border-l border-border bg-card px-5 py-6"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        Details
      </div>
      <div className="text-lg font-semibold text-text">{model.name}</div>
      <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-3.5">
        <dt className="text-subText">Type</dt>
        <dd>{TYPE_LABEL[model.modelType]}</dd>
        {model.quant && (
          <>
            <dt className="text-subText">Quantization</dt>
            <dd className="font-mono">{model.quant}</dd>
          </>
        )}
        <dt className="text-subText">Size on disk</dt>
        <dd className="font-mono">{formatBytes(model.sizeBytes)}</dd>
        <dt className="text-subText">File</dt>
        <dd className="break-all font-mono text-xs">{model.fileName}</dd>
        <dt className="text-subText">Location</dt>
        <dd className="break-all font-mono text-xs">{modelsDir}</dd>
      </dl>
      <div className="h-px bg-border" />
      {model.modelType === "embedding" ? (
        <div className="rounded-xl border border-border bg-background px-4 py-3.5 leading-relaxed text-subText">
          Embedding models aren't used for chat. Load this from the RAG tab
          instead, when indexing a folder of documents.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-background px-4 py-3.5 leading-relaxed text-subText">
          Larger models tend to give better answers on documents and code,
          but need more RAM and run more slowly.
        </div>
      )}
    </aside>
  );
}
