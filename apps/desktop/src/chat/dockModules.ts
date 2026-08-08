export interface ModuleInfo {
  title: string;
  description: string;
  related?: string;
}

/**
 * Honest descriptions for dock icons with no real backend yet. Shown in a
 * ModulePanel instead of doing nothing — the icon is genuinely interactive
 * (opens something real: an explanation of current scope), it just isn't a
 * fabricated feature. `related` calls out an actual adjacent capability
 * where one exists, so the panel doesn't just say "no" — see
 * docs/PROJECT_INDEX.md for what's actually built.
 *
 * Empty today: every dock icon is backed by real functionality (see
 * Dock.tsx's REAL_FEATURE set). Kept as the mechanism for the next one that
 * isn't, rather than deleted.
 */
export const MODULE_INFO: Record<string, ModuleInfo> = {};
