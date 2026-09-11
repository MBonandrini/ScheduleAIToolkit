# Project Controls AI Suite v1.2.1

## Schedule Assessment fixes

1. **Activity Register resizable columns**
   - Added visible vertical drag handles to every activity-register heading.
   - Uses pointer dragging and persists widths in browser local storage.
   - Horizontal width expands with the resized columns rather than forcing neighbouring columns to collapse.

2. **Critical Path resizable columns**
   - Reworked the Critical / zero-float table around a `<colgroup>` so dragging changes the actual column width, not just the header cell.
   - Added visible drag separators and persistent widths.

3. **Milestone Control correction**
   - Milestone recognition now reads `activityType`, `task_type`, and legacy/raw XER `raw.task_type`.
   - Recognises Primavera milestone task types including `TT_Mile`, `TT_StartMile`, and `TT_FinMile`.
   - Stored schedules are re-hydrated on load, so schedules imported before this fix are corrected without needing to be re-imported.
   - Avoids treating string `"0"` as a true milestone flag.

## Validation

- 22/22 normal automated test suites pass.
- Exhaustive stress / volume / boundary suite passes.
- Added regression coverage for legacy raw-XER milestone recognition and both persistent resize implementations.

## Deployment

The GitHub Pages asset query version is now `v=1.2.1` to force browsers to retrieve the updated JavaScript and CSS after deployment.
