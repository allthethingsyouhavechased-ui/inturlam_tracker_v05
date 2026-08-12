param([Parameter(Mandatory = $true)][string]$RepoPath)

$ErrorActionPreference = "Stop"
$resolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
$npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
$logDir = Join-Path $resolvedRepo "data\logs"
$logPath = Join-Path $logDir "calendar-sync.log"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

Push-Location $resolvedRepo
try {
  & $npmPath run calendar:sync -- --scheduled *>> $logPath
  $syncExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $syncExitCode
