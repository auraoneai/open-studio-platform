#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: generate-checksums.sh <artifact-directory>

Writes SHA256SUMS for release artifacts and signs it when AURAONE_GPG_KEY_ID is
set. Existing .asc, .sig, and SHA256SUMS files are excluded.

Optional:
  AURAONE_GPG_KEY_ID
  AURAONE_GPG_HOMEDIR
  AURAONE_DRY_RUN=1
USAGE
}

die() {
  printf 'generate-checksums: %s\n' "$1" >&2
  exit 1
}

[[ $# -eq 1 ]] || { usage >&2; exit 2; }
artifact_dir="$1"
[[ -d "$artifact_dir" ]] || die "artifact directory does not exist: $artifact_dir"

if [[ "${AURAONE_DRY_RUN:-0}" == "1" ]]; then
  printf 'DRY RUN: generate %s/SHA256SUMS\n' "$artifact_dir"
  exit 0
fi

checksum_file="$artifact_dir/SHA256SUMS"
(
  cd "$artifact_dir"
  find . -maxdepth 1 -type f \
    ! -name 'SHA256SUMS' \
    ! -name 'SHA256SUMS.asc' \
    ! -name '*.asc' \
    ! -name '*.sig' \
    -print0 |
    sort -z |
    xargs -0 shasum -a 256 |
    sed 's#  ./#  #'
) > "$checksum_file"

printf 'Wrote %s\n' "$checksum_file"

if [[ -n "${AURAONE_GPG_KEY_ID:-}" ]]; then
  gpg_args=(--batch --yes --local-user "$AURAONE_GPG_KEY_ID")
  if [[ -n "${AURAONE_GPG_HOMEDIR:-}" ]]; then
    gpg_args=(--homedir "$AURAONE_GPG_HOMEDIR" "${gpg_args[@]}")
  fi
  gpg "${gpg_args[@]}" --armor --detach-sign --output "${checksum_file}.asc" "$checksum_file"
  fingerprint="$(gpg "${gpg_args[@]}" --with-colons --fingerprint "$AURAONE_GPG_KEY_ID" | awk -F: '/^fpr:/ {print $10; exit}')"
  printf 'Signed SHA256SUMS.asc with fingerprint: %s\n' "$fingerprint"
fi
