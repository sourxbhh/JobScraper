@echo off
echo =========================================
echo   JobHunt Pro — Starting Up
echo =========================================

:: Check Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Python 3.10+ is required but not found.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo Using %%i

:: Check Node
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js 18+ is required but not found.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo Using Node %%i

:: Backend setup
echo.
echo --- Setting up backend ---
cd backend

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing backend dependencies...
pip install numpy --quiet
pip install --no-deps python-jobspy --quiet
pip install fastapi uvicorn[standard] sqlalchemy apscheduler pydantic pandas openpyxl python-multipart aiofiles requests beautifulsoup4 tls_client markdownify regex --quiet

cd ..

:: Frontend setup
echo.
echo --- Setting up frontend ---
cd frontend

if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install --legacy-peer-deps
)

cd ..

:: Start services
echo.
echo =========================================
echo   Starting services...
echo =========================================

:: Start backend in a new window
start "JobHunt Backend" cmd /c "cd backend && call venv\Scripts\activate.bat && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Give backend a moment to start
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "JobHunt Frontend" cmd /c "cd frontend && npm run dev"

:: Wait for frontend to start
timeout /t 5 /nobreak >nul

:: Open browser
start http://localhost:5173

echo.
echo =========================================
echo   JobHunt Pro is running!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo =========================================
echo.
echo Close the terminal windows to stop services.
pause
