#!/usr/bin/env bash
set -euo pipefail

echo "==> Setting up ClassLoop development environment..."

# 1. Python virtual environment
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in .venv..."
    python3 -m venv .venv || python -m venv .venv
fi

# Source virtual environment
if [ -f ".venv/bin/activate" ]; then
    # shellcheck source=/dev/null
    source .venv/bin/activate
elif [ -f ".venv/Scripts/activate" ]; then
    # shellcheck source=/dev/null
    source .venv/Scripts/activate
fi

echo "Upgrading pip and installing backend dependencies..."
python -m pip install --upgrade pip
python -m pip install -e backend

# 2. Frontend dependencies
echo "Installing frontend dependencies..."
if [ -d "frontend" ]; then
    (cd frontend && npm install)
else
    echo "Frontend directory not found, skipping npm install."
fi

# 3. Environment configuration
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Copying .env.example to .env..."
    cp .env.example .env
fi

echo "==> Setup complete! Activate your venv with: source .venv/bin/activate (or .venv/Scripts/activate on Windows)"
