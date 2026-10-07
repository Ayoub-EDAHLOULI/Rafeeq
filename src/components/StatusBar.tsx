import { useEffect, useState } from "react";
import { getOfflineAudit } from "../lib/offlineAudit";
import { getSystemStats, type SystemStats } from "../lib/systemStats";

const POLL_INTERVAL_MS = 2000;

function formatGb(bytes: number): string {
  return (bytes / 1024 ** 3).toFixed(1);
}

export default function StatusBar() {
  const [isOffline, setIsOffline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    getOfflineAudit()
      .then((audit) => setIsOffline(audit.is_offline))
      .catch(() => setIsOffline(null));
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function poll() {
      getSystemStats()
        .then(setStats)
        .catch(() => {});
    }

    function startPolling() {
      if (intervalId !== null) return;
      poll();
      intervalId = setInterval(poll, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (intervalId === null) return;
      clearInterval(intervalId);
      intervalId = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-card px-5 text-xs text-subText">
      <span
        title={
          isOffline === false
            ? "This build has network-capable plugins registered — offline guarantee not verified."
            : "No network-capable plugins are registered in this build."
        }
        className="flex items-center gap-2"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isOffline === false ? "currentColor" : "var(--accentFg)"}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={isOffline === false ? "text-danger" : undefined}
        >
          <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        {isOffline === false
          ? "Network capable"
          : "Offline · no network calls"}
      </span>

      {stats && (
        <span className="flex items-center gap-4 font-mono">
          <span>
            RAM {formatGb(stats.used_memory_bytes)} /{" "}
            {formatGb(stats.total_memory_bytes)} GB
          </span>
          <span>CPU {Math.round(stats.cpu_usage_percent)}%</span>
        </span>
      )}
    </footer>
  );
}
