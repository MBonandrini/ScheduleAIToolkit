#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo '[1/9] JavaScript syntax'
while IFS= read -r f; do node --check "$f" >/dev/null; done < <(find . -name '*.js' -type f)
echo 'PASS JavaScript syntax'
echo '[2/9] HTML/CSS/local assets'
python - <<'PY'
from pathlib import Path
from bs4 import BeautifulSoup
import sys
root=Path('.')
errs=[]
for html in root.rglob('*.html'):
 t=html.read_text(errors='ignore'); soup=BeautifulSoup(t,'html.parser')
 ids=[x.get('id') for x in soup.find_all(attrs={'id':True})]
 dup=sorted({x for x in ids if ids.count(x)>1})
 if dup: errs.append(f'{html}: duplicate IDs {dup}')
 for tag,attr in [('script','src'),('link','href')]:
  for el in soup.find_all(tag):
   v=el.get(attr)
   if not v or v.startswith(('http://','https://','data:','#','mailto:')): continue
   p=(html.parent/v.split('?',1)[0].split('#',1)[0]).resolve()
   if not p.exists(): errs.append(f'{html}: missing {v}')
for css in root.rglob('*.css'):
 t=css.read_text(errors='ignore')
 if t.count('{')!=t.count('}'): errs.append(f'{css}: CSS brace mismatch')
if errs:
 print('\n'.join(errs)); sys.exit(1)
print('PASS HTML/CSS/local assets')
PY
echo '[3/9] Shell/settings/tutorial contracts'
node tests/suite-contract-tests.js
echo '[4/9] Shared AI/Ollama integration'
node tests/ai-provider-tests.js
echo '[5/9] XER parser regression + 10k/50k performance'
node tests/parser-tests.js
echo '[6/9] XER malformed/random fuzzing'
node tests/parser-fuzz-tests.js >/tmp/pcai_fuzz.log
tail -1 /tmp/pcai_fuzz.log
echo '[7/9] XER 25k/100k stress'
node tests/parser-stress-extra.js | tail -2
echo '[8/9] NotebookLM+ full non-browser suite'
(cd apps/notebooklmplus && bash tests/run_tests.sh)
echo '[9/9] Static HTTP routes'
python -m http.server 8899 --bind 127.0.0.1 >/tmp/pcai_http.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT
sleep .5
python - <<'PY'
import urllib.request
paths=['','apps/contract-manager/','apps/drawing-measurement/','apps/schedule-assessment/','apps/risk-analysis/','apps/claims-forensics/','apps/ai-configuration/','apps/tutorial/','apps/notebooklmplus/','apps/settings/','apps/schedule-builder/']
for p in paths:
 with urllib.request.urlopen('http://127.0.0.1:8899/'+p,timeout=5) as r:
  b=r.read(); assert r.status==200 and len(b)>100,(p,r.status,len(b))
print('PASS all 11 static routes')
PY
kill "$PID" 2>/dev/null || true
trap - EXIT
echo 'RELEASE VALIDATION PASS'
