# v1.5.5 Validation Report

## Scope
Validation covers the hierarchical WBS Gantt change, WBS collapse/expand behaviour, Risk/Claims chat removal, automatic Claims delay-event identification, Claims CSV extensions, and Settings layout cleanup.

## Automated regression
- **30/30 suites PASS**.
- Existing v1.2 through v1.5.4 regression suites remain passing.
- New `v1.5.5-requested-changes.test.js` verifies:
  - parent and child WBS bands render from the schedule WBS hierarchy;
  - the full WBS path is available to Gantt fields;
  - collapsed WBS state is rendered and descendant rows/bars are hidden;
  - double-click collapse is bound in the application;
  - Risk Analysis contains no Risk chat markup/binding;
  - Claims & Forensics contains no Claims chat markup/binding;
  - Identify Delay Events exists and feeds the Delay Event Register;
  - activity candidates detect later start/finish, duration, calendar, resource and logic changes;
  - Settings uses packed responsive columns.

## Exhaustive validation
The full stress/volume/boundary suite passes, including parser fuzzing, 50,000-activity / 200,000-relationship parsing and health analysis, 10,000-activity comparison, deep network chains and 5,000-case Monte Carlo/boundary coverage.

## Behavioural notes
- WBS hierarchy is reconstructed from explicit WBS IDs/parent IDs where available; `wbsPath` remains a fallback for sources without a usable hierarchy table.
- Critical Path includes only critical/zero-float activities but still renders every WBS ancestor required to show their full hierarchy.
- Collapsing a WBS branch hides descendant activities and therefore hides/redraws relationship links connected to those hidden rows.
- Delay candidates are deterministic observations of schedule differences. They do not constitute a legal, contractual or causation conclusion.
