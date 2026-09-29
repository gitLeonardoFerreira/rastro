#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
python_bin="${RASTRO_PYTHON:-$project_dir/.venv/bin/python}"
if [[ ! -x "$python_bin" ]]; then
  echo 'Crie .venv e instale backend/requirements.lock.txt antes de iniciar.' >&2
  exit 1
fi
if [[ ! -f "$project_dir/backend/.env" ]]; then
  echo 'Copie backend/.env.example para backend/.env e configure DATABASE_URL.' >&2
  exit 1
fi
if [[ ! -d "$project_dir/frontend/node_modules" ]]; then
  echo 'Execute npm ci na pasta frontend antes de iniciar.' >&2
  exit 1
fi
api_pid=''
web_pid=''
cleanup() {
  [[ -z "$api_pid" ]] || kill "$api_pid" 2>/dev/null || true
  [[ -z "$web_pid" ]] || kill "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
(cd "$project_dir/backend" && exec "$python_bin" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload) &
api_pid=$!
(cd "$project_dir/frontend" && exec npm run dev) &
web_pid=$!
echo 'Rastro: http://127.0.0.1:5173 · API: http://127.0.0.1:8000/docs'
wait "$api_pid" "$web_pid"
