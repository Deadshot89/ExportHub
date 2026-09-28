[CmdletBinding()]
param(
  [switch]$Disable,
  [switch]$SkipPrinterCheck
)

$ErrorActionPreference = 'Stop'
$policyPath = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'ExportHUB Direktdruck muss einmalig als Administrator eingerichtet werden.'
  }
}

function Find-Edge {
  $programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
  $programFiles = [Environment]::GetFolderPath('ProgramFiles')
  $candidates = @(
    (Join-Path $programFilesX86 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $programFiles 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }
  return $candidates | Select-Object -First 1
}

Assert-Administrator

if ($Disable) {
  if (Test-Path $policyPath) {
    Remove-ItemProperty -Path $policyPath -Name 'SilentPrintingEnabled' -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path $policyPath -Name 'PrintPreviewUseSystemDefaultPrinter' -ErrorAction SilentlyContinue
  }
  Write-Host 'ExportHUB Direktdruck wurde deaktiviert. Microsoft Edge vollständig schließen und neu starten.'
  exit 0
}

$edge = Find-Edge
if (-not $edge) {
  throw 'Microsoft Edge wurde nicht gefunden. Für den ExportHUB Direktdruck wird Microsoft Edge ab Version 144 benötigt.'
}

$versionText = (Get-Item $edge).VersionInfo.ProductVersion
$versionMatch = [regex]::Match([string]$versionText, '^\d+(?:\.\d+){1,3}')
if (-not $versionMatch.Success) {
  throw "Microsoft-Edge-Version konnte nicht ermittelt werden: $versionText"
}
$edgeVersion = [version]$versionMatch.Value
if ($edgeVersion.Major -lt 144) {
  throw "Microsoft Edge $edgeVersion ist zu alt. ExportHUB Direktdruck benötigt Edge 144 oder neuer."
}

if (-not $SkipPrinterCheck) {
  $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1
  if (-not $defaultPrinter) {
    throw 'Windows hat keinen Standarddrucker. Bitte zuerst den gewünschten ExportHUB-Drucker als Windows-Standarddrucker festlegen.'
  }
  Write-Host ("Windows-Standarddrucker: " + $defaultPrinter.Name)
  if ($defaultPrinter.Name -match 'PDF|OneNote|XPS') {
    Write-Warning 'Der aktuelle Standarddrucker wirkt wie ein Datei-/PDF-Drucker. Für den automatischen Papierdruck einen physischen Drucker als Windows-Standard festlegen.'
  }
}

New-Item -Path $policyPath -Force | Out-Null
New-ItemProperty -Path $policyPath -Name 'SilentPrintingEnabled' -PropertyType DWord -Value 1 -Force | Out-Null
New-ItemProperty -Path $policyPath -Name 'PrintPreviewUseSystemDefaultPrinter' -PropertyType DWord -Value 1 -Force | Out-Null

$verifiedSilent = (Get-ItemProperty -Path $policyPath -Name 'SilentPrintingEnabled').SilentPrintingEnabled
$verifiedDefault = (Get-ItemProperty -Path $policyPath -Name 'PrintPreviewUseSystemDefaultPrinter').PrintPreviewUseSystemDefaultPrinter
if ($verifiedSilent -ne 1 -or $verifiedDefault -ne 1) {
  throw 'Die Edge-Druckrichtlinien konnten nicht verifiziert werden.'
}

Write-Host ''
Write-Host 'ExportHUB Direktdruck ist eingerichtet.'
Write-Host '1. Microsoft Edge vollständig schließen.'
Write-Host '2. Edge neu starten und ExportHUB öffnen.'
Write-Host '3. QR scannen oder REF eingeben. Der vorhandene Gesamtdruck geht direkt an den Windows-Standarddrucker.'
Write-Host ''
Write-Host 'Rückgängig: PowerShell als Administrator öffnen und dieses Skript mit -Disable ausführen.'
