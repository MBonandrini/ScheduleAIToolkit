@echo off
setlocal EnableExtensions EnableDelayedExpansion
TITLE Project Controls AI Suite - Ollama Setup

echo ============================================================
echo   Project Controls AI Suite - Local Ollama Setup
echo ============================================================
echo.
echo This installs/configures Ollama for local use with the GitHub-hosted site.
echo No paid AI service is required.
echo.

where ollama >nul 2>&1
if errorlevel 1 (
  echo Ollama was not found. Attempting installation with Windows Package Manager...
  where winget >nul 2>&1
  if errorlevel 1 (
    echo.
    echo ERROR: winget is not available on this PC.
    echo Install Ollama manually from https://ollama.com/download/windows then run this file again.
    pause
    exit /b 1
  )
  winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo.
    echo ERROR: Ollama installation failed.
    pause
    exit /b 1
  )
  set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
)

echo.
set /p SITE_ORIGIN=Enter your GitHub Pages origin, e.g. https://your-name.github.io : 
if "%SITE_ORIGIN%"=="" set "SITE_ORIGIN=https://localhost"

echo.
echo Configuring OLLAMA_ORIGINS=%SITE_ORIGIN%
setx OLLAMA_ORIGINS "%SITE_ORIGIN%" >nul
set "OLLAMA_ORIGINS=%SITE_ORIGIN%"

echo Starting Ollama...
start "Ollama" /min cmd /c "ollama serve"
timeout /t 4 /nobreak >nul

echo.
set /p MODEL=Model to pull [qwen2.5:3b]: 
if "%MODEL%"=="" set "MODEL=qwen2.5:3b"
echo Pulling %MODEL% ...
ollama pull "%MODEL%"
if errorlevel 1 (
  echo.
  echo WARNING: The model pull failed. Ollama may still be installed correctly.
  echo You can later run: ollama pull qwen2.5:3b
)

echo.
echo ============================================================
echo Setup complete.
echo 1. Leave Ollama running.
echo 2. Open the website Settings page.
echo 3. Click Check Ollama, then Detect ^& classify.
echo 4. Select the installed model and click Test ^& Save.
echo ============================================================
echo.
pause
endlocal
