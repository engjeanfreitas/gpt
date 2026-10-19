use crate::model::*;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, String>;
fn db_error(e: impl std::fmt::Display) -> String {
    format!("Armazenamento local: {e}")
}
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub struct Store {
    conn: Connection,
    pub config: Configuration,
    pub runtime: RuntimeState,
    pending: Option<TimeEvent>,
    last_sample: Option<i64>,
    last_flush: i64,
    pub capturing: bool,
    pub tracking_status: TrackingStatus,
    pub last_error: Option<String>,
}
impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path).map_err(db_error)?;
        Self::from_connection(conn)
    }
    fn from_connection(conn: Connection) -> Result<Self> {
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(db_error)?;
        conn.pragma_update(None, "synchronous", "NORMAL")
            .map_err(db_error)?;
        conn.pragma_update(None, "secure_delete", "ON")
            .map_err(db_error)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(db_error)?;
        conn.execute_batch("CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, start INTEGER NOT NULL, end INTEGER NOT NULL, app TEXT NOT NULL, title TEXT NOT NULL, domain TEXT, project_id TEXT, kind TEXT NOT NULL, CHECK(end >= start));
          CREATE INDEX IF NOT EXISTS events_start ON events(start);
          CREATE INDEX IF NOT EXISTS events_project ON events(project_id, start);").map_err(db_error)?;
        let mut config: Configuration = Self::read_metadata(&conn, "config")?.unwrap_or_default();
        let upgraded_palette = config.upgrade_palette();
        let runtime = Self::read_metadata(&conn, "runtime")?.unwrap_or_default();
        let store = Self {
            conn,
            config,
            runtime,
            pending: None,
            last_sample: None,
            last_flush: 0,
            capturing: false,
            tracking_status: TrackingStatus::Unknown,
            last_error: None,
        };
        if upgraded_palette {
            store.write_metadata("config", &store.config)?;
        }
        Ok(store)
    }
    fn read_metadata<T: serde::de::DeserializeOwned>(
        conn: &Connection,
        key: &str,
    ) -> Result<Option<T>> {
        let value: Option<String> = conn
            .query_row("SELECT value FROM metadata WHERE key=?1", [key], |r| {
                r.get(0)
            })
            .optional()
            .map_err(db_error)?;
        value
            .map(|v| serde_json::from_str(&v).map_err(db_error))
            .transpose()
    }
    fn write_metadata(&self, key: &str, value: &impl serde::Serialize) -> Result<()> {
        let json = serde_json::to_string(value).map_err(db_error)?;
        self.conn.execute("INSERT INTO metadata(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key, json]).map_err(db_error)?;
        Ok(())
    }
    pub fn save_config(&mut self, config: Configuration, now: i64) -> Result<()> {
        config.validate()?;
        self.finish(now)?;
        self.write_metadata("config", &config)?;
        self.config = config;
        if self.runtime.current_project_id.as_ref().is_some_and(|id| {
            !self
                .config
                .projects
                .iter()
                .any(|p| p.id == *id && !p.archived)
        }) {
            self.runtime.current_project_id = None;
            self.write_metadata("runtime", &self.runtime)?;
        }
        self.prune(now)?;
        Ok(())
    }
    fn persist_event(&self, event: &TimeEvent) -> Result<()> {
        if event.end <= event.start {
            return Ok(());
        }
        self.conn.execute("INSERT INTO events(id,start,end,app,title,domain,project_id,kind) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(id) DO UPDATE SET end=excluded.end", params![event.id, event.start, event.end, event.app, event.title, event.domain, event.project_id, event.kind]).map_err(db_error)?;
        Ok(())
    }
    pub fn flush(&mut self, now: i64) -> Result<()> {
        if let Some(event) = &self.pending {
            self.persist_event(event)?;
        }
        self.last_flush = now;
        Ok(())
    }
    pub fn finish(&mut self, now: i64) -> Result<()> {
        if let Some(mut event) = self.pending.take() {
            if let Some(last) = self.last_sample {
                event.end = now.min(last + 2_000).max(event.end);
            }
            self.persist_event(&event)?;
        }
        self.capturing = false;
        self.tracking_status = TrackingStatus::Unknown;
        Ok(())
    }
    pub fn set_project(&mut self, project_id: Option<String>, now: i64) -> Result<()> {
        if let Some(id) = &project_id {
            if !self
                .config
                .projects
                .iter()
                .any(|p| p.id == *id && !p.archived)
            {
                return Err("Projeto não encontrado ou arquivado.".into());
            }
        }
        self.finish(now)?;
        self.runtime.current_project_id = project_id;
        self.write_metadata("runtime", &self.runtime)
    }
    pub fn start_pause(&mut self, minutes: Option<f64>, now: i64) -> Result<()> {
        if minutes.is_some_and(|m| !m.is_finite() || !(0.05..=1440.).contains(&m)) {
            return Err("A duração deve estar entre 0,05 e 1440 minutos.".into());
        }
        if self.runtime.pause.is_some() {
            return Err("Uma pausa já está em andamento. Use prorrogar ou continuar.".into());
        }
        self.finish(now)?;
        self.runtime.pause = Some(PauseState {
            id: Uuid::new_v4().to_string(),
            started_at: now,
            ends_at: minutes.map(|m| now + (m * 60_000.) as i64),
            notified: false,
        });
        self.write_metadata("runtime", &self.runtime)
    }
    pub fn extend_pause(&mut self, minutes: f64, now: i64) -> Result<()> {
        if !minutes.is_finite() || !(0.05..=1440.).contains(&minutes) {
            return Err("Duração inválida.".into());
        }
        let pause = self
            .runtime
            .pause
            .as_mut()
            .ok_or("Não há pausa em andamento.")?;
        pause.ends_at = Some(pause.ends_at.unwrap_or(now).max(now) + (minutes * 60_000.) as i64);
        pause.notified = false;
        self.write_metadata("runtime", &self.runtime)
    }
    pub fn resume(&mut self, now: i64) -> Result<()> {
        if let Some(pause) = &self.runtime.pause {
            let e = TimeEvent {
                id: pause.id.clone(),
                start: pause.started_at,
                end: now.max(pause.started_at),
                app: String::new(),
                title: String::new(),
                domain: None,
                project_id: None,
                kind: "pause".into(),
            };
            self.persist_event(&e)?;
        }
        self.runtime.pause = None;
        self.last_sample = None;
        self.capturing = false;
        self.tracking_status = TrackingStatus::Unknown;
        self.write_metadata("runtime", &self.runtime)
    }
    /// Returns true exactly once per deadline, even when no dashboard is open.
    pub fn check_alarm(&mut self, now: i64) -> Result<bool> {
        let due = self
            .runtime
            .pause
            .as_ref()
            .is_some_and(|p| !p.notified && p.ends_at.is_some_and(|end| now >= end));
        if !due {
            return Ok(false);
        }
        if let Some(pause) = &mut self.runtime.pause {
            pause.notified = true;
        }
        self.write_metadata("runtime", &self.runtime)?;
        if self.config.settings.auto_resume {
            self.resume(now)?;
        }
        Ok(true)
    }
    pub fn observe(&mut self, observation: Option<Observation>, now: i64) -> Result<()> {
        if self.runtime.pause.is_some() {
            self.capturing = false;
            self.tracking_status = TrackingStatus::Paused;
            self.last_sample = Some(now);
            return Ok(());
        }
        if let Some(last) = self.last_sample {
            if now <= last || now - last > 5_000 {
                self.finish(last)?;
                if now > last {
                    self.persist_event(&TimeEvent {
                        id: Uuid::new_v4().to_string(),
                        start: last,
                        end: now,
                        app: String::new(),
                        title: String::new(),
                        domain: None,
                        project_id: None,
                        kind: "unknown".into(),
                    })?;
                }
                self.last_sample = None;
            }
        }
        let (app, title, kind, status) = match observation {
            Some(o) if o.locked => (String::new(), String::new(), "idle", TrackingStatus::Locked),
            Some(o) if o.idle_seconds >= self.config.settings.idle_seconds => {
                (String::new(), String::new(), "idle", TrackingStatus::Afk)
            }
            Some(o) if !o.app.is_empty() => {
                let excluded = self
                    .config
                    .settings
                    .privacy_apps
                    .iter()
                    .any(|app| app.eq_ignore_ascii_case(&o.app))
                    || self.config.settings.privacy_titles.iter().any(|t| {
                        !t.is_empty() && o.title.to_lowercase().contains(&t.to_lowercase())
                    });
                if excluded {
                    (
                        String::new(),
                        String::new(),
                        "unknown",
                        TrackingStatus::Unknown,
                    )
                } else {
                    (o.app, o.title, "active", TrackingStatus::Active)
                }
            }
            _ => (
                String::new(),
                String::new(),
                "unknown",
                TrackingStatus::Unknown,
            ),
        };
        let project_id = if kind == "active" {
            self.runtime
                .current_project_id
                .as_ref()
                .filter(|id| {
                    self.config.projects.iter().any(|p| {
                        p.id == **id
                            && !p.archived
                            && p.apps.iter().any(|a| a.eq_ignore_ascii_case(&app))
                    })
                })
                .cloned()
        } else {
            None
        };
        let same = self.pending.as_ref().is_some_and(|e| {
            e.app == app && e.title == title && e.kind == kind && e.project_id == project_id
        });
        if same {
            if let Some(e) = &mut self.pending {
                e.end = now;
            }
        } else {
            self.finish(now)?;
            self.pending = Some(TimeEvent {
                id: Uuid::new_v4().to_string(),
                start: now,
                end: now,
                app,
                title,
                domain: None,
                project_id,
                kind: kind.into(),
            });
        }
        self.last_sample = Some(now);
        self.capturing = kind == "active";
        self.tracking_status = status;
        if now - self.last_flush >= 5_000 {
            self.flush(now)?;
        }
        Ok(())
    }
    pub fn snapshot(&self, now: i64) -> Result<Snapshot> {
        let mut statement = self
            .conn
            .prepare(
                "SELECT id,start,end,app,title,domain,project_id,kind FROM events ORDER BY start",
            )
            .map_err(db_error)?;
        let mut events = statement
            .query_map([], |r| {
                Ok(TimeEvent {
                    id: r.get(0)?,
                    start: r.get(1)?,
                    end: r.get(2)?,
                    app: r.get(3)?,
                    title: r.get(4)?,
                    domain: r.get(5)?,
                    project_id: r.get(6)?,
                    kind: r.get(7)?,
                })
            })
            .map_err(db_error)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(db_error)?;
        if let Some(pending) = &self.pending {
            events.retain(|e| e.id != pending.id);
            if pending.end > pending.start {
                events.push(pending.clone());
            }
        }
        if let Some(pause) = &self.runtime.pause {
            events.push(TimeEvent {
                id: pause.id.clone(),
                start: pause.started_at,
                end: now.max(pause.started_at),
                app: String::new(),
                title: String::new(),
                domain: None,
                project_id: None,
                kind: "pause".into(),
            });
        }
        Ok(Snapshot {
            config: self.config.clone(),
            events,
            pause: self.runtime.pause.clone(),
            current_project_id: self.runtime.current_project_id.clone(),
            capturing: self.capturing,
            tracking_status: if self.runtime.pause.is_some() {
                TrackingStatus::Paused
            } else {
                self.tracking_status
            },
            platform: std::env::consts::OS.into(),
            last_error: self.last_error.clone(),
        })
    }
    pub fn prune(&mut self, now: i64) -> Result<()> {
        let cutoff = now - self.config.settings.retention_days as i64 * 86_400_000;
        self.conn
            .execute("DELETE FROM events WHERE end <= ?1", [cutoff])
            .map_err(db_error)?;
        self.conn
            .execute(
                "UPDATE events SET start=?1 WHERE start < ?1 AND end > ?1",
                [cutoff],
            )
            .map_err(db_error)?;
        Ok(())
    }
    pub fn delete_history(&mut self, start: i64, end: i64, now: i64) -> Result<()> {
        if end <= start {
            return Err("Período inválido.".into());
        }
        self.finish(now)?;
        // Materialize the past portion without silently ending the user's pause.
        let continuing_pause = self
            .runtime
            .pause
            .as_ref()
            .filter(|p| p.started_at < end && now > start)
            .cloned();
        if continuing_pause.is_some() {
            self.resume(now)?;
        }
        let snapshot = self.snapshot(now)?;
        let mut assignments = self.config.assignments.clone();
        let tx = self.conn.transaction().map_err(db_error)?;
        for event in snapshot
            .events
            .iter()
            .filter(|e| e.end > start && e.start < end)
        {
            tx.execute("DELETE FROM events WHERE id=?1", [&event.id])
                .map_err(db_error)?;
            let assignment = assignments.remove(&event.id);
            if event.start < start {
                tx.execute(
                    "INSERT INTO events VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
                    params![
                        event.id,
                        event.start,
                        start,
                        event.app,
                        event.title,
                        event.domain,
                        event.project_id,
                        event.kind
                    ],
                )
                .map_err(db_error)?;
                if let Some(value) = &assignment {
                    assignments.insert(event.id.clone(), value.clone());
                }
            }
            if event.end > end {
                let id = Uuid::new_v4().to_string();
                tx.execute(
                    "INSERT INTO events VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
                    params![
                        id,
                        end,
                        event.end,
                        event.app,
                        event.title,
                        event.domain,
                        event.project_id,
                        event.kind
                    ],
                )
                .map_err(db_error)?;
                if let Some(value) = assignment {
                    assignments.insert(id, value);
                }
            }
        }
        let mut config = self.config.clone();
        config.assignments = assignments;
        let json = serde_json::to_string(&config).map_err(db_error)?;
        tx.execute("INSERT INTO metadata(key,value) VALUES('config',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [json]).map_err(db_error)?;
        tx.commit().map_err(db_error)?;
        self.config = config;
        if let Some(mut pause) = continuing_pause {
            pause.id = Uuid::new_v4().to_string();
            pause.started_at = now;
            self.runtime.pause = Some(pause);
            self.write_metadata("runtime", &self.runtime)?;
        }
        self.pending = None;
        self.last_sample = None;
        self.conn
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
            .map_err(db_error)?;
        Ok(())
    }
    pub fn backup_to(&mut self, destination: &Path) -> Result<()> {
        self.flush(now_ms())?;
        self.conn
            .backup("main", destination, None)
            .map_err(db_error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn store() -> Store {
        Store::from_connection(Connection::open_in_memory().unwrap()).unwrap()
    }
    fn active(title: &str) -> Observation {
        Observation {
            app: "eberick.exe".into(),
            title: title.into(),
            idle_seconds: 0,
            locked: false,
        }
    }
    #[test]
    fn foreground_changes_do_not_overlap_or_fill_sleep() {
        let mut s = store();
        s.observe(Some(active("A")), 1000).unwrap();
        s.observe(Some(active("A")), 2000).unwrap();
        s.observe(Some(active("B")), 3000).unwrap();
        s.observe(Some(active("B")), 4000).unwrap();
        s.observe(Some(active("C")), 60_000).unwrap();
        s.observe(Some(active("C")), 61_000).unwrap();
        let events = s.snapshot(61_000).unwrap().events;
        assert_eq!(
            events
                .iter()
                .filter(|e| e.kind == "active")
                .map(|e| e.end - e.start)
                .sum::<i64>(),
            4000
        );
        let mut sorted = events.clone();
        sorted.sort_by_key(|e| e.start);
        assert!(sorted.windows(2).all(|pair| pair[0].end <= pair[1].start));
        assert_eq!(
            events.iter().find(|e| e.kind == "unknown").unwrap().end,
            60_000
        );
    }
    #[test]
    fn afk_starts_at_threshold_and_input_resumes_without_losing_time() {
        let mut s = store();
        assert_eq!(s.config.settings.idle_seconds, 180);
        for seconds in 0..=190 {
            let mut observation = active("TFLM");
            observation.idle_seconds = seconds;
            s.observe(Some(observation), 1_000 + seconds as i64 * 1_000)
                .unwrap();
            assert_eq!(
                s.tracking_status,
                if seconds < 180 {
                    TrackingStatus::Active
                } else {
                    TrackingStatus::Afk
                }
            );
        }
        assert!(!s.capturing);
        let afk = s.snapshot(191_000).unwrap();
        assert_eq!(afk.tracking_status, TrackingStatus::Afk);
        let idle = afk.events.iter().find(|e| e.kind == "idle").unwrap();
        assert!(idle.app.is_empty() && idle.title.is_empty() && idle.project_id.is_none());
        s.observe(Some(active("TFLM")), 192_000).unwrap();
        s.observe(Some(active("TFLM")), 193_000).unwrap();
        assert!(s.capturing);
        assert_eq!(s.tracking_status, TrackingStatus::Active);
        let events = s.snapshot(193_000).unwrap().events;
        assert_eq!(
            events
                .iter()
                .filter(|e| e.kind == "active")
                .map(|e| e.end - e.start)
                .sum::<i64>(),
            181_000
        );
        assert_eq!(
            events
                .iter()
                .filter(|e| e.kind == "idle")
                .map(|e| e.end - e.start)
                .sum::<i64>(),
            11_000
        );
        assert_eq!(events.iter().map(|e| e.end - e.start).sum::<i64>(), 192_000);
        let mut sorted = events.clone();
        sorted.sort_by_key(|e| e.start);
        assert!(sorted.windows(2).all(|pair| pair[0].end == pair[1].start));
    }
    #[test]
    fn afk_threshold_is_configurable_and_short_input_breaks_reset_it() {
        let mut s = store();
        s.config.settings.idle_seconds = 60;
        for (i, seconds) in [59, 0, 59, 60, 0].into_iter().enumerate() {
            let mut observation = active("A");
            observation.idle_seconds = seconds;
            s.observe(Some(observation), 1_000 + i as i64 * 1_000)
                .unwrap();
            assert_eq!(
                s.tracking_status,
                if seconds < 60 {
                    TrackingStatus::Active
                } else {
                    TrackingStatus::Afk
                }
            );
        }
    }
    #[test]
    fn lock_unknown_and_explicit_pause_are_distinct_from_afk() {
        let mut s = store();
        let mut observation = active("A");
        observation.locked = true;
        s.observe(Some(observation), 1_000).unwrap();
        assert_eq!(s.tracking_status, TrackingStatus::Locked);
        s.observe(None, 2_000).unwrap();
        assert_eq!(s.tracking_status, TrackingStatus::Unknown);
        s.start_pause(None, 3_000).unwrap();
        let mut afk = active("Should not be captured");
        afk.idle_seconds = 300;
        s.observe(Some(afk), 4_000).unwrap();
        assert_eq!(
            s.snapshot(4_000).unwrap().tracking_status,
            TrackingStatus::Paused
        );
        s.resume(5_000).unwrap();
        let events = s.snapshot(5_000).unwrap().events;
        assert_eq!(
            events
                .iter()
                .filter(|e| e.kind == "pause")
                .map(|e| e.end - e.start)
                .sum::<i64>(),
            2_000
        );
        assert!(events
            .iter()
            .filter(|e| e.kind == "idle")
            .all(|e| e.end <= 3_000));
    }
    #[test]
    fn pause_alarm_fires_once_and_waits_for_resume() {
        let mut s = store();
        s.start_pause(Some(1.), 1000).unwrap();
        assert!(!s.check_alarm(60_999).unwrap());
        assert!(s.check_alarm(61_000).unwrap());
        assert!(!s.check_alarm(62_000).unwrap());
        s.observe(Some(active("A")), 70_000).unwrap();
        assert!(s.runtime.pause.is_some());
        s.resume(80_000).unwrap();
        let snapshot = s.snapshot(80_000).unwrap();
        assert_eq!(snapshot.events[0].kind, "pause");
        assert_eq!(snapshot.events[0].end, 80_000);
    }
    #[test]
    fn pause_and_context_survive_reopening() {
        let path = std::env::temp_dir().join(format!("tempo-{}.db", Uuid::new_v4()));
        {
            let mut s = Store::open(&path).unwrap();
            s.start_pause(Some(1.), 1000).unwrap();
        }
        {
            let mut s = Store::open(&path).unwrap();
            assert_eq!(s.runtime.pause.as_ref().unwrap().ends_at, Some(61_000));
            assert!(s.check_alarm(80_000).unwrap());
        }
        let _ = std::fs::remove_file(&path);
    }
    #[test]
    fn auto_resume_only_counts_new_observed_activity() {
        let mut s = store();
        s.config.settings.auto_resume = true;
        s.start_pause(Some(1.), 1000).unwrap();
        s.check_alarm(61_000).unwrap();
        assert!(s.runtime.pause.is_none());
        let mut idle = active("Secret");
        idle.locked = true;
        s.observe(Some(idle), 62_000).unwrap();
        s.observe(Some(active("Work")), 63_000).unwrap();
        assert_eq!(
            s.snapshot(63_000)
                .unwrap()
                .events
                .iter()
                .filter(|e| e.kind == "active")
                .count(),
            0
        );
    }
    #[test]
    fn privacy_exclusions_never_persist_context() {
        let mut s = store();
        s.config.settings.privacy_apps.push("eberick.exe".into());
        s.observe(Some(active("Sensitive document")), 1000).unwrap();
        s.observe(Some(active("Sensitive document")), 2000).unwrap();
        s.flush(2000).unwrap();
        assert!(s
            .snapshot(2000)
            .unwrap()
            .events
            .iter()
            .all(|e| e.title.is_empty() && e.app.is_empty()));
    }
    #[test]
    fn deleting_middle_preserves_only_outside_intervals() {
        let mut s = store();
        let event = TimeEvent {
            id: "a".into(),
            start: 1000,
            end: 10_000,
            app: "eberick.exe".into(),
            title: "TFLM".into(),
            domain: None,
            project_id: None,
            kind: "active".into(),
        };
        s.persist_event(&event).unwrap();
        s.delete_history(3000, 7000, 20_000).unwrap();
        let events = s.snapshot(20_000).unwrap().events;
        assert_eq!(events.len(), 2);
        assert_eq!(events.iter().map(|e| e.end - e.start).sum::<i64>(), 5000);
        assert!(events.iter().all(|e| e.end <= 3000 || e.start >= 7000));
    }
    #[test]
    fn cyclic_categories_are_rejected() {
        let mut config = Configuration::default();
        config.categories[0].parent_id = Some("engineering".into());
        assert!(config.validate().is_err());
    }
    #[test]
    fn default_config_is_valid() {
        Configuration::default().validate().unwrap();
    }
    #[test]
    fn palette_upgrade_preserves_custom_colors_and_history() {
        let mut s = store();
        s.config.categories[0].color = "#7e9274".into();
        s.config.categories[1].color = "#123456".into();
        s.config.categories[0].name = "Minha categoria".into();
        s.write_metadata("config", &s.config).unwrap();
        s.observe(Some(active("TFLM")), 1000).unwrap();
        s.observe(Some(active("TFLM")), 2000).unwrap();
        s.finish(2000).unwrap();
        let upgraded = Store::from_connection(s.conn).unwrap();
        assert_eq!(upgraded.config.categories[0].color, "#2563EB");
        assert_eq!(upgraded.config.categories[0].name, "Minha categoria");
        assert_eq!(upgraded.config.categories[1].color, "#123456");
        assert_eq!(upgraded.snapshot(2000).unwrap().events[0].end, 2000);
        let stored: Configuration = Store::read_metadata(&upgraded.conn, "config")
            .unwrap()
            .unwrap();
        assert_eq!(stored.categories[0].color, "#2563EB");
    }
    #[test]
    fn project_context_only_applies_to_eligible_software() {
        let mut s = store();
        s.config.projects.push(Project {
            id: "tflm".into(),
            name: "TFLM".into(),
            client: String::new(),
            color: "#c87957".into(),
            budget_minutes: Some(1200),
            apps: vec!["eberick.exe".into()],
            archived: false,
        });
        s.set_project(Some("tflm".into()), 1000).unwrap();
        s.observe(Some(active("A")), 1000).unwrap();
        s.observe(Some(active("A")), 2000).unwrap();
        let mut other = active("Personal");
        other.app = "chrome.exe".into();
        s.observe(Some(other), 3000).unwrap();
        s.flush(4000).unwrap();
        assert_eq!(
            s.snapshot(4000).unwrap().events[0].project_id.as_deref(),
            Some("tflm")
        );
        assert!(s.pending.as_ref().unwrap().project_id.is_none());
    }
    #[test]
    fn deleting_partial_history_keeps_manual_assignments_on_both_sides() {
        let mut s = store();
        let event = TimeEvent {
            id: "a".into(),
            start: 1000,
            end: 10_000,
            app: "eberick.exe".into(),
            title: "TFLM".into(),
            domain: None,
            project_id: None,
            kind: "active".into(),
        };
        s.persist_event(&event).unwrap();
        s.config
            .assignments
            .insert("a".into(), serde_json::json!({"activityId": "structural"}));
        s.delete_history(3000, 7000, 20_000).unwrap();
        let snapshot = s.snapshot(20_000).unwrap();
        for event in snapshot.events {
            assert_eq!(
                snapshot.config.assignments[&event.id]["activityId"],
                "structural"
            );
        }
    }
    #[test]
    fn extended_pause_can_emit_a_second_alarm_and_deletion_keeps_it_paused() {
        let mut s = store();
        s.start_pause(Some(1.), 1000).unwrap();
        assert!(s.check_alarm(61_000).unwrap());
        s.extend_pause(1., 61_000).unwrap();
        assert!(!s.check_alarm(100_000).unwrap());
        assert!(s.check_alarm(121_000).unwrap());
        s.delete_history(0, 100_000, 125_000).unwrap();
        assert!(s.runtime.pause.is_some());
        assert_eq!(
            s.snapshot(126_000)
                .unwrap()
                .events
                .iter()
                .filter(|e| e.kind == "pause")
                .map(|e| e.end - e.start)
                .sum::<i64>(),
            26_000
        );
    }
}
