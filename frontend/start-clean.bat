@echo off
echo Starting SumiTask Frontend...
echo.
echo Current directory: %CD%
echo.
echo Checking Node.js...
node --version
echo.
echo Checking npm...
npm --version
echo.
echo Installing dependencies...
npm install
echo.
echo Starting development server...
npm run dev
pause 