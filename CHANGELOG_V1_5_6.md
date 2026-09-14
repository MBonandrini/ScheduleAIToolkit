# v1.5.6 Changelog

## WBS / Gantt hierarchy correction
- WBS/Gantt now renders the complete WBS dictionary, not only WBS nodes selected from currently visible activities.
- Parent, intermediate and empty WBS nodes are preserved.
- Critical Path retains the complete ancestor chain for every critical/zero-float activity.
- WBS collapse/expand behaviour remains available by double-clicking any WBS band.

## Primavera ordering correction
- XER `PROJWBS.seq_num` is imported into the schedule model.
- WBS sibling bands are sorted by Primavera `seq_num` (P6 Sort Order).
- Source order is used as the deterministic fallback when no P6 sequence is available.
- Alphabetical WBS sorting is no longer used as the primary order.
- Microsoft Project XML WBS nodes preserve OutlineNumber/source order as the equivalent ordering metadata.

## Display correction
- Empty WBS nodes no longer draw a misleading summary bar when they contain no descendant activities.

## Validation
- Added `v1.5.6-wbs-order.test.js` covering complete WBS display, empty/intermediate parent WBS nodes, P6 `seq_num` ordering, Critical Path ancestor preservation and XER sequence parsing.
