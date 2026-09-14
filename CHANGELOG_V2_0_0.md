# v2.0.0 Changelog

## Forensic Review evidence drill-down
The multi-schedule Forensic Review now includes five collapsible evidence boxes beneath the existing revision summaries. Each box keeps a compact count visible when closed and expands into revision-by-revision charts and auditable detail tables.

### Activities
- Shows activities added and removed between each adjacent selected schedule revision.
- Includes Activity ID, activity name, WBS and status.
- Removed activities are highlighted in red.
- Includes a transition chart comparing additions and removals.

### Progress
- Shows percent-complete changes for common activities.
- Detects Actual Start and Actual Finish dates being added, removed or changed.
- Distinguishes progress increases from progress reductions/resets.
- Includes a transition chart for progress changes and actual-date additions/removals.

### Resourcing
- Adds total resource-loading charts across the selected revision sequence.
- Shows Budget/Target Units, Actual Units, Remaining Units and At Completion Units (Actual + Remaining).
- Shows resource-master additions, removals and definition changes.
- Shows activity-resource assignment additions/removals.
- Shows detailed Actual and At Completion changes, including before, after and delta values.

### Calendars
- Shows calendar additions, removals and definition changes.
- Separately shows activity calendar-assignment changes.
- Includes a transition chart covering calendar definitions and assignment movements.

### Relationships
- Shows relationship additions and removals.
- Relationship modifications are now identified separately when the predecessor/successor pair remains but type and/or lag changes.
- The detail view shows predecessor, successor, previous relationship and current relationship.
- Includes a transition chart for added, removed and changed relationships.

## Architecture
- Added `src/analysis/forensics.js` as the dedicated evidence-building layer for multi-revision forensic analysis.
- The evidence engine works across the existing explicit 2–10 schedule selection and respects data-date ordering.
- Existing Forensic Review summary charts/tables remain in place above the new drill-down evidence panels.

## Validation
- Added `v2.0.0-forensics-detail.test.js` covering all five evidence categories.
- Relationship testing includes one true addition, one true removal and one type/lag modification to prove modifications are not misclassified.
- Full legacy regression and exhaustive stress/volume/boundary coverage retained.
