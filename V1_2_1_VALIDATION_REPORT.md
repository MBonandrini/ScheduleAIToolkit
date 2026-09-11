# Project Controls AI Suite v1.2.1 Validation Report

## Requested changes validated

### Activity Register column resizing
- Each header has an explicit pointer-based drag separator.
- Column widths update while dragging.
- The virtual grid and its rows use the same CSS grid column definition.
- Total table width grows/shrinks with the selected column.
- Widths are persisted as `pcai.activityRegisterWidths` in browser local storage.

### Critical Path column resizing
- The table now renders a `<colgroup>` and drag handles for every header.
- Dragging updates the corresponding `<col>` width, so header and body remain aligned.
- Total table width is recalculated while dragging and can horizontally scroll where required.
- Widths are persisted under `pcai.tableWidths.criticalPath`.

### Milestone Control
- Milestone detection supports display labels containing `Milestone`.
- Primavera task types ending in `Mile` are recognised, including `TT_Mile`, `TT_StartMile`, and `TT_FinMile`.
- Legacy normalized schedules are repaired from `raw.task_type` during hydration.
- Schedules loaded from IndexedDB are re-hydrated before use, so re-import is not required for this fix.
- String milestone flags such as `"0"` are no longer treated as truthy.

## Automated validation

- 22/22 normal test suites: PASS
- Exhaustive stress / volume / boundary suite: PASS
- Syntax / import graph checks: PASS
- GitHub Pages deployment checks: PASS

The final package is versioned 1.2.1 and uses `?v=1.2.1` asset cache busting in `index.html`.
