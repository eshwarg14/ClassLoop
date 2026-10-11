.PHONY: setup dev build start test lint seed replay secret clean help

ifeq ($(OS),Windows_NT)
	VENV_BIN = .venv/Scripts
	PYTHON = $(VENV_BIN)/python.exe
	PIP = $(VENV_BIN)/pip.exe
	UVICORN = $(VENV_BIN)/uvicorn.exe
	PYTEST = $(VENV_BIN)/pytest.exe
	RUFF = $(VENV_BIN)/ruff.exe
	RM = powershell -NoProfile -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"
else
	VENV_BIN = .venv/bin
	PYTHON = $(VENV_BIN)/python
	PIP = $(VENV_BIN)/pip
	UVICORN = $(VENV_BIN)/uvicorn
	PYTEST = $(VENV_BIN)/pytest
	RUFF = $(VENV_BIN)/ruff
	RM = rm -rf
endif

setup:
	python -m venv .venv
	$(PIP) install --upgrade pip
	$(PIP) install -e backend
	cd frontend && npm install

dev:
	npx concurrently -n "api,web" -c "blue,green" \
		"$(UVICORN) app.main:app --reload --port 8080" \
		"cd frontend && npm run dev"

build:
	cd frontend && npm run build

start:
	$(UVICORN) app.main:app --port 8080

test:
	$(PYTEST) backend/tests

lint:
	$(RUFF) check backend
	cd frontend && npx tsc --noEmit

seed:
	$(PYTHON) scripts/seed_demo.py

replay:
	$(PYTHON) scripts/replay_transcript.py

secret:
	$(PYTHON) -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

clean:
ifeq ($(OS),Windows_NT)
	$(RM) data, frontend/dist, backend/__pycache__, .pytest_cache, .ruff_cache
	powershell -NoProfile -Command "Get-ChildItem -Recurse -Filter '__pycache__' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"
else
	$(RM) data frontend/dist backend/__pycache__ .pytest_cache .ruff_cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
endif
