@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Dhanalakshmi Textiles Billing - Packaging App
echo =======================================================
echo.

:: Check for Node.js
where /q npm
if %errorlevel% neq 0 (
    echo [ERROR] npm is not in your path. Please install Node.js first.
    pause
    exit /b 1
)

:: Check if node_modules exists
if not exist node_modules (
    echo [INFO] node_modules not found. Running install first...
    call npm install
)

echo.
echo [1/2] Building Vite frontend...
call npm run build:vite
if %errorlevel% neq 0 (
    echo [ERROR] Vite build failed! 
    pause
    exit /b 1
)

echo.
echo [2/2] Creating Installer (Electron Builder)...
call npx electron-builder --windows nsis:x64
if %errorlevel% neq 0 (
    echo [ERROR] Packaging failed! 
    pause
    exit /b 1
)

echo.
echo =======================================================
echo Build complete!
echo Your installer is ready in the "release" folder.
echo Look for Dhanalakshmi Textiles Billing Setup xxx.exe
echo =======================================================
echo.
pause
