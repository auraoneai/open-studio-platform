//! Robotics-grade video decode contracts for Open Studio Platform v0.2.
//!
//! The crate keeps the public decode interface stable across Robotics Studio Open
//! while allowing platform-specific GPU implementations to live behind features
//! and sidecar binaries. The `ffmpeg` feature wires the crate to `ffmpeg-next`;
//! the default build remains portable for CI environments without system FFmpeg.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HardwareBackend {
    VideoToolbox,
    Vaapi,
    Nvdec,
    Direct3D11,
    LibavSoftware,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DecodePlan {
    pub source: PathBuf,
    pub preferred_backends: Vec<HardwareBackend>,
    pub fallback: HardwareBackend,
    pub max_decode_surfaces: u8,
}

impl DecodePlan {
    pub fn for_host(source: impl Into<PathBuf>) -> Self {
        let mut preferred_backends = Vec::new();
        if cfg!(target_os = "macos") {
            preferred_backends.push(HardwareBackend::VideoToolbox);
        }
        if cfg!(target_os = "linux") {
            preferred_backends.push(HardwareBackend::Vaapi);
            preferred_backends.push(HardwareBackend::Nvdec);
        }
        if cfg!(target_os = "windows") {
            preferred_backends.push(HardwareBackend::Direct3D11);
        }
        preferred_backends.push(HardwareBackend::LibavSoftware);

        Self {
            source: source.into(),
            preferred_backends,
            fallback: HardwareBackend::LibavSoftware,
            max_decode_surfaces: 8,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PixelFormat {
    Rgba8,
    Bgra8,
    Nv12,
    Yuv420p,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct FrameRequest {
    pub timestamp_ms: u64,
    pub stream_index: usize,
    pub max_width: Option<u32>,
    pub max_height: Option<u32>,
    pub format: PixelFormat,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DecodedFrame {
    pub timestamp_ms: u64,
    pub width: u32,
    pub height: u32,
    pub format: PixelFormat,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Error)]
pub enum VideoError {
    #[error("video source does not exist: {0}")]
    SourceMissing(PathBuf),
    #[error("requested frame dimensions are invalid")]
    InvalidDimensions,
    #[error("decode backend unavailable: {0:?}")]
    BackendUnavailable(HardwareBackend),
}

pub trait VideoDecoder: Send {
    fn backend(&self) -> HardwareBackend;
    fn decode_frame(&mut self, request: FrameRequest) -> Result<DecodedFrame, VideoError>;
}

pub fn validate_decode_plan(plan: &DecodePlan) -> Result<(), VideoError> {
    if !Path::new(&plan.source).exists() {
        return Err(VideoError::SourceMissing(plan.source.clone()));
    }
    if plan.max_decode_surfaces == 0 {
        return Err(VideoError::InvalidDimensions);
    }
    Ok(())
}

pub fn expected_rgba_len(width: u32, height: u32) -> Result<usize, VideoError> {
    if width == 0 || height == 0 {
        return Err(VideoError::InvalidDimensions);
    }
    Ok(width as usize * height as usize * 4)
}

pub fn host_hardware_backend() -> Option<HardwareBackend> {
    if cfg!(target_os = "macos") {
        Some(HardwareBackend::VideoToolbox)
    } else if cfg!(target_os = "linux") {
        Some(HardwareBackend::Vaapi)
    } else if cfg!(target_os = "windows") {
        Some(HardwareBackend::Direct3D11)
    } else {
        None
    }
}

pub fn backend_from_name(name: &str) -> Option<HardwareBackend> {
    match name.to_ascii_lowercase().as_str() {
        "videotoolbox" | "video-toolbox" => Some(HardwareBackend::VideoToolbox),
        "vaapi" => Some(HardwareBackend::Vaapi),
        "nvdec" => Some(HardwareBackend::Nvdec),
        "direct3d11" | "direct3d" | "d3d11" => Some(HardwareBackend::Direct3D11),
        "software" | "libav" | "libavsoftware" => Some(HardwareBackend::LibavSoftware),
        _ => None,
    }
}

#[cfg(feature = "ffmpeg")]
pub fn ffmpeg_linked_version() -> &'static str {
    ffmpeg_next::version::version()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_plan_always_has_software_fallback() {
        let plan = DecodePlan::for_host("episode.mp4");
        assert!(plan
            .preferred_backends
            .contains(&HardwareBackend::LibavSoftware));
        assert_eq!(plan.fallback, HardwareBackend::LibavSoftware);
    }

    #[test]
    fn host_plan_prefers_current_os_hardware_backend() {
        let plan = DecodePlan::for_host("episode.mp4");

        if let Some(backend) = host_hardware_backend() {
            assert_eq!(plan.preferred_backends[0], backend);
        }
    }

    #[test]
    fn backend_names_match_ci_fixture_matrix() {
        assert_eq!(
            backend_from_name("videotoolbox"),
            Some(HardwareBackend::VideoToolbox)
        );
        assert_eq!(backend_from_name("vaapi"), Some(HardwareBackend::Vaapi));
        assert_eq!(backend_from_name("nvdec"), Some(HardwareBackend::Nvdec));
        assert_eq!(
            backend_from_name("direct3d11"),
            Some(HardwareBackend::Direct3D11)
        );
        assert_eq!(backend_from_name("unknown"), None);
    }

    #[test]
    fn validates_frame_size() {
        assert_eq!(expected_rgba_len(640, 480).unwrap(), 1_228_800);
        assert!(matches!(
            expected_rgba_len(0, 480),
            Err(VideoError::InvalidDimensions)
        ));
    }

    #[test]
    #[ignore = "requires a hardware-backed video fixture mounted on the runner"]
    fn gpu_decode_fixture_contract() {
        assert_eq!(
            std::env::var("AURAONE_RUN_GPU_DECODE_SMOKE").as_deref(),
            Ok("1"),
            "set AURAONE_RUN_GPU_DECODE_SMOKE=1 to run GPU fixture smoke tests"
        );

        let fixture = std::env::var("AURAONE_GPU_FIXTURE")
            .expect("AURAONE_GPU_FIXTURE must point at the mounted video fixture");
        let backend_name = std::env::var("AURAONE_GPU_BACKEND")
            .expect("AURAONE_GPU_BACKEND must name the expected hardware backend");
        let backend = backend_from_name(&backend_name).expect("unknown AURAONE_GPU_BACKEND");
        let plan = DecodePlan::for_host(&fixture);

        validate_decode_plan(&plan).unwrap();
        assert!(
            plan.preferred_backends.contains(&backend),
            "host plan {:?} does not include requested backend {:?}",
            plan.preferred_backends,
            backend
        );

        #[cfg(feature = "ffmpeg")]
        assert!(!ffmpeg_linked_version().is_empty());
    }
}
