import { EventEmitter } from "node:events";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError } from "@omnira/core";
import { ALLOWED_APP_NAMES, SAFE_DIR_NAMES, createFile, createFolder, isSafeHttpUrl, openApp, openUrl } from "./system-control.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const { TEST_HOME } = vi.hoisted(() => ({
  TEST_HOME: `${process.env["TEMP"] ?? process.env["TMPDIR"] ?? "/tmp"}/omnira-test-home-${Date.now()}-${Math.random().toString(36).slice(2)}`,
}));

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => TEST_HOME };
});

const { spawn } = await import("node:child_process");
const spawnMock = vi.mocked(spawn);

afterAll(async () => {
  await rm(TEST_HOME, { recursive: true, force: true });
});

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

describe("createFile", () => {
  it("writes real content inside the allowlisted Desktop folder", async () => {
    const { path } = await createFile("desktop", "notes.txt", "hello from omnira");
    expect(path).toBe(join(TEST_HOME, "Desktop", "notes.txt"));
    expect(await readFile(path, "utf8")).toBe("hello from omnira");
  });

  it("rejects a location outside the allowlist", async () => {
    await expect(createFile("system32", "x.txt", "")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects file names that attempt path traversal or contain separators", async () => {
    await expect(createFile("desktop", "../evil.txt", "x")).rejects.toBeInstanceOf(ValidationError);
    await expect(createFile("desktop", "sub/evil.txt", "x")).rejects.toBeInstanceOf(ValidationError);
  });

  it("only ever writes inside one of the documented safe directories", () => {
    expect(SAFE_DIR_NAMES).toEqual(["desktop", "documents"]);
  });
});

describe("createFolder", () => {
  it("creates a real directory inside the allowlisted Documents folder", async () => {
    const { path } = await createFolder("documents", "MyStuff");
    expect(path).toBe(join(TEST_HOME, "Documents", "MyStuff"));
    expect((await stat(path)).isDirectory()).toBe(true);
  });

  it("rejects a folder name that attempts path traversal", async () => {
    await expect(createFolder("documents", "..")).rejects.toBeInstanceOf(ValidationError);
  });
});
