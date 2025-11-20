@echo off
echo Building SumiTask for Electron...
echo.

cd /d "%~dp0"
set ELECTRON=true
echo ELECTRON=%ELECTRON%
npm run build

echo.
echo Build complete!
pause
