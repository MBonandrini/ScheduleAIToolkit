# Project Controls AI Suite v1.2.0

## Requested changes completed

- AI is disabled by default. The application starts with **No AI** and does not download/invoke a model until one is explicitly selected and applied in Settings.
- The header AI control is now a read-only display. Model selection is only available on the Settings page.
- Enter sends all chat messages; Shift+Enter inserts a new line.
- Schedule Assessment > Activity Register has draggable column resizers.
- Schedule Assessment > Critical Path table has draggable column resizers.
- DCMA-style report now includes a final Pass / Fail column.
- "Nodes & Links" has been renamed to "Nodes".
- Primavera P6 milestone recognition now includes TT_Mile, TT_StartMile and TT_FinMile task types as well as descriptive milestone types.
- Cost Report is now a collapsible hierarchical WBS tree with child WBS elements and activities indented beneath their schedule WBS, with Budget, Actual, Remaining, Forecast and Variance values.
- Project Controls Profile now has an Apply Profile button and persists the applied profile locally.
- GitHub Pages deployment guidance was replaced on Settings by a local Ollama setup tutorial.
- Added `setup-ollama.bat` to install/configure Ollama on Windows, configure OLLAMA_ORIGINS, start Ollama and pull a default local model.
- Cache-busting asset version updated to v1.2.0.

## Validation

- 22/22 normal automated test suites pass.
- Exhaustive stress/volume/boundary suite passes.
- Added a dedicated v1.2 regression suite covering the requested changes and Primavera milestone types.
