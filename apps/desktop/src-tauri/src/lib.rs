// Desktop-bridge (Phase 1, master prompt §7): permissioned OS-capability
// plugins registered here, each scoped by the capabilities/*.json files —
// the single, auditable chokepoint before any capability reaches the OS.
// The fs/opener plugins back the Files dock panel (read-only listing of a
// fixed set of user folders, open-with-default-app only — no write access
// from this surface). The shell plugin backs the Terminal dock panel — every
// runnable command is a fixed, named, no-user-supplied-argument entry in
// capabilities/default.json (see the comment there); this is a diagnostics
// panel, not arbitrary command execution. Everything else still talks to
// apps/api directly over HTTP for auth, chat, and voice.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running the Omnira desktop application");
}
