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
#[derive(Deserialize)]
struct CommonDefaults {
    categories: Vec<Category>,
    activities: Vec<Activity>,
    softwares: Vec<Software>,
    rules: Vec<Rule>,
}
impl Default for Configuration {
    fn default() -> Self {
        let mut config: Self =
            serde_json::from_str(include_str!("../../src/lib/default-config.json"))
                .expect("valid embedded defaults");
        config.install_common_defaults();
        config
    }
}
impl Configuration {
    pub fn install_common_defaults(&mut self) -> bool {
        let base: CommonDefaults =
            serde_json::from_str(include_str!("../../src/lib/default-config.json"))
                .expect("valid embedded defaults");
        let catalog: CommonDefaults =
            serde_json::from_str(include_str!("../../src/lib/common-defaults.json"))
                .expect("valid common defaults");
        let before = (
            self.categories.len(),
            self.activities.len(),
            self.softwares.len(),
            self.rules.len(),
        );
        let seeds: Vec<_> = base
            .categories
            .into_iter()
            .chain(catalog.categories.iter().cloned())
            .collect();
        for category in catalog.categories {
            self.ensure_default_category(&category.id, &seeds);
        }
        for activity in catalog.activities {
            if !self.activities.iter().any(|a| a.id == activity.id) {
                if let Some(id) = &activity.category_id {
                    self.ensure_default_category(id, &seeds);
                }
                self.activities.push(activity);
            }
        }
        for software in catalog.softwares {
            if !self
                .softwares
                .iter()
                .any(|s| s.executable.eq_ignore_ascii_case(&software.executable))
            {
                if let Some(id) = &software.category_id {
                    self.ensure_default_category(id, &seeds);
                }
                self.softwares.push(software);
            }
        }
        for rule in catalog.rules {
            if !self.rules.iter().any(|r| r.id == rule.id) {
                self.rules.push(rule);
            }
        }
        before
            != (
                self.categories.len(),
                self.activities.len(),
                self.softwares.len(),
                self.rules.len(),
            )
    }
    fn ensure_default_category(&mut self, id: &str, seeds: &[Category]) {
        if self.categories.iter().any(|c| c.id == id) {
            return;
        }
        let category = seeds
            .iter()
            .find(|c| c.id == id)
            .expect("valid default category")
            .clone();
        if let Some(parent) = &category.parent_id {
            self.ensure_default_category(parent, seeds);
        }
        self.categories.push(category);
    }
    pub fn upgrade_category_defaults(&mut self) -> bool {
        let palette: serde_json::Value =
            serde_json::from_str(include_str!("../../src/lib/palette.json"))
                .expect("valid shared palette");
        let mut changed = false;
        for replacement in palette["categoryDefaults"]
            .as_array()
            .expect("valid category defaults")
        {
            for category in &mut self.categories {
                if category.id == replacement["id"].as_str().unwrap_or_default()
                    && category.parent_id.is_none()
                    && category
                        .color
                        .eq_ignore_ascii_case(replacement["from"].as_str().unwrap_or_default())
                {
                    category.color = replacement["to"].as_str().expect("valid color").to_string();
                    changed = true;
                }
            }
        }
        changed
    }
    pub fn upgrade_palette(&mut self) -> bool {
        let palette: serde_json::Value =
            serde_json::from_str(include_str!("../../src/lib/palette.json"))
                .expect("valid shared palette");
        let mut changed = false;
        for color in self
            .categories
            .iter_mut()
            .map(|c| &mut c.color)
            .chain(self.projects.iter_mut().map(|p| &mut p.color))
        {
            if let Some(replacement) = palette["legacy"][color.to_lowercase()].as_str() {
                *color = replacement.to_string();
                changed = true;
            }
        }
        changed
    }
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
                || !(-1000..=1000).contains(&r.priority)
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
    pub tracking_status: TrackingStatus,
    pub platform: String,
    pub last_error: Option<String>,
}
#[derive(Clone, Copy, Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrackingStatus {
    Active,
    Afk,
    Locked,
    Paused,
    Unknown,
}
#[derive(Clone, Debug)]
pub struct Observation {
    pub app: String,
    pub title: String,
    pub idle_seconds: u64,
    pub locked: bool,
}
