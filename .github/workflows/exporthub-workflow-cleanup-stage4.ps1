param(
  [string]$Repo = "Deadshot89/ExportHub",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Erforderliches Programm fehlt: $Name"
  }
}

Require-Command "gh"

Write-Host "Prüfe GitHub-Anmeldung..."
gh auth status | Out-Host

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Host ""
Write-Host "Lese aktuelle Workflow-Dateien aus .github/workflows ..."

$filesJson = gh api "repos/$Repo/contents/.github/workflows?ref=$Branch"
$files = $filesJson | ConvertFrom-Json

if (-not $files) {
  throw "Keine Workflow-Dateien gefunden."
}

$items = @()

foreach ($f in $files) {
  if ($f.type -ne "file") { continue }
  if ($f.name -notmatch '\.(yml|yaml)$') { continue }

  $detailJson = gh api "repos/$Repo/contents/$($f.path)?ref=$Branch"
  $detail = $detailJson | ConvertFrom-Json

  $raw = [System.Text.Encoding]::UTF8.GetString(
    [System.Convert]::FromBase64String(($detail.content -replace '\s',''))
  )

  $nameLine = ($raw -split "`n" | Where-Object { $_ -match '^\s*name\s*:' } | Select-Object -First 1)
  $workflowName = if ($nameLine) {
    ($nameLine -replace '^\s*name\s*:\s*','').Trim().Trim('"').Trim("'")
  } else {
    "(ohne name)"
  }

  $keep = $false
  $reason = ""

  if ($workflowName -eq "ExportHUB PRODUCTION Deploy") {
    $keep = $true
    $reason = "Produktion"
  }
  elseif ($workflowName -eq "ExportHUB TESTSERVICE Deploy") {
    $keep = $true
    $reason = "aktueller TESTSERVICE-Deploy"
  }
  elseif ($workflowName -eq "Build ExportHUB Android Test APK") {
    $keep = $true
    $reason = "Android-Build"
  }
  elseif ($workflowName -like "RC889*") {
    $keep = $true
    $reason = "aktueller Entwicklungsworkflow RC889"
  }

  $items += [PSCustomObject]@{
    Path = $f.path
    Name = $workflowName
    Sha = $detail.sha
    Keep = $keep
    Reason = $reason
  }
}

$keepItems = $items | Where-Object { $_.Keep }
$deleteItems = $items | Where-Object { -not $_.Keep }

Write-Host ""
Write-Host "BEHALTEN:"
$keepItems | ForEach-Object {
  Write-Host ("  + {0}  [{1}]" -f $_.Path,$_.Reason)
}

Write-Host ""
Write-Host "LÖSCHEN:"
if ($deleteItems.Count -eq 0) {
  Write-Host "  Keine alten Workflow-Dateien mehr vorhanden."
  exit 0
}
$deleteItems | ForEach-Object {
  Write-Host ("  - {0}  [{1}]" -f $_.Path,$_.Name)
}

Write-Host ""
$answer = Read-Host "Zum endgültigen Löschen exakt JA eingeben"
if ($answer -ne "JA") {
  Write-Host "Abgebrochen. Es wurde nichts gelöscht."
  exit 0
}

Write-Host ""
Write-Host "Erzeuge Backup-Tag vor der Löschung..."

$ref = gh api "repos/$Repo/git/ref/heads/$Branch" | ConvertFrom-Json
$mainSha = $ref.object.sha
$tagName = "backup-before-workflow-cleanup-$stamp"

$body = @{
  ref = "refs/tags/$tagName"
  sha = $mainSha
} | ConvertTo-Json

$body | gh api --method POST "repos/$Repo/git/refs" --input - | Out-Null
Write-Host "Backup-Tag erstellt: $tagName"

Write-Host ""
$failures = @()

foreach ($item in $deleteItems) {
  Write-Host "Lösche $($item.Path) ..."

  $deleteBody = @{
    message = "Repository cleanup: remove obsolete workflow $($item.Name)"
    sha = $item.Sha
    branch = $Branch
  } | ConvertTo-Json

  try {
    $deleteBody | gh api --method DELETE "repos/$Repo/contents/$($item.Path)" --input - | Out-Null
    Write-Host "  gelöscht"
  }
  catch {
    Write-Host "  FEHLER"
    $failures += $item.Path
  }
}

Write-Host ""
Write-Host "Aktueller Workflow-Bestand:"
$remaining = gh api "repos/$Repo/contents/.github/workflows?ref=$Branch" | ConvertFrom-Json
$remaining | Where-Object { $_.type -eq "file" -and $_.name -match '\.(yml|yaml)$' } | ForEach-Object {
  Write-Host ("  * {0}" -f $_.path)
}

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Folgende Dateien konnten nicht gelöscht werden:"
  $failures | ForEach-Object { Write-Host ("  ! {0}" -f $_) }
  exit 1
}

Write-Host ""
Write-Host "Workflow-Datei-Cleanup abgeschlossen."
