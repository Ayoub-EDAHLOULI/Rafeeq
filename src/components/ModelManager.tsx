import { useEffect, useState } from "react";
import type { ModelInfo } from "../types/model";
import {
  getLoadedModel,
  getModelsDir,
  loadModel,
  scanModels,
  unloadModel,
} from "../lib/scanModels";
import {
  deleteProfile,
  listProfiles,
  saveProfile,
  type ModelProfile,
} from "../lib/profiles";
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
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [namingModel, setNamingModel] = useState<ModelInfo | null>(null);
  const [profileName, setProfileName] = useState("");

  function refreshProfiles() {
    listProfiles()
      .then(setProfiles)
      .catch(() => {});
  }

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
    refreshProfiles();
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

  async function handleLoadProfile(profile: ModelProfile) {
    setLoadError(null);
    setLoadingFile(profile.model_file);
    try {
      await loadModel(profile.model_file);
      setLoadedFile(profile.model_file);
      onModelLoaded(profile.model_file);
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoadingFile(null);
    }
  }

  async function handleSaveProfile() {
    if (!namingModel || !profileName.trim()) return;
    try {
      await saveProfile(profileName.trim(), namingModel.fileName);
      setNamingModel(null);
      setProfileName("");
      refreshProfiles();
    } catch (err) {
      setLoadError(String(err));
    }
  }

  async function handleDeleteProfile(id: string) {
    try {
      await deleteProfile(id);
      refreshProfiles();
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

      {namingModel && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
          <p className="shrink-0 text-sm text-text">
            Save "{namingModel.name}" as:
          </p>
          <input
            autoFocus
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveProfile();
              if (e.key === "Escape") setNamingModel(null);
            }}
            placeholder="Profile name"
            className="min-w-0 flex-1 rounded-lg border border-border bg-inputBg px-3 py-1.5 text-sm text-text placeholder:text-subText focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={!profileName.trim()}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setNamingModel(null)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-inputBg"
          >
            Cancel
          </button>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-subText">
            Profiles
          </p>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="group flex items-center gap-2 rounded-lg border border-border bg-card py-1.5 pl-3 pr-1.5"
              >
                <button
                  type="button"
                  onClick={() => handleLoadProfile(profile)}
                  disabled={loadingFile === profile.model_file}
                  className="text-sm font-medium text-text disabled:opacity-50"
                >
                  {profile.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(profile.id)}
                  aria-label="Delete profile"
                  className="rounded px-1 text-xs text-subText opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
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
              onSaveProfile={setNamingModel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
