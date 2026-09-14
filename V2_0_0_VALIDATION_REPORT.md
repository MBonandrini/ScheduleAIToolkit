# v2.0.0 Validation Report

## Scope
Validation covers the requested expansion of the multi-schedule Forensic Review into collapsible evidence sections for Activities, Progress, Resourcing, Calendars and Relationships.

## Functional validation
### Activities
- Activity additions and removals are identified for every adjacent selected revision pair.
- Detail includes activity ID/name, WBS and status.
- Removed items render with deletion emphasis.

### Progress
- Percent-complete movement is captured for common activities.
- Actual Start and Actual Finish additions, removals and date changes are captured independently.
- Progress reset/reduction is distinguishable from normal progress increase.

### Resourcing
- Revision-level Budget/Target, Actual, Remaining and At Completion unit totals are calculated.
- Resource-master additions/removals/changes are retained.
- Activity-resource assignment additions/removals are retained.
- Actual Units and At Completion Units show previous/current/delta values for changed assignments.

### Calendars
- Calendar additions/removals/definition changes are retained.
- Activity calendar-assignment changes are separately identified.

### Relationships
- True relationship additions/removals are retained.
- Same predecessor/successor relationships with modified type and/or lag are classified as Changed rather than being double-counted as an add plus a remove.

## Automated validation
- Added `tests/v2.0.0-forensics-detail.test.js`.
- The fixture contains activity addition/removal, progress movement, actual-date addition/removal, resource master and loading changes, calendar definition and assignment changes, and relationship add/remove/change cases.
- Normal regression suite: **32/32 PASS** before release packaging.
- Exhaustive stress/volume/boundary suite: **PASS** before release packaging.

## Exhaustive coverage retained
The exhaustive suite continues to cover parser fuzzing, 50,000-activity / 200,000-relationship parsing and health analysis, 10,000-activity comparisons, deep network chains and 5,000-case Monte Carlo/boundary testing.

## Release verification
The final GitHub-ready ZIP is extracted into a clean directory, its SHA-256 release manifest is verified, and both normal and exhaustive suites are rerun from the packaged copy before release.
