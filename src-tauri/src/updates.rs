use crate::{
    desktop::{locked, State},
    store::now_ms,
};
use serde::Serialize;
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{Emitter, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub(crate) struct UpdateState {
    available: Mutex<Option<Update>>,
    busy: AtomicBool,
}

struct Operation<'a>(&'a AtomicBool);
impl<'a> Operation<'a> {
    fn start(state: &'a UpdateState) -> Result<Self, String> {
        state
            .busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map_err(|_| "Já há uma verificação ou atualização em andamento.")?;
        Ok(Self(&state.busy))
    }
}
impl Drop for Operation<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateInfo {
    current_version: String,
    available_version: Option<String>,
    notes: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    phase: &'static str,
    downloaded: u64,
    total: Option<u64>,
}

#[tauri::command]
pub(crate) async fn check_for_updates(app: tauri::AppHandle) -> Result<UpdateInfo, String> {
    if !cfg!(windows) {
        return Err("A atualização pelo aplicativo está disponível no Windows.".into());
    }
    let state = app.state::<UpdateState>();
    let _operation = Operation::start(&state)?;
    *state
        .available
        .lock()
        .map_err(|_| "Atualizador indisponível.")? = None;
    let update = app
        .updater_builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Não foi possível preparar o atualizador: {e}"))?
        .check()
        .await
        .map_err(|_| {
            "Não foi possível verificar atualizações. Confira sua conexão e tente novamente."
        })?;
    let info = UpdateInfo {
        current_version: app.package_info().version.to_string(),
        available_version: update.as_ref().map(|u| u.version.clone()),
        notes: update.as_ref().and_then(|u| u.body.clone()),
    };
    *state
        .available
        .lock()
        .map_err(|_| "Atualizador indisponível.")? = update;
    Ok(info)
}

#[tauri::command]
pub(crate) async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("A atualização pelo aplicativo está disponível no Windows.".into());
    }
    let updates = app.state::<UpdateState>();
    let _operation = Operation::start(&updates)?;
    let mut update = updates
        .available
        .lock()
        .map_err(|_| "Atualizador indisponível.")?
        .take()
        .ok_or("Verifique novamente se há uma atualização disponível.")?;
    update.timeout = Some(Duration::from_secs(600));
    let mut downloaded = 0;
    // The plugin verifies the pinned public-key signature before returning bytes.
    let bytes = update.download(|chunk, total| {
        downloaded += chunk as u64;
        let _ = app.emit("update-progress", Progress { phase: "downloading", downloaded, total });
    }, || {}).await.map_err(|_| "Não foi possível baixar ou validar a atualização. Nenhuma instalação foi iniciada. Verifique novamente e tente outra vez.")?;

    let state = app.state::<State>();
    {
        let mut store = locked(&state)?;
        let backup_dir = state.data_dir.join("backups");
        std::fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Não foi possível preparar o backup: {e}"))?;
        store.finish(now_ms())?;
        store.backup_to(&backup_dir.join(format!(
            "antes-atualizacao-{}-{}.sqlite",
            app.package_info().version,
            now_ms()
        )))?;
        // Stop new observations only after the verified download and backup succeed.
        state.updating.store(true, Ordering::SeqCst);
    }
    let _ = app.emit(
        "update-progress",
        Progress {
            phase: "installing",
            downloaded,
            total: Some(downloaded),
        },
    );
    // On Windows the plugin starts NSIS in update mode, then exits this process.
    // Errors leave this installation usable and allow the collector to continue.
    let result = update.install(bytes);
    state.updating.store(false, Ordering::SeqCst);
    result.map_err(|_| "Não foi possível iniciar o instalador. A coleta pode continuar. Verifique as atualizações novamente para tentar outra vez.".into())
}
