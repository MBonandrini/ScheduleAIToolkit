#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/8] JavaScript syntax"
for f in js/*.js sw.js; do node --check "$f"; done

echo "[2/8] Retrieval/configuration unit tests"
node --test tests/unit.test.mjs

echo "[3/8] Ollama API integration tests (mock server)"
node --test tests/ollama.integration.mjs

echo "[4/8] Hosted AI integration tests (mock OpenAI-compatible server)"
node --test tests/hosted-ai.integration.mjs


echo "[6/8] Research / transcript / transcription integration tests"
node --test tests/research-tools.integration.mjs

echo "[7/8] Static application contract tests"
python -m pytest -q tests/contract_test.py

echo "[8/8] GitHub Pages static-route smoke test"
python - <<'PY'
from pathlib import Path
root=Path('.')
for rel,marker in [('index.html','NotebookLM+'),('js/app.js','sendQuestion'),('sw.js','notebooklmplus-v0.8.3-suite-ui-cleanup')]:
    data=(root/rel).read_text(errors='ignore')
    assert marker in data,(rel,marker)
print('PASS NotebookLM+ static route assets')
PY

echo "All tests passed."
