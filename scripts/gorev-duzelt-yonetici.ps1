# Bu dosyayi YONETICI olarak calistir.
# (Sag tik -> "Run with PowerShell" yeterli DEGIL; asagidaki yontemi kullan:
#  Baslat menusune "PowerShell" yaz -> sag tik -> "Yonetici olarak calistir" ->
#  acilan pencereye su satiri yapistirip Enter:
#    & "C:\Users\intur\repos\inturlam-tracker-v05\scripts\gorev-duzelt-yonetici.ps1"
# )
#
# NE YAPAR: Bilgisayar acilisinda sunucuyu baslatan gorevi, eski v03 adindan/yolundan
# kurtarip dogrudan v05'e baglar. Sunucunun calismasi zaten dogru; bu sadece temizlik.

$ErrorActionPreference = "Stop"

$eskiAd = "Inturlam Tracker v03 Host"
$yeniAd = "Inturlam Tracker v05 Host"
$repo   = "C:\Users\intur\repos\inturlam-tracker-v05"
$script = Join-Path $repo "scripts\run-host.ps1"

if (-not (Test-Path -LiteralPath $script)) { throw "Bulunamadi: $script" }

Write-Host "1/4 Eski gorev durduruluyor..."
try { Stop-ScheduledTask -TaskName $eskiAd -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 3

Write-Host "2/4 Eski gorev siliniyor..."
Unregister-ScheduledTask -TaskName $eskiAd -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "3/4 Yeni gorev kaydediliyor..."
$argumanlar = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -RepoPath `"$repo`""
$action    = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Argument $argumanlar -WorkingDirectory $repo
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "intur" -LogonType S4U -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$settings.ExecutionTimeLimit = "PT0S"   # sinirsiz: gorev calistigi surece sunucu ayakta

Register-ScheduledTask -TaskName $yeniAd -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "INTURLAM Tracker v05 sunucusu (port 3000), acilista baslar." -Force | Out-Null

Write-Host "4/4 Baslatiliyor..."
Start-ScheduledTask -TaskName $yeniAd
Start-Sleep -Seconds 15

$dinleyen = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($dinleyen) {
  Write-Host "`nTAMAM. Sunucu port 3000'de calisiyor. Gorev adi: $yeniAd" -ForegroundColor Green
  Write-Host "Artik v03 klasorune hic ugramiyor."
} else {
  Write-Warning "Port 3000'de dinleyen yok. Loglara bak: $repo\data\logs"
}
