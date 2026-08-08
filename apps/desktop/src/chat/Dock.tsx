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
}

export interface DockProps {
  activeId: string;
  voiceMode: boolean;
  onSelect: (id: string) => void;
}

const ITEMS: DockItem[] = [
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

// Backed by real, working functionality. Every dock icon currently is (see
// dockModules.ts's MODULE_INFO, which is empty for the same reason) — the
// `!real` branch below stays as the mechanism for the next icon that isn't,
// rather than being deleted along with the last placeholder.
const REAL_FEATURE = new Set([
  "chat",
  "voice",
  "dashboard",
  "memory",
  "settings",
  "files",
  "terminal",
  "automation",
  "agents",
  "browser",
  "analytics",
  "music",
  "calendar",
]);

/**
 * A macOS-style rounded glass dock. Every icon is interactive and, today,
 * backed by real functionality; a future non-real icon would instead open a
 * small honest panel explaining what's not built yet rather than sitting
 * there disabled. See the redesign brief: frontend/UX only, no fabricated
 * features.
 */
export function Dock({ activeId, voiceMode, onSelect }: DockProps): ReactNode {
  return (
    <nav className="omnira-dock omnira-glass" aria-label="App dock">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isVoice = item.id === "voice";
        const active = item.id === activeId || (isVoice && voiceMode);
        const real = REAL_FEATURE.has(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className="omnira-dock__item"
            data-active={active}
            title={real ? item.label : `${item.label} — not connected yet`}
            onClick={() => onSelect(item.id)}
          >
            <Icon size={20} strokeWidth={1.8} />
            {!real && <span className="omnira-dock__pending" aria-hidden="true" />}
            <span className="omnira-dock__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
