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
node tests/parser-fuzz-tests.js >"${TMPDIR:-/tmp}/pcai_fuzz_$$.log"
tail -1 "${TMPDIR:-/tmp}/pcai_fuzz_$$.log"
echo '[7/9] XER 25k/100k stress'
node tests/parser-stress-extra.js | tail -2
echo '[8/9] NotebookLM+ full non-browser suite'
(cd apps/notebooklmplus && bash tests/run_tests.sh)
echo '[9/9] Static route compatibility'
python - <<'PY'
from pathlib import Path
paths=['index.html','apps/contract-manager/index.html','apps/drawing-measurement/index.html','apps/schedule-assessment/index.html','apps/risk-analysis/index.html','apps/claims-forensics/index.html','apps/notebooklmplus/index.html','apps/settings/index.html','apps/schedule-builder/index.html']
for p in paths:
 b=Path(p).read_bytes(); assert len(b)>100,(p,len(b))
print('PASS all 9 static routes')
PY
echo 'RELEASE VALIDATION PASS'
