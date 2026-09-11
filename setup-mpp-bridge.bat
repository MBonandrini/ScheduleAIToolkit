@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Project Controls - Local MPP Parser

echo ============================================================
echo Project Controls AI Suite - Local Microsoft Project MPP Parser
echo ============================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or later is required. Attempting to install Node.js LTS...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Windows Package Manager ^(winget^) was not found.
    echo Install Node.js LTS from https://nodejs.org and run this file again.
    pause
    exit /b 1
  )
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  if errorlevel 1 (
    echo ERROR: Node.js installation did not complete successfully.
    pause
    exit /b 1
  )
  echo.
  echo Node.js was installed. Close this window and run setup-mpp-bridge.bat again
  echo so the updated PATH is available.
  pause
  exit /b 0
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set NODEMAJOR=%%V
if %NODEMAJOR% LSS 20 (
  echo ERROR: Node.js 20 or later is required. Your version is:
  node --version
  echo Update Node.js LTS and run this file again.
  pause
  exit /b 1
)

if not exist "%~dp0tools\package.json" (
  echo ERROR: tools\package.json is missing. Keep the full website folder structure intact.
  pause
  exit /b 1
)

pushd "%~dp0tools"
echo Installing/updating the local MPP parser components...
call npm install --omit=dev
if errorlevel 1 (
  echo ERROR: npm could not install the local MPP parser.
  popd
  pause
  exit /b 1
)

echo.
echo Starting the local MPP parser on http://127.0.0.1:8765 ...
echo Leave this window open while importing .mpp files.
echo Press Ctrl+C to stop it.
echo.
node mpp-bridge.mjs
set EXITCODE=%ERRORLEVEL%
popd
if not "%EXITCODE%"=="0" (
  echo.
  echo The MPP parser stopped with exit code %EXITCODE%.
  pause
)
endlocal
