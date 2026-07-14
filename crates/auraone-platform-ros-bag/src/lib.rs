//! ROS bag adapter scaffolding for Robotics Studio Open.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RosBagFormat {
    Rosbag1,
    Rosbag2Sqlite,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RosTopic {
    pub name: String,
    pub message_type: String,
    pub offered_qos_profiles: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RosBagSummary {
    pub root: PathBuf,
    pub format: RosBagFormat,
    pub storage_files: Vec<PathBuf>,
    pub metadata_file: Option<PathBuf>,
}

#[derive(Debug, Error)]
pub enum RosBagError {
    #[error("path does not exist: {0}")]
    Missing(PathBuf),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub trait RosBagAdapter {
    fn summarize(&self, root: &Path) -> Result<RosBagSummary, RosBagError>;
    fn list_topics(&self, root: &Path) -> Result<Vec<RosTopic>, RosBagError>;
}

#[derive(Debug, Default)]
pub struct FilesystemRosBagAdapter;

impl RosBagAdapter for FilesystemRosBagAdapter {
    fn summarize(&self, root: &Path) -> Result<RosBagSummary, RosBagError> {
        summarize_bag(root)
    }

    fn list_topics(&self, root: &Path) -> Result<Vec<RosTopic>, RosBagError> {
        if !root.exists() {
            return Err(RosBagError::Missing(root.to_path_buf()));
        }
        Ok(Vec::new())
    }
}

pub fn summarize_bag(root: &Path) -> Result<RosBagSummary, RosBagError> {
    if !root.exists() {
        return Err(RosBagError::Missing(root.to_path_buf()));
    }
    let metadata = root.join("metadata.yaml");
    let mut storage_files = Vec::new();
    if root.is_dir() {
        for entry in fs::read_dir(root)? {
            let path = entry?.path();
            if matches!(
                path.extension().and_then(|value| value.to_str()),
                Some("db3" | "sqlite3" | "bag")
            ) {
                storage_files.push(path);
            }
        }
    } else {
        storage_files.push(root.to_path_buf());
    }

    let format = detect_format(root, metadata.exists(), &storage_files);
    Ok(RosBagSummary {
        root: root.to_path_buf(),
        format,
        storage_files,
        metadata_file: metadata.exists().then_some(metadata),
    })
}

pub fn detect_format(
    root: &Path,
    has_metadata_yaml: bool,
    storage_files: &[PathBuf],
) -> RosBagFormat {
    if has_metadata_yaml
        || storage_files.iter().any(|path| {
            matches!(
                path.extension().and_then(|value| value.to_str()),
                Some("db3" | "sqlite3")
            )
        })
    {
        return RosBagFormat::Rosbag2Sqlite;
    }
    if matches!(
        root.extension().and_then(|value| value.to_str()),
        Some("bag")
    ) || storage_files.iter().any(|path| {
        matches!(
            path.extension().and_then(|value| value.to_str()),
            Some("bag")
        )
    }) {
        return RosBagFormat::Rosbag1;
    }
    RosBagFormat::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;

    #[test]
    fn detects_rosbag2_sqlite_layout() {
        let dir = tempfile::tempdir().unwrap();
        File::create(dir.path().join("metadata.yaml")).unwrap();
        File::create(dir.path().join("episode_0.db3")).unwrap();
        let summary = summarize_bag(dir.path()).unwrap();
        assert_eq!(summary.format, RosBagFormat::Rosbag2Sqlite);
        assert_eq!(summary.storage_files.len(), 1);
        assert!(summary.metadata_file.is_some());
    }

    #[test]
    fn detects_rosbag1_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("legacy.bag");
        File::create(&path).unwrap();
        let summary = summarize_bag(&path).unwrap();
        assert_eq!(summary.format, RosBagFormat::Rosbag1);
    }
}
