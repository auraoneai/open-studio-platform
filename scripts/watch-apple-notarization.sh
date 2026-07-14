#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: watch-apple-notarization.sh

Polls the current AuraOne Apple notary submissions and staples each DMG once
Apple reports the submission as Accepted. Required:
  APPLE_API_KEY_PATH or AURAONE_NOTARY_KEY_PATH
  APPLE_API_KEY or AURAONE_NOTARY_KEY_ID
  APPLE_API_ISSUER or AURAONE_NOTARY_ISSUER_ID

Optional:
  AURAONE_NOTARY_POLL_SECONDS=300
  AURAONE_NOTARY_MAX_MINUTES=360
USAGE
}

die() {
  printf 'watch-notarization: %s\n' "$1" >&2
  exit 1
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
poll_seconds="${AURAONE_NOTARY_POLL_SECONDS:-300}"
max_minutes="${AURAONE_NOTARY_MAX_MINUTES:-360}"
max_seconds=$((max_minutes * 60))
started_at="$(date +%s)"

notary_key_path="${AURAONE_NOTARY_KEY_PATH:-${APPLE_API_KEY_PATH:-}}"
notary_key_id="${AURAONE_NOTARY_KEY_ID:-${APPLE_API_KEY:-}}"
notary_issuer_id="${AURAONE_NOTARY_ISSUER_ID:-${APPLE_API_ISSUER:-}}"

[[ -n "$notary_key_path" ]] || die "APPLE_API_KEY_PATH or AURAONE_NOTARY_KEY_PATH is required"
[[ -n "$notary_key_id" ]] || die "APPLE_API_KEY or AURAONE_NOTARY_KEY_ID is required"
[[ -n "$notary_issuer_id" ]] || die "APPLE_API_ISSUER or AURAONE_NOTARY_ISSUER_ID is required"
[[ -f "$notary_key_path" ]] || die "notary key does not exist: $notary_key_path"

auth_args=(--key "$notary_key_path" --key-id "$notary_key_id" --issuer "$notary_issuer_id")

declare -A submissions=(
  ["Rubric Studio Open_0.1.0_aarch64.dmg"]="5d5cfc36-555e-4ab5-9b65-88f3fa37e92f"
  ["Robotics Studio Open_0.1.0_aarch64.dmg"]="5ca52d64-1255-492e-9e83-52b3eeedea23"
  ["Agent Studio Open_0.1.0_aarch64.dmg"]="a7531244-bac9-4aff-94f2-a1dd6c37f667"
)

declare -A artifacts=(
  ["Rubric Studio Open_0.1.0_aarch64.dmg"]="$repo_root/opensource/rubric-studio-open/src-tauri/target/release/bundle/dmg/Rubric Studio Open_0.1.0_aarch64.dmg"
  ["Robotics Studio Open_0.1.0_aarch64.dmg"]="$repo_root/opensource/robotics-studio/src-tauri/target/release/bundle/dmg/Robotics Studio Open_0.1.0_aarch64.dmg"
  ["Agent Studio Open_0.1.0_aarch64.dmg"]="$repo_root/opensource/agent-studio-open/desktop/src-tauri/target/release/bundle/dmg/Agent Studio Open_0.1.0_aarch64.dmg"
)

for artifact in "${artifacts[@]}"; do
  [[ -f "$artifact" ]] || die "artifact does not exist: $artifact"
done

while true; do
  remaining=0

  for name in "${!submissions[@]}"; do
    id="${submissions[$name]}"
    artifact="${artifacts[$name]}"
    info="$(xcrun notarytool info "$id" "${auth_args[@]}" --output-format json)"
    status="$(printf '%s\n' "$info" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
    printf '%s %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$name" "$status"

    case "$status" in
      Accepted)
        xcrun stapler staple "$artifact"
        xcrun stapler validate "$artifact"
        spctl -a -vvv -t install "$artifact"
        unset 'submissions[$name]'
        ;;
      Invalid|Rejected)
        xcrun notarytool log "$id" "${auth_args[@]}" --output-format json || true
        die "$name notarization failed with status $status"
        ;;
      *)
        remaining=$((remaining + 1))
        ;;
    esac
  done

  [[ "$remaining" -gt 0 ]] || break

  elapsed=$(( $(date +%s) - started_at ))
  if [[ "$elapsed" -ge "$max_seconds" ]]; then
    die "timed out after ${max_minutes}m waiting for Apple notarization"
  fi

  sleep "$poll_seconds"
done

printf 'All AuraOne macOS DMGs are notarized, stapled, and Gatekeeper-validated.\n'
