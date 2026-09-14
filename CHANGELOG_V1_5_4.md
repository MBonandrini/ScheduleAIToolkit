# Project Controls AI Suite v1.5.4

## Measurement — Align to schedule

- Added an optional **Align to schedule** checkbox to Drawing Measurement.
- When enabled, the user must select one schedule from a required dropdown before **Generate** is available.
- The schedule dropdown only lists repository **PDF, XML and XER** files.
- XML/XER alignment uses the toolkit's parsed schedule activity register.
- PDF alignment extracts the text layer and builds an activity ID / description index for recommendation matching.
- Added **Recommended Activity ID(s)** as a separate field. Manual **Activity ID** assignments are never overwritten.
- BOQ/activity matching uses construction-aware token normalisation and ranked textual similarity across BOQ item, description, category, discipline and schedule activity/WBS text.
- Existing CSV BOQs are rewritten with the recommendation column and downloaded as an aligned copy.
- Existing XLS/XLSX BOQs are rewritten client-side using SheetJS and downloaded as an aligned copy. The toolkit repository copy is also updated.
- **NEW BOQ Document** exports the same recommendation column.
- Alignment summary shows the selected schedule and matched/total rows.
- Alignment settings and results persist locally with the Measurement workflow.

## Dependencies

- CSV and XER/XML alignment remain self-contained.
- PDF alignment dynamically loads Mozilla PDF.js 6.3.289 when required.
- XLS/XLSX rewriting dynamically loads SheetJS Community Edition 0.20.3 when required.

## Validation

- Added a dedicated v1.5.4 regression suite covering UI contracts, required selection behaviour, recommendation ranking, PDF activity candidate extraction and CSV BOQ output.
- Normal regression suite: 29/29 passing.
- Exhaustive stress / volume / boundary suite: passing.
