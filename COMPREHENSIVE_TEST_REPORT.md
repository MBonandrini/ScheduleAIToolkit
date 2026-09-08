# Project Controls AI Suite — Comprehensive Validation Report

## Release status

**AUTOMATED RELEASE GATE: PASS**

The rewritten GitHub Pages build passed every automated suite and the additional exhaustive stress/volume suite.

## Defects found and corrected during validation

1. **UI contract regression**
   - The S-Curve and Histogram were intentionally split into two professional panels, but an older test still expected the combined heading.
   - The test was corrected to require both `Weekly S-Curve` and `Weekly Histogram`.

2. **Relationship lag double conversion**
   - XER/MS Project relationship lags were normalized to days by the parser and then divided by 24 again by the common model normalizer.
   - This was a real defect.
   - The model now treats an already-normalized `lag` value as days and only divides the raw P6 `lag_hr_cnt` field by 24.
   - Permanent regression tests verify:
     - 48 P6 lag hours = 2 days.
     - An already-normalized 1-day Microsoft Project lag remains 1 day.

3. **Recursive cycle detection stack overflow**
   - A very deep synthetic relationship chain could overflow the JavaScript call stack.
   - Cycle detection was rewritten as an iterative, stack-safe DFS.
   - A 20,000-activity deep chain now completes successfully.

4. **Revision progress comparison**
   - Added/deleted scope could distort the headline progress movement between revisions.
   - The comparison engine now calculates progress movement on comparable/common activities when available.

5. **Ollama unavailable classification**
   - The first version of the new Ollama diagnostic did not classify every unreachable-loopback wording as a likely installation/running/access issue.
   - The classification was corrected and is now regression-tested.

## Automated suites

All 18 primary suites passed:

1. Parser & file import — PASS
2. Network/driving path — PASS
3. Schedule comparison/golden movement — PASS
4. Health, confidence, narrative, weekly series — PASS
5. Calendar & data-centre readiness — PASS
6. Risk/QSRA & claims — PASS
7. Structured AI schedule tools — PASS
8. Microsoft Project XML golden results — PASS
9. Ollama native API compatibility — PASS
10. Ollama failure/recovery paths — PASS
11. Repository/multi-project integration — PASS
12. Shared AI runtime + repository context — PASS
13. Parser fuzz — PASS
14. Performance/volume — PASS
15. UI/GitHub Pages contracts — PASS
16. Master feature completeness contract — PASS
17. GitHub Pages deployment/import graph — PASS
18. Security — PASS

## Exhaustive stress suite

PASS:
- 3,000 randomized malformed XER inputs.
- 50,000 activities / 200,000 relationships parse.
- Health analysis on 50,000 / 200,000.
- 10,000-activity revision comparison.
- 20,000-activity deep dependency chain.
- 5,000-iteration deterministic Monte Carlo.

Most recent measured timings in this environment:
- 3,000-input fuzz pass: ~157 ms
- 50k / 200k parse: ~990 ms
- 50k / 200k health analysis: ~419 ms
- 10k revision comparison: ~148 ms
- 20k deep-chain graph analysis: ~183 ms
- 5,000-iteration Monte Carlo pair: ~29 ms

These timings are environment-specific and should not be treated as contractual performance guarantees.

## GitHub Pages validation

PASS:
- `.nojekyll` present.
- No server build required.
- Relative asset paths only.
- Relative module import graph resolves.
- Worker module URLs resolve.
- No root-relative application API dependency.
- GitHub Actions exhaustive-test workflow included.
- GitHub Pages deployment workflow included and deployment is gated on tests.
- Static subpath serving smoke test returned HTTP 200 for:
  - `/`
  - `assets/app.css`
  - `src/ui/app.js`
  - `src/ai/ollama.js`
  - `src/repository/repository.js`
  - schedule worker
  - Monte Carlo worker
  - `.nojekyll`
  - `404.html`

## Ollama validation

PASS:
- `GET /api/tags`
- `POST /api/show`
- `POST /api/chat`
- `POST /api/generate` fallback
- chat vs embedding model classification
- empty-chat fallback to generate
- thinking On / Off fallback
- progress HUD events
- localhost / 127.0.0.1 fallback
- missing Ollama / not-running / CORS guidance
- HTTP server errors
- checked Project Repository files injected into the actual AI request
- structured schedule tool result injected alongside repository evidence

The toolkit deliberately says **“Ollama was not detected”** rather than claiming it is definitely uninstalled, because a browser cannot reliably distinguish:
- not installed;
- installed but stopped;
- blocked by local-network/CORS policy.

## Security/static-hosting checks

PASS:
- no OmniRoute references;
- no embedded API keys/secrets;
- no `eval()` use;
- HTML escaping helper tested;
- CSV injection/quoting helper tested;
- one global AI selector only;
- only Dark, Light, and Light · Dark Blue Contrast themes;
- no obsolete tab icons;
- Schedule Builder precedes Settings;
- checked repository context remains central;
- Gantt remains light;
- critical Gantt bars remain red.

## Master feature contract

PASS for the requested architecture and improvements, including:
- central multi-project Project Repository;
- schedule revision lineage;
- structured AI schedule-query tools;
- canonical network engine;
- Why Did My Date Move;
- milestone control centre;
- professional Gantt;
- cross-report filtering;
- planner dashboard;
- Planner's Inbox;
- data-centre mode;
- forecast confidence;
- Monte Carlo P10/P50/P80/P90;
- risk-to-schedule mapping;
- claims evidence packs;
- AI evidence references;
- specialist AI roles using one global model;
- Web Workers;
- large-table virtualisation;
- browser project database;
- schedule comparison;
- Week-on-Week;
- DCMA-style check;
- delay analysis;
- forensic review;
- year-by-year calendar analysis;
- weekly S-Curve and Histogram;
- comparative schedule narrative;
- Resources/EVM;
- Cost Report;
- baseline/lookahead;
- Nodes & Links.

## Important environment limitation

The automated test suite is at **100% pass**.

That is not the same as claiming software can never contain a defect. This environment does not have the user's real Windows Ollama process, installed models, GitHub account/browser permissions, or a usable graphical Chromium session for interactive GUI UAT.

Before calling the deployment operationally accepted, perform a short live UAT on the real hosted GitHub Pages site:
1. Open the deployed site in Chrome or Edge.
2. Import two real P6 XER revisions.
3. Confirm Schedule Comparison, Critical Path, Calendar Analyser, S-Curve, Narrative and Gantt.
4. Tick `perun 3.xer` in the Project Repository.
5. Settings → Ollama → Check Ollama.
6. Detect models.
7. Test & Save.
8. Ask a schedule-specific question in at least two mini-tools.
9. Confirm the AI answer shows evidence filenames and the progress HUD.
10. Refresh the page and confirm the Project Repository and project selection persist.

No optimization work should begin until that live UAT is accepted.
