param(
  [switch]$DryRun,
  [string]$Manifest = "https://updates.auraone.ai/release-evidence/robotics-studio-open/stable.json"
)

$ErrorActionPreference = "Stop"

$Repo = "auraoneai/robotics-studio-open"
$Binary = "robostudio.exe"
$DisplayName = "Robotics Studio Open"

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "$DisplayName supports Windows x64 at GA."
}

if ($DryRun) {
  Write-Output "flagship=robotics-studio-open"
  Write-Output "platform=windows"
  Write-Output "arch=x64"
  Write-Output "manifest=$Manifest"
  Write-Output "install_path=$env:LOCALAPPDATA\Programs\Robotics Studio Open\$Binary"
  Write-Output "repo=$Repo"
  exit 0
}

$Evidence = Invoke-RestMethod -Uri $Manifest
if ($Evidence.product.id -ne "robotics-studio-open") {
  throw "Release evidence product does not match installer."
}
$Candidates = @(
  $Evidence.artifacts | Where-Object {
    $_.platform -eq "windows" -and
    $_.architecture -eq "x64" -and
    $_.type -eq "msi"
  }
)
if ($Candidates.Count -ne 1) {
  throw "Release evidence must contain exactly one Windows x64 MSI."
}
$Artifact = $Candidates[0]
if ($Artifact.status -notin @("verified", "released")) {
  $Reason = if ($Artifact.blockers) { $Artifact.blockers -join "; " } else { "no verified release evidence" }
  throw "MSI is $($Artifact.status): $Reason"
}
if (-not $Artifact.url -or -not $Artifact.sha256 -or -not $Artifact.name) {
  throw "Verified MSI evidence is incomplete."
}
$Asset = $Artifact.name
$Temp = New-Item -ItemType Directory -Path ([System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString()))
$Msi = Join-Path $Temp.FullName $Asset

Invoke-WebRequest -Uri $Artifact.url -OutFile $Msi
$Expected = $Artifact.sha256.ToUpperInvariant()
$Actual = (Get-FileHash -Algorithm SHA256 $Msi).Hash.ToUpperInvariant()
if ($Expected -ne $Actual) {
  throw "Checksum mismatch against canonical release evidence for $Asset"
}

Start-Process msiexec.exe -Wait -ArgumentList "/i", "`"$Msi`""
