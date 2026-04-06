@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Dhanalakshmi Textiles Billing - Setup ^& Install
echo =======================================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! 
    echo Please install Node.js from https://nodejs.org/ before continuing.
    pause
    exit /b 1
)

echo [1/3] Cleaning old dependencies...
if exist node_modules (
    echo Removing existing node_modules...
    rmdir /s /q node_modules
)

echo.
echo [2/3] Installing Node.js dependencies...
echo This may take a few minutes depending on your internet speed.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed! Please check your internet connection.
    pause
    exit /b 1
)

echo.
echo [3/3] Building native modules (sqlite3) for Electron...
call npx electron-rebuild -f -w sqlite3
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] electron-rebuild failed. 
    echo If the app fails to start, you may need to install build tools.
    echo Run: npm install --global --production windows-build-tools
)

echo.
echo =======================================================
echo Installation Complete!
echo =======================================================
echo.
echo You can now:
echo 1. Run in Development: Double-click "run.bat"
echo 2. Build for Production: Double-click "build_app.bat"
echo.
pause
