// Desktop-bridge (Phase 1, master prompt §7): permissioned OS-capability
// plugins registered here, each scoped by the capabilities/*.json files —
// the single, auditable chokepoint before any capability reaches the OS.
// The fs/opener plugins back the Files/Browser/Calendar/Music dock panels
// (read-only listing of a fixed set of user folders, open-with-default-app,
// and opening OAuth consent screens in the real system browser — no write
// access from this surface). The shell plugin backs the Terminal dock panel
// — every runnable command is a fixed, named, no-user-supplied-argument
// entry in capabilities/default.json; this is a diagnostics panel, not
// arbitrary command execution. Everything else still talks to apps/api
// directly over HTTP for auth, chat, and voice — see spawn_api_server below
// for how that server itself gets started.

use std::fs::File;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

/// Holds the auto-started apps/api child process so it can be killed when
/// the desktop app exits — otherwise it would keep running as an orphaned
/// background process every time Omnira closes.
struct ApiProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(ApiProcess(Mutex::new(None)))
        .setup(|app| {
            spawn_api_server(app);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Omnira desktop application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(state) = app_handle.try_state::<ApiProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.as_mut() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}

/// Resolves node.exe without trusting the spawning process's inherited
/// PATH — a real bug hit in testing: double-clicking the app (or launching
/// via a shortcut) inherits Explorer's environment, which is a snapshot
/// from Explorer's own last start and doesn't reliably pick up a PATH
/// change made after that (a full logoff/reboot does, a fresh terminal
/// window does since it re-reads the registry, a long-lived Explorer
/// session often doesn't) — even though `node` resolved fine from every
/// terminal used during development. `%ProgramFiles%` is a real Windows
/// system environment variable set by the OS itself, not user/session
/// PATH, so it doesn't have this staleness problem — check the official
/// installer's default location there first and fall back to bare `node`
/// (PATH-based) for non-default installs (nvm, volta, etc.).
fn resolve_node_path() -> PathBuf {
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        let candidate = std::path::Path::new(&program_files).join("nodejs/node.exe");
        if candidate.exists() {
            return candidate;
        }
    }
    PathBuf::from("node")
}

/// Starts apps/api locally so Omnira is a genuine double-click-and-go
/// desktop app instead of requiring a separate `pnpm dev` in a terminal.
///
/// Known Phase 0 limitation, stated plainly rather than papered over: this
/// resolves apps/api's dist/.env relative to CARGO_MANIFEST_DIR, a path
/// baked in at *build* time — so the installed app only works on the
/// machine it was built on, with that source checkout still in place
/// (dist/ built, .env configured). It is not a portable, distributable
/// build; that needs a real bundled sidecar (desktop-bridge, master
/// prompt §7) — deliberately out of scope for personal, single-machine
/// use, which is all Phase 0 targets. If apps/api is already running
/// (e.g. `pnpm dev` in another terminal), the spawned copy just fails to
/// bind its port and exits — the already-running one keeps serving
/// requests either way. stdout/stderr go to apps/api/omnira-api.log next
/// to .env, so a failure here is diagnosable instead of silently invisible
/// (this app has no console window in a release build).
fn spawn_api_server(app: &tauri::App) {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let api_dir = std::path::Path::new(manifest_dir).join("../../api");
    let entry = api_dir.join("dist/index.js");
    let env_file = api_dir.join(".env");
    let log_path = api_dir.join("omnira-api.log");

    if !entry.exists() || !env_file.exists() {
        eprintln!(
            "Omnira: apps/api isn't built or configured (expected {} and {}) — skipping auto-start; run `pnpm --filter @omnira/api dev` manually.",
            entry.display(),
            env_file.display()
        );
        return;
    }

    let stdout_log = File::create(&log_path).ok();
    let stderr_log = stdout_log.as_ref().and_then(|f| f.try_clone().ok());

    let spawned = Command::new(resolve_node_path())
        .arg(format!("--env-file={}", env_file.display()))
        .arg(&entry)
        .current_dir(&api_dir)
        .stdout(stdout_log.map_or(Stdio::null(), Stdio::from))
        .stderr(stderr_log.map_or(Stdio::null(), Stdio::from))
        .spawn();

    match spawned {
        Ok(child) => {
            if let Some(state) = app.try_state::<ApiProcess>() {
                *state.0.lock().expect("ApiProcess mutex poisoned") = Some(child);
            }
        }
        Err(err) => {
            eprintln!(
                "Omnira: could not auto-start apps/api ({err}) — start it manually with `pnpm --filter @omnira/api dev`. See {} for details from any partial attempt.",
                log_path.display()
            );
        }
    }
}
