#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$ROOT_DIR"

echo "[1/4] Creating Python virtual environment..."
python3 -m venv "$BACKEND_DIR/.venv"
source "$BACKEND_DIR/.venv/bin/activate"

cd "$BACKEND_DIR"
echo "[2/4] Installing backend dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

if [ ! -f .env ]; then
  echo "[3/4] Creating .env from template..."
  cp .env.example .env
fi

echo "[4/4] Backend environment is ready."
echo "Next steps:"
echo "  1. Edit backend/.env with your API and Salesforce credentials"
echo "  2. Activate the environment: source backend/.venv/bin/activate"
echo "  3. Start the API: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
