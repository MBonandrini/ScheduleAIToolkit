# Central AI UI / Shared Context Correction

## What was wrong
Several mini-tools still contained legacy code paths that tried to paint their own AI/model status (for example `Shared AI ready — model loads on first use` or a provider/model label). Even after the HTML status elements were removed, those JavaScript paths remained.

Separately, some mini-tools still treated their module-local `sources[]` array as the authoritative source of truth. When that array was empty they could say there were no uploaded project documents, even though checked files existed in the Shared Project Repository and were being injected by the central AI runtime.

The screenshots containing OmniRoute also prove that at least some deployed/cached assets were older than the current build; OmniRoute does not exist in the current production source. To prevent mixed-build loading, every local JS/CSS reference is now versioned.

## Corrections
- The top suite AI dropdown is the only user-facing AI/model selector/status surface outside Settings.
- Removed/no-op'd legacy per-module AI status rendering.
- Removed NotebookLM+'s redundant `Unified AI` status pill.
- Removed obsolete phrases such as:
  - `Shared AI ready — model loads on first use`
  - per-module `configured in Settings` badges
  - `Local AI loading was cancelled`
- Removed local-source-only blockers from:
  - Contract Manager analysis
  - Claims & Forensics analysis
  - Schedule Builder schedule generation
- Empty module-local source lists no longer claim that no project documents exist.
- Checked Shared Project Repository files remain the central chat context and are injected into every shared AI request.
- Module-local uploads remain optional supplementary inputs.
- Added cache-busting query versions to every local JS/CSS reference in every app HTML page.
- Updated all iframe route cache-busters.
- OmniRoute literal scan: zero production matches.

## Validation
- Central AI UI/context regression: PASS
- Selected Shared Repository XER -> Ollama request: PASS
- Deep Ollama compatibility: PASS
- Ollama 25-request concurrency stress: PASS
- JavaScript syntax: PASS
- XER 300-input fuzz: PASS
- XER 10k/50k performance: PASS
- XER 25k/100k stress: PASS
- NotebookLM+ tests: PASS
- All nine static routes: PASS
- Full release validation: **PASS**
