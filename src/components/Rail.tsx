export type Section = "chat" | "models" | "knowledge" | "settings";

interface RailProps {
  active: Section;
  onNavigate: (section: Section) => void;
}

interface RailButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  pushDown?: boolean;
  children: React.ReactNode;
}

function RailButton({
  label,
  isActive,
  onClick,
  pushDown,
  children,
}: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${
        pushDown ? "mt-auto" : ""
      } ${
        isActive
          ? "bg-panel2 text-accentFg"
          : "text-subText hover:bg-inputBg hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

export default function Rail({ active, onNavigate }: RailProps) {
  return (
    <nav
      aria-label="Sections"
      className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-card py-3"
    >
      <RailButton
        label="Chat"
        isActive={active === "chat"}
        onClick={() => onNavigate("chat")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </svg>
      </RailButton>
      <RailButton
        label="Models"
        isActive={active === "models"}
        onClick={() => onNavigate("models")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      </RailButton>
      <RailButton
        label="Knowledge base"
        isActive={active === "knowledge"}
        onClick={() => onNavigate("knowledge")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      </RailButton>
      <RailButton
        label="Settings"
        isActive={active === "settings"}
        onClick={() => onNavigate("settings")}
        pushDown
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      </RailButton>
    </nav>
  );
}
