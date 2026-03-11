param(
  [ValidateSet("dry-run", "live")]
  [string]$Mode = "dry-run"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-WorkingCommand {
  param([string[]]$Candidates)
  foreach ($candidate in $Candidates) {
    try {
      & $candidate "--version" *> $null
      if ($LASTEXITCODE -eq 0) {
        return $candidate
      }
    } catch {
      # Keep trying candidates
    }
  }
  return $null
}

function Invoke-External {
  param(
    [string]$Exe,
    [string[]]$Args
  )
  & $Exe @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed ($Exe) with exit code $LASTEXITCODE"
  }
}

$CodeHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME ".codex" }
$SoraCli = Join-Path $CodeHome "skills\\sora\\scripts\\sora.py"
$BatchFile = Join-Path $PSScriptRoot "shiftway-investor-batch.jsonl"

$OutRoot = Join-Path $PSScriptRoot "out"
$JobsDir = Join-Path $OutRoot "jobs"
$VideosDir = Join-Path $OutRoot "videos"
$PollDir = Join-Path $OutRoot "poll"

$PythonCmd = Get-WorkingCommand -Candidates @("python", "py")
$UvCmd = Get-WorkingCommand -Candidates @("uv")

New-Item -ItemType Directory -Path $JobsDir -Force | Out-Null
New-Item -ItemType Directory -Path $VideosDir -Force | Out-Null
New-Item -ItemType Directory -Path $PollDir -Force | Out-Null

if (-not (Test-Path $SoraCli)) {
  throw "Sora CLI not found at: $SoraCli"
}
if (-not (Test-Path $BatchFile)) {
  throw "Batch file not found: $BatchFile"
}
if ([string]::IsNullOrWhiteSpace($PythonCmd)) {
  throw "No working Python executable found. Install Python, then rerun."
}

Write-Host "Sora CLI: $SoraCli"
Write-Host "Batch file: $BatchFile"
Write-Host "Mode: $Mode"
Write-Host "Python: $PythonCmd"
Write-Host "uv: $(if ($UvCmd) { $UvCmd } else { 'not found (will use python fallback)' })"

if ($Mode -eq "dry-run") {
  Invoke-External -Exe $PythonCmd -Args @(
    $SoraCli, "create-batch",
    "--input", $BatchFile,
    "--out-dir", $JobsDir,
    "--model", "sora-2",
    "--size", "1280x720",
    "--seconds", "4",
    "--dry-run"
  )

  Write-Host "Dry-run complete."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($env:OPENAI_API_KEY)) {
  throw "OPENAI_API_KEY is not set. Set it first, then rerun with -Mode live."
}

# Create all six shots as async jobs
if ($UvCmd) {
  Invoke-External -Exe $UvCmd -Args @(
    "run", "--with", "openai", "python", $SoraCli, "create-batch",
    "--input", $BatchFile,
    "--out-dir", $JobsDir,
    "--model", "sora-2",
    "--size", "1280x720",
    "--seconds", "4",
    "--concurrency", "2",
    "--max-attempts", "3"
  )
} else {
  Invoke-External -Exe $PythonCmd -Args @(
    $SoraCli, "create-batch",
    "--input", $BatchFile,
    "--out-dir", $JobsDir,
    "--model", "sora-2",
    "--size", "1280x720",
    "--seconds", "4",
    "--concurrency", "2",
    "--max-attempts", "3"
  )
}

# Poll each created job and download MP4 output
$jobFiles = Get-ChildItem -Path $JobsDir -Filter *.json | Sort-Object Name
foreach ($file in $jobFiles) {
  $job = Get-Content -Path $file.FullName -Raw | ConvertFrom-Json
  $id = $job.id
  if ([string]::IsNullOrWhiteSpace($id)) {
    Write-Warning "Skipping $($file.Name): missing job id"
    continue
  }

  $base = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $videoOut = Join-Path $VideosDir "$base.mp4"
  $pollJson = Join-Path $PollDir "$base-poll.json"

  Write-Host "Polling and downloading: $id -> $videoOut"
  if ($UvCmd) {
    Invoke-External -Exe $UvCmd -Args @(
      "run", "--with", "openai", "python", $SoraCli, "poll",
      "--id", $id,
      "--poll-interval", "10",
      "--timeout", "1800",
      "--download",
      "--variant", "video",
      "--out", $videoOut,
      "--json-out", $pollJson
    )
  } else {
    Invoke-External -Exe $PythonCmd -Args @(
      $SoraCli, "poll",
      "--id", $id,
      "--poll-interval", "10",
      "--timeout", "1800",
      "--download",
      "--variant", "video",
      "--out", $videoOut,
      "--json-out", $pollJson
    )
  }
}

Write-Host "Live run complete. Downloaded clips in: $VideosDir"
