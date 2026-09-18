import type { ModelInfo } from "../types/model";
import { mockModels } from "../lib/mockModels";
import ModelCard from "./ModelCard";

export default function ModelManager() {
  function handleLoad(model: ModelInfo) {
    console.log("Load model (not yet wired):", model.fileName);
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          Models
        </h1>
        <p className="mt-1 text-sm text-subText">
          Select a local model to start a chat. Everything runs on this device.
        </p>
      </div>

      {mockModels.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-20 text-center">
          <p className="text-sm font-medium text-text">No models found</p>
          <p className="max-w-sm text-sm text-subText">
            Add .gguf files to your models directory, then refresh to see them
            here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {mockModels.map((model) => (
            <ModelCard key={model.fileName} model={model} onLoad={handleLoad} />
          ))}
        </div>
      )}
    </div>
  );
}
