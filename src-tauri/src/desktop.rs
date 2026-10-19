use crate::{
    model::*,
    store::{now_ms, Store},
};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

pub(crate) struct State {
    pub(crate) store: Mutex<Store>,
    pub(crate) data_dir: PathBuf,
    pub(crate) updating: AtomicBool,
}
pub(crate) fn locked<'a>(
    state: &'a tauri::State<'_, State>,
) -> Result<std::sync::MutexGuard<'a, Store>, String> {
    let store = state
        .store
        .lock()
        .map_err(|_| "Não foi possível acessar o armazenamento.")?;
    if state.updating.load(Ordering::SeqCst) {
        return Err("A atualização está sendo instalada. Aguarde o reinício do Tempo.".into());
    }
    Ok(store)
}

#[tauri::command]
fn get_snapshot(state: tauri::State<'_, State>) -> Result<Snapshot, String> {
    locked(&state)?.snapshot(now_ms())
}
#[tauri::command]
fn save_config(state: tauri::State<'_, State>, config: Configuration) -> Result<(), String> {
    locked(&state)?.save_config(config, now_ms())
}
#[tauri::command]
fn start_pause(state: tauri::State<'_, State>, minutes: Option<f64>) -> Result<(), String> {
    locked(&state)?.start_pause(minutes, now_ms())
}
#[tauri::command]
fn extend_pause(state: tauri::State<'_, State>, minutes: f64) -> Result<(), String> {
    locked(&state)?.extend_pause(minutes, now_ms())
}
#[tauri::command]
fn resume_tracking(state: tauri::State<'_, State>) -> Result<(), String> {
    locked(&state)?.resume(now_ms())
}
#[tauri::command]
fn set_current_project(
    state: tauri::State<'_, State>,
    project_id: Option<String>,
) -> Result<(), String> {
    locked(&state)?.set_project(project_id, now_ms())
}
#[tauri::command]
fn delete_history(state: tauri::State<'_, State>, start: i64, end: i64) -> Result<(), String> {
    locked(&state)?.delete_history(start, end, now_ms())
}
#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable()
    } else {
        app.autolaunch().disable()
    }
    .map_err(|e| e.to_string())
}
#[tauri::command]
fn create_backup(state: tauri::State<'_, State>) -> Result<String, String> {
    let dir = state.data_dir.join("backups");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let destination = dir.join(format!("tempo-{}.sqlite", now_ms()));
    locked(&state)?.backup_to(&destination)?;
    Ok(destination.to_string_lossy().into())
}
#[tauri::command]
fn test_alarm(state: tauri::State<'_, State>) -> Result<(), String> {
    let settings = locked(&state)?.config.settings.clone();
    sound(settings);
    Ok(())
}
fn sound(settings: Settings) {
    #[cfg(windows)]
    std::thread::spawn(move || crate::windows::alarm(&settings.alarm_sound, settings.alarm_volume));
    #[cfg(not(windows))]
    let _ = settings;
}
fn open_dashboard(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }
    if let Err(error) = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("Tempo — Seu tempo, com clareza")
        .inner_size(1400., 940.)
        .min_inner_size(850., 640.)
        .build()
    {
        let _ = app
            .notification()
            .builder()
            .title("Tempo")
            .body(format!("Não foi possível abrir o dashboard: {error}"))
            .show();
    }
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            open_dashboard(app)
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args(["--background"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(crate::updates::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            save_config,
            start_pause,
            extend_pause,
            resume_tracking,
            set_current_project,
            delete_history,
            get_autostart,
            set_autostart,
            create_backup,
            test_alarm,
            crate::updates::check_for_updates,
            crate::updates::install_update
        ])
        .setup(|app| {
            let data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let mut store =
                Store::open(&data_dir.join("tempo.sqlite")).map_err(std::io::Error::other)?;
            store.prune(now_ms()).map_err(std::io::Error::other)?;
            app.manage(State {
                store: Mutex::new(store),
                data_dir,
                updating: AtomicBool::new(false),
            });
            let open = MenuItem::with_id(app, "open", "Abrir dashboard", true, None::<&str>)?;
            let pause5 =
                MenuItem::with_id(app, "pause5", "Pausar por 5 minutos", true, None::<&str>)?;
            let pause15 =
                MenuItem::with_id(app, "pause15", "Pausar por 15 minutos", true, None::<&str>)?;
            let pause =
                MenuItem::with_id(app, "pause", "Pausar até eu voltar", true, None::<&str>)?;
            let resume = MenuItem::with_id(app, "resume", "Continuar coleta", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Encerrar Tempo", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &pause5, &pause15, &pause, &resume, &quit])?;
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
            let tray = TrayIconBuilder::with_id("tempo")
                .icon(icon)
                .tooltip("Tempo · Coleta em segundo plano")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    if event.id.as_ref() == "open" {
                        open_dashboard(app);
                        return;
                    }
                    let state = app.state::<State>();
                    let result = match state.store.lock() {
                        Ok(mut store) => match event.id.as_ref() {
                            "pause5" => store.start_pause(Some(5.), now_ms()),
                            "pause15" => store.start_pause(Some(15.), now_ms()),
                            "pause" => store.start_pause(None, now_ms()),
                            "resume" => store.resume(now_ms()),
                            "quit" => {
                                let result = store.finish(now_ms());
                                if result.is_ok() {
                                    app.exit(0);
                                }
                                result
                            }
                            _ => Ok(()),
                        },
                        Err(_) => Err("Armazenamento indisponível.".into()),
                    };
                    if let Err(message) = result {
                        let _ = app
                            .notification()
                            .builder()
                            .title("Tempo")
                            .body(message)
                            .show();
                    }
                })
                .build(app)?;
            let _ = tray;
            #[cfg(windows)]
            crate::windows::watch_session();
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut maintenance = 0;
                loop {
                    let now = now_ms();
                    let state = handle.state::<State>();
                    let mut alarm = None;
                    let mut tooltip = String::new();
                    if let Ok(mut store) = state.store.lock() {
                        if state.updating.load(Ordering::SeqCst) {
                            drop(store);
                            std::thread::sleep(Duration::from_secs(1));
                            continue;
                        }
                        match store.check_alarm(now) {
                            Ok(true) => alarm = Some(store.config.settings.clone()),
                            Err(e) => store.last_error = Some(e),
                            _ => {}
                        }
                        #[cfg(windows)]
                        {
                            let observation =
                                crate::windows::read_window(store.config.settings.idle_seconds)
                                    .map(|o| Observation {
                                        app: o.app,
                                        title: o.title,
                                        idle_seconds: o.idle_seconds,
                                        locked: o.locked,
                                    });
                            if let Err(e) = store.observe(observation, now) {
                                store.last_error = Some(e);
                            }
                        }
                        #[cfg(not(windows))]
                        {
                            store.last_error =
                                Some("O coletor desta versão funciona somente no Windows.".into());
                        }
                        if let Some(pause) = &store.runtime.pause {
                            tooltip = match pause.ends_at {
                                Some(end) if end > now => {
                                    let seconds = (end - now) / 1000;
                                    format!("Tempo · Pausa {:02}:{:02}", seconds / 60, seconds % 60)
                                }
                                Some(_) => "Tempo · Pausa encerrada, aguardando continuar".into(),
                                None => "Tempo · Em pausa até você voltar".into(),
                            };
                        } else {
                            tooltip.push_str(match store.tracking_status {
                                crate::model::TrackingStatus::Active => "Tempo · Coleta ativa",
                                crate::model::TrackingStatus::Afk => {
                                    "Tempo · AFK / ausente · retomada automática"
                                }
                                crate::model::TrackingStatus::Locked => "Tempo · Tela bloqueada",
                                crate::model::TrackingStatus::Paused => "Tempo · Em pausa",
                                crate::model::TrackingStatus::Unknown => {
                                    "Tempo · Aguardando sinal de coleta"
                                }
                            });
                        }
                        if maintenance == 0 {
                            if let Err(e) = store.prune(now) {
                                store.last_error = Some(e);
                            }
                        }
                    }
                    if let Some(tray) = handle.tray_by_id("tempo") {
                        let _ = tray.set_tooltip(Some(&tooltip));
                    }
                    if let Some(settings) = alarm {
                        let _ = handle.emit("pause-finished", ());
                        let _ = handle
                            .notification()
                            .builder()
                            .title("Tempo · Sua pausa terminou")
                            .body("Abra o Tempo para continuar ou prorrogar sua pausa.")
                            .show();
                        sound(settings);
                    }
                    maintenance = (maintenance + 1) % 3600;
                    std::thread::sleep(Duration::from_secs(1));
                }
            });
            if !std::env::args().any(|arg| arg == "--background") {
                open_dashboard(app.handle());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Não foi possível iniciar o Tempo")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() {
                    api.prevent_exit();
                } else if let Some(state) = app.try_state::<State>() {
                    if let Ok(mut store) = state.store.lock() {
                        let _ = store.finish(now_ms());
                    }
                }
            }
        });
}
