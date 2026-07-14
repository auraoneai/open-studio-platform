#!/usr/bin/env bash
set -euo pipefail

manifest="${1:-.open-studio-platform-sync.json}"
required_version="${OPEN_STUDIO_PLATFORM_VERSION:-0.3.0}"
max_age_days="${OPEN_STUDIO_PLATFORM_SYNC_MAX_AGE_DAYS:-7}"

if [[ ! -f "$manifest" ]]; then
  echo "missing platform sync manifest: $manifest" >&2
  exit 10
fi

platform_version="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["platform_version"])' "$manifest")"
synced_at="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["synced_at"])' "$manifest")"

if [[ "$platform_version" != "$required_version" ]]; then
  echo "platform sync version $platform_version does not match required $required_version" >&2
  exit 11
fi

python3 - "$synced_at" "$max_age_days" <<'PY'
from datetime import datetime, timezone
import sys

synced_at = datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00"))
max_age_days = int(sys.argv[2])
age = datetime.now(timezone.utc) - synced_at
if age.days > max_age_days:
    print(f"platform template sync is {age.days} days old; max is {max_age_days}", file=sys.stderr)
    raise SystemExit(12)
PY

echo "platform template sync manifest is current for $platform_version"
