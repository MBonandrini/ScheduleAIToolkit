# Project Controls AI Suite v1.5.3

## Drawing Measurement workspace redesign

- Rebuilt the top of **Drawing Measurement** around two repository-backed source boxes.
- Added **Drawings to be measured** with a hierarchical tree derived from repository `relativePath` values and multi-select checkboxes.
- Added **BOQ** with the same repository hierarchy but single-select radio behaviour.
- Only `.csv`, `.xls` and `.xlsx` files can be selected as an existing BOQ target; all other repository files remain visible but are greyed out and disabled.
- Added **NEW BOQ Document** as the first BOQ destination option.
- Added a single **Generate** action beneath the two source boxes.
- Removed the previous Measurement AI chat/conversation panel and all Drawing Measurement chat bindings.
- Added a dedicated **Measurement & allocation settings** section below the source selection, including measurement mode, discipline, default unit, decimal precision, allocation method, grouping, rounding, source traceability and unallocated-item handling.
- Retained the existing editable **Measurement & allocation register**, Add Row and Export CSV functions below the settings.
- Persisted drawing selections, BOQ target and measurement settings in browser local storage.
- Removed stale file selections automatically when repository files are removed.
- Bumped GitHub Pages asset cache identifiers and package version to `v1.5.3`.
