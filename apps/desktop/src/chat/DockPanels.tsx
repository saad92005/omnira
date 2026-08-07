import {
  Bot,
  BrainCircuit,
  CalendarDays,
  ChartBar,
  FolderOpen,
  Globe,
  LogOut,
  Mic2,
  Music2,
  ShieldCheck,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@omnira/ui-kit";
import type { ConversationSummary } from "../api-client.js";
import { MODULE_INFO } from "./dockModules.js";
import { FilesPanel } from "./FilesPanel.js";
import { ModulePanel } from "./ModulePanel.js";
import { TerminalPanel } from "./TerminalPanel.js";

const MODULE_ICONS: Record<string, LucideIcon> = {
  agents: Bot,
  browser: Globe,
  automation: Workflow,
  analytics: ChartBar,
  music: Music2,
  calendar: CalendarDays,
};

export interface DockPanelsProps {
  activeModule: string | null;
  onClose: () => void;
  conversations: ConversationSummary[];
  onSelectConversation: (id: string) => void;
  micGranted: boolean;
  systemControlGranted: boolean;
  voiceMode: boolean;
  onToggleVoiceMode: () => void;
  onGrantMic: () => Promise<void>;
  onRevokeMic: () => Promise<void>;
  onGrantSystemControl: () => Promise<void>;
  onSignOut: () => void;
}

export function DockPanels({
  activeModule,
  onClose,
  conversations,
  onSelectConversation,
  micGranted,
  systemControlGranted,
  voiceMode,
  onToggleVoiceMode,
  onGrantMic,
  onRevokeMic,
  onGrantSystemControl,
  onSignOut,
}: DockPanelsProps): ReactNode {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!activeModule) return null;

  async function run(name: string, action: () => Promise<void>): Promise<void> {
    setBusy(name);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (activeModule === "memory") {
    return (
      <ModulePanel title="Memory" icon={<BrainCircuit size={18} strokeWidth={2} />} onClose={onClose}>
        <p style={{ margin: 0 }}>
          Omnira remembers your conversations — {conversations.length}{" "}
          {conversations.length === 1 ? "conversation" : "conversations"} saved so far. There's no deeper
          long-term/semantic memory yet; this is your real chat history.
        </p>
        {conversations.length > 0 && (
          <div className="omnira-modal__conversation-list">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className="omnira-conversation-item"
                onClick={() => {
                  onSelectConversation(c.id);
                  onClose();
                }}
              >
                {c.title ?? "New conversation"}
              </button>
            ))}
          </div>
        )}
      </ModulePanel>
    );
  }

  if (activeModule === "files") {
    return (
      <ModulePanel title="Files" icon={<FolderOpen size={18} strokeWidth={2} />} onClose={onClose}>
        <FilesPanel />
      </ModulePanel>
    );
  }

  if (activeModule === "terminal") {
    return (
      <ModulePanel title="Terminal" icon={<Terminal size={18} strokeWidth={2} />} onClose={onClose}>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--omnira-text-secondary)" }}>
          A fixed set of read-only diagnostic commands — no free-text/arbitrary shell access.
        </p>
        <TerminalPanel />
      </ModulePanel>
    );
  }

  if (activeModule === "settings") {
    return (
      <ModulePanel title="Settings" icon={<ShieldCheck size={18} strokeWidth={2} />} onClose={onClose}>
        {error && (
          <p role="alert" style={{ color: "var(--omnira-danger)", margin: 0, fontSize: "var(--omnira-text-xs)" }}>
            {error}
          </p>
        )}
        <div className="omnira-modal__row">
          <div>
            <p className="omnira-modal__row-label" style={{ margin: 0 }}>
              Voice mode
            </p>
            <p className="omnira-modal__row-desc">Speak replies out loud after a voice command.</p>
          </div>
          <button type="button" className="omnira-hud-switch" data-on={voiceMode} onClick={onToggleVoiceMode} aria-pressed={voiceMode}>
            <span className="omnira-hud-switch__track" aria-hidden="true">
              <span className="omnira-hud-switch__thumb" />
            </span>
          </button>
        </div>
        <div className="omnira-modal__row">
          <div>
            <p className="omnira-modal__row-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <Mic2 size={14} strokeWidth={2} /> Microphone
            </p>
            <p className="omnira-modal__row-desc">Lets Omnira listen when you hold the voice core.</p>
          </div>
          <Button
            variant={micGranted ? "secondary" : "primary"}
            disabled={busy !== null}
            onClick={() => void run("mic", micGranted ? onRevokeMic : onGrantMic)}
          >
            {busy === "mic" ? "…" : micGranted ? "Revoke" : "Allow"}
          </Button>
        </div>
        <div className="omnira-modal__row">
          <div>
            <p className="omnira-modal__row-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={14} strokeWidth={2} /> System control
            </p>
            <p className="omnira-modal__row-desc">Lets Omnira open a small allow-listed set of apps/URLs.</p>
          </div>
          <Button
            variant={systemControlGranted ? "secondary" : "primary"}
            disabled={busy !== null || systemControlGranted}
            onClick={() => void run("system", onGrantSystemControl)}
          >
            {busy === "system" ? "…" : systemControlGranted ? "Allowed" : "Allow"}
          </Button>
        </div>
        <div className="omnira-modal__row">
          <div>
            <p className="omnira-modal__row-label" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <LogOut size={14} strokeWidth={2} /> Sign out
            </p>
            <p className="omnira-modal__row-desc">End this session on this device.</p>
          </div>
          <Button variant="danger" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </ModulePanel>
    );
  }

  const info = MODULE_INFO[activeModule];
  if (!info) return null;
  const Icon = MODULE_ICONS[activeModule] ?? Bot;

  return (
    <ModulePanel title={info.title} icon={<Icon size={18} strokeWidth={2} />} onClose={onClose}>
      <span className="omnira-modal__badge">
        <span className="omnira-modal__badge-dot" aria-hidden="true" />
        Not connected yet
      </span>
      <p style={{ margin: 0 }}>{info.description}</p>
      {info.related && (
        <p style={{ margin: 0, color: "var(--omnira-text-secondary)", fontSize: "12.5px" }}>{info.related}</p>
      )}
    </ModulePanel>
  );
}
