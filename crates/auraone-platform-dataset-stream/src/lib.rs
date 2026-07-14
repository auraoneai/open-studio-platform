//! Chunked file IPC primitives for large robotics datasets.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use thiserror::Error;

pub const DEFAULT_CHUNK_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_CHUNK_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DatasetStreamManifest {
    pub dataset_id: String,
    pub total_bytes: u64,
    pub chunk_bytes: u64,
    pub chunks: u64,
    pub redacted_source: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChunkRequest {
    pub offset: u64,
    pub length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DatasetChunk {
    pub offset: u64,
    pub length: u64,
    pub sha256: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Error)]
pub enum DatasetStreamError {
    #[error("chunk length must be between 1 and {MAX_CHUNK_BYTES} bytes")]
    InvalidChunkLength,
    #[error("chunk offset is outside the file")]
    OffsetOutOfRange,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

pub fn manifest_for_file(
    dataset_id: impl Into<String>,
    source: &Path,
    chunk_bytes: u64,
) -> Result<DatasetStreamManifest, DatasetStreamError> {
    validate_chunk_len(chunk_bytes)?;
    let total_bytes = source.metadata()?.len();
    let chunks = total_bytes.div_ceil(chunk_bytes);
    Ok(DatasetStreamManifest {
        dataset_id: dataset_id.into(),
        total_bytes,
        chunk_bytes,
        chunks,
        redacted_source: redact_project_path(source),
    })
}

pub fn read_chunk(
    source: &Path,
    request: ChunkRequest,
) -> Result<DatasetChunk, DatasetStreamError> {
    validate_chunk_len(request.length)?;
    let mut file = File::open(source)?;
    let total = file.metadata()?.len();
    if request.offset >= total {
        return Err(DatasetStreamError::OffsetOutOfRange);
    }
    let length = request.length.min(total - request.offset);
    file.seek(SeekFrom::Start(request.offset))?;
    let mut bytes = vec![0; length as usize];
    file.read_exact(&mut bytes)?;
    let sha256 = format!("{:x}", Sha256::digest(&bytes));
    Ok(DatasetChunk {
        offset: request.offset,
        length,
        sha256,
        bytes,
    })
}

fn validate_chunk_len(length: u64) -> Result<(), DatasetStreamError> {
    if length == 0 || length > MAX_CHUNK_BYTES {
        return Err(DatasetStreamError::InvalidChunkLength);
    }
    Ok(())
}

pub fn redact_project_path(path: &Path) -> String {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("dataset.bin");
    format!("<PROJECT>/{file_name}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn streams_range_without_leaking_absolute_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("episodes.parquet");
        let mut file = File::create(&path).unwrap();
        file.write_all(b"abcdefghijklmnopqrstuvwxyz").unwrap();

        let manifest = manifest_for_file("dataset-a", &path, 10).unwrap();
        assert_eq!(manifest.chunks, 3);
        assert_eq!(manifest.redacted_source, "<PROJECT>/episodes.parquet");

        let chunk = read_chunk(
            &path,
            ChunkRequest {
                offset: 10,
                length: 8,
            },
        )
        .unwrap();
        assert_eq!(chunk.bytes, b"klmnopqr");
        assert_eq!(chunk.length, 8);
    }

    #[test]
    fn manifests_and_reads_sparse_multi_gib_dataset_without_loading_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("large-robotics-dataset.bin");
        let mut file = File::create(&path).unwrap();
        file.set_len(5 * 1024 * 1024 * 1024).unwrap();
        file.seek(SeekFrom::Start((5 * 1024 * 1024 * 1024) - 4))
            .unwrap();
        file.write_all(b"tail").unwrap();

        let manifest = manifest_for_file("dataset-large", &path, DEFAULT_CHUNK_BYTES).unwrap();
        assert_eq!(manifest.total_bytes, 5 * 1024 * 1024 * 1024);
        assert_eq!(manifest.chunks, 640);
        assert_eq!(
            manifest.redacted_source,
            "<PROJECT>/large-robotics-dataset.bin"
        );

        let chunk = read_chunk(
            &path,
            ChunkRequest {
                offset: (5 * 1024 * 1024 * 1024) - 4,
                length: 4,
            },
        )
        .unwrap();
        assert_eq!(chunk.bytes, b"tail");
        assert_eq!(chunk.length, 4);
    }
}
