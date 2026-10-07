import { useEffect, useState } from "react";
import type { ModelInfo } from "../types/model";
import {
  getLoadedModel,
  getModelsDir,
  loadModel,
  openModelsDir,
  scanModels,
  unloadModel,
} from "../lib/scanModels";
import {
  deleteProfile,
  listProfiles,
  saveProfile,
  type ModelProfile,
} from "../lib/profiles";
import { getSettings } from "../lib/settings";
import ModelCard from "./ModelCard";
import ModelDetailsPanel from "./ModelDetailsPanel";
import FirstRun from "./FirstRun";

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
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

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
      setSelectedFile((current) => {
        if (current && models.some((m) => m.fileName === current)) {
          return current;
        }
        return loaded ?? models[0]?.fileName ?? null;
      });
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
      const settings = await getSettings().catch(() => null);
      await loadModel(model.fileName, settings?.cpu_threads);
      setLoadedFile(model.fileName);
      onModelLoaded(model.fileName);
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoadingFile(null);
    }
  }

  async function handleOpenModelsDir() {
    try {
      await openModelsDir();
    } catch (err) {
      setLoadError(String(err));
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
      const settings = await getSettings().catch(() => null);
      await loadModel(profile.model_file, settings?.cpu_threads);
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

  if (state.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-subText">Scanning for models…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium text-danger">
          Couldn't scan for models
        </p>
        <p className="max-w-sm text-sm text-subText">{state.message}</p>
      </div>
    );
  }

  if (state.models.length === 0) {
    return (
      <FirstRun
        modelsDir={state.modelsDir}
        onOpenModelsDir={handleOpenModelsDir}
        onRefresh={load}
      />
    );
  }

  const selectedModel =
    state.models.find((m) => m.fileName === selectedFile) ?? null;
  const totalBytes = state.models.reduce((sum, m) => sum + m.sizeBytes, 0);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-9 py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-text">
              Models
            </h1>
            <p className="mt-1.5 text-subText">
              {state.models.length} model
              {state.models.length === 1 ? "" : "s"} ·{" "}
              {(totalBytes / 1024 ** 3).toFixed(2)} GB on disk. Everything
              runs on this device.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleOpenModelsDir}
              className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
            >
              Open models folder
            </button>
            <button
              type="button"
              onClick={load}
              className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Refresh
            </button>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        )}

        {namingModel && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
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
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Profile
            </span>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="group flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-1.5"
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
        )}

        <div className="flex flex-col gap-3">
          {state.models.map((model) => (
            <ModelCard
              key={model.fileName}
              model={model}
              isLoaded={loadedFile === model.fileName}
              isLoading={loadingFile === model.fileName}
              isSelected={selectedFile === model.fileName}
              onSelect={(m) => setSelectedFile(m.fileName)}
              onLoad={handleLoad}
              onUnload={handleUnload}
              onSaveProfile={setNamingModel}
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-border px-5 py-4">
            <div className="min-w-[280px] flex-1">
              <div className="font-semibold text-text">
                Add another model
              </div>
              <p className="mt-1 leading-relaxed text-subText">
                Copy any .gguf file into the models folder, by USB or file
                share, then press Refresh. No download happens inside
                Rafeeq.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenModelsDir}
              className="h-11 shrink-0 rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
            >
              Open models folder
            </button>
          </div>
        </div>
      </div>

      {selectedModel && (
        <ModelDetailsPanel model={selectedModel} modelsDir={state.modelsDir} />
      )}
    </div>
  );
}
