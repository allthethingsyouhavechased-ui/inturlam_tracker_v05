Set objShell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptsPath = fileSystem.GetParentFolderName(WScript.ScriptFullName)
repoPath = fileSystem.GetParentFolderName(scriptsPath)
runnerPath = fileSystem.BuildPath(scriptsPath, "run-calendar-sync.ps1")
powerShellPath = objShell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"

command = """" & powerShellPath & """ -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & runnerPath & """ -RepoPath """ & repoPath & """"
exitCode = objShell.Run(command, 0, True)
WScript.Quit exitCode
