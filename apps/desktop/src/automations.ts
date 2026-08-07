export type AutomationTrigger =
  | { type: "once"; atISO: string }
  | { type: "interval"; everyMinutes: number };

export interface Automation {
  id: string;
  label: string;
  message: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  lastRunISO: string | null;
}

const STORAGE_KEY = "omnira.automations";

/**
 * A real automation is "run this exact message through Omnira's normal
 * chat pipeline at a scheduled time" — reusing the existing agent (and
 * whatever tools it decides to call: timers, clipboard, opening an
 * allow-listed app/URL) rather than a bespoke trigger→action engine. Runs
 * only while the app is open; there's no background service. Persisted to
 * localStorage so definitions (not schedules — see nextRunAt) survive a
 * restart.
 */
export function loadAutomations(): Automation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Automation[]) : [];
  } catch {
    return [];
  }
}

export function saveAutomations(automations: Automation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(automations));
}

/** Null means "never due again" (a one-off that already ran). */
export function nextRunAt(automation: Automation): Date | null {
  if (!automation.enabled) return null;
  if (automation.trigger.type === "once") {
    if (automation.lastRunISO) return null;
    return new Date(automation.trigger.atISO);
  }
  const intervalMs = automation.trigger.everyMinutes * 60_000;
  const last = automation.lastRunISO ? new Date(automation.lastRunISO).getTime() : 0;
  return new Date(last + intervalMs);
}

export function isDue(automation: Automation, now: Date): boolean {
  const next = nextRunAt(automation);
  return next !== null && next.getTime() <= now.getTime();
}

export function describeTrigger(trigger: AutomationTrigger): string {
  if (trigger.type === "once") {
    return `Once, at ${new Date(trigger.atISO).toLocaleString()}`;
  }
  return `Every ${trigger.everyMinutes} minute${trigger.everyMinutes === 1 ? "" : "s"}`;
}
