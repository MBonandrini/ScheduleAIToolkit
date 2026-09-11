# Project Controls AI Suite v1.4.0 — Changelog

Release date: 11 September 2026

## Schedule Assessment

### Schedule Comparison
- Added calendar-master comparison: added, deleted and changed calendars.
- Added resource-master comparison: added, deleted and changed resources.
- Added activity/resource assignment and loading comparison, including budget/target, actual and remaining units/cost values where present.
- Activity change rows now flag resource-assignment/loading changes.
- Deleted activities, relationships, calendars, resources and resource assignments are rendered in red.

### Critical Path and WBS/Gantt
- Added explicit **Timescale start** and **Timescale finish** date pickers plus **Full range** reset.
- Timescale labels automatically reduce font size and rotate 90 degrees when the selected date range makes a segment too narrow.
- Dependency links now use orthogonal/square elbows rather than curved Bezier lines, closer to the Primavera P6 relationship-line convention.
- Relationship routing honours predecessor/successor start/finish anchors for FS/SS/FF/SF relationship types.
- Existing draggable WBS/Activity width remains available.

### DCMA-style graphics
- Replaced decorative mixed chart types with threshold-first graphics.
- Each check now shows the measured result and the applicable acceptance threshold on the same scale, together with explicit PASS/FAIL state.
- Cycle checks use a zero-cycle target rather than presenting a misleading percentage.

### Schedule Narrative
- Added a collapsible full activity-detail register beneath the narrative.
- Every activity is included.
- Critical and zero-float activity values are highlighted in red.

## NotebookLM+
- Removed the separate Outputs tab.
- Added a dedicated right-hand **Outputs** pane beside the chat.
- Chat remains in a fixed-height workspace with the composer at the bottom of the centre pane.
- Report, Graphic, Data Extract and Audio Brief each open a customisation prompt before generation.
- Customised outputs can be previewed and downloaded locally:
  - report: HTML;
  - graphic: SVG;
  - data extract: CSV;
  - audio brief: text script, with local browser speech playback.
- Data prompts can request useful deterministic filters such as critical, negative float, in progress, not started, complete, or `WBS: <name>`.
- Report/audio customisation can use the selected AI when AI is enabled; otherwise deterministic schedule content is still produced.

## AI Settings
- Added **Google Gemini** to the global AI-model dropdown.
- Added **xAI Grok** to the global AI-model dropdown.
- Added locally persistent API-key/password fields and editable model-name fields for both providers.
- Added Save locally, Test and Clear-key controls.
- Default models for this release are `gemini-3.8-flash` and `grok-4.6`.
- Keys are stored in browser `localStorage` only and are never written to the repository or packaged release.
- The Settings page clearly warns that long-lived browser-side keys are less secure than server-side secrets/proxies.
- **No AI remains the default**.

## Layout
- Added a fixed Notebook workspace so the chat composer does not require scrolling the centre pane.
- Added extra width/overflow containment for tables, charts, Gantts and network views so wide artefacts scroll internally rather than expanding the page.

## Validation
- 24/24 normal automated test suites pass.
- Exhaustive stress/volume/boundary suite passes.
- v1.4-specific regression coverage added for comparison data, deleted-item rendering, Gantt date controls/label rotation/P6-style links, threshold graphics, narrative detail, Notebook output pane and cloud-AI configuration/routing.
