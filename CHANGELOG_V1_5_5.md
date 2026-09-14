# Project Controls AI Suite v1.5.5

## WBS / Gantt and Critical Path
- Rebuilt WBS grouping to use the schedule WBS parent/child table rather than only the activity's immediate WBS label.
- Both WBS/Gantt and Critical Path now display the complete WBS ancestry and parent bands.
- Activity WBS fields use the reconstructed full path when the imported activity contains only a direct WBS reference.
- WBS bands are hierarchical and collapsible. Double-click a WBS band to collapse/expand all descendant WBS bands, activity rows and matching Gantt bars.
- Collapse state is retained independently for the WBS/Gantt and Critical Path layouts in local browser storage.
- Relationship overlays redraw after collapse/expand so links remain aligned only to visible activities.

## Risk Analysis
- Removed the AI Risk Review chat/conversation panel.
- Risk register, CSV round-trip and QSRA/Monte Carlo functions remain unchanged.

## Claims & Forensics
- Removed the Forensic Planning Assistant chat/conversation panel.
- Added an **Identify Delay Events** analysis area below the existing claims tools.
- Two schedules are selected explicitly as earlier/reference and later/comparison schedules; upload order is not assumed.
- Automatic candidate events are generated from confirmed schedule-data differences including:
  - later activity starts and finishes;
  - duration increases;
  - calendar assignment changes;
  - resource/loading changes;
  - constraint changes;
  - relationship/logic additions and removals;
  - added and removed activities.
- Candidate events are editable before acceptance and can be selectively added to the Delay / Change Event Register.
- Accepted events retain category, observed movement days, activity IDs, description and identification source.
- Claims CSV import/export now includes Category, Impact Days and Source while remaining backward compatible with older CSVs.
- The analysis explicitly states that schedule-data observations are not contractual entitlement conclusions.

## Settings
- Repacked Settings cards using a responsive masonry-style two-column flow, removing large blank gaps caused by unequal card heights.
- Settings automatically return to a single column on narrower displays.

## Testing
- Added a dedicated v1.5.5 regression suite for WBS ancestry/collapse, chat removal, delay-event categorisation and Settings layout.
- Full regression suite: 30/30 passing.
- Exhaustive stress/volume/boundary suite passes.
