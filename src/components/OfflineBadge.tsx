import { useEffect, useState } from "react";
import { getOfflineAudit } from "../lib/offlineAudit";

export default function OfflineBadge() {
  const [isOffline, setIsOffline] = useState<boolean | null>(null);

  useEffect(() => {
    getOfflineAudit()
      .then((audit) => setIsOffline(audit.is_offline))
      .catch(() => setIsOffline(null));
  }, []);

  if (isOffline === null) return null;

  return (
    <span
      title={
        isOffline
          ? "No network-capable plugins are registered in this build."
          : "This build has network-capable plugins registered — offline guarantee not verified."
      }
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isOffline
          ? "bg-primary/10 text-primary"
          : "bg-danger/10 text-danger"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isOffline ? "bg-primary" : "bg-danger"}`}
      />
      {isOffline ? "Offline" : "Network capable"}
    </span>
  );
}
