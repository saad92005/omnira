import { EventEmitter } from "node:events";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@omnira/core";
import { ALLOWED_APP_NAMES, isSafeHttpUrl, openApp, openUrl } from "./system-control.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const { spawn } = await import("node:child_process");
const spawnMock = vi.mocked(spawn);

// openUrl/openApp are Windows-only in Phase 0 (documented limitation) — pin
// process.platform so this test is deterministic regardless of CI platform.
beforeAll(() => {
  Object.defineProperty(process, "platform", { value: "win32" });
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeChild() {
  const emitter = new EventEmitter();
  queueMicrotask(() => emitter.emit("spawn"));
  return emitter as never;
}

describe("isSafeHttpUrl", () => {
  it("accepts well-formed http/https URLs", () => {
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeHttpUrl("http://example.com/path?query=1")).toBe(true);
  });

  it("rejects non-http(s) protocols — no file://, javascript:, etc.", () => {
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("ftp://example.com")).toBe(false);
  });

  it("rejects malformed strings", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false);
    expect(isSafeHttpUrl("")).toBe(false);
  });

  it("rejects shell metacharacters that could break out of the start command", () => {
    expect(isSafeHttpUrl("https://example.com & del /f /q C:\\*")).toBe(false);
    expect(isSafeHttpUrl("https://example.com | calc")).toBe(false);
    expect(isSafeHttpUrl('https://example.com" & malicious')).toBe(false);
  });
});

describe("openUrl", () => {
  it("spawns cmd.exe with the url as a separate argv entry, never concatenated into a string", async () => {
    spawnMock.mockImplementation(() => fakeChild());
    await openUrl("https://example.com");

    expect(spawnMock).toHaveBeenCalledWith(
      "cmd.exe",
      ["/c", "start", '""', "https://example.com"],
      expect.objectContaining({ shell: false }),
    );
  });

  it("rejects an unsafe URL before ever calling spawn", async () => {
    await expect(openUrl("https://example.com & del /f /q C:\\*")).rejects.toThrow();
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("openApp", () => {
  it("opens each allowlisted app by its fixed command, never a caller-supplied string", async () => {
    spawnMock.mockImplementation(() => fakeChild());
    for (const app of ALLOWED_APP_NAMES) {
      await openApp(app);
    }
    expect(spawnMock).toHaveBeenCalledTimes(ALLOWED_APP_NAMES.length);
  });

  it("rejects anything outside the allowlist, including attempted arbitrary commands", async () => {
    await expect(openApp("powershell -c rm -rf C:\\")).rejects.toBeInstanceOf(ForbiddenError);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
