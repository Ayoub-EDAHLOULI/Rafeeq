import { useEffect, useState } from "react";
import type { ModelInfo } from "../types/model";
import {
  getLoadedModel,
  getModelsDir,
  loadModel,
  scanModels,
  unloadModel,
} from "../lib/scanModels";
import ModelCard from "./ModelCard";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; models: ModelInfo[]; modelsDir: string };

interface ModelManagerProps {
  onModelLoaded: (fileName: string) => void;
}

export default function ModelManager({ onModelLoaded }: ModelManagerProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setState({ status: "loading" });
    try {
      const [models, modelsDir, loaded] = await Promise.all([
        scanModels(),
        getModelsDir(),
        getLoadedModel(),
      ]);
      setState({ status: "ready", models, modelsDir });
      setLoadedFile(loaded);
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLoad(model: ModelInfo) {
    setLoadError(null);
    setLoadingFile(model.fileName);
    try {
      await loadModel(model.fileName);
      setLoadedFile(model.fileName);
      onModelLoaded(model.fileName);
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoadingFile(null);
    }
  }

  async function handleUnload() {
    setLoadError(null);
    try {
      await unloadModel();
      setLoadedFile(null);
    } catch (err) {
      setLoadError(String(err));
    }
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

      {loadError && (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {loadError}
        </div>
      )}

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
            Add .gguf files to your models directory, then refresh to see them
            here.
          </p>
          <p className="mt-1 max-w-sm break-all font-mono text-xs text-subText">
            {state.modelsDir}
          </p>
        </div>
      )}

      {state.status === "ready" && state.models.length > 0 && (
        <div className="flex flex-col gap-3">
          {state.models.map((model) => (
            <ModelCard
              key={model.fileName}
              model={model}
              isLoaded={loadedFile === model.fileName}
              isLoading={loadingFile === model.fileName}
              onLoad={handleLoad}
              onUnload={handleUnload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
