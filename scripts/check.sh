#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${TEST_DATABASE_URL:?Informe explicitamente a URL do banco separado rastro_test.}"
(cd "$project_dir/backend" && ../.venv/bin/python -m pytest -q)
(cd "$project_dir/frontend" && npm run build)
