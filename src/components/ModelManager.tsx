import { useEffect, useState } from "react";
import type { ModelInfo } from "../types/model";
import { getModelsDir, scanModels } from "../lib/scanModels";
import ModelCard from "./ModelCard";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; models: ModelInfo[]; modelsDir: string };

export default function ModelManager() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  async function load() {
    setState({ status: "loading" });
    try {
      const [models, modelsDir] = await Promise.all([
        scanModels(),
        getModelsDir(),
      ]);
      setState({ status: "ready", models, modelsDir });
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleLoad(model: ModelInfo) {
    console.log("Load model (not yet wired):", model.fileName);
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Models
          </h1>
          <p className="mt-1 text-sm text-subText">
            Select a local model to start a chat. Everything runs on this
            device.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg"
        >
          Refresh
        </button>
      </div>

      {state.status === "loading" && (
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-sm text-subText">Scanning for models…</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-danger/40 py-20 text-center">
          <p className="text-sm font-medium text-danger">
            Couldn't scan for models
          </p>
          <p className="max-w-sm text-sm text-subText">{state.message}</p>
        </div>
      )}

      {state.status === "ready" && state.models.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-text">No models found</p>
          <p className="max-w-sm text-sm text-subText">
            Add .gguf files to your models directory, then refresh to see
            them here.
          </p>
          <p className="mt-1 max-w-sm break-all font-mono text-xs text-subText">
            {state.modelsDir}
          </p>
        </div>
      )}

      {state.status === "ready" && state.models.length > 0 && (
        <div className="flex flex-col gap-3">
          {state.models.map((model) => (
            <ModelCard key={model.fileName} model={model} onLoad={handleLoad} />
          ))}
        </div>
      )}
    </div>
  );
}
