import type { ToolHandler } from "@omnira/agents";
import { ALLOWED_APP_NAMES, SAFE_DIR_NAMES, createFile, createFolder, openApp, openUrl } from "./system-control.js";

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

const MAX_TIMER_SECONDS = 24 * 60 * 60;

/**
 * Always-available, like DATETIME_TOOL — no OS interaction, nothing to gate
 * behind Capability.SystemControl. The actual waiting and notification
 * can't happen here: apps/api may be a stateless Netlify Function with no
 * way to "wait" between requests, so this only validates the request and
 * hands a clientAction back for the frontend (ChatView.tsx) to actually run.
 */
const SET_TIMER_TOOL: ToolHandler = {
  definition: {
    name: "set_timer",
    description: "Set a countdown timer that notifies the user when it finishes.",
    parameters: {
      type: "object",
      properties: {
        seconds: { type: "number", description: "How many seconds from now the timer should go off (max 86400, i.e. 24 hours)." },
        label: { type: "string", description: "A short label for what the timer is for, e.g. \"pasta\". Optional." },
      },
      required: ["seconds"],
      additionalProperties: false,
    },
  },
  execute: async (args) => {
    const seconds = Number(args["seconds"]);
    const label = String(args["label"] ?? "");
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return "Error: seconds must be a positive number.";
    }
    if (seconds > MAX_TIMER_SECONDS) {
      return `Error: timers can be at most ${MAX_TIMER_SECONDS} seconds (24 hours).`;
    }
    return {
      result: `Timer set for ${seconds} second${seconds === 1 ? "" : "s"}${label ? ` (${label})` : ""}.`,
      clientAction: { type: "set_timer", payload: { seconds, label } },
    };
  },
};

/**
 * Always-available, same reasoning as SET_TIMER_TOOL — only the frontend
 * has access to the user's actual clipboard (navigator.clipboard).
 */
const COPY_TO_CLIPBOARD_TOOL: ToolHandler = {
  definition: {
    name: "copy_to_clipboard",
    description: "Copy a piece of text to the user's clipboard.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", description: "The exact text to copy." } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  execute: async (args) => {
    const text = String(args["text"] ?? "");
    if (!text) return "Error: no text provided to copy.";
    return {
      result: "Copied to clipboard.",
      clientAction: { type: "copy_to_clipboard", payload: { text } },
    };
  },
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

const CREATE_FILE_TOOL: ToolHandler = {
  definition: {
    name: "create_file",
    description: "Create a new text file with the given content in a folder on the user's computer.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", enum: SAFE_DIR_NAMES, description: "Which folder to create it in." },
        fileName: { type: "string", description: "The file name, including extension, e.g. notes.txt." },
        content: { type: "string", description: "The text content to write into the file. Empty string for a blank file." },
      },
      required: ["location", "fileName", "content"],
      additionalProperties: false,
    },
  },
  execute: async (args) => {
    const { path } = await createFile(String(args["location"] ?? ""), String(args["fileName"] ?? ""), String(args["content"] ?? ""));
    return `Created file at ${path}.`;
  },
};

const CREATE_FOLDER_TOOL: ToolHandler = {
  definition: {
    name: "create_folder",
    description: "Create a new folder on the user's computer.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", enum: SAFE_DIR_NAMES, description: "Which parent folder to create it in." },
        folderName: { type: "string", description: "The new folder's name." },
      },
      required: ["location", "folderName"],
      additionalProperties: false,
    },
  },
  execute: async (args) => {
    const { path } = await createFolder(String(args["location"] ?? ""), String(args["folderName"] ?? ""));
    return `Created folder at ${path}.`;
  },
};

/**
 * System-control tools (open_url, open_app, create_file, create_folder) are
 * only offered to the model when the user has granted
 * Capability.SystemControl — an ungranted capability means the tool doesn't
 * exist for this turn at all, not "exists but denied," so the model won't
 * even attempt it. See ADR-0006.
 */
export function buildToolHandlers(systemControlGranted: boolean): ToolHandler[] {
  const alwaysAvailable = [DATETIME_TOOL, SET_TIMER_TOOL, COPY_TO_CLIPBOARD_TOOL];
  return systemControlGranted
    ? [...alwaysAvailable, OPEN_URL_TOOL, OPEN_APP_TOOL, CREATE_FILE_TOOL, CREATE_FOLDER_TOOL]
    : alwaysAvailable;
}
