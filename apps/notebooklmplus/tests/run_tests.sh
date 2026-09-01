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

echo "[5/8] OmniRoute integration tests (mock routed endpoint)"
node --test tests/omniroute.integration.mjs

echo "[6/8] Research / transcript / transcription integration tests"
node --test tests/research-tools.integration.mjs

echo "[7/8] Static application contract tests"
python -m pytest -q tests/contract_test.py

echo "[8/8] GitHub Pages static-server smoke test"
PORT=8768
python -m http.server "$PORT" --bind 127.0.0.1 >/tmp/notebooklmplus-http.log 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
sleep 1
SMOKE_DIR="$(mktemp -d)"
trap 'rm -rf "$SMOKE_DIR"; kill "$SERVER_PID" 2>/dev/null || true' EXIT
curl --fail --silent --show-error "http://127.0.0.1:$PORT/" -o "$SMOKE_DIR/index.html"
curl --fail --silent --show-error "http://127.0.0.1:$PORT/js/app.js" -o "$SMOKE_DIR/app.js"
curl --fail --silent --show-error "http://127.0.0.1:$PORT/sw.js" -o "$SMOKE_DIR/sw.js"
grep -q 'NotebookLM+' "$SMOKE_DIR/index.html"
grep -q 'sendQuestion' "$SMOKE_DIR/app.js"
grep -q 'notebooklmplus-v0.7.1-suite' "$SMOKE_DIR/sw.js"
rm -rf "$SMOKE_DIR"
kill "$SERVER_PID" 2>/dev/null || true
trap - EXIT

echo "All tests passed."
