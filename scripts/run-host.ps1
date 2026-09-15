param(
  [string]$RepoPath = "C:\Users\intur\repos\inturlam-tracker-v05",
  [switch]$Detach   # true: baslatip cik (gorunmez pencere), false: gorev bitene kadar bekle
)

$ErrorActionPreference = "Stop"
$repo = (Resolve-Path -LiteralPath $RepoPath).Path
$logDir = Join-Path $repo "data\logs"
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $logDir "v05-host-$stamp.out.log"
$err = Join-Path $logDir "v05-host-$stamp.err.log"

# Port 3000'i tutan eski surec varsa kapat
foreach ($c in @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
  try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop } catch {}
}
Start-Sleep -Seconds 2

$npm = "C:\Program Files\nodejs\npm.cmd"
if (-not (Test-Path -LiteralPath $npm)) { $npm = (Get-Command npm.cmd -ErrorAction Stop).Source }

$common = @{
  FilePath = $npm
  ArgumentList = @("run","start")
  WorkingDirectory = $repo
  RedirectStandardOutput = $out
  RedirectStandardError = $err
  WindowStyle = "Hidden"
}

if ($Detach) { Start-Process @common }
else { Start-Process @common -Wait }
