#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: sign-macos.sh [--entitlements path] [--deep] <artifact> [artifact...]

Signs macOS .app, .dmg, .pkg, and executable artifacts with the AuraOne
Developer ID identity. Required environment:
  AURAONE_MACOS_SIGNING_IDENTITY

Optional:
  AURAONE_DRY_RUN=1
USAGE
}

die() {
  printf 'sign-macos: %s\n' "$1" >&2
  exit 1
}

entitlements=()
deep=()
artifacts=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --entitlements)
      [[ $# -ge 2 ]] || die "--entitlements requires a path"
      entitlements=(--entitlements "$2")
      shift 2
      ;;
    --deep)
      deep=(--deep)
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      artifacts+=("$@")
      break
      ;;
    -*)
      die "unknown option: $1"
      ;;
    *)
      artifacts+=("$1")
      shift
      ;;
  esac
done

[[ ${#artifacts[@]} -gt 0 ]] || die "at least one artifact is required"
identity="${AURAONE_MACOS_SIGNING_IDENTITY:-}"
[[ -n "$identity" ]] || die "AURAONE_MACOS_SIGNING_IDENTITY is required"

if [[ "${AURAONE_DRY_RUN:-0}" != "1" ]]; then
  command -v codesign >/dev/null 2>&1 || die "missing required command: codesign"
fi

for artifact in "${artifacts[@]}"; do
  [[ -e "$artifact" ]] || die "artifact does not exist: $artifact"
  if [[ "${AURAONE_DRY_RUN:-0}" == "1" ]]; then
    printf 'DRY RUN: codesign %s\n' "$artifact"
    continue
  fi
  codesign --force --timestamp --options runtime "${deep[@]}" "${entitlements[@]}" --sign "$identity" "$artifact"
  codesign --verify --strict --verbose=2 "${deep[@]}" "$artifact"
  printf 'Signed macOS artifact: %s\n' "$artifact"
done
