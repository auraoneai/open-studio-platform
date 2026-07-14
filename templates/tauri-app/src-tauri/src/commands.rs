use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum Flagship {
    RubricStudio,
    RoboticsStudio,
    AgentStudio,
    PlatformTemplate,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectManifest {
    id: String,
    name: String,
    path: String,
    flagship: Flagship,
    opened_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentProject {
    name: String,
    path: String,
    last_opened_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectTreeEntry {
    name: String,
    path: String,
    kind: ProjectTreeEntryKind,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectTreeEntryKind {
    File,
    Folder,
}

#[tauri::command]
pub fn open_project_folder(app: AppHandle, path: String) -> Result<ProjectManifest, String> {
    let project_path = validate_project_folder(&path)?;
    let manifest = create_project_manifest(&project_path)?;
    persist_project_manifest(&project_path, &manifest)?;
    record_recent_project(&app, &manifest)?;
    app.emit("project://opened", manifest.clone())
        .map_err(|error| error.to_string())?;
    Ok(manifest)
}

#[tauri::command]
pub fn list_recent_projects(app: AppHandle) -> Result<Vec<RecentProject>, String> {
    let path = recent_projects_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn read_project_tree(path: String) -> Result<Vec<ProjectTreeEntry>, String> {
    let project_path = validate_project_folder(&path)?;
    let mut entries = Vec::new();

    for entry in fs::read_dir(project_path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" {
            continue;
        }
        entries.push(ProjectTreeEntry {
            name,
            path: path.to_string_lossy().to_string(),
            kind: if file_type.is_dir() {
                ProjectTreeEntryKind::Folder
            } else {
                ProjectTreeEntryKind::File
            },
        });
    }

    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(entries)
}

pub fn project_path_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    let mut args = args.into_iter().peekable();
    while let Some(arg) = args.next() {
        if matches!(arg.as_str(), "--project" | "--open") {
            return args.next();
        }
        if arg.starts_with("auraone://") || arg.starts_with('-') {
            continue;
        }
        return Some(arg);
    }
    None
}

fn validate_project_folder(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    if !candidate.exists() {
        return Err("Project folder does not exist".to_string());
    }
    if !candidate.is_dir() {
        return Err("Project path must be a folder".to_string());
    }
    candidate.canonicalize().map_err(|error| error.to_string())
}

fn create_project_manifest(path: &Path) -> Result<ProjectManifest, String> {
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "AuraOne Project".to_string());

    Ok(ProjectManifest {
        id: Uuid::new_v4().to_string(),
        name,
        path: path.to_string_lossy().to_string(),
        flagship: Flagship::PlatformTemplate,
        opened_at: now()?,
    })
}

fn persist_project_manifest(path: &Path, manifest: &ProjectManifest) -> Result<(), String> {
    let aura_dir = path.join(".auraone");
    fs::create_dir_all(&aura_dir).map_err(|error| error.to_string())?;
    let contents = serde_json::to_string_pretty(manifest).map_err(|error| error.to_string())?;
    fs::write(aura_dir.join("project.json"), contents).map_err(|error| error.to_string())
}

fn record_recent_project(app: &AppHandle, manifest: &ProjectManifest) -> Result<(), String> {
    let path = recent_projects_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let mut recent = if path.exists() {
        let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        serde_json::from_str::<Vec<RecentProject>>(&contents).unwrap_or_default()
    } else {
        Vec::new()
    };

    recent.retain(|project| project.path != manifest.path);
    recent.insert(
        0,
        RecentProject {
            name: manifest.name.clone(),
            path: manifest.path.clone(),
            last_opened_at: manifest.opened_at.clone(),
        },
    );
    recent.truncate(20);

    let contents = serde_json::to_string_pretty(&recent).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn recent_projects_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    Ok(app_data_dir.join("recent-projects.json"))
}

fn now() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cli_project_path_accepts_explicit_and_positional_folder_args() {
        assert_eq!(
            project_path_from_args(["--project".to_string(), "/tmp/rubric".to_string()]),
            Some("/tmp/rubric".to_string())
        );
        assert_eq!(
            project_path_from_args(["/tmp/robotics".to_string()]),
            Some("/tmp/robotics".to_string())
        );
        assert_eq!(
            project_path_from_args([
                "--flag".to_string(),
                "auraone://rubric-studio/open".to_string()
            ]),
            None
        );
    }

    #[test]
    fn rejects_non_folder_project_paths() {
        let temp = tempfile::NamedTempFile::new().unwrap();
        assert!(validate_project_folder(&temp.path().to_string_lossy()).is_err());
    }
}
