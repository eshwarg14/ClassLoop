# ClassLoop Setup Script for Windows PowerShell
$ErrorActionPreference = "Stop"

Write-Host "==> Setting up ClassLoop development environment..." -ForegroundColor Cyan

# 1. Python virtual environment
if (-not (Test-Path -Path ".venv")) {
    Write-Host "Creating virtual environment in .venv..." -ForegroundColor Yellow
    python -m venv .venv
}

$venvPython = Join-Path ".venv" "Scripts" "python.exe"
$venvPip = Join-Path ".venv" "Scripts" "pip.exe"

if (-not (Test-Path -Path $venvPython)) {
    throw "Virtual environment python executable not found at $venvPython"
}

Write-Host "Upgrading pip and installing backend dependencies..." -ForegroundColor Yellow
& $venvPip install --upgrade pip
& $venvPip install -e backend

# 2. Frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
if (Test-Path -Path "frontend") {
    Push-Location "frontend"
    try {
        npm install
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "Frontend directory not found, skipping npm install." -ForegroundColor DarkGray
}

# 3. Environment configuration
if (-not (Test-Path -Path ".env") -and (Test-Path -Path ".env.example")) {
    Write-Host "Copying .env.example to .env..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
}

Write-Host "==> Setup complete! Activate your venv with: .\.venv\Scripts\Activate.ps1" -ForegroundColor Green
