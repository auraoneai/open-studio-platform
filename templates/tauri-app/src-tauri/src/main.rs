mod commands;
mod deep_link;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            deep_link::register(app.handle())?;
            if let Some(path) = commands::project_path_from_args(std::env::args().skip(1)) {
                let _ = commands::open_project_folder(app.handle().clone(), path);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_project_folder,
            commands::list_recent_projects,
            commands::read_project_tree
        ])
        .run(tauri::generate_context!())
        .expect("failed to run AuraOne Open Studio template");
}
