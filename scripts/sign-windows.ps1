param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string[]]$ArtifactPath,
  [string]$TimestampUrl = ""
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error "sign-windows: $Message"
  exit 1
}

function Find-SignTool {
  $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
  if (Test-Path $kitsRoot) {
    $candidate = Get-ChildItem -Path $kitsRoot -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  Fail "signtool.exe was not found"
}

$thumbprint = $env:AURAONE_WINDOWS_CERT_THUMBPRINT
$pfxPath = $env:AURAONE_WINDOWS_PFX_PATH
$pfxPassword = $env:AURAONE_WINDOWS_PFX_PASSWORD
$provider = $env:AURAONE_WINDOWS_SIGNING_PROVIDER
if (-not $provider) {
  $provider = $env:WINDOWS_SIGNING_PROVIDER
}
$provider = "$provider".Trim().ToLowerInvariant()
$artifactSigningProvider = $provider -in @(
  "azure-artifact-signing",
  "artifact-signing",
  "azure-trusted-signing",
  "trusted-signing"
)
$dryRun = $env:AURAONE_DRY_RUN -eq "1"

function Redact-SigningArgs($Args) {
  $redacted = @()
  for ($index = 0; $index -lt $Args.Count; $index++) {
    $value = [string]$Args[$index]
    $redacted += $value
    if ($value -in @("/p", "/f", "/dmdf")) {
      if ($index + 1 -lt $Args.Count) {
        if ($value -eq "/p") {
          $redacted += "<redacted-password>"
        } elseif ($value -eq "/f") {
          $redacted += "<redacted-pfx-path>"
        } else {
          $redacted += "<redacted-metadata-path>"
        }
        $index += 1
      }
    }
  }
  return $redacted
}

if (-not $TimestampUrl) {
  if ($artifactSigningProvider) {
    $TimestampUrl = "http://timestamp.acs.microsoft.com"
  } else {
    $TimestampUrl = "http://timestamp.digicert.com"
  }
}

$artifactSigningDlibPath = $env:AURAONE_ARTIFACT_SIGNING_DLIB_PATH
if (-not $artifactSigningDlibPath) {
  $artifactSigningDlibPath = $env:AURAONE_TRUSTED_SIGNING_DLIB_PATH
}
$artifactSigningMetadataPath = $env:AURAONE_ARTIFACT_SIGNING_METADATA_PATH
if (-not $artifactSigningMetadataPath) {
  $artifactSigningMetadataPath = $env:AURAONE_TRUSTED_SIGNING_METADATA_PATH
}
$artifactSigningEndpoint = $env:AURAONE_ARTIFACT_SIGNING_ENDPOINT
if (-not $artifactSigningEndpoint) {
  $artifactSigningEndpoint = $env:AURAONE_TRUSTED_SIGNING_ENDPOINT
}
$artifactSigningAccountName = $env:AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME
if (-not $artifactSigningAccountName) {
  $artifactSigningAccountName = $env:AURAONE_TRUSTED_SIGNING_ACCOUNT_NAME
}
$artifactSigningCertificateProfile = $env:AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME
if (-not $artifactSigningCertificateProfile) {
  $artifactSigningCertificateProfile = $env:AURAONE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME
}
$artifactSigningCorrelationId = $env:AURAONE_ARTIFACT_SIGNING_CORRELATION_ID

if (-not $thumbprint -and -not $pfxPath -and -not $artifactSigningProvider) {
  Fail "set AURAONE_WINDOWS_CERT_THUMBPRINT, AURAONE_WINDOWS_PFX_PATH, or AURAONE_WINDOWS_SIGNING_PROVIDER=azure-artifact-signing"
}
if ($pfxPath -and -not (Test-Path $pfxPath)) {
  Fail "AURAONE_WINDOWS_PFX_PATH does not exist"
}
if ($pfxPath -and -not $pfxPassword) {
  Fail "AURAONE_WINDOWS_PFX_PASSWORD is required when signing from PFX"
}
if ($artifactSigningProvider) {
  if (-not $artifactSigningDlibPath) {
    Fail "AURAONE_ARTIFACT_SIGNING_DLIB_PATH is required for Azure Artifact Signing"
  }
  if (-not $dryRun -and -not (Test-Path $artifactSigningDlibPath)) {
    Fail "AURAONE_ARTIFACT_SIGNING_DLIB_PATH does not exist"
  }
  if ($artifactSigningMetadataPath) {
    if (-not $dryRun -and -not (Test-Path $artifactSigningMetadataPath)) {
      Fail "AURAONE_ARTIFACT_SIGNING_METADATA_PATH does not exist"
    }
  } elseif (-not $artifactSigningEndpoint -or -not $artifactSigningAccountName -or -not $artifactSigningCertificateProfile) {
    Fail "set AURAONE_ARTIFACT_SIGNING_METADATA_PATH or AURAONE_ARTIFACT_SIGNING_ENDPOINT, AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME, and AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME"
  }
}

$signTool = if ($dryRun) { "signtool.exe" } else { Find-SignTool }
$temporaryMetadataPath = $null

try {
  if ($artifactSigningProvider -and -not $artifactSigningMetadataPath) {
    $metadata = [ordered]@{
      Endpoint = $artifactSigningEndpoint
      CodeSigningAccountName = $artifactSigningAccountName
      CertificateProfileName = $artifactSigningCertificateProfile
    }
    if ($artifactSigningCorrelationId) {
      $metadata.CorrelationId = $artifactSigningCorrelationId
    }
    $temporaryMetadataPath = [System.IO.Path]::GetTempFileName()
    $metadata | ConvertTo-Json -Depth 4 | Set-Content -Path $temporaryMetadataPath -NoNewline -Encoding utf8
    $artifactSigningMetadataPath = $temporaryMetadataPath
  }

  foreach ($artifact in $ArtifactPath) {
    if (-not (Test-Path $artifact)) { Fail "artifact does not exist: $artifact" }

    if ($artifactSigningProvider) {
      $args = @("sign", "/v", "/debug", "/fd", "SHA256", "/tr", $TimestampUrl, "/td", "SHA256", "/dlib", $artifactSigningDlibPath, "/dmdf", $artifactSigningMetadataPath, $artifact)
    } elseif ($thumbprint) {
      $args = @("sign", "/fd", "SHA256", "/tr", $TimestampUrl, "/td", "SHA256", "/sha1", $thumbprint, $artifact)
    } else {
      $args = @("sign", "/fd", "SHA256", "/tr", $TimestampUrl, "/td", "SHA256", "/f", $pfxPath, "/p", $pfxPassword, $artifact)
    }

    if ($dryRun) {
      $safeArgs = Redact-SigningArgs $args
      Write-Host "DRY RUN: signtool $($safeArgs -join ' ')"
      continue
    }

    & $signTool @args
    & $signTool verify /pa /all $artifact
    Write-Host "Signed Windows artifact: $artifact"
  }
} finally {
  if ($temporaryMetadataPath -and (Test-Path $temporaryMetadataPath)) {
    Remove-Item -Force $temporaryMetadataPath
  }
}
