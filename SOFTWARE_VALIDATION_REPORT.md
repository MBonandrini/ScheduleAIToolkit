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
