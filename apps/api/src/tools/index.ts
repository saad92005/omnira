import type { ToolHandler } from "@omnira/agents";
import { ALLOWED_APP_NAMES, openApp, openUrl } from "./system-control.js";

/**
 * Always-available: read-only, no side effects, no risk (§5.4's read-only
 * tier never needs confirmation or a permission grant).
 */
const DATETIME_TOOL: ToolHandler = {
  definition: {
    name: "get_current_datetime",
    description: "Get the current date and time, in the user's server timezone.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  execute: async () => new Date().toString(),
};

const OPEN_URL_TOOL: ToolHandler = {
  definition: {
    name: "open_url",
    description: "Open a website URL in the user's default web browser.",
    parameters: {
      type: "object",
      properties: { url: { type: "string", description: "A full http:// or https:// URL." } },
      required: ["url"],
      additionalProperties: false,
    },
  },
  execute: async (args) => {
    const url = String(args["url"] ?? "");
    await openUrl(url);
    return `Opened ${url} in the browser.`;
  },
};

const OPEN_APP_TOOL: ToolHandler = {
  definition: {
    name: "open_app",
    description: "Open a known application on the user's computer.",
    parameters: {
      type: "object",
      properties: { app: { type: "string", enum: ALLOWED_APP_NAMES, description: "Which app to open." } },
      required: ["app"],
      additionalProperties: false,
    },
  },
  execute: async (args) => {
    const { label } = await openApp(String(args["app"] ?? ""));
    return `Opened ${label}.`;
  },
};

/**
 * System-control tools (open_url, open_app) are only offered to the model
 * when the user has granted Capability.SystemControl — an ungranted
 * capability means the tool doesn't exist for this turn at all, not "exists
 * but denied," so the model won't even attempt it. See ADR-0006.
 */
export function buildToolHandlers(systemControlGranted: boolean): ToolHandler[] {
  return systemControlGranted ? [DATETIME_TOOL, OPEN_URL_TOOL, OPEN_APP_TOOL] : [DATETIME_TOOL];
}
