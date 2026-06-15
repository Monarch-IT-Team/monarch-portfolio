use std::process::Command;

#[tauri::command]
fn launch_monarch_ai() -> Result<(), String> {
    println!("Launching Monarch AI...");
    let path = "D:\\Programmer\\Projects\\Monarch-AI";
    
    #[cfg(target_os = "windows")]
    {
        // Try launching run_dev.bat in a new window
        let result = Command::new("cmd")
            .args(&["/C", "start", "run_dev.bat"])
            .current_dir(path)
            .spawn();

        match result {
            Ok(_) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Not supported on this OS".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![launch_monarch_ai])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
