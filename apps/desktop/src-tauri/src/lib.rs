// The desktop-bridge module (Phase 1) will add permissioned OS-capability
// commands here — file access, app launching, clipboard, etc. — each
// reachable only through this single chokepoint, per master prompt §7.
// Phase 0 has no custom commands: the webview talks to apps/api directly
// over HTTP for auth, chat, and voice.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Omnira desktop application");
}
