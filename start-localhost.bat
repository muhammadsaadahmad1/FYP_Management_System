@echo off
echo Starting FYP Management System Local Server...
echo.
echo Checking if live-server is installed...
where npx >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npx not found. Please install Node.js and npm.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo Starting live server on port 5500...
echo Server will be available at: http://localhost:5500
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%~dp0"
npx live-server --port=5500 --host=localhost --open=/index.html --quiet

pause
