# v1.5.0 Validation Report

Date: 14 September 2026

## Result

**PASS — development tree**

The complete v1.5 development tree passed the normal regression suite and exhaustive stress/volume/boundary suite before packaging. A clean-extraction package verification is performed after the final release archive and manifest are generated.

### Normal suite
- 25 / 25 suites passed.
- Includes all previous release regression contracts plus the new v1.5 requested-change contract.

### Exhaustive suite
Passed in the development release run with:
- 3,000-case parser fuzz: ~161 ms
- 50,000 activities / 200,000 relationships parse: ~823 ms
- 50,000 activities / 200,000 relationships health analysis: ~371 ms
- 10,000-activity comparison: ~126 ms
- deep-chain network analysis: ~209 ms
- 5,000-case Monte Carlo/boundary test: ~40 ms
- exhaustive suite total: ~2.29 s

Timing is environment-specific and is recorded as a regression indicator only.

## v1.5 request-specific checks

### Professional Critical Path / WBS Gantt
PASS:
- shared P6-style field catalogue;
- Available / Displayed field chooser;
- add/remove/reorder/reset field controls;
- per-field draggable column dividers;
- independent Critical Path and WBS saved layout keys;
- configurable baseline / actual / progress / data-date / WBS grouping;
- bar label, colour and bar-height controls;
- compatibility with existing timescale/date-range and orthogonal relationship rendering.

### S-Curve / Histogram
PASS:
- activity / units / cost / single-resource bases;
- multiple-resource filter path;
- From / To date filtering;
- 4-week expand / contract / full-range controls;
- independent Planned / Actual / Forecast visibility;
- resource-filtered unit totals and focused date-window regression checks.

### Risk / Claims CSV
PASS:
- Risk CSV import/export controls;
- Claims CSV import/export controls;
- quoted CSV values and embedded commas;
- import/export available without an active schedule while schedule-dependent calculations remain guarded.

### Schedule Builder
PASS:
- 12-step workflow contract;
- Level 3 / 4 / 5 choices;
- discipline / phase selection;
- schedule-type-dependent responsibility matrix including 30% design controls;
- milestone editor;
- explicit similar-schedule/reference-document/reference-drawing selection;
- explicit AI context file scoping;
- AI readiness gate;
- progress bar/log;
- generated schedule normalisation / editable output path.

### Calendars / public holidays
PASS:
- 5-day, 6-day, 7-day and custom working-week controls;
- multiple calendar support;
- hours/day and applicability fields;
- no-country default to prevent silent jurisdiction assumptions;
- country/public-holiday selection and custom holidays;
- Ireland 2026 St Patrick's Day fixture;
- custom non-working-day fixture;
- working-day addition across national + custom exclusions.

## Existing release regressions
All v1.2, v1.3 and v1.4 request-specific suites remain passing, including Schedule Comparison, milestone handling, P6-style Gantt links/ranges, NotebookLM+ layout/output pane, threshold graphics, Gemini/Grok routing and repository isolation.

## Environment limitations
- The Windows-native MPP conversion helper cannot be executed against Microsoft Project inside this Linux validation container. Post-conversion MSPDI parsing remains covered by golden tests.
- Cloud API live calls are not made without user credentials; Gemini/Grok routing is covered by mocked contract tests.
- Browser pointer/drag behaviour is covered through renderer/UI contracts; sandbox restrictions may prevent full hosted loopback acceptance testing.

The final delivery report records the clean-extraction result, file-manifest verification and ZIP SHA-256.
