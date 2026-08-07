import { Command } from "@tauri-apps/plugin-shell";
import { isDesktopRuntime } from "./files.js";

export { isDesktopRuntime };

export interface DiagnosticCommand {
  /** Must match a `name` entry in src-tauri/capabilities/default.json's shell:allow-execute — the Rust layer rejects anything else, this is just the matching label for the UI. */
  id: string;
  label: string;
  description: string;
}

/**
 * A fixed, read-only diagnostic command set — no free-text/arbitrary shell
 * access. Every entry here has a matching fixed-argument entry in
 * capabilities/default.json; there is no way to run anything not on both
 * lists, and no user-supplied argument is ever passed through.
 */
export const DIAGNOSTIC_COMMANDS: DiagnosticCommand[] = [
  { id: "diag-whoami", label: "whoami", description: "Current signed-in user" },
  { id: "diag-hostname", label: "hostname", description: "This computer's name" },
  { id: "diag-ipconfig", label: "ipconfig /all", description: "Network adapter configuration" },
  { id: "diag-systeminfo", label: "systeminfo", description: "OS, hardware, and patch summary" },
  { id: "diag-tasklist", label: "tasklist", description: "Currently running processes" },
  { id: "diag-netstat", label: "netstat -an", description: "Active network connections" },
  { id: "diag-ver", label: "ver", description: "Windows version" },
];

export interface DiagnosticResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export async function runDiagnostic(id: string): Promise<DiagnosticResult> {
  const output = await Command.create(id).execute();
  return { stdout: output.stdout, stderr: output.stderr, code: output.code };
}
