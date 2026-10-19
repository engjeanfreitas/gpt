use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub color: String,
    pub parent_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub name: String,
    pub category_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub client: String,
    pub color: String,
    pub budget_minutes: Option<u64>,
    pub apps: Vec<String>,
    pub archived: bool,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Software {
    pub executable: String,
    pub name: String,
    pub category_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub priority: i32,
    pub app: String,
    pub title_contains: String,
    pub domain: String,
    pub activity_id: Option<String>,
    pub project_id: Option<String>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub idle_seconds: u64,
    pub pause_presets: Vec<f64>,
    pub auto_resume: bool,
    pub alarm_sound: String,
    pub alarm_volume: u32,
    pub privacy_apps: Vec<String>,
    pub privacy_titles: Vec<String>,
    pub retention_days: u32,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Configuration {
    pub categories: Vec<Category>,
    pub activities: Vec<Activity>,
    pub projects: Vec<Project>,
    pub softwares: Vec<Software>,
    pub rules: Vec<Rule>,
    pub assignments: HashMap<String, serde_json::Value>,
    pub settings: Settings,
}
impl Default for Configuration {
    fn default() -> Self {
        serde_json::from_str(include_str!("../../src/lib/default-config.json"))
            .expect("valid embedded defaults")
    }
}
impl Configuration {
    pub fn validate(&self) -> Result<(), String> {
        if !(60..=3600).contains(&self.settings.idle_seconds)
            || !(1..=3650).contains(&self.settings.retention_days)
            || self.settings.alarm_volume > 100
        {
            return Err("Preferências fora dos limites permitidos.".into());
        }
        if !["soft", "bell", "none"].contains(&self.settings.alarm_sound.as_str())
            || self.settings.pause_presets.is_empty()
            || self.settings.pause_presets.len() > 6
            || self
                .settings
                .pause_presets
                .iter()
                .any(|v| !v.is_finite() || *v <= 0. || *v > 1440.)
        {
            return Err("Configuração do alarme ou das pausas inválida.".into());
        }
        fn ids<'a>(items: impl Iterator<Item = &'a str>) -> Result<HashSet<&'a str>, String> {
            let mut set = HashSet::new();
            for id in items {
                if id.is_empty() || !set.insert(id) {
                    return Err("Identificadores vazios ou duplicados.".into());
                }
            }
            Ok(set)
        }
        let categories = ids(self.categories.iter().map(|v| v.id.as_str()))?;
        let projects = ids(self.projects.iter().map(|v| v.id.as_str()))?;
        let activities = ids(self.activities.iter().map(|v| v.id.as_str()))?;
        ids(self.rules.iter().map(|v| v.id.as_str()))?;
        for c in &self.categories {
            let mut current = Some(c.id.as_str());
            let mut seen = HashSet::new();
            while let Some(id) = current {
                if !seen.insert(id) {
                    return Err("A árvore de categorias não pode conter ciclos.".into());
                }
                let item = self
                    .categories
                    .iter()
                    .find(|c| c.id == id)
                    .ok_or("Categoria pai inexistente.")?;
                current = item.parent_id.as_deref();
            }
            if c.name.trim().is_empty() {
                return Err("Informe o nome da categoria.".into());
            }
        }
        for a in &self.activities {
            if a.name.trim().is_empty()
                || a.category_id
                    .as_deref()
                    .is_some_and(|id| !categories.contains(id))
            {
                return Err("Atividade ou categoria inválida.".into());
            }
        }
        for p in &self.projects {
            if p.name.trim().is_empty() || p.budget_minutes.is_some_and(|v| v == 0 || v > 6_000_000)
            {
                return Err("Projeto ou estimativa inválida.".into());
            }
        }
        for r in &self.rules {
            if r.name.trim().is_empty()
                || (r.app.trim().is_empty()
                    && r.title_contains.trim().is_empty()
                    && r.domain.trim().is_empty())
                || (r.activity_id.is_none() && r.project_id.is_none())
                || !(0..=1000).contains(&r.priority)
                || r.project_id
                    .as_deref()
                    .is_some_and(|id| !projects.contains(id))
                || r.activity_id
                    .as_deref()
                    .is_some_and(|id| !activities.contains(id))
            {
                return Err("Regra inválida ou sem condições/classificação.".into());
            }
        }
        for a in self.assignments.values() {
            if !a.is_object() {
                return Err("Atribuição inválida.".into());
            }
            if a.get("projectId")
                .and_then(|v| v.as_str())
                .is_some_and(|id| !projects.contains(id))
                || a.get("activityId")
                    .and_then(|v| v.as_str())
                    .is_some_and(|id| !activities.contains(id))
            {
                return Err("Projeto ou atividade da atribuição não existe.".into());
            }
        }
        Ok(())
    }
}
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimeEvent {
    pub id: String,
    pub start: i64,
    pub end: i64,
    pub app: String,
    pub title: String,
    pub domain: Option<String>,
    pub project_id: Option<String>,
    pub kind: String,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PauseState {
    pub id: String,
    pub started_at: i64,
    pub ends_at: Option<i64>,
    pub notified: bool,
}
#[derive(Clone, Serialize, Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeState {
    pub pause: Option<PauseState>,
    pub current_project_id: Option<String>,
}
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub config: Configuration,
    pub events: Vec<TimeEvent>,
    pub pause: Option<PauseState>,
    pub current_project_id: Option<String>,
    pub capturing: bool,
    pub platform: String,
    pub last_error: Option<String>,
}
#[derive(Clone, Debug)]
pub struct Observation {
    pub app: String,
    pub title: String,
    pub idle_seconds: u64,
    pub locked: bool,
}
