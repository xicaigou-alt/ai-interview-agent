@echo off
rem ============================================================
rem  Personal AI Interview Agent - local startup (Windows)
rem  Auto-start on boot: build(first run) + start server
rem  + open browser + reminder popup.
rem  Logs: scripts\agent.log (script flow)
rem        scripts\server.log (server output)
rem  NOTE: this window is a launcher; it closes itself after
rem        starting everything - that is NORMAL.
rem  Signs of success: minimized "InterviewAgent-Server" window
rem  + browser opens http://localhost:3000 + reminder popup.
rem  NOTE: keep this file ASCII-only with CRLF line endings.
rem  Paths use the script folder (%~dp0), so it works even if
rem  the project path contains non-ASCII characters.
rem ============================================================
setlocal
cd /d "%~dp0\.."
set LOG=scripts\agent.log

rem Guard: must run from the app folder, not a copy elsewhere
if not exist "package.json" (
  echo [agent] ERROR: wrong folder. Run this from its original location.
  echo [agent] Put a SHORTCUT in shell:startup, do NOT copy this file.
  echo [agent] Press any key to close...
  pause
  exit /b 1
)

echo [%date% %time%] agent start >> "%LOG%"

rem Build on first run (when no production build exists yet)
if not exist ".next\BUILD_ID" (
  echo [agent] First run: building production bundle...
  call pnpm build >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [agent] Build FAILED. See scripts\agent.log
    echo [%date% %time%] build FAILED >> "%LOG%"
    pause
    exit /b 1
  )
)

echo [agent] Starting server...
echo [%date% %time%] starting server >> "%LOG%"
start "InterviewAgent-Server" /min cmd /c "pnpm start >> scripts\server.log 2>&1"

echo [agent] Waiting for server...
rem Use ping for delay (timeout fails instantly under redirected input)
ping -n 7 127.0.0.1 >nul

echo [agent] Opening http://localhost:3000 ...
start "" "http://localhost:3000"

echo [agent] Showing reminder popup...
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0reminder-toast.ps1"

echo [agent] Done. If nothing happened, check scripts\server.log
echo [%date% %time%] agent done >> "%LOG%"