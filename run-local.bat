@echo off
title WashPro - Local Launcher
cls

echo ========================================================
echo   🚗 WASHPRO LOCAL ENVIRONMENT LAUNCHER
echo   OS2 Studio · Dindigul, Tamil Nadu
echo ========================================================
echo.

:: ── 1. PREREQUISITE WARNINGS ──────────────────────────────

echo [*] Checking prerequisites...

node --version >nul 2>nul
if errorlevel 1 (
    echo  [!] WARNING: Node.js not detected. Please ensure Node.js is installed.
) else (
    echo  [+] Node.js detected.
)

python --version >nul 2>nul
if errorlevel 1 (
    echo  [!] WARNING: Python not detected. Please ensure Python is installed.
) else (
    echo  [+] Python detected.
)

netstat -ano | findstr :5432 >nul 2>nul
if errorlevel 1 (
    echo  [!] WARNING: No local service detected on default PostgreSQL port 5432.
    echo      Please make sure your local PostgreSQL service is started and running!
) else (
    echo  [+] Local PostgreSQL port 5432 detected.
)
echo.

:: ── 2. BACKEND SETUP & INSTALLATION ───────────────────────

echo [*] Checking Backend Virtual Environment...
if not exist backend\venv (
    echo  [-] Virtual environment not found in backend\. Creating one now...
    cd backend
    python -m venv venv
    if errorlevel 1 (
        echo  [!] WARNING: Failed to create Python virtual environment.
        cd ..
        goto :frontend
    )
    echo  [+] Virtual environment created successfully.
    echo [*] Installing backend dependencies...
    call venv\Scripts\activate
    python -m pip install --upgrade pip >nul 2>nul
    pip install -r requirements.txt
    if errorlevel 1 (
        echo  [!] WARNING: Failed to install some Python backend dependencies.
    ) else (
        echo  [+] Backend dependencies installed successfully.
    )
    cd ..
) else (
    echo  [+] Python virtual environment found.
)
echo.

:frontend
:: ── 3. FRONTEND SETUP & INSTALLATION ──────────────────────

echo [*] Checking Frontend Dependencies...
if not exist node_modules (
    echo  [-] node_modules not found. Running npm install...
    call npm install --legacy-peer-deps --no-audit
    if errorlevel 1 (
        echo  [!] WARNING: npm install encountered warnings or failed.
    ) else (
        echo  [+] Frontend dependencies installed.
    )
) else (
    echo  [+] Frontend dependencies already installed.
)
echo.

:: ── 4. CONCURRENT LAUNCH ──────────────────────────────────

echo ========================================================
echo   🚀 LAUNCHING WASHPRO SERVERS
echo ========================================================
echo [*] Starting FastAPI Backend on port 8000 (new window)...
start "WashPro Backend Server" cmd /k "cd backend && call venv\Scripts\activate && python main.py"

echo [*] Starting React Frontend on port 3000 (active window)...
npm run dev
