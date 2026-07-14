const FLAGSHIPS = {
  "rubric-studio-open": {
    displayName: "Rubric Studio Open",
    repo: "auraoneai/rubric-studio-open",
    binary: "rubricstudio",
    app: "Rubric Studio Open.app",
    artifactPrefix: "Rubric.Studio.Open",
    macArtifactTemplate: "Rubric.Studio.Open_${VERSION}_aarch64.dmg",
    macArm64Only: true
  },
  "robotics-studio-open": {
    displayName: "Robotics Studio Open",
    repo: "auraoneai/robotics-studio-open",
    binary: "robostudio",
    app: "Robotics Studio Open.app",
    artifactPrefix: "Robotics.Studio.Open",
    macArtifactTemplate: "Robotics.Studio.Open_${VERSION}_aarch64.dmg",
    docsPath: "robotics-studio",
    macosOnly: true,
    macArm64Only: true
  },
  "agent-studio-open": {
    displayName: "Agent Studio Open",
    repo: "auraoneai/agent-studio-open",
    binary: "agentstudio",
    app: "Agent Studio Open.app",
    artifactPrefix: "Agent.Studio.Open",
    macArtifactTemplate: "Agent.Studio.Open_${VERSION}_aarch64.dmg",
    linuxArtifactTemplate: "Agent.Studio.Open_${VERSION}_${LINUX_ARCH}.AppImage",
    windowsArtifactTemplate: "Agent.Studio.Open_${VERSION}_${ARCH}_en-US.msi",
    macArm64Only: true
  }
};

const FLAGSHIP_ALIASES = {
  "robotics-studio": "robotics-studio-open"
};

const FALLBACK_INSTALL_SIGNATURES = {
  "rubric-studio-open.sh.asc": `-----BEGIN PGP SIGNATURE-----

iQIzBAABCAAdFiEE+QmAbRPZzUz0A/o8jGHhd+tjKecFAmoNtjoACgkQjGHhd+tj
KefBtA//UkIpgZ5FekVcgXTvBj1eg3stnVVrrtmB9O5NY30ktACDC6Xxyv2MBz5z
U3lBvP6aft5uuKAO1MqaHH5H8kdg2CM1mGsu9oM1QqxM5KMOmxEien4K0rzem7Ah
K09bZ7wMHzmKpzqgaSHjN/j9U/gsMWUHkCBGmpGHD3wf/PMUr4Gj70O3lTgahpPL
ej12baBrF4LPqiC8K8xVsEaD+JVBeheDc55ZF2WNTMNesV68NxCQR+HBWEGKC2ei
tqBP0aUTNPQYVMpO4ub03UIBvDBJvvDEuL16E275etddbs/OhLDzGYUbM4htHsaD
Jb57YoxZB67yR2Cn16hD6jjvfwWPjJaDA5I+hHifdXuckqIDUpurxEeyvQJehZV/
/MoigcphaaF0MOThjS+qVowdHCyPzn3jPX0Ky5As0ejfmnRiEYICELJwf8IlqKkm
qNVNVAJ5BYvat+MNd+v3P+AR+FNxy3CSvB2f6D6Gn8Kdm5SwnDkRe2uTiF4Kgenu
ZVPqCB0EPj4AMgg3ZT49XB0AQRGIUZn0STNg9Yrc6B79mbFqKOSbRqU+kqphMnlr
BLhpgVtuOC1fur30XL5gLBAt8bxwPazAFHqMheYUmwGcG6SpuYqmwYQFX0HVGR7d
OZVKWOiXUJ8/jvl2ijRQAIOCsU/Zx2qAG56Zef0E/USs5rkTNqQ=
=LE1v
-----END PGP SIGNATURE-----`,
  "robotics-studio-open.sh.asc": `-----BEGIN PGP SIGNATURE-----

iQIzBAABCAAdFiEE+QmAbRPZzUz0A/o8jGHhd+tjKecFAmoNtjsACgkQjGHhd+tj
KedDvQ//f8p6n8GuLLfEvJswBPADhKprl5/EYjc4nx9uTLamnKJUR5raKGRjYXts
e9v991aC1n8smTXZWiA+FElldslnG/3QJP51P+HmJgHU4LAA+Uez9CpJuOOjPYas
dyG9kCQzfUOSBh9F5wuqRMqstOc3DVGQ9fB4zFOXFZWff4L0c169tJY1lYEZ9nBE
r4c6XyH6frkvbn4C074xMaDDh3/RnDYclwENSrM25xEdUDDpwOOL31kXQbsVFLzO
i0gBRWH1LvwE08GNtWyTIYOx+BILzzGdmOR2ixH0gTyGX0ZBxCQ0SJpqlnWDgwqw
nHaWiO8GJPrGqerKMS/MO4CP/7QDOnsevIRYsyhEJTzBTYdZZEgtX6NEcroO3jnN
i2+GzKafHWTMI7orwTKgCWl25dViKnqBv5sXVlGQs88PEvq9OsKpoaJZ52j52eZk
0R44J78/rGx7TZmBxNfEUQ9sjh2PDsml+RAy/q9nNfyNSXujaI5d0kWcQyT+vgRc
5S7rsgkIeSv8PRvB7YzzmUimvinAoojdtdj1bfVMs89fOSX9aW6mBJR2jpXIB7yF
02THbJZnLg3O34Qbbk6M74s+wZRnKmcVa/WvyceMAfAOwe4ToQBnXoK8CRl2V6MO
spWM5CcU0gWHMJ8hApoLzyfQG83ZUbIjfF01z6a2uZ1FLSsl++o=
=8uUc
-----END PGP SIGNATURE-----`,
  "agent-studio-open.sh.asc": `-----BEGIN PGP SIGNATURE-----

iQIzBAABCAAdFiEE+QmAbRPZzUz0A/o8jGHhd+tjKecFAmoNtjsACgkQjGHhd+tj
KeelJw/9GKhIH0HfL5+JseZltVAhOBzPDh+v7buIJOCntUI6vO5wf6KmtQnHtcyq
iyngJw+6H9eGJBgJ9Pp9zTQaaIKD9hP7HVExN1zWNgmhyHxZ0TAGlwNzYTeT/5Vv
gnSB7SLO8EQVjZbpzydK+w3BqhVn7XCdKGXb/C1g4GIAE4bYY4taYcTBczRHseyw
NNabWPTEi/z4CLWysqw3noYaBrNa9WfenB1L+FkMUziZjADqLTu+Y1SFdnFPOjxA
ER9ckQJKjwzUrKvhFYyScMhBiMPfelF2GyNsX5W6mG7rI77NxTXH/i5ZujpLI6XP
0IT/RlW7rPza0R1GAnBkzrIgBJf986RV1YHkozuFWCPr/JHf+Y7eqAbrnLAdy2tv
NvQ8qEhLK13liBz5IH9cLYbIeNPMF8zYQHkwmffp1oVteIxK7VbB/X+ES4B4y/1b
3CCbUQcVyIQhzScInjE0Hx3j3PclHpeVcdqSgScxPelse49l8RC0JaUowmEPtUIO
UkGJZfqptVQlhyg004D2eQfohCMq4zmEH9wXmqL0+TGWZDAHFcnLkbobrKDWPZSF
co8kSxLgvPcmO5gSP+27NVy3R2Jlu2bcth7fADDaD2Kmqsz+mHeEOePAi8ZQ/oW6
T0ipKGiyILi2t+vrA1cDjMJ5j4cWSX5CEBLUvXBDDO2ekVGtSvU=
=pOnK
-----END PGP SIGNATURE-----`
};

function text(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": init.cacheControl || "public, max-age=300",
      ...(init.headers || {})
    }
  });
}

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export function renderShellInstallScript(flagshipId, options = {}) {
  const cfg = FLAGSHIPS[flagshipId];
  if (!cfg) throw new Error(`unknown flagship: ${flagshipId}`);
  const fingerprint = options.gpgFingerprint || "F909806D13D9CD4CF403FA3C8C61E177EB6329E7";
  return `#!/usr/bin/env bash
set -euo pipefail

FLAGSHIP="${flagshipId}"
DISPLAY_NAME="${cfg.displayName}"
REPO="${cfg.repo}"
BINARY_NAME="${cfg.binary}"
APP_NAME="${cfg.app}"
ARTIFACT_PREFIX="${cfg.artifactPrefix}"
EXPECTED_GPG_FINGERPRINT="${fingerprint}"
RELEASE_GPG_KEY_URL="\${AURAONE_RELEASE_GPG_KEY_URL:-https://updates.auraone.ai/keys/auraone-open.gpg}"
DOCS_PATH="${cfg.docsPath || flagshipId}"

die() { printf '%s installer: %s\\n' "$DISPLAY_NAME" "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

ensure_release_gpg_key() {
  [[ "$EXPECTED_GPG_FINGERPRINT" == BLOCKED-* ]] && return 0
  if gpg --batch --fingerprint --with-colons "$EXPECTED_GPG_FINGERPRINT" 2>/dev/null \\
    | awk -F: -v expected="$EXPECTED_GPG_FINGERPRINT" '$1 == "fpr" && $10 == expected { found = 1 } END { exit found ? 0 : 1 }'; then
    return 0
  fi

  curl -fsSLo "$TMPDIR/auraone-open.gpg" "$RELEASE_GPG_KEY_URL"
  gpg --batch --show-keys --with-colons "$TMPDIR/auraone-open.gpg" 2>/dev/null \\
    | awk -F: -v expected="$EXPECTED_GPG_FINGERPRINT" '$1 == "fpr" && $10 == expected { found = 1 } END { exit found ? 0 : 1 }' \\
    || die "release signing key fingerprint mismatch"
  gpg --batch --import "$TMPDIR/auraone-open.gpg" >/dev/null 2>&1 \\
    || die "could not import AuraOne Open release signing key"
}

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) AURA_ARCH="x64"; LINUX_ARCH="amd64" ;;
  arm64|aarch64) AURA_ARCH="arm64"; LINUX_ARCH="arm64" ;;
  *) die "unsupported architecture: $ARCH" ;;
esac

case "$OS" in
  darwin) PLATFORM="macos" ;;
  linux) PLATFORM="linux" ;;
  *) die "unsupported operating system for this script: $OS" ;;
esac
${cfg.macArm64Only ? `if [[ "$PLATFORM" == "macos" ]]; then
  [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]] || die "this release channel publishes Apple Silicon macOS builds only"
fi` : ""}
${cfg.macosOnly ? `[[ "$OS" == "darwin" ]] || die "this release channel publishes macOS builds only"` : ""}

need curl
need shasum
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

LATEST_URL="https://api.github.com/repos/$REPO/releases/latest"
TAG="$(curl -fsSL "$LATEST_URL" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' | head -n 1)"
[[ -n "$TAG" ]] || die "could not resolve latest release tag"
VERSION="\${TAG#v}"
BASE_URL="https://github.com/$REPO/releases/download/$TAG"

if [[ "$PLATFORM" == "macos" ]]; then
  ARTIFACT="${cfg.macArtifactTemplate || "${ARTIFACT_PREFIX}_${VERSION}_universal.dmg"}"
else
  ARTIFACT="${cfg.linuxArtifactTemplate || "${FLAGSHIP}_${VERSION}_${LINUX_ARCH}.AppImage"}"
fi

curl -fsSLo "$TMPDIR/$ARTIFACT" "$BASE_URL/$ARTIFACT"
curl -fsSLo "$TMPDIR/SHA256SUMS" "$BASE_URL/SHA256SUMS"

(
  cd "$TMPDIR"
  grep "  $ARTIFACT$" SHA256SUMS | shasum -a 256 -c -
)

if curl -fsLo "$TMPDIR/SHA256SUMS.asc" "$BASE_URL/SHA256SUMS.asc" 2>/dev/null; then
  need gpg
  ensure_release_gpg_key
  gpg --batch --verify "$TMPDIR/SHA256SUMS.asc" "$TMPDIR/SHA256SUMS"
  ACTUAL_FINGERPRINT="$(gpg --batch --status-fd 1 --verify "$TMPDIR/SHA256SUMS.asc" "$TMPDIR/SHA256SUMS" 2>/dev/null | awk '/^\\[GNUPG:\\] VALIDSIG / {print $3; exit}')"
  [[ -n "$ACTUAL_FINGERPRINT" ]] || die "could not read release signing fingerprint"
  if [[ "$EXPECTED_GPG_FINGERPRINT" != BLOCKED-* && "$ACTUAL_FINGERPRINT" != "$EXPECTED_GPG_FINGERPRINT" ]]; then
    die "release signing fingerprint mismatch: $ACTUAL_FINGERPRINT"
  fi
else
  ACTUAL_FINGERPRINT="not-provided"
fi

if [[ "$PLATFORM" == "macos" ]]; then
  need hdiutil
  need spctl
  spctl -a -t open --context context:primary-signature -v "$TMPDIR/$ARTIFACT"
  MOUNT_DIR="$TMPDIR/mount"
  mkdir -p "$MOUNT_DIR"
  hdiutil attach "$TMPDIR/$ARTIFACT" -mountpoint "$MOUNT_DIR" -nobrowse -quiet
  trap 'hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 || true; rm -rf "$TMPDIR"' EXIT
  cp -R "$MOUNT_DIR/$APP_NAME" "$HOME/Applications/" 2>/dev/null || {
    mkdir -p "$HOME/Applications"
    cp -R "$MOUNT_DIR/$APP_NAME" "$HOME/Applications/"
  }
  hdiutil detach "$MOUNT_DIR" -quiet
  printf '%s installed to %s\\n' "$DISPLAY_NAME" "$HOME/Applications/$APP_NAME"
else
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  install -m 0755 "$TMPDIR/$ARTIFACT" "$install_dir/$BINARY_NAME"
  printf '%s installed to %s\\n' "$DISPLAY_NAME" "$install_dir/$BINARY_NAME"
fi

printf 'Verified artifact SHA-256. Verified SHA256SUMS signature fingerprint: %s\\n' "$ACTUAL_FINGERPRINT"
printf 'Docs: https://auraone.ai/open/%s\\n' "$DOCS_PATH"
`;
}

export function renderPowerShellInstallScript(flagshipId, options = {}) {
  const cfg = FLAGSHIPS[flagshipId];
  if (!cfg) throw new Error(`unknown flagship: ${flagshipId}`);
  const publisherThumbprint = options.windowsPublisherThumbprint || "BLOCKED-2026-05-13-AURAONE-WINDOWS-EV-CERT-THUMBPRINT";
  return `param(
  [string]$InstallScope = "CurrentUser"
)
$ErrorActionPreference = "Stop"
$Flagship = "${flagshipId}"
$DisplayName = "${cfg.displayName}"
$Repo = "${cfg.repo}"
$ArtifactPrefix = "${cfg.artifactPrefix}"
$ArtifactTemplate = "${cfg.windowsArtifactTemplate || "${ARTIFACT_PREFIX}_${VERSION}_${ARCH}_en-US.msi"}"
$ExpectedPublisherThumbprint = "${publisherThumbprint}"

function Fail($Message) { Write-Error "$DisplayName installer: $Message"; exit 1 }

$Arch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq "Arm64") { "arm64" } else { "x64" }
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Tag = $Release.tag_name
if (-not $Tag) { Fail "could not resolve latest release tag" }
$Version = $Tag.TrimStart("v")
$Artifact = $ExecutionContext.InvokeCommand.ExpandString($ArtifactTemplate)
$BaseUrl = "https://github.com/$Repo/releases/download/$Tag"
$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
  $Msi = Join-Path $Tmp $Artifact
  $Sums = Join-Path $Tmp "SHA256SUMS"
  Invoke-WebRequest -Uri "$BaseUrl/$Artifact" -OutFile $Msi
  Invoke-WebRequest -Uri "$BaseUrl/SHA256SUMS" -OutFile $Sums
  $Expected = (Select-String -Path $Sums -Pattern "  $([regex]::Escape($Artifact))$").Line.Split(" ")[0].ToUpperInvariant()
  $Actual = (Get-FileHash -Algorithm SHA256 -Path $Msi).Hash.ToUpperInvariant()
  if ($Expected -ne $Actual) { Fail "SHA256 mismatch: $Actual" }
  $Signature = Get-AuthenticodeSignature -FilePath $Msi
  if ($Signature.Status -eq "Valid") {
    $Thumbprint = $Signature.SignerCertificate.Thumbprint
    if (-not $ExpectedPublisherThumbprint.StartsWith("BLOCKED-") -and $Thumbprint -ne $ExpectedPublisherThumbprint) {
      Fail "publisher thumbprint mismatch: $Thumbprint"
    }
  } elseif (-not $ExpectedPublisherThumbprint.StartsWith("BLOCKED-")) {
    Fail "Authenticode signature is not valid: $($Signature.Status)"
  } else {
    $Thumbprint = "not-provided"
  }
  Start-Process msiexec.exe -Wait -ArgumentList @("/i", $Msi, "/qn")
  Write-Host "$DisplayName installed."
  Write-Host "Verified publisher certificate thumbprint: $Thumbprint"
  Write-Host "Docs: https://auraone.ai/open/$Flagship/docs/install"
} finally {
  Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
}
`;
}

export async function handleInstallRequest(request, env = {}) {
  const url = new URL(request.url);
  if (url.pathname === "/healthz") return json({ ok: true, service: "auraone-open-install-server" });
  const parts = url.pathname.split("/").filter(Boolean);
  const requestedSlug = parts[0]?.replace(/\.sh$|\.ps1$|\.asc$/g, "");
  const slug = FLAGSHIP_ALIASES[requestedSlug] || requestedSlug;
  if (!slug || !FLAGSHIPS[slug]) {
    return json({ error_code: "not_found", error_message: "unknown flagship" }, { status: 404 });
  }

  if (url.pathname.endsWith(".asc")) {
    const signatureKey = `${slug}.sh.asc`;
    const signature =
      (await env.INSTALL_SIGNATURES?.get?.(signatureKey)) ||
      FALLBACK_INSTALL_SIGNATURES[signatureKey];
    if (!signature) return json({ error_code: "signature_not_provisioned", error_message: "install script signature has not been provisioned" }, { status: 503 });
    return text(signature, { headers: { "content-type": "application/pgp-signature" } });
  }

  const opts = {
    gpgFingerprint: env.AURAONE_RELEASE_GPG_FINGERPRINT,
    windowsPublisherThumbprint: env.AURAONE_WINDOWS_PUBLISHER_THUMBPRINT
  };
  if (url.pathname.endsWith(".ps1") || url.searchParams.get("format") === "powershell") {
    return text(renderPowerShellInstallScript(slug, opts), {
      headers: { "content-disposition": `inline; filename="${slug}.ps1"` }
    });
  }
  return text(renderShellInstallScript(slug, opts), {
    headers: { "content-disposition": `inline; filename="${slug}.sh"` }
  });
}

export default {
  fetch(request, env) {
    return handleInstallRequest(request, env);
  }
};
