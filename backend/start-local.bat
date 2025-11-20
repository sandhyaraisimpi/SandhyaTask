@echo off
echo ========================================
echo SumiTask Backend - Local Setup
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Creating .env file from env.example...
    copy env.example .env
    echo .env file created successfully!
    echo.
) else (
    echo .env file already exists.
    echo.
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    echo.
) else (
    echo Dependencies already installed.
    echo.
)

REM Check if database exists
if not exist database\sumitask.db (
    echo Initializing database...
    call npm run migrate
    echo.
) else (
    echo Database already exists.
    echo.
)

echo ========================================
echo Starting backend server...
echo ========================================
echo Server will run on http://localhost:5000
echo Press Ctrl+C to stop the server
echo.

call npm run dev


