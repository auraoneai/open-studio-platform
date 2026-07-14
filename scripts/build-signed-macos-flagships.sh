#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: build-signed-macos-flagships.sh [rubric|robotics|agent|all...]

Builds macOS app and DMG bundles for the Open Studio flagships using the shared
Apple Developer ID identity. Required locally or in CI:
  APPLE_SIGNING_IDENTITY or AURAONE_MACOS_SIGNING_IDENTITY

Defaults on this machine:
  Developer ID Application: Gurbaksh Chahal (6T44QQW78K)

Optional:
  AURAONE_MACOS_BUNDLES="app,dmg"
  AURAONE_MACOS_TARGET="universal-apple-darwin"
  AURAONE_MACOS_CREATE_UPDATER_ARTIFACTS="true" (requires TAURI_SIGNING_PRIVATE_KEY)

Local offline DMG builds default to updater artifacts disabled. Release CI must
enable updater artifacts explicitly and provide the protected signing key.
USAGE
}

die() {
  printf 'build-signed-macos: %s\n' "$1" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
identity="${APPLE_SIGNING_IDENTITY:-${AURAONE_MACOS_SIGNING_IDENTITY:-Developer ID Application: Gurbaksh Chahal (6T44QQW78K)}}"
bundles="${AURAONE_MACOS_BUNDLES:-app,dmg}"
target="${AURAONE_MACOS_TARGET:-}"
create_updater_artifacts="${AURAONE_MACOS_CREATE_UPDATER_ARTIFACTS:-false}"

case "$create_updater_artifacts" in
  true)
    [[ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]] ||
      die "TAURI_SIGNING_PRIVATE_KEY is required when updater artifacts are enabled"
    ;;
  false) ;;
  *) die "AURAONE_MACOS_CREATE_UPDATER_ARTIFACTS must be true or false" ;;
esac

export APPLE_SIGNING_IDENTITY="$identity"
export AURAONE_MACOS_SIGNING_IDENTITY="$identity"
export APPLE_TEAM_ID="${APPLE_TEAM_ID:-6T44QQW78K}"
export CI="${CI:-true}"

command -v pnpm >/dev/null 2>&1 || die "missing required command: pnpm"
command -v codesign >/dev/null 2>&1 || die "missing required command: codesign"
security find-identity -v -p codesigning | grep -F "$identity" >/dev/null || die "signing identity not found in keychain: $identity"

run_tauri_build() {
  local app_dir="$1"
  local config_arg="$2"
  local features="${3:-}"
  local -a args=(build --bundles "$bundles" --ci)
  if [[ -n "$target" ]]; then
    args+=(--target "$target")
  fi
  if [[ -n "$config_arg" ]]; then
    args+=(--config "$config_arg")
  fi
  if [[ -n "$features" ]]; then
    args+=(--features "$features")
  fi
  if [[ "$create_updater_artifacts" == "false" ]]; then
    args+=(--config '{"bundle":{"createUpdaterArtifacts":false}}')
  fi
  (cd "$repo_root/$app_dir" && pnpm exec tauri "${args[@]}")
}

verify_codesign() {
  local app_dir="$1"
  local target_dir="$repo_root/$app_dir/src-tauri/target/release/bundle"
  if [[ "$app_dir" == "opensource/agent-studio-open" ]]; then
    target_dir="$repo_root/$app_dir/desktop/src-tauri/target/release/bundle"
  fi

  local found=0
  while IFS= read -r -d '' app; do
    found=1
    codesign --verify --deep --strict --verbose=2 "$app"
    codesign -dv "$app" 2>&1 | grep -E 'Authority=Developer ID Application|TeamIdentifier=6T44QQW78K' >/dev/null
    printf 'Verified signed app: %s\n' "$app"
  done < <(find "$target_dir" -type d -name '*.app' -print0 2>/dev/null)

  while IFS= read -r -d '' dmg; do
    found=1
    codesign --verify --verbose=2 "$dmg"
    printf 'Verified signed dmg: %s\n' "$dmg"
  done < <(find "$target_dir" -type f -name '*.dmg' -print0 2>/dev/null)

  [[ "$found" == "1" ]] || die "no signed .app or .dmg artifacts found under $target_dir"
}

build_one() {
  case "$1" in
    rubric)
      run_tauri_build "opensource/rubric-studio-open" "" "tauri-runtime"
      verify_codesign "opensource/rubric-studio-open"
      ;;
    robotics)
      run_tauri_build "opensource/robotics-studio" "" "tauri-runtime"
      verify_codesign "opensource/robotics-studio"
      ;;
    agent)
      run_tauri_build "opensource/agent-studio-open" "desktop/src-tauri/tauri.conf.json"
      verify_codesign "opensource/agent-studio-open"
      ;;
    all)
      build_one rubric
      build_one robotics
      build_one agent
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown flagship: $1"
      ;;
  esac
}

if [[ $# -eq 0 ]]; then
  set -- all
fi

for flagship in "$@"; do
  build_one "$flagship"
done
