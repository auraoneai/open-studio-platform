#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: publish-release.sh --repo owner/name --tag vX.Y.Z --artifacts-dir dir --release-evidence path [options]

Options:
  --title text
  --notes-file path
  --release-evidence path
  --r2-bucket bucket-name
  --r2-prefix prefix

Publishes artifacts to GitHub Releases and, when wrangler is configured, mirrors
them to Cloudflare R2 for updates.auraone.ai. Secrets are read only through gh
and wrangler environment/configuration and are never printed. Publication is
refused unless canonical release evidence passes publishable mode. Existing
release assets are never overwritten.
USAGE
}

die() {
  printf 'publish-release: %s\n' "$1" >&2
  exit 1
}

repo=""
tag=""
title=""
notes_file=""
artifacts_dir=""
release_evidence=""
r2_bucket="${AURAONE_R2_BUCKET:-}"
r2_prefix="${AURAONE_R2_PREFIX:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) repo="$2"; shift 2 ;;
    --tag) tag="$2"; shift 2 ;;
    --title) title="$2"; shift 2 ;;
    --notes-file) notes_file="$2"; shift 2 ;;
    --artifacts-dir) artifacts_dir="$2"; shift 2 ;;
    --release-evidence) release_evidence="$2"; shift 2 ;;
    --r2-bucket) r2_bucket="$2"; shift 2 ;;
    --r2-prefix) r2_prefix="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ -n "$repo" ]] || die "--repo is required"
[[ -n "$tag" ]] || die "--tag is required"
[[ -n "$artifacts_dir" ]] || die "--artifacts-dir is required"
[[ -d "$artifacts_dir" ]] || die "artifact directory does not exist: $artifacts_dir"
[[ -n "$release_evidence" ]] || die "--release-evidence is required"
[[ -f "$release_evidence" ]] || die "release evidence does not exist: $release_evidence"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$script_dir/verify-release-evidence.mjs" \
  --manifest "$release_evidence" \
  --publishable \
  --require-local-artifacts \
  >/dev/null || die "release evidence is not publishable"

if [[ "${AURAONE_DRY_RUN:-0}" == "1" ]]; then
  printf 'DRY RUN: publish %s to %s using %s\n' "$tag" "$repo" "$release_evidence"
  exit 0
fi

command -v gh >/dev/null 2>&1 || die "missing required command: gh"

release_args=("$tag" --repo "$repo")
[[ -n "$title" ]] && release_args+=(--title "$title")
if [[ -n "$notes_file" ]]; then
  release_args+=(--notes-file "$notes_file")
else
  release_args+=(--generate-notes)
fi

if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  printf 'GitHub Release already exists: %s %s\n' "$repo" "$tag"
else
  gh release create "${release_args[@]}"
fi

mapfile -t artifacts < <(find "$artifacts_dir" -maxdepth 1 -type f | sort)
[[ ${#artifacts[@]} -gt 0 ]] || die "no artifacts found in $artifacts_dir"
gh release upload "$tag" "${artifacts[@]}" --repo "$repo"

if [[ -n "$r2_bucket" ]]; then
  [[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || die "CLOUDFLARE_API_TOKEN is required when --r2-bucket is set"
  [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]] || die "CLOUDFLARE_ACCOUNT_ID is required when --r2-bucket is set"
  command -v wrangler >/dev/null 2>&1 || die "wrangler is required when --r2-bucket is set"
  prefix="${r2_prefix:-releases/$repo/$tag}"
  for artifact in "${artifacts[@]}"; do
    name="$(basename "$artifact")"
    wrangler r2 object put "${r2_bucket}/${prefix}/${name}" --file "$artifact"
  done
fi

printf 'Published release: %s %s\n' "$repo" "$tag"
