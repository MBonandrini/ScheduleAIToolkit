# v1.4.0 Validation Report

Date: 11 September 2026

## Result

**PASS**

The complete v1.4 development tree passed both the normal regression suite and the exhaustive stress/volume/boundary suite before packaging.

### Normal suite
- 24 / 24 suites passed.
- Includes all previous v1.2 and v1.3 regression contracts plus the new v1.4 contract.

### Exhaustive suite
Passed with the following measured cases in the release run:
- 3,000-case parser fuzz: ~313 ms
- 50,000 activities / 200,000 relationships parse: ~2,003 ms
- 50,000 activities / 200,000 relationships health analysis: ~1,219 ms
- 10,000-activity comparison: ~254 ms
- deep-chain network analysis: ~494 ms
- 5,000-case Monte Carlo/boundary test: ~60 ms

Timing is environment-specific and is recorded only as a regression indicator, not a user-machine performance guarantee.

## v1.4 request-specific checks

### Schedule Comparison
PASS:
- calendar additions/deletions/changes;
- resource additions/deletions/changes;
- activity-resource loading additions/deletions/changes;
- resource-change flag on activity deltas;
- red deleted-item rendering contract.

### Critical Path / WBS Gantt
PASS:
- explicit start and finish date inputs;
- Full Range reset;
- weeks/months/quarters/years selector retained;
- adaptive narrow-segment class/rotation contract;
- orthogonal H/V/H dependency routing contract;
- P6-style square line CSS;
- resizable WBS/activity band retained.

### DCMA-style visualisation
PASS:
- actual value and threshold share one visual scale;
- explicit threshold marker;
- PASS/FAIL colour state;
- zero-cycle target treatment.

### Schedule Narrative
PASS:
- collapsed full activity register;
- all activity fields generated;
- critical/zero-float red-highlight contract.

### NotebookLM+
PASS:
- no separate Outputs subtab;
- right-side Outputs pane;
- per-output customisation prompt;
- HTML/SVG/CSV/text downloads;
- local speech playback path;
- fixed-height notebook chat with bottom composer;
- internal output-pane scrolling.

### Gemini / Grok
PASS (mocked network contract tests):
- Gemini and Grok are present in the global AI catalogue;
- defaults are `gemini-3.8-flash` and `grok-4.6`;
- key/model configuration persists through localStorage;
- Gemini REST request format/response parsing;
- Grok chat-completions request format/response parsing;
- clear-key path;
- no API key is embedded in the production source/repository.

## Security note

The requested locally persistent Gemini/Grok keys are stored in browser localStorage and therefore remain client-side credentials. The UI warns users that this is less secure than server-side secrets. Production/shared deployments should use a backend or Worker proxy where practical.

## Environment limitations

As with v1.3, the Linux validation container cannot execute the Windows-native MPP conversion helper against Microsoft Project itself. The MSPDI parser and the post-conversion internal model are covered by automated golden tests. Browser interaction is validated through renderer/UI contracts; this environment's browser sandbox restrictions may prevent a full hosted loopback acceptance run.

A clean-extraction package verification is performed after the release ZIP is created. The final delivery message reports the verified package hash.
