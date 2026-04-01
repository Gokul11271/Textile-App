@echo off
echo =======================================================
echo Dhanalakshmi Textiles Billing - Setup ^& Install
echo =======================================================
echo.
echo Step 1/2: Installing Node.js dependencies...
call npm install
echo.

echo Step 2/2: Ensuring sqlite3 is correctly built for Electron...
call npx electron-rebuild -f -w sqlite3
echo.

echo =======================================================
echo Installation Complete!
echo You can now run the application by double-clicking "run.bat".
echo =======================================================
pause
