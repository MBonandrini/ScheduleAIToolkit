# v1.5.4 Validation Report

## Scope

Validated the optional Drawing Measurement **Align to schedule** workflow: schedule selection enforcement, supported file filtering, recommendation logic, BOQ recommendation column, CSV output and regression compatibility.

## Results

- Normal automated suites: **29 / 29 PASS**.
- Exhaustive stress / volume / boundary suite: **PASS**.
- Parser fuzz: 3,000 cases PASS.
- 50,000 activities / 200,000 relationships volume case PASS.
- 10,000 activity comparison case PASS.
- Deep-chain network case PASS.
- 5,000-case Monte Carlo / boundary case PASS.

## v1.5.4-specific checks

- Align to schedule defaults off.
- Enabling alignment exposes a required schedule selector.
- Selector is restricted to PDF / XML / XER repository files.
- Generate is disabled / guarded until a schedule is selected when alignment is enabled.
- Recommended Activity ID(s) remains separate from manual Activity ID.
- XER/XML activity matching uses parsed schedule data.
- PDF text candidate extraction identifies activity-ID / name pairs.
- Construction-word normalisation improves install/installation and singular/plural matching.
- CSV BOQ receives Recommended Activity ID(s) and preserves quoted fields.
- Existing v1.2 through v1.5.3 contracts remain passing.

## Browser-only dependency note

PDF.js 6.3.289 is loaded on demand for PDF text extraction and SheetJS CE 0.20.3 is loaded on demand for XLS/XLSX workbook rewriting. Their network availability is therefore required for those two optional paths. CSV and XML/XER alignment remain local.
