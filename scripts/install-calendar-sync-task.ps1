param([string]$RepoPath = "C:\Users\intur\repos\inturlam-tracker-v03")

$action = New-ScheduledTaskAction -Execute "npm.cmd" -Argument "run calendar:sync" -WorkingDirectory $RepoPath
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "Inturlam Tracker v03 Calendar Sync" -Action $action -Trigger $trigger -Settings $settings -Description "İNTURLAM v03 Google Calendar çift yönlü senkron" -Force
