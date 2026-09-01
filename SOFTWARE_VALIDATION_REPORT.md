# Software Validation Report

## Release

Schedule AI Toolkit web workbench — master-feature integration build.

## Modules reviewed

- Shared application shell and repository
- XER parser and normalized schedule model
- Schedule Assessment
- Risk Analysis
- Claims & Forensics
- Contract Manager
- Drawing Measurement
- Schedule Builder
- Shared AI/OmniRoute service
- PDF/Excel/reporting paths

## Automated/static tests performed

- JavaScript syntax validation across every JavaScript file
- Local CSS/JS asset-reference validation
- Report-definition to report-handler coverage check
- Report-category coverage check
- Synthetic P6 XER parser test
- Malformed-row parser test
- Duplicate-activity identifier test
- Orphan-relationship test
- Raw XER value preservation test
- Dynamic unknown-table summary test
- 10,000-activity performance test
- 50,000-relationship performance test

## Results

All current automated/static validation checks pass.

Large synthetic schedule after relationship-index optimisation:

- Activities: 10,000
- Relationships: 50,000
- Parse/normalize time observed in the test environment: approximately 0.14–0.16 seconds
- Incremental heap observed during the test: approximately 30 MB

The earlier implementation took approximately 19 seconds on the same synthetic test because predecessor/successor assignment repeatedly scanned the full relationship array. That algorithm was replaced with indexed incoming/outgoing relationship maps.

## Newly integrated master-brief capabilities

- Searchable schedule viewer
- Activity Inspector
- Raw TASK/XER activity data drill-down
- Import Diagnostic Report
- What Changed dashboard
- Material-change classification
- Critical Path Intelligence and path migration
- Why Did My Date Move? evidence-ranked analysis
- Dedicated Float Analysis
- Dedicated Logic Quality Analysis
- Progress Integrity and potential out-of-sequence screening
- Stalled high-completion activity screening
- Schedule Time Machine
- Milestone Trend Analysis
- Forecast Stability Index
- Resource, EVM and productivity screening
- Calendar Analyser
- Constraint Analyser
- Baseline Analysis
- Configurable lookahead generator
- Evidence-based schedule narrative
- Executive Schedule Dashboard
- Analysis threshold settings
- Multi-sheet Excel export
- Portable Schedule Assessment project backup/restore
- Structured in-memory diagnostic logging
- Raw XER source preservation

## Known limitations

- Exact Primavera proprietary scheduling semantics cannot always be reconstructed solely from XER data. Driving-path and causation outputs therefore identify confidence/assumptions rather than pretending exact P6 equivalence.
- Calendar exception strings are retained in raw data, but complete proprietary P6 calendar-rule emulation is not yet claimed.
- Resource overload cannot be proven where maximum availability/capacity information is absent from the source.
- EVM values are only calculated where source fields support them; missing AC or resource units are never fabricated.
- Browser storage remains less suitable than a desktop database for very large portfolios and long revision histories.
- Full persistent structured log files, installer, command-line automation and Windows-native repository backup belong to the packaged desktop phase.
- Live UI smoke testing is environment-dependent; syntax, parser, data-integrity and performance tests were executed in this build environment.

## Release readiness

The web build is suitable for continued planner testing and controlled real-world evaluation. It should not yet be represented as a Primavera-certified CPM replacement. The intended role remains an analytical, forensic and reporting layer above imported P6 data.


# Validation Addendum — 31 August 2026

## Release candidate scope

This addendum validates the Tutorial / AI Setup work and direct Ollama integration.

## Tests performed

| Area | Test | Result |
|---|---|---|
| JavaScript | Syntax validation for all JS modules | PASS |
| XER Parser | Simple XER regression | PASS |
| XER Parser | Malformed-row detection | PASS |
| XER Parser | Duplicate activity detection | PASS |
| XER Parser | Orphan relationship detection | PASS |
| Performance | 10,000 activities | PASS |
| Performance | 50,000 relationships | PASS |
| AI | Ollama appears in shared catalogue | PASS |
| AI | Ollama URL normalization | PASS |
| AI | Installed-model discovery | PASS |
| AI | Native `/api/chat` response | PASS |
| AI | Shared AI service routes through Ollama | PASS |
| AI | No-model diagnostic | PASS |
| AI | Server-error diagnostic | PASS |
| AI | CORS/network diagnostic | PASS |
| AI | Live local HTTP mock integration | PASS |
| UI Structure | Tutorial tab registered in suite shell | PASS |
| UI Structure | Tutorial assets resolve | PASS |
| UI Structure | Global light/dark mode inherited | PASS |
| Reports | 34 definitions match 34 handlers | PASS |
| HTML | Duplicate ID scan | PASS |
| CSS | Structural brace check | PASS |

## Known deployment dependency

A GitHub Pages website calling local Ollama requires the deployed site origin to be accepted by Ollama through `OLLAMA_ORIGINS`. This is enforced outside the web application and cannot be bypassed safely by client-side code.

## Release readiness

The direct Ollama implementation and tutorial functionality are suitable for release subject to a final smoke test from the actual deployed GitHub Pages origin on a Windows machine with Ollama installed.


# Validation Addendum — NotebookLM+ / OmniRoute Integration

**Date:** 1 September 2026

NotebookLM+ v0.7.0 has been incorporated as a separate suite tab. Its original notebook repository remains independent from the Project Controls shared repository. The application inherits the suite light/dark theme through the parent theme message.

AI configuration now provides explicit Ollama, OmniRoute, and generic OpenAI-compatible modes. OmniRoute defaults to `http://localhost:20128/v1` and the `auto` route. Credentials, when endpoint authentication is enabled, remain session-memory only. Normal keyless local OmniRoute uses the same non-empty placeholder bearer approach as the shared Project Controls AI service.

All automated regression and integration tests listed in `TESTING.md` passed. No unresolved code-level regression was found during this integration cycle. A final deployed-origin browser smoke test remains recommended because CORS and local-network permissions are enforced by the user's browser and local AI service.


# Release Validation Addendum — 1 September 2026

## Scope

Validation was repeated after restoring the dedicated AI/Ollama Configuration and Settings workspaces and retaining the Setup Tutorial and NotebookLM+ integration.

## Iterative defects found and fixed

1. The dedicated Settings workspace initially wrote the theme preference to a storage key different from the global theme service. This was detected by the new shell/settings contract test, corrected to `projectControlsTheme`, and the regression test now enforces the correct key.

## Automated validation results

- 44 JavaScript modules: syntax PASS.
- All HTML local script/style references: PASS.
- Duplicate HTML ID scan: PASS.
- CSS structural brace validation: PASS.
- 10 shell tabs matched against 10 registered application routes: PASS.
- All application routes physically present and HTTP-served: PASS.
- AI/Ollama Configuration: OmniRoute test wiring, Ollama discovery and Ollama chat test wiring: PASS.
- Setup Tutorial: Ollama `OLLAMA_ORIGINS` guidance and OmniRoute connection test guidance: PASS.
- Shared Ollama integration: 10/10 checks PASS.
- XER parser core regression: PASS.
- Malformed-row, duplicate-ID and orphan-relationship diagnostics: PASS.
- 300 randomized/malformed XER fuzz cases: no uncaught exceptions.
- 10,000 activities / 50,000 relationships: repeated passes around 130–156 ms in this environment.
- 25,000 activities / 100,000 relationships: PASS at approximately 287–291 ms, ~63 MB incremental heap in this environment.
- NotebookLM+ unit suite: 26/26 PASS.
- NotebookLM+ Ollama integration: 8/8 PASS.
- NotebookLM+ generic hosted-AI integration: 9/9 PASS.
- NotebookLM+ OmniRoute integration: 4/4 PASS.
- NotebookLM+ research/transcript/transcription integration: 4/4 PASS.
- NotebookLM+ static application contracts: 42/42 PASS.
- GitHub Pages static-server smoke test: PASS.
- Root and all 10 application pages served over a local HTTP server: PASS.

## Browser-E2E limitation

The Playwright browser runtime available in this execution environment is blocked by administrator policy from navigating to localhost (`ERR_BLOCKED_BY_ADMINISTRATOR`). The existing NotebookLM+ browser E2E suite therefore cannot execute here even though the same static server is reachable through ordinary HTTP clients. This is an environment restriction, not an application test failure.

A final browser smoke test should be run from the deployed GitHub Pages origin on the target Windows/browser configuration. This is particularly important for local-network permission and CORS when connecting to Ollama or OmniRoute.

## Release position

All automated tests that can execute in this environment pass. No software can responsibly be certified as “100% defect-free”; release readiness remains subject to the final deployed-browser smoke test and testing against representative real production XER/document sets.
