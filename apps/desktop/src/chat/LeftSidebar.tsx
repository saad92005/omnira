import {
  Battery,
  Bell,
  Bot,
  CalendarDays,
  Cpu,
  Download,
  FileText,
  FolderKanban,
  Gauge,
  HardDrive,
  ListTodo,
  MemoryStick,
  MessageSquarePlus,
  Newspaper,
  Star,
  Sun,
  Wifi,
  Workflow,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button, WidgetCard } from "@omnira/ui-kit";
import type { ConversationSummary, NewsHeadline } from "../api-client.js";
import type { CurrentWeather } from "../weather.js";
import { SystemPlaceholderGrid } from "./SystemPlaceholderGrid.js";
import { WeatherTrend } from "./WeatherTrend.js";

export interface LeftSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId: string | undefined;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  headlines: NewsHeadline[];
  weather: CurrentWeather | null;
  voiceMode: boolean;
  onToggleVoiceMode: () => void;
  onExportConversation: () => void;
  hasMessages: boolean;
}

const SYSTEM_PLACEHOLDERS = [
  { icon: <Cpu size={12} strokeWidth={2} />, label: "CPU" },
  { icon: <Gauge size={12} strokeWidth={2} />, label: "GPU" },
  { icon: <MemoryStick size={12} strokeWidth={2} />, label: "RAM" },
  { icon: <HardDrive size={12} strokeWidth={2} />, label: "Disk" },
  { icon: <Wifi size={12} strokeWidth={2} />, label: "Net speed" },
  { icon: <Battery size={12} strokeWidth={2} />, label: "Battery" },
];

const WORKSPACE_PLACEHOLDERS = [
  { icon: <Bot size={12} strokeWidth={2} />, label: "Agents" },
  { icon: <Workflow size={12} strokeWidth={2} />, label: "Automations" },
  { icon: <CalendarDays size={12} strokeWidth={2} />, label: "Calendar" },
  { icon: <Bell size={12} strokeWidth={2} />, label: "Notifications" },
  { icon: <ListTodo size={12} strokeWidth={2} />, label: "Pinned tasks" },
  { icon: <FolderKanban size={12} strokeWidth={2} />, label: "Project" },
  { icon: <FileText size={12} strokeWidth={2} />, label: "Recent files" },
  { icon: <Star size={12} strokeWidth={2} />, label: "Favorites" },
];

export function LeftSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  headlines,
  weather,
  voiceMode,
  onToggleVoiceMode,
  onExportConversation,
  hasMessages,
}: LeftSidebarProps): ReactNode {
  return (
    <div className="omnira-sidebar-stack">
      <WidgetCard title="Quick actions" compact>
        <div className="omnira-quick-actions">
          <Button variant="primary" onClick={onNewChat} fullWidth title="New chat (Ctrl/Cmd+Shift+K)">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <MessageSquarePlus size={14} strokeWidth={2} /> New chat
            </span>
          </Button>
          <div style={{ display: "flex", gap: "var(--omnira-space-2)" }}>
            <button type="button" className="omnira-chip" data-on={voiceMode} onClick={onToggleVoiceMode}>
              Voice mode
            </button>
            <button
              type="button"
              className="omnira-chip"
              onClick={onExportConversation}
              disabled={!hasMessages}
              title="Download this conversation as Markdown"
            >
              <Download size={11} strokeWidth={2} /> Export
            </button>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard title="Recent chats" icon={<MessageSquarePlus size={13} strokeWidth={2} />}>
        <div className="omnira-conversation-list">
          {conversations.length === 0 && (
            <p style={{ color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-sm)", margin: 0 }}>
              No conversations yet.
            </p>
          )}
          {conversations.map((c) => {
            const isActive = c.id === activeConversationId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={isActive}
                className="omnira-conversation-item"
                data-active={isActive}
              >
                {c.title ?? "New conversation"}
              </button>
            );
          })}
        </div>
      </WidgetCard>

      {weather && (
        <WidgetCard title="Weather" icon={<Sun size={13} strokeWidth={2} />}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--omnira-space-2)" }}>
            <span className="omnira-widget-stat">{weather.temperatureC}°C</span>
            <span style={{ color: "var(--omnira-text-secondary)", fontSize: "var(--omnira-text-xs)" }}>{weather.label}</span>
          </div>
          <WeatherTrend hourlyTemperaturesC={weather.hourlyTemperaturesC} />
        </WidgetCard>
      )}

      {headlines.length > 0 && (
        <WidgetCard title="Headlines" icon={<Newspaper size={13} strokeWidth={2} />}>
          <div className="omnira-headline-list">
            {headlines.map((h) => (
              <a key={h.link} href={h.link} target="_blank" rel="noreferrer" className="omnira-headline-link">
                {h.title}
              </a>
            ))}
          </div>
        </WidgetCard>
      )}

      <WidgetCard title="System" icon={<Cpu size={13} strokeWidth={2} />} disconnected>
        <SystemPlaceholderGrid items={SYSTEM_PLACEHOLDERS} />
      </WidgetCard>

      <WidgetCard title="Workspace" icon={<FolderKanban size={13} strokeWidth={2} />} disconnected>
        <SystemPlaceholderGrid items={WORKSPACE_PLACEHOLDERS} />
      </WidgetCard>
    </div>
  );
}
