import { useCallback, useState } from "react";

export interface LogEntry {
  id: string;
  time: string;
  text: string;
  kind: "info" | "success" | "warning" | "error";
}

const MAX_ENTRIES = 40;

/**
 * A small ring buffer of real, in-app events (message sent, reply received,
 * permission changes, tool actions, errors) for the "live log" panel —
 * every line traces back to something that actually happened in this
 * session, never a simulated feed.
 */
export function useEventLog(): { entries: LogEntry[]; log: (text: string, kind?: LogEntry["kind"]) => void } {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const log = useCallback((text: string, kind: LogEntry["kind"] = "info") => {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      text,
      kind,
    };
    setEntries((prev) => [...prev.slice(-(MAX_ENTRIES - 1)), entry]);
  }, []);

  return { entries, log };
}
