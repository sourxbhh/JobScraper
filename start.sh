#!/bin/bash
set -e

echo "========================================="
echo "  JobHunt Pro — Starting Up"
echo "========================================="

# Check Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "ERROR: Python 3.10+ is required but not found."
    exit 1
fi
PYTHON=$(command -v python3 || command -v python)
echo "Using Python: $($PYTHON --version)"

# Check Node
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js 18+ is required but not found."
    exit 1
fi
echo "Using Node: $(node --version)"

# Backend setup
echo ""
echo "--- Setting up backend ---"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON -m venv venv
fi

# Activate venv
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

echo "Installing backend dependencies..."
pip install numpy --quiet
pip install --no-deps python-jobspy --quiet
pip install -r requirements.txt --quiet 2>/dev/null || pip install fastapi "uvicorn[standard]" sqlalchemy apscheduler pydantic pandas openpyxl python-multipart aiofiles requests beautifulsoup4 tls_client markdownify regex --quiet

cd ..

# Frontend setup
echo ""
echo "--- Setting up frontend ---"
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install --legacy-peer-deps
fi

cd ..

# Start services
echo ""
echo "========================================="
echo "  Starting services..."
echo "========================================="

# Start backend
cd backend
if [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================="
echo "  JobHunt Pro is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop all services."

# Wait and cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
