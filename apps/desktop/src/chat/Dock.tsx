import {
  Bot,
  BrainCircuit,
  CalendarDays,
  ChartBar,
  FolderOpen,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Mic2,
  Music2,
  Settings,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

interface DockItem {
  id: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

export interface DockProps {
  voiceMode: boolean;
  onToggleVoiceMode: () => void;
}

const ITEMS: Omit<DockItem, "available">[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "voice", label: "Voice", icon: Mic2 },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "memory", label: "Memory", icon: BrainCircuit },
  { id: "browser", label: "Browser", icon: Globe },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "terminal", label: "Terminal", icon: Terminal },
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analytics", label: "Analytics", icon: ChartBar },
  { id: "music", label: "Music", icon: Music2 },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "settings", label: "Settings", icon: Settings },
];

const AVAILABLE = new Set(["chat", "voice"]);

/**
 * A macOS-style rounded glass dock. Only "Chat" (the only screen this app
 * has) and "Voice" (toggles voice mode, a real setting) are wired — the
 * rest render dimmed with a "Coming soon" tooltip rather than navigating to
 * pages that don't exist. Per this redesign's brief: frontend/UX only, no
 * new application features, so no fake destinations either.
 */
export function Dock({ voiceMode, onToggleVoiceMode }: DockProps): ReactNode {
  return (
    <nav className="omnira-dock omnira-glass" aria-label="App dock">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const available = AVAILABLE.has(item.id);
        const isVoice = item.id === "voice";
        const active = item.id === "chat" || (isVoice && voiceMode);
        return (
          <button
            key={item.id}
            type="button"
            className="omnira-dock__item"
            data-active={active}
            disabled={!available}
            title={available ? item.label : `${item.label} — coming soon`}
            onClick={isVoice ? onToggleVoiceMode : undefined}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span className="omnira-dock__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
