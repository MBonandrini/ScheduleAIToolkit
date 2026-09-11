# Project Controls AI Suite v1.3.0 Validation Report

## Release scope

This validation covers the complete v1.3.0 source tree, including the Dashboard lineage changes, Schedule Assessment comparison/Gantt/network/DCMA/forensic/S-curve/narrative/lookahead changes, NotebookLM+ Outputs tab, responsive layout changes, MPP local-parser integration and expanded Microsoft Project MSPDI parser.

## Automated regression results

`npm test`

- **23/23 suites passed**.
- Includes parser/import, network/driving path, golden comparison movement, health/confidence/narrative/timeseries, calendar/readiness, QSRA/claims, AI tooling, rich MSPDI golden parsing, Ollama compatibility/recovery, browser-model catalogue, repository/multi-project integration, AI roles/context, parser fuzz, performance/volume, UI/GitHub Pages contracts, security, v1.2 regressions and v1.3 request-specific regression tests.

## Exhaustive results

`npm run test:exhaustive`

Passed after the final MSPDI parser expansion. The latest run included:

- 3,000-case parser fuzz batch;
- 50,000 activities / 200,000 relationships parse and health tests;
- 10,000-activity comparison test;
- deep-chain network test;
- 5,000-iteration Monte Carlo/boundary test.

Clean-package exhaustive timing snapshot:

- fuzz3000: 106.52 ms
- parse50k200k: 572.05 ms
- health50k200k: 333.11 ms
- compare10k: 84.48 ms
- deepChain: 144.52 ms
- monte5000: 21.79 ms
- exhaustive stress suite total: 1523.7 ms

(Timings are environment-specific; pass/fail is the release criterion.)

## Microsoft Project validation

The MSPDI golden fixture verifies that the internal model retains:

- summary/WBS hierarchy;
- activities and milestones;
- start/finish, baseline, duration and remaining duration;
- total/free slack conversion;
- calendar assignment;
- constraints;
- predecessor relationships and lag conversion;
- resources;
- assignments;
- planned/actual/remaining work and cost.

The `.mpp` browser route, local bridge source, setup BAT, CORS/private-network headers and conversion hand-off are covered by source/integration contracts.

### MPP runtime limitation of this test environment

The final Windows-native `@byteink/mppjs` converter binary could **not** be executed end-to-end in this Linux/container validation environment because installing its native package was not available within the test sandbox. The bridge JavaScript itself passes syntax/contracts and its API usage was checked against the package's documented conversion API. A real `.mpp` conversion therefore remains the one deployment acceptance check to perform on the target Windows PC by running `setup-mpp-bridge.bat` and importing a representative MPP file.

This limitation does **not** apply to the MSPDI parser after conversion: that parser is exercised directly with the rich golden fixture and passes.

## Browser smoke-test limitation

An attempted automated Chromium smoke run was blocked by the execution environment's browser policy before the local/static page could load (`ERR_BLOCKED_BY_ADMINISTRATOR` for both loopback HTTP and file URLs). For that reason the release does not claim a successful Playwright/Chromium acceptance run in this sandbox. UI behaviour is instead covered by module execution, render-output assertions, import-graph checks, repository integration tests and the v1.3 UI contract suite.

## Release conclusion

All executable normal and exhaustive automated suites available in the release environment pass. The two environment-specific acceptance items are:

1. run the local Windows MPP helper against a representative real `.mpp` file;
2. perform a short visual browser acceptance pass after GitHub Pages deployment, particularly drag/zoom/relationship-overlay interactions.
