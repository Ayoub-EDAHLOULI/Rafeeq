import OfflineBadge from "./OfflineBadge";
import logo from "../assets/logo.png";

interface AppHeaderProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export default function AppHeader({ theme, onToggleTheme }: AppHeaderProps) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <img src={logo} alt="" className="h-6 w-6 rounded-md" />
        <span className="text-sm font-semibold text-text">Rafeeq</span>
      </div>

      <div className="flex items-center gap-3">
        <OfflineBadge />

      <button
        type="button"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        className="flex h-7 w-7 items-center justify-center rounded-md text-subText transition-colors hover:bg-inputBg hover:text-text"
      >
        {theme === "dark" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="4"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        )}
        </button>
      </div>
    </header>
  );
}
