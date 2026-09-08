# UI Cleanup & Theme Revision Validation

## Requested changes delivered

1. Removed the duplicated per-tool AI/model status pills from Contract Manager, Drawing Measurement, Schedule Assessment, Claims & Forensics and Schedule Builder. The suite now exposes the AI model selection only through the global top-bar dropdown; configuration remains in Settings.
2. Reduced themes to exactly:
   - Dark
   - Light
   - Light · Dark Blue Contrast
3. Removed the icon/glyph before every suite tab name.
4. Swapped Schedule Builder and Settings so Schedule Builder now appears immediately before Settings.

## Regression protections

New automated checks verify:
- exactly one top-shell AI model selector;
- no mini-tool engine/model status pill remains;
- no `engineDot`, `engineStatus`, or `engineText` element remains in mini-tool headers;
- no tab icon markup remains;
- Schedule Builder precedes Settings;
- only the three requested themes are available;
- removed Slate, Midnight and Sand choices do not remain in the theme dropdown;
- the NotebookLM+ theme bridge supports the same three themes.

## Validation

Full `tests/run-release-validation.sh`: **PASS**

This includes:
- JavaScript syntax;
- suite/static route contracts;
- shared AI architecture;
- Ollama mock integration;
- schedule-report enhancement regression;
- shared repository AI context;
- XER parser regression/fuzz/stress;
- NotebookLM+ unit and integration tests;
- all nine static application routes.

The Python startup emitted unrelated spreadsheet-runtime warmup warnings in this environment, but the affected test suites still completed successfully (42 passed) and the release gate returned PASS.
