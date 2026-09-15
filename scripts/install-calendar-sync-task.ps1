param([string]$RepoPath = "C:\Users\intur\repos\inturlam-tracker-v05")

$ErrorActionPreference = "Stop"
$resolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
$envPath = Join-Path $resolvedRepo ".env.local"
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw ".env.local bulunamadı. Google test takvimi bilgilerini önce yapılandırın."
}
$envText = Get-Content -LiteralPath $envPath -Raw
foreach ($requiredName in @("GOOGLE_CALENDAR_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY")) {
  if ($envText -notmatch "(?m)^$requiredName\s*=\s*.+$") {
    throw "$requiredName .env.local içinde eksik."
  }
}
if ($envText -match "REPLACE_ME|test-calendar-id@|tracker-calendar@example-project") {
  throw ".env.local örnek değerler içeriyor; gerçek test takvimi bilgilerini ekleyin."
}

$wscriptPath = Join-Path $env:SystemRoot "System32\wscript.exe"
$launcherPath = Join-Path $resolvedRepo "scripts\run-calendar-sync-hidden.vbs"
if (-not (Test-Path -LiteralPath $launcherPath -PathType Leaf)) {
  throw "Penceresiz takvim senkron başlatıcısı bulunamadı: $launcherPath"
}
$action = New-ScheduledTaskAction -Execute $wscriptPath -Argument "`"$launcherPath`"" -WorkingDirectory $resolvedRepo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
$task = Register-ScheduledTask -TaskName "Inturlam Tracker v05 Calendar Sync" -Action $action -Trigger $trigger -Settings $settings -Description "İNTURLAM v05 Google Calendar çift yönlü senkron (5 dakikada bir)" -Force
$task | Select-Object TaskName, State
