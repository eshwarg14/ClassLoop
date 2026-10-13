@echo off
setlocal enabledelayedexpansion

title ClassLoop Observatory

:: Ensure current working directory is the script directory
cd /d "%~dp0"

echo ========================================================
echo  ClassLoop: Autonomous Lecture Intelligence Observatory
echo ========================================================
echo.

:: 1. Check for environment file
if not exist ".env" (
    if exist ".env.example" (
        echo [*] .env file not found. Initializing from .env.example...
        copy /y ".env.example" ".env" >nul
        echo [OK] Created .env configuration.
    )
)

:: 2. Detect Python executable
set "PYTHON_EXE="

if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=.venv\Scripts\python.exe"
) else if exist "backend\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=backend\.venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python was not found on your system.
    echo Please install Python 3.11 or higher and add it to your PATH.
    echo Download: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo [*] Using Python: %PYTHON_EXE%

:: 3. Check and build frontend if needed
if not exist "frontend\dist\index.html" (
    echo [*] Compiled frontend UI not found. Building production bundle...
    where npm >nul 2>&1
    if !errorlevel! equ 0 (
        pushd frontend
        if not exist "node_modules" (
            echo [*] Installing frontend npm packages...
            call npm install
        )
        echo [*] Running npm run build...
        call npm run build
        popd
        echo [OK] Frontend bundle created in frontend\dist.
    ) else (
        echo [WARNING] npm is not installed or not in PATH.
        echo The API will start, but the web UI may not load until frontend\dist is built.
    )
) else (
    echo [OK] Built frontend UI detected in frontend\dist.
)

:: 4. Set Python path for backend modules
set "PYTHONPATH=backend"

:: 5. Launch browser automatically in background after server initializes
start /b "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080"

echo.
echo ========================================================
echo  Server starting on: http://localhost:8080
echo  Press Ctrl+C in this window to stop the server.
echo ========================================================
echo.

:: 6. Run uvicorn server (single process serving API + job runner + UI)
"%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8080

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped with error code %errorlevel%.
    pause
)

endlocal
