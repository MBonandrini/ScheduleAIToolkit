# v1.5.1 Validation Report

Date: 14 September 2026

## Result

**PASS**

This maintenance release changes only the Schedule Builder activity/editor area and GitHub Pages cache version.

### Requested changes verified
- Generated / Editable Schedule includes a **Remove all** button.
- Remove all is disabled when there are no generated activities.
- Remove all requires user confirmation.
- Confirmed removal clears the in-memory activity set and persists an empty builder list to local browser storage.
- The Schedule Builder chat panel beneath the wizard/activity table has been removed.
- Schedule Builder no longer binds chat handlers after rendering.
- GitHub Pages asset URLs are cache-bumped to `v=1.5.1`.

### Normal regression suite
- **26 / 26 suites passed**.
- Includes all v1.2, v1.3, v1.4 and v1.5 regression contracts plus the new v1.5.1 builder-cleanup contract.

### Exhaustive suite
PASS, including:
- 3,000-case parser fuzz;
- 50,000 activities / 200,000 relationships parse and health analysis;
- 10,000-activity schedule comparison;
- deep-chain network analysis;
- 5,000-case Monte Carlo/boundary test.

The final release archive is generated from this validated tree and is re-extracted for package integrity verification.
