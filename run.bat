@echo off
setlocal

echo =======================================================
echo Dhanalakshmi Textiles Billing - Launch Control
echo =======================================================
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo [ERROR] Application is not installed. 
    echo Please run "install.bat" first before trying to launch.
    echo.
    pause
    exit /b 1
)

echo [LAUNCHING] Starting development server...
echo.
echo Please leave this window open while using the application.
echo To STOP the application:
echo 1. Close the Electron window
echo 2. Press Ctrl+C in this terminal if it doesn't automatically close
echo.

call npm run dev
pause
