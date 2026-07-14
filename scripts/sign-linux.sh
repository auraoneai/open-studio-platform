#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: sign-linux.sh <artifact> [artifact...]

Creates armored detached GPG signatures and per-artifact SHA-256 files for Linux
release artifacts. Required:
  AURAONE_GPG_KEY_ID

Optional:
  AURAONE_GPG_HOMEDIR
  AURAONE_DRY_RUN=1
USAGE
}

die() {
  printf 'sign-linux: %s\n' "$1" >&2
  exit 1
}

[[ $# -gt 0 ]] || { usage >&2; exit 2; }
key_id="${AURAONE_GPG_KEY_ID:-}"
[[ -n "$key_id" ]] || die "AURAONE_GPG_KEY_ID is required"

gpg_args=(--batch --yes --local-user "$key_id")
if [[ -n "${AURAONE_GPG_HOMEDIR:-}" ]]; then
  gpg_args=(--homedir "$AURAONE_GPG_HOMEDIR" "${gpg_args[@]}")
fi

if [[ "${AURAONE_DRY_RUN:-0}" != "1" ]]; then
  command -v gpg >/dev/null 2>&1 || die "missing required command: gpg"
fi

for artifact in "$@"; do
  [[ -f "$artifact" ]] || die "artifact does not exist: $artifact"
  if [[ "${AURAONE_DRY_RUN:-0}" == "1" ]]; then
    printf 'DRY RUN: gpg --armor --detach-sign %s\n' "$artifact"
    continue
  fi
  gpg "${gpg_args[@]}" --armor --detach-sign --output "${artifact}.asc" "$artifact"
  shasum -a 256 "$artifact" > "${artifact}.sha256"
  fingerprint="$(gpg "${gpg_args[@]}" --with-colons --fingerprint "$key_id" | awk -F: '/^fpr:/ {print $10; exit}')"
  printf 'Signed Linux artifact: %s\n' "$artifact"
  printf 'GPG fingerprint: %s\n' "$fingerprint"
done
