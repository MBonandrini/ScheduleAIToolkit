# v1.5.6 Validation Report

## Scope
Validation covers the reported WBS/Gantt defect where parent WBS elements could be absent and sibling WBS bands appeared in the wrong order.

## Root cause
- The WBS/Gantt selected WBS nodes from activities visible in the current time window, so WBS nodes with no visible/direct activities could be omitted.
- The renderer sorted sibling WBS nodes alphabetically by WBS code/name.
- The XER parser did not retain `PROJWBS.seq_num`, which Primavera defines as the WBS Sort Order.

## Correction
- Normal WBS/Gantt rendering now includes the complete schedule WBS dictionary.
- Critical Path keeps only relevant branches but includes every required ancestor.
- XER `seq_num` and project-node metadata are retained through parsing/normalisation.
- WBS siblings are sorted by `seq_num`, then source order, then a deterministic natural-code fallback.
- Empty WBS bands render without a false Gantt summary bar.
- Existing collapse/expand behaviour is retained.

## Automated validation
- Added `v1.5.6-wbs-order.test.js`.
- Test fixture deliberately uses WBS codes whose alphabetical order conflicts with Primavera `seq_num`; the renderer is required to follow `seq_num`.
- Test fixture includes an intermediate parent and an empty WBS node with no direct activity assignments; both must render in WBS/Gantt.
- Critical Path test verifies the complete ancestor chain remains visible while unrelated non-critical branches are excluded.
- XER parser test verifies `seq_num` and `proj_node_flag` are retained.

## Exhaustive validation
- **31/31 normal regression suites PASS** before packaging.
- The exhaustive stress/volume/boundary suite PASS includes parser fuzzing, 50,000-activity / 200,000-relationship parsing and health analysis, 10,000-activity comparison, deep-chain network analysis and 5,000-case Monte Carlo/boundary coverage.
- The same suites are run again against the clean extracted release ZIP.
