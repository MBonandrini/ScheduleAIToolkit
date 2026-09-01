# Master Schedule Intelligence Feature Matrix

This build maps the master 70-section development brief into the current web toolkit. `Implemented` means a working browser feature exists. `Partial` means useful functionality exists but does not yet reproduce all Primavera or desktop-specific behaviour. `Desktop phase` means the browser architecture cannot honestly satisfy the requirement completely and it is reserved for the packaged Windows application.

| Area | Status | Current implementation |
|---|---|---|
| XER parser/data model | Implemented/expanded | Dynamic table recognition, raw source retention, activity raw records, generic table summary, import diagnostics |
| Multi-project XER | Implemented | PROJECT-based schedule extraction and independent project schedules |
| Viewer/Gantt/WBS | Implemented/expanded | Collapsible Gantt plus new searchable schedule viewer and activity inspector |
| Activity inspector/raw XER | Implemented | General, dates, float, relationships, resources, codes, constraints and raw TASK data |
| Revision comparison | Implemented | Schedule Comparison, Week-on-Week and What Changed dashboard |
| Material change | Implemented | Informational/Minor/Material/Critical deterministic classification |
| Critical path/path migration | Implemented/partial | Critical/near-critical lists and revision migration; exact proprietary P6 driving semantics remain qualified |
| Why did my date move | Implemented/partial | Delay/forensic comparison identifies schedule drivers; exact attribution remains evidence-qualified |
| Float/logic/DCMA | Implemented/expanded | Dedicated Float, Logic Quality, DCMA and detailed checks |
| Progress/OOS | Implemented/expanded | Dedicated Progress Integrity and OOS screening |
| Time machine/milestones/stability | Implemented | Revision history, milestone trends and forecast stability index |
| Risk | Implemented | Dedicated Risk Analysis workspace, Monte Carlo, criticality, scenarios and mitigation |
| S-curves/histograms | Implemented/partial | Time-phased progress and histogram capability; resource-detail depends on XER fields |
| EVM/productivity/resources | Implemented/partial | Budget/actual/forecast cost, units and transparent EVM screening where data exists |
| Calendar/constraint/baseline | Implemented/expanded | Dedicated analyser reports and revision comparisons |
| Executive/What Changed | Implemented | Management dashboard and material change register |
| Narrative/lookahead | Implemented | Evidence-only narrative and configurable 2/4/6/12-week lookahead |
| PDF reporting | Implemented | Professional Schedule AI Toolkit PDF reports with page footer |
| Excel export | Partial | Existing data/report export paths remain; full multi-sheet XLSX workbook is a desktop-phase hardening item |
| Common filtering/global search | Partial | Viewer search and report filters exist; full cross-report filter context remains to be unified |
| Structured diagnostic logging | Partial | Browser diagnostics/errors exist; full persistent DEBUG/INFO/WARNING/ERROR/CRITICAL log service is desktop-phase |
| 10k/50k performance | Partial/validated progressively | Heavy reports on-demand and Monte Carlo worker; full 50k-relationship certification needs representative test corpus |
| Synthetic/regression suite | Expanded | TESTING.md plus synthetic QA test generator in tests/ |
| Raw vs calculated integrity | Implemented | Original XER text retained; normalized/calculated values separate |
| Portfolio hierarchy | Architecture-ready | Shared repository/project model can be extended without changing parsers |
| Command architecture | Partial | UI actions call reusable services; formal command registry is reserved for desktop app |
| Backup/restore portability | Partial | Browser local repository persists; packaged repository backup/import/export is desktop phase |
| Installer/EXE | Desktop phase | Not applicable to this website build |

## Important limitations

P6 uses proprietary scheduling/calendar behaviour that cannot always be reconstructed exactly from an XER alone. The toolkit therefore labels driving/causal conclusions as evidence-based indicators rather than silently claiming Primavera-equivalent certainty. Resource and EVM calculations are only displayed when the required source fields exist.
