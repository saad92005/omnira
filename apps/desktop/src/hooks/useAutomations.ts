import { useCallback, useEffect, useRef, useState } from "react";
import {
  isDue,
  loadAutomations,
  saveAutomations,
  type Automation,
  type AutomationTrigger,
} from "../automations.js";

const CHECK_INTERVAL_MS = 20_000;

export interface UseAutomationsResult {
  automations: Automation[];
  addAutomation: (label: string, message: string, trigger: AutomationTrigger) => void;
  removeAutomation: (id: string) => void;
  toggleAutomation: (id: string) => void;
}

/**
 * Owns the automation list and the scheduling loop: every 20s, checks
 * whether any enabled automation is due and fires `onRun` for it, then
 * records the run so a one-off doesn't fire twice and an interval waits
 * out its next window. Runs only while this component is mounted — no
 * background/OS-level scheduling, and the UI says so.
 */
export function useAutomations(onRun: (automation: Automation) => void): UseAutomationsResult {
  const [automations, setAutomations] = useState<Automation[]>(() => loadAutomations());
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  // Kept in sync every render so the interval tick can read the current
  // list without going through a setState updater — React (StrictMode in
  // particular) may invoke an updater function more than once to check
  // it's pure, so the actual "send the message" side effect must happen
  // outside of one, not inside it, or it fires twice.
  const automationsRef = useRef(automations);
  automationsRef.current = automations;

  useEffect(() => {
    saveAutomations(automations);
  }, [automations]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const due = automationsRef.current.filter((a) => isDue(a, now));
      if (due.length === 0) return;
      due.forEach((a) => onRunRef.current(a));
      const dueIds = new Set(due.map((a) => a.id));
      setAutomations((prev) => prev.map((a) => (dueIds.has(a.id) ? { ...a, lastRunISO: now.toISOString() } : a)));
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const addAutomation = useCallback((label: string, message: string, trigger: AutomationTrigger) => {
    setAutomations((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label, message, trigger, enabled: true, lastRunISO: null },
    ]);
  }, []);

  const removeAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  }, []);

  return { automations, addAutomation, removeAutomation, toggleAutomation };
}
