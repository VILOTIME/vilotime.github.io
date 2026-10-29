@echo off
rem One-click sync: runs tools\sync.ps1 with execution policy bypassed.
rem (ASCII-only + CRLF on purpose: cmd.exe misparses UTF-8/LF files.)
setlocal
set "PS1=%~dp0sync.ps1"

where pwsh.exe >nul 2>nul
if %ERRORLEVEL%==0 (
    pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
) else (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
)

set CODE=%ERRORLEVEL%
exit /b %CODE%