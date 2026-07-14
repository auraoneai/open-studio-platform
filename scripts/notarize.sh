#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: notarize.sh <artifact>

Submits a signed macOS .app/.dmg/.pkg/.zip to Apple notarization and staples the
ticket when supported. Use one of:
  AURAONE_NOTARY_KEYCHAIN_PROFILE
  AURAONE_NOTARY_KEY_P8 + AURAONE_NOTARY_KEY_ID + AURAONE_NOTARY_ISSUER_ID
  AURAONE_NOTARY_KEY_PATH + AURAONE_NOTARY_KEY_ID + AURAONE_NOTARY_ISSUER_ID
  AURAONE_APPLE_ID + AURAONE_APPLE_TEAM_ID + AURAONE_APPLE_APP_PASSWORD
  APPLE_API_KEY_PATH + APPLE_API_KEY + APPLE_API_ISSUER
  APPLE_ID + APPLE_TEAM_ID + APPLE_PASSWORD

Optional:
  AURAONE_DRY_RUN=1
USAGE
}

die() {
  printf 'notarize: %s\n' "$1" >&2
  exit 1
}

[[ $# -eq 1 ]] || { usage >&2; exit 2; }
artifact="$1"
[[ -e "$artifact" ]] || die "artifact does not exist: $artifact"

if [[ "${AURAONE_DRY_RUN:-0}" == "1" ]]; then
  printf 'DRY RUN: xcrun notarytool submit %s --wait\n' "$artifact"
  exit 0
fi

command -v xcrun >/dev/null 2>&1 || die "missing required command: xcrun"

auth_args=()
temporary_key_dir=""
notary_keychain_profile="${AURAONE_NOTARY_KEYCHAIN_PROFILE:-}"
notary_key_p8="${AURAONE_NOTARY_KEY_P8:-}"
notary_key_path="${AURAONE_NOTARY_KEY_PATH:-${APPLE_API_KEY_PATH:-}}"
notary_key_id="${AURAONE_NOTARY_KEY_ID:-${APPLE_API_KEY:-}}"
notary_issuer_id="${AURAONE_NOTARY_ISSUER_ID:-${APPLE_API_ISSUER:-}}"
notary_apple_id="${AURAONE_APPLE_ID:-${APPLE_ID:-}}"
notary_team_id="${AURAONE_APPLE_TEAM_ID:-${APPLE_TEAM_ID:-}}"
notary_password="${AURAONE_APPLE_APP_PASSWORD:-${APPLE_PASSWORD:-}}"

cleanup() {
  if [[ -n "$temporary_key_dir" ]]; then
    rm -rf "$temporary_key_dir"
  fi
}
trap cleanup EXIT

if [[ -n "$notary_keychain_profile" ]]; then
  auth_args=(--keychain-profile "$notary_keychain_profile")
elif [[ -n "$notary_key_p8" ]]; then
  [[ -n "$notary_key_id" ]] || die "AURAONE_NOTARY_KEY_ID or APPLE_API_KEY is required when using AURAONE_NOTARY_KEY_P8"
  [[ -n "$notary_issuer_id" ]] || die "AURAONE_NOTARY_ISSUER_ID or APPLE_API_ISSUER is required when using AURAONE_NOTARY_KEY_P8"
  temporary_key_dir="$(mktemp -d)"
  notary_key_path="$temporary_key_dir/AuthKey_${notary_key_id}.p8"
  printf '%s\n' "$notary_key_p8" > "$notary_key_path"
  chmod 600 "$notary_key_path"
  auth_args=(--key "$notary_key_path" --key-id "$notary_key_id" --issuer "$notary_issuer_id")
elif [[ -n "$notary_key_path" || -n "$notary_key_id" || -n "$notary_issuer_id" ]]; then
  [[ -n "$notary_key_path" ]] || die "AURAONE_NOTARY_KEY_PATH or APPLE_API_KEY_PATH is required when using App Store Connect API key auth"
  [[ -n "$notary_key_id" ]] || die "AURAONE_NOTARY_KEY_ID or APPLE_API_KEY is required when using App Store Connect API key auth"
  [[ -n "$notary_issuer_id" ]] || die "AURAONE_NOTARY_ISSUER_ID or APPLE_API_ISSUER is required when using App Store Connect API key auth"
  auth_args=(--key "$notary_key_path" --key-id "$notary_key_id" --issuer "$notary_issuer_id")
else
  [[ -n "$notary_apple_id" ]] || die "AURAONE_APPLE_ID or APPLE_ID is required when no keychain profile is set"
  [[ -n "$notary_team_id" ]] || die "AURAONE_APPLE_TEAM_ID or APPLE_TEAM_ID is required when no keychain profile is set"
  [[ -n "$notary_password" ]] || die "AURAONE_APPLE_APP_PASSWORD or APPLE_PASSWORD is required when no keychain profile is set"
  auth_args=(--apple-id "$notary_apple_id" --team-id "$notary_team_id" --password "$notary_password")
fi

xcrun notarytool submit "$artifact" "${auth_args[@]}" --wait

case "$artifact" in
  *.app|*.dmg|*.pkg)
    xcrun stapler staple "$artifact"
    xcrun stapler validate "$artifact"
    ;;
  *)
    printf 'Notarized artifact does not support stapling: %s\n' "$artifact"
    ;;
esac

printf 'Notarized artifact: %s\n' "$artifact"
