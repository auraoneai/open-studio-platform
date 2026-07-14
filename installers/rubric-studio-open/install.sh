#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export AURAONE_FLAGSHIP_ID="rubric-studio-open"
export AURAONE_DISPLAY_NAME="Rubric Studio Open"
export AURAONE_GITHUB_REPO="auraoneai/rubric-studio-open"
export AURAONE_BINARY_NAME="rubricstudio"
export AURAONE_MAC_APP_NAME="Rubric Studio Open.app"
export AURAONE_MAC_ARM64_ONLY="true"
export AURAONE_RELEASE_EVIDENCE_URL="${AURAONE_RELEASE_EVIDENCE_URL:-https://updates.auraone.ai/release-evidence/rubric-studio-open/stable.json}"
exec "$SCRIPT_DIR/../shared/install.sh" "$@"
