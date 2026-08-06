import { describe, expect, it } from "vitest";
import { buildToolHandlers } from "./index.js";

function findTool(name: string, systemControlGranted = false) {
  const tool = buildToolHandlers(systemControlGranted).find((t) => t.definition.name === name);
  if (!tool) throw new Error(`Tool "${name}" not found`);
  return tool;
}

describe("buildToolHandlers", () => {
  it("always includes get_current_datetime, set_timer, and copy_to_clipboard, regardless of system control", () => {
    const names = buildToolHandlers(false).map((t) => t.definition.name);
    expect(names).toEqual(["get_current_datetime", "set_timer", "copy_to_clipboard"]);
  });

  it("adds the system-control tools only when granted", () => {
    const names = buildToolHandlers(true).map((t) => t.definition.name);
    expect(names).toEqual([
      "get_current_datetime",
      "set_timer",
      "copy_to_clipboard",
      "open_url",
      "open_app",
      "create_file",
      "create_folder",
    ]);
  });
});

describe("set_timer tool", () => {
  it("returns a confirmation and a clientAction with the requested seconds/label", async () => {
    const outcome = await findTool("set_timer").execute({ seconds: 90, label: "tea" });
    expect(outcome).toEqual({
      result: "Timer set for 90 seconds (tea).",
      clientAction: { type: "set_timer", payload: { seconds: 90, label: "tea" } },
    });
  });

  it("rejects a non-positive or missing duration without a clientAction", async () => {
    const outcome = await findTool("set_timer").execute({ seconds: 0 });
    expect(outcome).toBe("Error: seconds must be a positive number.");
  });

  it("rejects a duration longer than 24 hours", async () => {
    const outcome = await findTool("set_timer").execute({ seconds: 999999 });
    expect(outcome).toBe("Error: timers can be at most 86400 seconds (24 hours).");
  });
});

describe("copy_to_clipboard tool", () => {
  it("returns a confirmation and a clientAction carrying the text", async () => {
    const outcome = await findTool("copy_to_clipboard").execute({ text: "hello world" });
    expect(outcome).toEqual({
      result: "Copied to clipboard.",
      clientAction: { type: "copy_to_clipboard", payload: { text: "hello world" } },
    });
  });

  it("rejects empty text", async () => {
    const outcome = await findTool("copy_to_clipboard").execute({ text: "" });
    expect(outcome).toBe("Error: no text provided to copy.");
  });
});
