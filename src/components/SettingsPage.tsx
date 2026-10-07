import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ThemePreference } from "../theme/useTheme";
import { getModelsDir, openModelsDir } from "../lib/scanModels";
import {
  deleteAllSessions,
  getAppVersion,
  getSettings,
  saveSettings,
  type AppSettings,
} from "../lib/settings";

interface SettingsPageProps {
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  loadedModel: string | null;
}

const THEME_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export default function SettingsPage({
  themePreference,
  onThemePreferenceChange,
  loadedModel,
}: SettingsPageProps) {
  const [modelsDir, setModelsDir] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [version, setVersion] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  useEffect(() => {
    getModelsDir()
      .then(setModelsDir)
      .catch(() => {});
    getSettings()
      .then(setSettings)
      .catch(() => {});
    getAppVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      saveSettings(next).catch(() => {});
      return next;
    });
  }

  async function handleDeleteAll() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    try {
      await deleteAllSessions();
      setDeleteStatus("All conversations deleted.");
    } catch (err) {
      setDeleteStatus(String(err));
    } finally {
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto px-9 py-7">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-text">
          Settings
        </h1>
        <p className="mt-1.5 text-subText">
          Everything here is stored on this device.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-[340px] flex-1 flex-col gap-4">
          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-5">
            <h2 className="text-[15px] font-semibold text-text">Appearance</h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium text-text">Theme</span>
              <div
                role="radiogroup"
                aria-label="Theme"
                className="flex gap-0.5 rounded-xl border border-border bg-background p-0.5"
              >
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={themePreference === option.key}
                    onClick={() => onThemePreferenceChange(option.key)}
                    className={`h-9 rounded-lg px-4 text-sm font-medium transition-colors ${
                      themePreference === option.key
                        ? "bg-primary text-white"
                        : "text-subText hover:text-text"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-5">
            <h2 className="text-[15px] font-semibold text-text">
              Models folder
            </h2>
            <p className="leading-relaxed text-subText">
              Rafeeq reads models from this folder. Copy .gguf files into it,
              then refresh the Models page.
            </p>
            <div className="break-all rounded-lg border border-border bg-background px-3.5 py-3 font-mono text-xs text-text">
              {modelsDir}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => openModelsDir().catch(() => {})}
                className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
              >
                Open folder
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-3.5 rounded-xl border border-border bg-card px-5 py-5">
            <h2 className="text-[15px] font-semibold text-text">
              Privacy and data
            </h2>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-3.5 py-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accentFg)"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 shrink-0"
              >
                <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span className="leading-relaxed text-subText">
                Rafeeq makes no network calls. Block network access at the
                system level and it runs the same.
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-text">
                Keep chat history on this device
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings?.keep_history ?? true}
                onClick={() =>
                  updateSettings({ keep_history: !settings?.keep_history })
                }
                className="flex h-11 w-[52px] shrink-0 items-center justify-center"
              >
                <span
                  className={`relative block h-[26px] w-11 rounded-full transition-colors ${
                    settings?.keep_history ?? true ? "bg-primary" : "bg-inputBg"
                  }`}
                >
                  <span
                    className={`absolute top-[3px] block h-5 w-5 rounded-full bg-white transition-all ${
                      settings?.keep_history ?? true
                        ? "right-[3px]"
                        : "left-[3px]"
                    }`}
                  />
                </span>
              </button>
            </div>
            <div>
              {confirmingDelete ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDeleteAll}
                    className="h-11 rounded-lg bg-warn px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Click again to confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-inputBg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  className="h-11 rounded-lg border border-warn px-4 text-sm font-medium text-warn transition-colors hover:bg-warn/10"
                >
                  Delete all conversations
                </button>
              )}
              {deleteStatus && (
                <p className="mt-2 text-xs text-subText">{deleteStatus}</p>
              )}
            </div>
          </section>
        </div>

        <div className="flex min-w-[340px] flex-1 flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-5">
            <div>
              <h2 className="text-[15px] font-semibold text-text">
                Defaults for new chats
              </h2>
              <p className="mt-1.5 leading-relaxed text-subText">
                Applied when you start a chat. You can still change them for
                a single session.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="settings-threads" className="font-medium text-text">
                  CPU threads
                </label>
                <span className="font-mono text-sm text-subText">
                  {settings?.cpu_threads ?? 4}
                </span>
              </div>
              <input
                id="settings-threads"
                type="range"
                min={1}
                max={8}
                step={1}
                value={settings?.cpu_threads ?? 4}
                onChange={(e) =>
                  updateSettings({ cpu_threads: Number(e.target.value) })
                }
                className="w-full accent-primary"
              />
              <span className="text-xs text-faint">
                Fewer threads keep the computer responsive while Rafeeq
                answers. Takes effect the next time you load a model.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="settings-maxtok" className="font-medium text-text">
                  Max response length
                </label>
                <span className="font-mono text-sm text-subText">
                  {settings?.max_response_tokens ?? 1024}
                </span>
              </div>
              <input
                id="settings-maxtok"
                type="range"
                min={128}
                max={2048}
                step={128}
                value={settings?.max_response_tokens ?? 1024}
                onChange={(e) =>
                  updateSettings({
                    max_response_tokens: Number(e.target.value),
                  })
                }
                className="w-full accent-primary"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="settings-temp" className="font-medium text-text">
                  Temperature
                </label>
                <span className="font-mono text-sm text-subText">
                  {(settings?.default_temperature ?? 0.8).toFixed(1)}
                </span>
              </div>
              <input
                id="settings-temp"
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings?.default_temperature ?? 0.8}
                onChange={(e) =>
                  updateSettings({
                    default_temperature: Number(e.target.value),
                  })
                }
                className="w-full accent-primary"
              />
            </div>
          </section>

          <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-5 py-5">
            <h2 className="text-[15px] font-semibold text-text">About</h2>
            <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
              <dt className="text-subText">Version</dt>
              <dd className="font-mono">{version || "—"}</dd>
              <dt className="text-subText">Developer</dt>
              <dd>
                <button
                  type="button"
                  onClick={() =>
                    openUrl("https://ayoubedahlouli.com").catch(() => {})
                  }
                  className="text-text transition-colors hover:text-primary hover:underline"
                >
                  Ayoub Edahlouli
                </button>
              </dd>
              <dt className="text-subText">License</dt>
              <dd>MIT</dd>
              <dt className="text-subText">Built with</dt>
              <dd>Tauri, Rust, llama.cpp</dd>
              {loadedModel && (
                <>
                  <dt className="text-subText">Loaded model</dt>
                  <dd className="break-all font-mono text-xs">
                    {loadedModel}
                  </dd>
                </>
              )}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
