# Project Controls AI Suite v1.3.0

## Dashboard
- Renamed **Data-Centre Readiness** to **Readiness**.
- Rebuilt **Revision Lineage** as five independent schedule selectors. Uploaded schedules are no longer assumed to be revisions of the same project.
- Dashboard lineage statistics and forecast-confidence inputs update only from the schedules explicitly selected in Revision Lineage.

## Schedule Assessment
- **Schedule Comparison:** explicit reference/comparison dropdowns; works with an empty repository and allows deliberately selected different projects with a warning.
- **Week-on-Week:** explicit earlier/later dropdowns; no upload-order assumption.
- **Critical Path:** interactive timescale selector (weeks/months/quarters/years), visible predecessor relationship links, and draggable WBS/Activity band width.
- **Logic & Health:** hover definitions added to health checks and headline metrics.
- **DCMA-style Check:** added a visual quality dashboard beneath the check statistics, with doughnut/ring, gauge, column, bar and area-style graphics.
- **Delay Analysis:** redesigned around an explicitly selected earlier/reference and later/impact schedule. Adds WBS delay concentration, critical migration, project movement, logic changes, and an activity-level evidence register. It is clearly labelled as schedule movement analysis rather than a contractual delay determination.
- **Forensic Review:** accepts up to 10 explicitly selected schedules, orders the selected set by data date, and compares adjacent updates for activity additions/removals, changed activities, relationship additions/removals, resource assignment changes, critical migration and forecast movement. Added change graphics and detailed tables.
- **S-Curve & Histogram:** added selectable basis for activity count, loaded units/man-hours, cost or an individual resource. Hovering chart points/bars exposes values. Weekly X-axis labels use Friday dates and are rotated vertically.
- **Forecast Confidence:** hover explanations now describe what each statistic means and why it affects confidence.
- **Schedule Narrative:** expanded deterministic narrative for phase/WBS position, progress, loaded units/man-hours, costs, resources, four-week starts/finishes, logic weaknesses, negative float, missed starts and roadblocks.
- **WBS/Gantt:** interactive timescale selector, visible relationship links, draggable WBS/Activity band, and filtering via the existing search/WBS/status/float controls.
- **Nodes:** smarter relationship layout, incoming/outgoing/issue hover details and zoom in/out/reset controls.
- **Time Machine:** now explains its purpose and uses up to eight explicitly selected schedules rather than inferred revisions.
- **Baseline & Lookahead:** explicit current/reference selectors, no revision assumption, and detailed next-four-week activities grouped by WBS.

## NotebookLM+
- Added a Notebook-only **Outputs** tab.
- Added deterministic downloadable HTML report, SVG summary graphic, activity-data CSV, and an audio-ready briefing script.
- Added local browser speech playback for the briefing script when the browser exposes SpeechSynthesis. Browser SpeechSynthesis does not expose a reliable downloadable audio stream, so the downloadable audio artifact is intentionally the script rather than a falsely labelled audio file.

## Microsoft Project MPP
- `.mpp` is now recognised as a schedule source in file import and linked folders.
- Added `setup-mpp-bridge.bat` plus a local Windows parser bridge. It converts binary MPP to Microsoft Project MSPDI XML locally, after which the site parses the result into the same internal editable schedule model as XER/XML.
- Expanded MSPDI parsing for WBS/summary hierarchy, activities, milestones, calendars, constraints, predecessor relationships, resources, assignments, work/units and cost fields.
- Added **Edit this schedule in Schedule Builder** from the Activity Register. Imported schedules, including converted MPP schedules, can be copied into the editable builder with WBS, dates, duration, predecessors and milestone status.

## Layout / GitHub Pages
- Responsive report navigation and auto-fit grids were strengthened so each report fits the available workspace without forcing the entire application wider than the page.
- Wide data tables, Gantts and graphics retain their own local scrolling where necessary.
- Asset cache-busting updated to **v1.3.0**.

## Testing
- 23/23 normal regression suites pass.
- Exhaustive parser fuzz, volume, deep-network, comparison and Monte-Carlo/boundary tests pass.
- Added a rich Microsoft Project MSPDI golden fixture and v1.3 request-specific contract tests.
