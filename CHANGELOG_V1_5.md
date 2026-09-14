# Project Controls AI Suite v1.5.0 — Changelog

Release date: 14 September 2026

## Professional Critical Path and WBS Gantt
- Rebuilt the left-hand activity table as a configurable P6-style field layout rather than a single fixed activity band.
- Added a **Columns / Field Chooser** with Available Fields and Displayed Fields lists.
- Fields can be added, removed and reordered, with independent saved layouts for Critical Path and WBS/Gantt.
- Displayed columns have individual draggable resize handles and persist locally in the browser.
- Expanded the field catalogue to activity ID/name, WBS, status, start/finish, baseline dates, original/remaining duration, total/free float, percent complete, calendar, constraint, resource, budget/actual/remaining units and budget/actual/remaining cost.
- Added P6-style Gantt display controls for baseline bars, actual-start markers, progress fill, data-date line, WBS grouping, bar labels, normal/critical/baseline/progress colours and bar height.
- Existing timescale/date-range controls and orthogonal P6-style relationship lines remain available.

## S-Curve / Histogram
- Added multi-resource filtering for activity, units/man-hours and cost profiles.
- Added individual-resource profile mode.
- Added explicit From / To date controls.
- Added **Expand 4w**, **Contract 4w** and **Full range** controls.
- Planned, Actual and Forecast can be shown/hidden independently.
- Weekly line and histogram series react to the selected basis, resources, date window and visible series.
- Weekly Friday-axis convention and copyable weekly data remain available.

## Risk Analysis CSV
- Added Risk Register CSV import and export.
- CSV import supports quoted values and commas inside fields.
- Imported risks are normalised into the internal risk register and can subsequently be used for schedule/QSRA analysis when a schedule is active.
- CSV import/export remains available even when no schedule is selected.

## Claims & Forensics CSV
- Added Claims / Delay Event CSV import and export.
- Imported event data includes code, title/event, date, description, affected activities, milestone, notice and instruction references.
- CSV import/export remains available without an active schedule; schedule evidence-pack generation remains schedule-dependent.

## Schedule Builder — complete wizard rebuild
The old flat builder has been replaced with a guided 12-step schedule-generation wizard:
1. Schedule Type
2. Detail Level (Level 3 / 4 / 5)
3. Schedule Specifications
4. Disciplines
5. Phases
6. Responsibility Matrix
7. Milestone Dates
8. Similar Schedules
9. Reference Documents
10. Reference Drawings / Models
11. Calendars & Public Holidays
12. Review & Generate

### Responsibility matrix
- Responsibility rows change according to schedule type.
- Includes design maturity/control gates such as 30%, 60%, 90% and IFC/AFC design plus schedule-type-specific control points.
- Responsibility can be assigned to Client, PM, Designer/Consultant, Main Contractor, Subcontractor, Vendor/OEM, Commissioning Agent or Other.

### References
- Similar schedules are explicitly selected and are never assumed to be revisions of one another.
- Specifications, documents and drawings/models are selected explicitly from the project repository.
- Only the files selected in the wizard are included in the schedule-generation AI context.

### Calendars and holidays
- Added multiple named calendars.
- Built-in patterns: 5 days Mon–Fri, 6 days Mon–Sat, 7 days Mon–Sun, or custom working days.
- Configurable hours per working day and applicability by phase/discipline.
- Optional country/national public-holiday profile plus custom non-working dates.
- Country options include Ireland, United Kingdom, South Africa, United States, Australia, Canada, Germany, France, Netherlands, Belgium, Spain and Italy, plus **No national profile**.
- New schedules default to **No national profile** so a country is never silently assumed.
- Generated activity dates are normalised against the chosen working days and holiday exclusions.
- Built-in holiday rules are planning aids; project, regional, collective-agreement and contractual calendars should still be checked before issue.

### AI generation workflow
- Final Review & Generate step summarises the complete wizard configuration and selected references.
- Generate is disabled until a compatible AI engine is selected/applied in Settings.
- Generation shows a visible progress bar and progress log.
- AI is instructed to return structured schedule JSON; generated rows are normalised through the selected calendars into an editable activity table.
- If AI output is not valid schedule JSON, the builder falls back to a deterministic wizard-based scaffold so the user is not left with an unusable screen.
- Generated schedule rows remain editable and can be exported as CSV.

## Validation
- 25/25 normal automated test suites pass.
- Exhaustive stress/volume/boundary suite passes.
- v1.5-specific tests cover Gantt field chooser/layout persistence, S-Curve resource/date/series filtering, quoted CSV parsing/import-export contracts, builder workflow, AI context scoping, AI gating/progress, calendar profiles and public-holiday working-day calculations.
