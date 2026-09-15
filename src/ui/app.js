/**
 * Project Controls AI Suite — application controller.
 *
 * This module owns view orchestration and DOM event wiring only. Domain logic
 * lives under /analysis, file parsing under /parsers, persistence under
 * /repository, and AI-provider adapters under /ai. Keeping those concerns
 * separate makes the static GitHub Pages application easier to test and extend.
 */
import {
  currentProject,
  projects,
  newProject,
  switchProject,
  restoreFolderHandles,
  renameProject,
  addFiles,
  listFiles,
  listSchedules,
  setFileChecked,
  removeFile,
  linkFolder,
  importFolderFallback,
  saveRisk,
  listRisks,
  saveClaim,
  listClaims,
  getFileBlob,
  updateFileBlob
} from "../repository/repository.js";
import {
  preferredAI,
  setPreferredAI,
  askAI,
  aiLabel,
  aiEntry,
  aiCompatibility,
  catalogueGroups,
  testSelectedAI
} from "../ai/runtime.js";
import {
  ollamaConfig,
  saveOllamaConfig,
  inspectModels,
  testOllama,
  probeOllama
} from "../ai/ollama.js";
import {
  cloudConfig,
  cloudProviderMeta,
  cloudProviderIds,
  saveCloudConfig,
  clearCloudKey,
  testCloudAI,
  listCloudModels
} from "../ai/cloud.js";
import {
  scheduleSummary,
  hydrateSchedule,
  isMilestoneActivity
} from "../core/model.js";
import {
  esc,
  isoDate,
  parseDate,
  daysBetween,
  toCSV,
  csvObjects,
  downloadBlob,
  uid,
  addDays
} from "../core/utils.js";
import {
  metric,
  table,
  lineChart,
  networkGraph,
  gantt,
  calendarMonth,
  badge,
  GANTT_FIELDS
} from "./render.js";
import {
  state,
  roles,
  noRepoViews,
  freshGanttLayout,
  loadGanttLayout,
  saveGanttLayout,
  loadNamedGanttLayouts,
  saveNamedGanttLayouts
} from "./app-state.js";
import {
  scheduleHealth,
  forecastConfidence,
  plannerInbox
} from "../analysis/health.js";
import {
  compareSchedules,
  whyDidDateMove,
  avgProgress
} from "../analysis/comparison.js";
import {
  networkHealth,
  openEnds,
  detectCycles,
  pathConvergence,
  drivingChain,
  longestPath,
  traceToMilestone
} from "../analysis/network.js";
import {
  projectYears,
  calendarYear
} from "../analysis/calendar.js";
import {
  weeklySeries,
  fourWeekLookahead,
  curveSeries
} from "../analysis/timeseries.js";
import {
  activityHistory,
  milestoneHistory
} from "../analysis/timemachine.js";
import {
  runMonteCarlo,
  mapRiskToSchedule
} from "../analysis/risk.js";
import {
  buildDelayEventFile
} from "../analysis/claims.js";
import {
  identifyDelayEvents
} from "../analysis/delay-events.js";
import {
  buildForensicEvidence
} from "../analysis/forensics.js";
import {
  dcma14
} from "../analysis/dcma.js";
import {
  QA_PROFILES,
  DEFAULT_QA_PROFILE_ID,
  qaProfile
} from "../analysis/qa-profiles.js";
import {
  progressIntegrity
} from "../analysis/progress-integrity.js";
import {
  logicChanges,
  calendarDifferences,
  resourceForensics,
  windowsAnalysis,
  analyticalFloatPaths,
  activityRevisionMatrix
} from "../analysis/advanced-forensics.js";
import {
  buildEvidencePack
} from "../analysis/evidence-pack.js";
import {
  weekOnWeekChanges
} from "../analysis/week-over-week.js";
import {
  fridaySeries,
  weekEndingFriday,
  monthsFromFridays,
  wbsClassificationPrompt,
  parseClassificationResponse,
  buildWeeklyBreakout,
  matchFloorLabel,
  DISCIPLINES
} from "../analysis/manpower-breakout.js";
import {
  bindInteractiveCharts,
  interactiveBarChart
} from "./chart-workbench.js";
import {
  dataCentreReadiness,
  readinessGates
} from "../analysis/datacentre.js";
import {
  scheduleNarrative
} from "../analysis/narrative.js";
import {
  mppBridgeUrl,
  setMppBridgeUrl,
  probeMppBridge,
  parseScheduleFile
} from "../parsers/index.js";
import {
  HOLIDAY_COUNTRIES,
  publicHolidays,
  calendarHolidaySet,
  addWorkingDays
} from "../analysis/holidays.js";
import {
  activityAlignmentIndex,
  pdfScheduleCandidates,
  alignMeasurementRows
} from "../analysis/measurement-alignment.js";
import {
  extractPdfScheduleText
} from "../parsers/pdf-schedule.js";
import {
  alignBoqFile,
  RECOMMENDED_HEADER
} from "../measurement/boq-alignment.js";
const $ = id => document.getElementById(id);
const manpowerObjectUrls = new Map();
// -----------------------------------------------------------------------------
// Application bootstrap and shared schedule-selection helpers
// -----------------------------------------------------------------------------
function renderAIModelDisplay() {
  const display = $("aiDisplay");
  if (display)display.value = aiLabel(preferredAI());
}
function selectedAIInfo() {
  const entry = aiEntry(preferredAI()),
  compat = aiCompatibility(entry.value);
  return {
    ...entry,
    compatible: compat.ok,
    compatibilityMessage: compat.reason
  };
}
async function init() {
  state.project = await currentProject();
  await restoreFolderHandles();
  state.quantityRows = JSON.parse(localStorage.getItem("pcai.quantities") || "[]");
  try {
    state.issueRows = JSON.parse(localStorage.getItem("pcai.issueRows") || "[]");
  } catch (_) {
    state.issueRows = [];
  }
  try {
    state.measurement = JSON.parse(localStorage.getItem("pcai.measurement") || "null")
  } catch (_) {
    state.measurement = null
  }
  state.measurement = normaliseMeasurementState(state.measurement);
  state.builderRows = JSON.parse(localStorage.getItem("pcai.builder") || "[]");
  state.profile = localStorage.getItem("pcai.profile") || "Data Centre";
  try {
    const savedManpower = JSON.parse(localStorage.getItem("pcai.manpower") || "null");
    if (savedManpower && typeof savedManpower === "object") {
      Object.assign(state, {
        manpowerMode: savedManpower.mode || state.manpowerMode,
        manpowerScheduleId: savedManpower.scheduleId || "",
        manpowerPlannedId: savedManpower.plannedId || "",
        manpowerActualId: savedManpower.actualId || "",
        manpowerLayouts: Array.isArray(savedManpower.layouts) && savedManpower.layouts.length ? savedManpower.layouts : state.manpowerLayouts,
        manpowerUseAI: savedManpower.useAI !== false,
        manpowerHoursPerPerson: Number(savedManpower.hoursPerPerson || 45) || 45,
        manpowerOverrides: savedManpower.overrides || {},
        manpowerFriday: savedManpower.friday || "",
        manpowerMonth: savedManpower.month || "",
      });
    }
  } catch (_) {
    // Ignore corrupt browser-local presentation preferences.
  }
  state.ganttLeftWidth = Number(localStorage.getItem("pcai.ganttLeftWidth") || 410);
  state.criticalLeftWidth = Number(localStorage.getItem("pcai.criticalLeftWidth") || 410);
  state.ganttLayouts.wbs = loadGanttLayout("wbs");
  state.ganttLayouts.critical = loadGanttLayout("critical");
  state.namedGanttLayouts.wbs = loadNamedGanttLayouts("wbs");
  state.namedGanttLayouts.critical = loadNamedGanttLayouts("critical");
  state.qaProfileId = localStorage.getItem("pcai.qaProfileId") || DEFAULT_QA_PROFILE_ID;
  try { state.qaCustomThresholds = JSON.parse(localStorage.getItem("pcai.qaCustomThresholds") || "{}"); } catch { state.qaCustomThresholds = {}; }
  try {
    const baselineSlots = JSON.parse(localStorage.getItem("pcai.baselineSlots") || "[]");
    if (Array.isArray(baselineSlots)) state.baselineSlots = [0,1,2].map(i => baselineSlots[i] || "");
  } catch (_) {}
  try {
    state.ganttCollapsed.wbs = JSON.parse(localStorage.getItem("pcai.ganttCollapsed.wbs") || "[]");
    state.ganttCollapsed.critical = JSON.parse(localStorage.getItem("pcai.ganttCollapsed.critical") || "[]")
  } catch (_) {
    state.ganttCollapsed = {
      critical: [],
      wbs: []
    }
  }
  try {
    state.builderWizard = JSON.parse(localStorage.getItem("pcai.builderWizard") || "null")
  } catch (_) {
    state.builderWizard = null
  }
  const savedTheme = localStorage.getItem("pcai.theme") || "navy";
  document.documentElement.dataset.theme = savedTheme;
  $("themeSelect").value = savedTheme;
  renderAIModelDisplay();
  bindShell();
  await refreshData();
  render();
}
function bindShell() {
  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-view]"); if (!b)return; state.view = b.dataset.view; render()
  });
  $("themeSelect").addEventListener("change", e => {
    document.documentElement.dataset.theme = e.target.value; localStorage.setItem("pcai.theme", e.target.value)
  });
  $("newProjectBtn").onclick = async() => {
    const name = prompt("Project name", "New Project");
    if (!name)return;
    state.project = await newProject(name);
    await restoreFolderHandles();
    await refreshData();
    render()
  };
  $("projectSelect").onchange = async e => {
    state.project = await switchProject(e.target.value);
    await restoreFolderHandles();
    state.activeScheduleId = null;
    state.previousScheduleId = null;
    await refreshData();
    render()
  };
  $("addFilesBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = async e => {
    const files = e.target.files;
    updateProgress({ title: "Loading schedules", detail: `Preparing ${files.length} file${files.length===1?"":"s"}`, percent: 1 });
    try {
      await addFiles(files, { onProgress: updateProgress });
      updateProgress({ title: "Loading schedules", detail: "Refreshing repository and schedule index", percent: 97 });
      await refreshData();
      updateProgress({ title: "Loading schedules", detail: "Complete", percent: 100, done: true });
    } catch (error) {
      updateProgress({ title: "Schedule load failed", detail: error.message || String(error), percent: 100, done: true });
      alert(`Schedule/file loading failed: ${error.message || error}`);
    } finally {
      e.target.value = "";
    }
  };
  $("folderFallbackBtn").onclick = () => $("folderInput").click();
  $("folderInput").onchange = async e => {
    updateProgress({ title: "Loading schedules", detail: `Scanning uploaded folder · ${e.target.files.length} files`, percent: 1 });
    try {
      await importFolderFallback(e.target.files, { onProgress: updateProgress });
      updateProgress({ title: "Loading schedules", detail: "Refreshing repository and schedule index", percent: 97 });
      await refreshData();
      updateProgress({ title: "Loading schedules", detail: "Complete", percent: 100, done: true });
    } catch (error) {
      updateProgress({ title: "Schedule load failed", detail: error.message || String(error), percent: 100, done: true });
      alert(`Folder loading failed: ${error.message || error}`);
    } finally {
      e.target.value = "";
    }
  };
  $("linkFolderBtn").onclick = async() => {
    try {
      updateProgress({ title: "Loading schedules", detail: "Opening project folder", percent: 1 });
      await linkFolder({ onProgress: updateProgress });
      updateProgress({ title: "Loading schedules", detail: "Refreshing repository and schedule index", percent: 97 });
      await refreshData();
      updateProgress({ title: "Loading schedules", detail: "Complete", percent: 100, done: true });
    } catch (e) {
      updateProgress({ title: "Schedule load failed", detail: e.message || String(e), percent: 100, done: true });
      alert(e.message)
    }
  };
  $("renameProjectBtn").onclick = async() => {
    const name = prompt("Project name", state.project?.name || "Untitled Project");
    if (!name)return;
    state.project = await renameProject(name);
    await refreshData();
    render();
  };
  globalThis.addEventListener("pc-progress", e => updateProgress(e.detail || {
  }));
}
async function refreshData() {
  state.files = await listFiles();
  state.schedules = (await listSchedules()).map(hydrateSchedule);
  state.risks = await listRisks();
  state.claims = await listClaims();
  state.schedules.sort((a, b) => (parseDate(a.dataDate)?.getTime() || 0) - (parseDate(b.dataDate)?.getTime() || 0));
  if (!state.activeScheduleId || !state.schedules.some(s => s.id===state.activeScheduleId))state.activeScheduleId = state.schedules.at( - 1)?.id || null;
  const idx = state.schedules.findIndex(s => s.id===state.activeScheduleId);
  if (!state.previousScheduleId || !state.schedules.some(s => s.id===state.previousScheduleId))state.previousScheduleId = idx>0? state.schedules[idx - 1]?.id: null;
  await renderRepository();
}
function scheduleById(id) {
  return state.schedules.find(s => s.id===id) || null
}
function activeSchedule() {
  return scheduleById(state.activeScheduleId)
}
function previousSchedule() {
  return scheduleById(state.previousScheduleId)
}
function scheduleLabel(s) {
  return[s?.projectName || s?.name || "Schedule", s?.sourceName && s.sourceName!==(s?.projectName || s?.name)? s.sourceName: "", isoDate(s?.dataDate) || "No data date"].filter(Boolean).join(" · ")
}
function scheduleSelector(id, value, {
  blank = "Select schedule…", className = ""
}
= {
}) {
  return`<select id="${id}" class="${className}"><option value="">${esc(blank)}</option>${state.schedules.map(s => `<option value="${s.id}" ${s.id===value? "selected": ""}>${esc(scheduleLabel(s))}</option>`).join("")}</select>`;
}
function scheduleSlots(prefix, values, count, {
  label = "Revision", blank = "Not selected"
}
= {
}) {
  return`<div class="schedule-slot-grid">${Array.from( {
    length: count
  }, (_, i) => `<label>${esc(label)} ${i + 1}${scheduleSelector(`${prefix}${i}`, values[i] || "", {
    blank
  })}</label>`).join("")}</div>`;
}
/**
 * Reconstruct the full WBS ancestry from explicit parent IDs. The fallback path
 * is retained for schedules that do not carry a complete WBS dictionary.
 */
function fullWbsPath(schedule, activity) {
  const fallback = String(activity?.wbsPath || "");
  if (!schedule || !activity?.wbsId)return fallback;
  const map = new Map((schedule.wbs || []).map(w => [String(w.id), w])),
  parts = [],
  seen = new Set();
  let cur = map.get(String(activity.wbsId)),
  guard = 0;
  while (cur && guard++<100 && !seen.has(String(cur.id))) {
    seen.add(String(cur.id));
    parts.unshift(cur.name || cur.code || cur.id);
    cur = map.get(String(cur.parentId || ""))
  }
  return parts.filter(Boolean).join(" / ") || fallback;
}
function filteredSchedule() {
  const s = activeSchedule();
  if (!s)return null;
  const f = state.filters,
  acts = s.activities.filter(a => {
    if (f.search && !`${a.id} ${a.name} ${a.wbsPath}`.toLowerCase().includes(f.search.toLowerCase()))return false; if (f.wbs && !a.wbsPath.toLowerCase().includes(f.wbs.toLowerCase()))return false; if (f.status && a.status!==f.status)return false; if (f.floatMax!=="" && Number(a.totalFloat)>Number(f.floatMax))return false; return true;
  }),
  ids = new Set(acts.map(a => a.id));
  return {
    ...s,
    activities: acts,
    relationships: s.relationships.filter(r => ids.has(r.predId) && ids.has(r.succId))
  };
}
async function renderRepository() {
  const ps = await projects();
  $("projectSelect").innerHTML = ps.map(p => `<option value="${p.id}" ${p.id===state.project?.id? "selected": ""}>${esc(p.name)}</option>`).join("");
  $("repoFiles").innerHTML = state.files.map(f => `<div class="repo-file">
    <input type="checkbox" data-check="${f.id}" ${f.checked? "checked": ""} title="Include in AI context">
    <div title="${esc(f.relativePath)}">${esc(f.name)}<small>${esc(f.category)} · ${Math.round((f.size || 0) / 1024)} KB${f.parseError? ` · parse error: ${esc(f.parseError)}`: ""}</small></div>
    <button data-remove="${f.id}" title="Remove reference">×</button></div>`).join("") || `<div class="muted">No project files yet.</div>`;
  $("repoFiles").querySelectorAll("[data-check]").forEach(x => x.onchange = async() => {
    await setFileChecked(x.dataset.check, x.checked)
  });
  $("repoFiles").querySelectorAll("[data-remove]").forEach(x => x.onclick = async() => {
    if (confirm("Remove this repository reference? Source disk files are not deleted.")) {
      await removeFile(x.dataset.remove); await refreshData(); render()
    }
  });
  $("scheduleCount").textContent = state.schedules.length;
  $("scheduleList").innerHTML = state.schedules.map(s => `<div class="schedule-row ${s.id===state.activeScheduleId? "active": ""}" data-schedule="${s.id}"><strong>${esc(s.sourceName || s.name)}</strong><small>Data date ${isoDate(s.dataDate) || "—"} · ${s.activities.length} activities</small></div>`).join("") || `<div class="muted">No XER/XML/MPP schedules parsed.</div>`;
  $("scheduleList").querySelectorAll("[data-schedule]").forEach(x => x.onclick = () => {
    state.activeScheduleId = x.dataset.schedule; const i = state.schedules.findIndex(s => s.id===state.activeScheduleId); state.previousScheduleId = i>0? state.schedules[i - 1].id: null; renderRepository(); render()
  });
}
function render() {
  document.querySelectorAll("#tabs [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view===state.view));
  $("repositoryPane").style.display = noRepoViews.has(state.view)? "none": "block";
  $("workspace").classList.toggle("workspace-fixed", state.view==="notebook");
  document.querySelector(".app-shell").style.gridTemplateColumns = noRepoViews.has(state.view)? "1fr": "285px 1fr";
  const map = {
    dashboard: renderDashboard,
    contracts: renderContracts,
    drawing: renderDrawing,
    assessment: renderAssessment,
    manpower: renderManpower,
    risk: renderRisk,
    claims: renderClaims,
    notebook: renderNotebook,
    builder: renderBuilder,
    settings: renderSettings
  };
  map[state.view]?.();
  // Chart controls are bound after each view render. The binder is idempotent,
  // so re-rendering a report never duplicates event handlers.
  queueMicrotask(() => bindInteractiveCharts(document));
}
function updateProgress(p) {
  const hud = $("progressHud"),
  track = hud.querySelector(".progress-track");
  hud.hidden = false;
  $("progressTitle").textContent = p.title || "Working";
  $("progressDetail").textContent = p.detail || "Processing…";
  const pct = Number(p.percent ?? p.pct ?? 0);
  $("progressPct").textContent = p.indeterminate? "Working…": `${Math.round(pct || 0)}%`;
  track.classList.toggle("indeterminate", !!p.indeterminate);
  $("progressBar").style.width = p.indeterminate? "35%": `${Math.max(0, Math.min(100, pct || 0))}%`;
  if (p.done)setTimeout(() => hud.hidden = true, 1400);
}
async function withProgress(title, fn) {
  updateProgress( {
    title, detail: "Working…", indeterminate: true
  });
  try {
    return await fn()
  } finally {
    updateProgress( {
      title, detail: "Complete", percent: 100, done: true
    })
  }
}
function toast(text) {
  updateProgress( {
    title: text, detail: "", percent: 100, done: true
  })
}
function viewHead(title, subtitle, actions = "") {
  return`<div class="view-head"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="actions">${actions}</div></div>`
}
function requireSchedule() {
  const s = activeSchedule();
  if (!s) {
    $("workspace").innerHTML = `${viewHead("Schedule Intelligence", "Import a Primavera P6 XER, Microsoft Project XML, or MPP file into the Project Repository.")}<div class="empty-state">No schedule has been loaded.</div>`;
    return null
  }
  return s
}
function revisionSelector(id, value) {
  return scheduleSelector(id, value, {
    blank: "No comparison"
  })
}
function filterBar() {
  const s = activeSchedule(),
  wbs = [...new Set((s?.activities || []).map(a => a.wbsPath).filter(Boolean))].slice(0, 400);
  return`<div class="filterbar"><input id="fSearch" placeholder="Search ID / activity / WBS" value="${esc(state.filters.search)}"><input id="fWBS" list="wbsList" placeholder="WBS contains…" value="${esc(state.filters.wbs)}"><datalist id="wbsList">${wbs.map(x => `<option>${esc(x)}</option>`).join("")}</datalist><select id="fStatus"><option value="">All statuses</option>${["Not Started", "In Progress", "Complete"].map(x => `<option ${state.filters.status===x? "selected": ""}>${x}</option>`).join("")}</select><input id="fFloat" type="number" placeholder="Max float (days)" value="${esc(state.filters.floatMax)}"><button class="btn" id="clearFilters">Clear</button></div>`;
}
function bindFilters() {
  const update = () => {
    state.filters = {
      search: $("fSearch")?.value || "",
      wbs: $("fWBS")?.value || "",
      status: $("fStatus")?.value || "",
      floatMax: $("fFloat")?.value ?? ""
    };
    render()
  };
  ["fSearch", "fWBS", "fStatus", "fFloat"].forEach(id => $(id)?.addEventListener(id==="fSearch" || id==="fWBS"? "change": "change", update));
  $("clearFilters")?.addEventListener("click", () => {
    state.filters = {
      search: "", wbs: "", status: "", floatMax: ""
    }; render()
  });
}
// -----------------------------------------------------------------------------
// Dashboard and conversational workspaces
// -----------------------------------------------------------------------------
function renderDashboard() {
  const s = activeSchedule();
  if (!s) {
    $("workspace").innerHTML = `${viewHead("Planner Dashboard", "Select or import a schedule. Uploaded schedules are treated as independent unless you explicitly group them.")}<section class="panel"><h2>Revision lineage</h2><p class="muted">Choose schedules below only when you want to treat them as a revision chain. No relationship between uploaded schedules is assumed.</p>${scheduleSlots("dashLineage", state.dashboardLineageIds, 5, {
      label: "Schedule"
    })}</section>`;
    bindDashboardLineage();
    return;
  }
  const filtered = filteredSchedule(),
  summary = scheduleSummary(filtered),
  health = scheduleHealth(filtered),
  inbox = plannerInbox(null, filtered),
  dc = dataCentreReadiness(filtered),
  milestones = filtered.activities.filter(a => a.milestone).slice(0, 12);
  const lineageSchedules = state.dashboardLineageIds.map(scheduleById).filter(Boolean),
  confidenceSchedules = lineageSchedules.length? lineageSchedules: [filtered],
  conf = forecastConfidence(confidenceSchedules);
  const lineageRows = lineageSchedules.map((x, i) => [esc(scheduleLabel(x)), isoDate(x.dataDate), i? `${daysBetween(lineageSchedules[i - 1].dataDate, x.dataDate)}d`: "—", x.activities.length, `${scheduleSummary(x).progress.toFixed(1)}%`, scheduleSummary(x).forecastFinish || "—"]);
  $("workspace").innerHTML = `${viewHead("Planner Dashboard", "Daily project-controls position, forecast confidence and attention items")}
  ${filterBar()}
  <div class="metrics">${metric("Schedule health", `${health.score}/100`, health.label)}${metric("Progress", `${summary.progress.toFixed(1)}%`, "Activity weighted")}${metric("Forecast finish", summary.forecastFinish || "—", "Current programme")}${metric("Critical", summary.critical, "Critical / zero float")}${metric("Negative float", summary.negativeFloat, "Activities")}${metric("Forecast confidence", `${conf.score}%`, conf.label, "Confidence uses only the schedules explicitly selected in Revision Lineage. If none are selected, only the active schedule is used.")}</div>
  <div class="grid grid2">
    <section class="panel"><h2>Planner's Inbox</h2><div class="inbox">${inbox.length? inbox.map(x => `<div class="inbox-item ${x.severity}"><strong>${esc(x.category)}</strong> · ${esc(x.text)}</div>`).join(""): `<div class="muted">No major deterministic alerts.</div>`}</div></section>
    <section class="panel"><h2>Readiness</h2>${table(["Stage", "Activities", "Complete", "Progress", "Critical"], dc.map(x => [x.stage, x.activities, x.complete, `${x.progress.toFixed(1)}%`, x.critical]))}</section>
    <section class="panel"><h2>Key milestones</h2>${table(["Milestone", "Forecast", "Float", "Status"], milestones.map(a => [`${esc(a.id)} · ${esc(a.name)}`, isoDate(a.currentFinish || a.finish), a.totalFloat.toFixed(1), badge(a.status, a.critical? "danger": "")]))}</section>
    <section class="panel"><h2>Revision Lineage</h2><p class="muted">Each slot is independent. Select only schedules that you intentionally want to analyse as one revision sequence; files from different projects can remain unselected.</p>${scheduleSlots("dashLineage", state.dashboardLineageIds, 5, {
    label: "Schedule"
  })}<div style="margin-top:10px">${table(["Selected revision", "Data date", "Gap from prior", "Activities", "Progress", "Forecast finish"], lineageRows)}</div></section>
  </div>`;
  bindFilters();
  bindDashboardLineage();
}
function bindDashboardLineage() {
  state.dashboardLineageIds.forEach((_, i) => $("dashLineage" + i)?.addEventListener("change", e => {
    state.dashboardLineageIds[i] = e.target.value; renderDashboard()
  }));
}
function chatMarkup(key, title, subtitle, defaultRole) {
  const hist = state.chats[key] || [];
  return`${viewHead(title, subtitle)}<section class="panel chat"><div class="messages" id="messages">${hist.map(m => `<div class="msg ${m.role==="user"? "user": ""}">${esc(m.content)}${m.sources?.length? `<div style="margin-top:7px;font-size:9px;opacity:.75">Evidence: ${m.sources.slice(0, 8).map(s => esc(s.name)).join(" · ")}${m.structuredTool? ` · Tool: ${esc(m.structuredTool)}`: ""}</div>`: ""}</div>`).join("") || `<div class="muted">Checked Project Repository files are available as context.</div>`}</div><div class="chatbox"><select id="chatRole">${roles.map(r => `<option ${r===defaultRole? "selected": ""}>${r}</option>`).join("")}</select><textarea id="chatInput" placeholder="Ask about the current project…"></textarea><button id="chatSend">Send</button></div></section>`;
}
function bindChat(key, defaultRole) {
  $("chatSend").onclick = async() => {
    const q = $("chatInput").value.trim();
    if (!q)return;
    const hist = state.chats[key]??=[];
    hist.push( {
      role: "user", content: q
    });
    $("chatInput").value = "";
    render();
    try {
      const out = await askAI( {
        question: q, role: $("chatRole")?.value || defaultRole, current: activeSchedule(), previous: previousSchedule(), revisions: state.schedules, history: hist.slice(0, - 1)
      });
      hist.push( {
        role: "assistant", content: out.text, sources: out.sources || [], structuredTool: out.structuredTool || null
      });
      render();
    } catch (e) {
      const ollamaHelp = /Ollama/i.test(String(e?.message || ""))? `\n\nOpen Settings → Ollama and use “Check Ollama”. If Ollama is not installed, install/start it first. If it is running, verify OLLAMA_ORIGINS allows this GitHub Pages origin.`: "";
      hist.push( {
        role: "assistant", content: `AI request failed: ${e.message}${ollamaHelp}`
      });
      render()
    }
  };
  $("chatInput").addEventListener("keydown", e => {
    if (e.key==="Enter" && !e.shiftKey) {
      e.preventDefault(); $("chatSend").click()
    }
  });
}
function renderContracts() {
  $("workspace").innerHTML = chatMarkup("contracts", "Contract Manager", "Evidence-grounded contract and project-controls review using checked repository files.", "Contract Analyst");
  bindChat("contracts", "Contract Analyst");
}
function notebookChatPanel() {
  const hist = state.chats.notebook || [];
  return`<section class="panel chat notebook-chat"><div class="messages" id="messages">${hist.map(m => `<div class="msg ${m.role==="user"? "user": ""}">${esc(m.content)}${m.sources?.length? `<div style="margin-top:7px;font-size:9px;opacity:.75">Evidence: ${m.sources.slice(0, 8).map(s => esc(s.name)).join(" · ")}${m.structuredTool? ` · Tool: ${esc(m.structuredTool)}`: ""}</div>`: ""}</div>`).join("") || `<div class="muted">Checked Project Repository files are available as context.</div>`}</div><div class="chatbox"><select id="chatRole">${roles.map(r => `<option ${r==="Project Controls Manager"? "selected": ""}>${r}</option>`).join("")}</select><textarea id="chatInput" placeholder="Ask about the current project…"></textarea><button id="chatSend">Send</button></div></section>`;
}
function notebookReportMarkup(customPrompt = "", aiText = "") {
  const s = activeSchedule(),
  files = state.files.filter(f => f.checked),
  summary = s? scheduleSummary(s): null,
  n = s? scheduleNarrative(s, null): null;
  return`<h1>Project Controls Notebook Report</h1><p>Generated ${new Date().toLocaleString()}</p>${customPrompt? `<p><strong>Requested focus:</strong> ${esc(customPrompt)}</p>`: ""}<h2>Source set</h2><p>${files.length} checked repository file(s)${s? ` and schedule <strong>${esc(scheduleLabel(s))}</strong>`: ""}.</p>${s? `<h2>Schedule overview</h2><ul><li>Activities: ${summary.activities}</li><li>Progress: ${summary.progress.toFixed(1)}%</li><li>Forecast finish: ${esc(summary.forecastFinish || "—")}</li><li>Critical / zero float: ${summary.critical}</li><li>Negative float: ${summary.negativeFloat}</li></ul><h2>Schedule narrative</h2>${n.paragraphs.map(x => `<p>${esc(x)}</p>`).join("")}`: `<p>No active schedule is selected.</p>`}${aiText? `<h2>Custom analysis</h2>${String(aiText).split(/\n{2,}/).map(x => `<p>${esc(x)}</p>`).join("")}`: ""}<h2>Repository files</h2><ul>${files.map(f => `<li>${esc(f.name)} · ${esc(f.category)} · ${Math.round((f.size || 0) / 1024)} KB</li>`).join("") || "<li>No checked files.</li>"}</ul>`;
}
function notebookGraphicSvg(customPrompt = "") {
  const s = activeSchedule(),
  sum = s? scheduleSummary(s): null,
  h = s? scheduleHealth(s): null,
  q = String(customPrompt || "").toLowerCase();
  let vals,
  labels,
  title = "Project Controls Summary",
  suffix = "%",
  max = 100;
  if (s && /(cost|budget|earned value|evm)/.test(q)) {
    const a = s.activities || [],
    budget = a.reduce((n, x) => n + (Number(x.budgetCost) || 0), 0),
    actual = a.reduce((n, x) => n + (Number(x.actualCost) || 0), 0),
    remaining = a.reduce((n, x) => n + (Number(x.remainingCost) || 0), 0);
    vals = [budget, actual, remaining];
    labels = ["Budget cost", "Actual cost", "Remaining cost"];
    title = "Cost Summary";
    suffix = "";
    max = Math.max(1, ...vals);
  } else if (s && /(resource|man.?hour|unit|labour|labor)/.test(q)) {
    const a = s.activities || [],
    budget = a.reduce((n, x) => n + (Number(x.budgetUnits) || 0), 0),
    actual = a.reduce((n, x) => n + (Number(x.actualUnits) || 0), 0),
    remaining = a.reduce((n, x) => n + (Number(x.remainingUnits) || 0), 0);
    vals = [budget, actual, remaining];
    labels = ["Budget units", "Actual units", "Remaining units"];
    title = "Resource / Unit Summary";
    suffix = "";
    max = Math.max(1, ...vals);
  } else {
    vals = sum? [sum.progress, Math.min(100, h.score), Math.min(100, sum.activities? sum.critical / sum.activities * 100: 0), Math.min(100, sum.activities? sum.negativeFloat / sum.activities * 100: 0)]: [0, 0, 0, 0];
    labels = ["Progress", "Health", "Critical %", "Negative float %"];
  }
  const w = 900,
  hg = 360,
  count = Math.max(1, vals.length),
  gap = 46,
  bw = Math.min(150, (760 - gap * (count - 1)) / count);
  const bars = vals.map((v, i) => {
    const x = 80 + i * (bw + gap), bh = Math.max(2, Number(v || 0) / max * 210), y = 285 - bh, display = suffix? `${Number(v || 0).toFixed(1)}${suffix}`: Number(v || 0).toLocaleString(undefined, {
      maximumFractionDigits: 1
    }); return`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="currentColor" opacity="${Math.max(.45, .95 - i * .12)}"/><text x="${x + bw / 2}" y="${y - 10}" text-anchor="middle" fill="currentColor" font-size="16">${esc(display)}</text><text x="${x + bw / 2}" y="322" text-anchor="middle" fill="currentColor" font-size="14">${esc(labels[i])}</text>`
  }).join("");
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hg}" width="${w}" height="${hg}"><rect width="100%" height="100%" fill="white"/><g color="#173b57"><text x="40" y="40" font-family="Segoe UI,Arial" font-size="24" font-weight="700" fill="currentColor">${esc(title)}</text><text x="40" y="66" font-family="Segoe UI,Arial" font-size="12" fill="currentColor">${esc(s? scheduleLabel(s): "No active schedule")}${customPrompt? ` · Focus: ${esc(customPrompt)}`: ""}</text>${bars}</g></svg>`;
}
function notebookAudioScript(customPrompt = "", aiText = "") {
  const s = activeSchedule();
  if (!s)return "No active schedule is selected. Select a schedule to generate an audio brief.";
  if (aiText)return String(aiText);
  const n = scheduleNarrative(s, null);
  return`Project controls audio brief${customPrompt? ` focused on ${customPrompt}`: ""}. ${n.paragraphs.join(" ")}`;
}
function notebookDataCsv(customPrompt = "") {
  const s = activeSchedule(),
  q = String(customPrompt || "").toLowerCase();
  let acts = [...(s?.activities || [])];
  if (/critical|zero float/.test(q))acts = acts.filter(a => a.critical || Number(a.totalFloat)<=0);
  if (/negative float/.test(q))acts = acts.filter(a => Number(a.totalFloat)<0);
  if (/in progress/.test(q))acts = acts.filter(a => a.status==="In Progress");
  if (/not started/.test(q))acts = acts.filter(a => a.status==="Not Started");
  if (/complete/.test(q) && !/not complete/.test(q))acts = acts.filter(a => a.status==="Complete");
  const m = customPrompt.match(/wbs\s*:\s*([^,;]+)/i);
  if (m)acts = acts.filter(a => String(a.wbsPath || "").toLowerCase().includes(m[1].trim().toLowerCase()));
  const rows = acts.map(a => [a.id, a.name, a.wbsPath, a.status, isoDate(a.currentStart || a.start), isoDate(a.currentFinish || a.finish), a.originalDuration, a.remainingDuration, a.totalFloat, a.percent, a.budgetUnits, a.actualUnits, a.remainingUnits, a.budgetCost, a.actualCost, a.remainingCost]);
  return toCSV(["ID", "Activity", "WBS", "Status", "Start", "Finish", "Original duration", "Remaining duration", "Total float", "Percent", "Budget units", "Actual units", "Remaining units", "Budget cost", "Actual cost", "Remaining cost"], rows);
}
function notebookOutputCard(type, title, description, actions = "") {
  const out = state.notebookOutputs?.[type],
  preview = out?.preview || "";
  return`<section class="notebook-output-card" data-output-card="${type}"><div class="output-card-head"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div><button class="btn primary compact" data-nb-create="${type}">Create / customise</button></div>${actions}<div class="output-card-preview" id="nb-${type}-preview">${preview}</div></section>`;
}
async function generateNotebookOutput(type) {
  const defaults = {
    report: "Focus the report on the most important schedule health, progress, forecast and management issues.",
    graphic: "Show the most useful project-controls summary graphic.",
    data: "Export the activities most useful for the current review. You can use terms such as critical, negative float, in progress, or WBS: <name>.",
    audio: "Create a concise executive audio briefing covering status, forecast, risks and next actions."
  };
  const promptText = window.prompt(`Customise this ${type} output:`, state.notebookOutputs?.[type]?.prompt || defaults[type] || "");
  if (promptText===null)return;
  state.notebookOutputs??= {
  };
  let aiText = "";
  if ((type==="report" || type==="audio") && preferredAI()!=="none") {
    try {
      const request = type==="report"? `Create a professional project-controls report section. Custom instruction: ${promptText}`: `Create a concise spoken project-controls briefing. Custom instruction: ${promptText}`;
      const out = await askAI( {
        question: request, role: "Project Controls Manager", current: activeSchedule(), previous: null, revisions: state.schedules, history: []
      });
      aiText = out.text || "";
    } catch (e) {
      aiText = `AI customisation was unavailable (${e.message}). Deterministic schedule content is shown instead.`
    }
  }
  if (type==="report") {
    const body = notebookReportMarkup(promptText, aiText),
    html = `<!doctype html><html><head><meta charset="utf-8"><title>Project Controls Notebook Report</title><style>body{font-family:Segoe UI,Arial;max-width:1100px;margin:40px auto;padding:0 24px;line-height:1.5}</style></head><body>${body}</body></html>`;
    state.notebookOutputs.report = {
      prompt: promptText,
      content: html,
      preview: `<div class="output-preview report-mini">${body}</div>`
    };
  } else if (type==="graphic") {
    const svg = notebookGraphicSvg(promptText);
    state.notebookOutputs.graphic = {
      prompt: promptText,
      content: svg,
      preview: `<div class="output-preview graphic-mini">${svg}</div>`
    };
  } else if (type==="data") {
    const csv = notebookDataCsv(promptText),
    lines = csv.split(/\r?\n/).filter(Boolean);
    state.notebookOutputs.data = {
      prompt: promptText,
      content: csv,
      preview: `<div class="output-preview"><strong>${Math.max(0, lines.length - 1)} activity rows</strong><small>${esc(promptText)}</small></div>`
    };
  } else if (type==="audio") {
    const text = notebookAudioScript(promptText, aiText);
    state.notebookOutputs.audio = {
      prompt: promptText,
      content: text,
      preview: `<div class="output-preview"><pre>${esc(text)}</pre></div>`
    };
  }
  renderNotebook();
}
function renderNotebook() {
  const reportActions = state.notebookOutputs?.report? `<div class="output-actions"><button class="btn" data-nb-download="report">Download HTML</button></div>`: "";
  const graphicActions = state.notebookOutputs?.graphic? `<div class="output-actions"><button class="btn" data-nb-download="graphic">Download SVG</button></div>`: "";
  const dataActions = state.notebookOutputs?.data? `<div class="output-actions"><button class="btn" data-nb-download="data">Download CSV</button></div>`: "";
  const audioActions = state.notebookOutputs?.audio? `<div class="output-actions"><button class="btn" id="nbListenAudio">Listen</button><button class="btn" data-nb-download="audio">Download script</button></div>`: "";
  $("workspace").innerHTML = `${viewHead("NotebookLM+", "Chat with project context while creating customised downloadable outputs in the right-hand studio.")}<div class="notebook-layout"><div class="notebook-chat-column">${notebookChatPanel()}</div><aside class="notebook-output-pane"><div class="output-pane-head"><h2>Outputs</h2><p>Click an output and describe exactly what you want it to contain.</p></div>${notebookOutputCard("report", "Report", "Customisable project-controls HTML report", reportActions)}${notebookOutputCard("graphic", "Graphic", "Prompt-directed SVG project graphic", graphicActions)}${notebookOutputCard("data", "Data extract", "Filtered activity data for further analysis", dataActions)}${notebookOutputCard("audio", "Audio brief", "Customisable briefing script with local playback", audioActions)}</aside></div>`;
  bindChat("notebook", "Project Controls Manager");
  document.querySelectorAll("[data-nb-create]").forEach(b => b.onclick = () => generateNotebookOutput(b.dataset.nbCreate));
  document.querySelectorAll("[data-nb-download]").forEach(b => b.onclick = () => {
    const type = b.dataset.nbDownload, out = state.notebookOutputs?.[type]; if (!out)return; const cfg = {
      report: ["text/html", "notebook-project-controls-report.html"], graphic: ["image/svg+xml", "notebook-project-graphic.svg"], data: ["text/csv", "notebook-activity-data.csv"], audio: ["text/plain", "notebook-audio-brief.txt"]
    }
    [type]; downloadBlob(new Blob([out.content], {
      type: cfg[0]
    }), cfg[1])
  });
  $("nbListenAudio")?.addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
      alert("This browser does not expose speech synthesis."); return
    }
    speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(state.notebookOutputs?.audio?.content || ""))
  });
}
const BOQ_EXT = /\.(csv|xls|xlsx)$/i;
const ALIGN_SCHEDULE_EXT = /\.(pdf|xml|xer)$/i;
const MEASUREMENT_DEFAULTS = {
  drawingIds: [],
  boqMode: "new",
  boqFileId: "",
  alignToSchedule: false,
  alignmentScheduleFileId: "",
  lastAlignment: null,
  lastGenerated: null,
  config: {
    measurementMode: "Quantity take-off & allocation",
    discipline: "All disciplines",
    defaultUnit: "Auto-detect",
    precision: 2,
    allocationMode: "BOQ item first",
    groupBy: "BOQ / category",
    rounding: "None",
    sourceTrace: true,
    includeUnallocated: true
  }
};
// -----------------------------------------------------------------------------
// Drawing measurement / BOQ workflow
// -----------------------------------------------------------------------------
function normaliseMeasurementState(value) {
  const v = value && typeof value==="object"? value: {
  };
  return {
    drawingIds: Array.isArray(v.drawingIds)? v.drawingIds.map(String): [],
    boqMode: v.boqMode==="existing"? "existing": "new",
    boqFileId: String(v.boqFileId || ""),
    alignToSchedule: !!v.alignToSchedule,
    alignmentScheduleFileId: String(v.alignmentScheduleFileId || ""),
    lastAlignment: v.lastAlignment || null,
    lastGenerated: v.lastGenerated || null,
    config: {
      ...MEASUREMENT_DEFAULTS.config,
      ...(v.config || {
      })
    }
  };
}
function saveMeasurementState() {
  localStorage.setItem("pcai.measurement", JSON.stringify(state.measurement))
}
function fileTreeData(files) {
  const root = {
    name: "",
    folders: new Map(),
    files: []
  };
  for (const f of files || []) {
    const raw = String(f.relativePath || f.name || "").replace(/\\/g, "/"),
    parts = raw.split("/").filter(Boolean),
    fileName = parts.pop() || f.name || "Unnamed file";
    let node = root;
    for (const part of parts) {
      if (!node.folders.has(part))node.folders.set(part, {
        name: part, folders: new Map(), files: []
      });
      node = node.folders.get(part)
    }
    node.files.push( {
      ...f, _treeName: fileName
    });
  }
  return root;
}
function measurementFileTree(files, {
  mode = "drawings"
}
= {
}) {
  const tree = fileTreeData(files),
  selected = new Set(state.measurement.drawingIds.map(String));
  const renderNode = (node, depth = 0) => {
    const folders = [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name));
    const fileRows = node.files.slice().sort((a, b) => String(a._treeName).localeCompare(String(b._treeName))).map(f => {
      const isBoq = BOQ_EXT.test(f.name || ""); if (mode==="boq")return`<label class="measurement-tree-file ${isBoq? "": "disabled"}" style="--tree-depth:${depth}"><input type="radio" name="measurementBoq" data-boq-file="${esc(f.id)}" ${state.measurement.boqMode==="existing" && state.measurement.boqFileId===String(f.id)? "checked": ""} ${isBoq? "": "disabled"}><span class="file-icon">${isBoq? "▤": "·"}</span><span><strong>${esc(f._treeName)}</strong><small>${esc(f.relativePath || f.name)}${isBoq? "": " · not a CSV/Excel BOQ"}</small></span></label>`; return`<label class="measurement-tree-file" style="--tree-depth:${depth}"><input type="checkbox" data-drawing-file="${esc(f.id)}" ${selected.has(String(f.id))? "checked": ""}><span class="file-icon">▧</span><span><strong>${esc(f._treeName)}</strong><small>${esc(f.relativePath || f.name)}</small></span></label>`;
    }).join("");
    return folders.map(folder => `<details class="measurement-tree-folder" open><summary style="--tree-depth:${depth}">▾ ${esc(folder.name)}</summary>${renderNode(folder, depth + 1)}</details>`).join("") + fileRows;
  };
  return renderNode(tree, 0) || `<div class="measurement-tree-empty">No project files are available.</div>`;
}
function measurementScheduleOptions() {
  const files = state.files.filter(f => ALIGN_SCHEDULE_EXT.test(f.name || ""));
  return`<option value="">Select schedule…</option>${files.map(f => `<option value="${esc(f.id)}" ${String(f.id)===String(state.measurement.alignmentScheduleFileId)? "selected": ""}>${esc(f.relativePath || f.name)}</option>`).join("")}`;
}
function asNamedFile(blob, rec) {
  return blob instanceof File? blob: new File([blob], rec.name, {
    type: rec.type || blob?.type || "application/octet-stream", lastModified: rec.lastModified || Date.now()
  })
}
/**
 * Build the activity search index used by BOQ alignment. XER/XML schedules use
 * parsed schedule records directly; PDFs use their text layer as a best-effort
 * source of activity ID/name pairs.
 */
async function measurementAlignmentIndex(fileId) {
  const rec = state.files.find(f => String(f.id)===String(fileId));
  if (!rec)throw new Error("Select a schedule file for alignment.");
  const ext = (rec.name.split(".").pop() || "").toLowerCase();
  if (ext==="pdf") {
    const blob = await getFileBlob(rec.id);
    if (!blob)throw new Error("The selected PDF is unavailable. Re-authorise the linked folder or re-import the file.");
    const text = await extractPdfScheduleText(asNamedFile(blob, rec)),
    index = pdfScheduleCandidates(text);
    if (!index.length)throw new Error("No activity ID / description pairs could be identified in the selected PDF schedule.");
    return index;
  }
  let schedules = state.schedules.filter(x => String(x.sourceFileId)===String(rec.id));
  if (!schedules.length) {
    const blob = await getFileBlob(rec.id);
    if (!blob)throw new Error("The selected schedule file is unavailable.");
    const parsed = await parseScheduleFile(asNamedFile(blob, rec));
    schedules = parsed.schedules || []
  }
  const index = activityAlignmentIndex(schedules.flatMap(x => x.activities || []));
  if (!index.length)throw new Error("The selected schedule contains no activities to align against.");
  return index;
}
function alignedNewBoqCsv() {
  const headers = ["Discipline", "Category", "Item", "Unit", "Quantity", "BOQ Item", RECOMMENDED_HEADER, "Activity ID", "Norm h/unit", "Calculated hours"];
  const rows = state.quantityRows.map(r => [r.discipline, r.category, r.item, r.unit, r.quantity, r.boq, r.recommendedActivityIds || "", r.activityId, r.norm, (r.quantity || 0) * (r.norm || 0)]);
  return toCSV(headers, rows);
}
async function applyMeasurementAlignment(index) {
  state.quantityRows = alignMeasurementRows(state.quantityRows, index);
  localStorage.setItem("pcai.quantities", JSON.stringify(state.quantityRows));
  let result = {
    matched: state.quantityRows.filter(r => r.recommendedActivityIds).length,
    total: state.quantityRows.length,
    name: "NEW BOQ Document"
  };
  if (state.measurement.boqMode==="existing") {
    const rec = state.files.find(f => String(f.id)===String(state.measurement.boqFileId));
    if (!rec)throw new Error("Selected BOQ file is unavailable.");
    const blob = await getFileBlob(rec.id);
    if (!blob)throw new Error("Selected BOQ cannot be read. Re-authorise its linked folder or re-import it.");
    result = await alignBoqFile(asNamedFile(blob, rec), index);
    await updateFileBlob(rec.id, result.blob, {
      name: rec.name, type: result.blob.type
    });
    downloadBlob(result.blob, result.name);
  } else {
    const blob = new Blob([alignedNewBoqCsv()], {
      type: "text/csv"
    });
    downloadBlob(blob, "NEW-BOQ-aligned.csv");
  }
  return result;
}
function renderDrawing() {
  state.measurement = normaliseMeasurementState(state.measurement);
  const fileIds = new Set(state.files.map(f => String(f.id))),
  validBoqIds = new Set(state.files.filter(f => BOQ_EXT.test(f.name || "")).map(f => String(f.id))),
  validScheduleIds = new Set(state.files.filter(f => ALIGN_SCHEDULE_EXT.test(f.name || "")).map(f => String(f.id)));
  state.measurement.drawingIds = state.measurement.drawingIds.filter(id => fileIds.has(String(id)));
  if (state.measurement.boqMode==="existing" && !validBoqIds.has(String(state.measurement.boqFileId))) {
    state.measurement.boqMode = "new";
    state.measurement.boqFileId = ""
  }
  if (state.measurement.alignmentScheduleFileId && !validScheduleIds.has(String(state.measurement.alignmentScheduleFileId)))state.measurement.alignmentScheduleFileId = "";
  saveMeasurementState();
  const c = state.measurement.config,
  target = state.measurement.boqMode==="existing"? state.files.find(f => String(f.id)===String(state.measurement.boqFileId))?.name || "Existing BOQ": "NEW BOQ Document";
  $("workspace").innerHTML = `${viewHead("Drawing Measurement", "Choose drawing sources and one BOQ destination, then configure measurement and allocation.", `<button class="btn" id="addQty">Add row</button><button class="btn" id="exportQty">Export CSV</button>`)}
  <section class="panel measurement-source-panel">
    <div class="measurement-source-grid">
      <div class="measurement-source-box"><div class="measurement-box-head"><div><h2>Drawings to be measured</h2><p>Select one or more files from the Project Repository.</p></div><div class="measurement-count" id="drawingSelectionCount">${state.measurement.drawingIds.length} selected</div></div><div class="measurement-tree">${measurementFileTree(state.files, {
    mode: "drawings"
  })}</div></div>
      <div class="measurement-source-box"><div class="measurement-box-head"><div><h2>BOQ</h2><p>Select the single BOQ that receives the allocation, or create a new one.</p></div><div class="measurement-count">1 target</div></div><label class="measurement-new-boq"><input type="radio" name="measurementBoq" id="newBoqTarget" ${state.measurement.boqMode!=="existing"? "checked": ""}><span>＋</span><strong>NEW BOQ Document</strong></label><div class="measurement-tree boq-tree">${measurementFileTree(state.files, {
    mode: "boq"
  })}</div></div>
    </div>
    <div class="measurement-alignment ${state.measurement.alignToSchedule? "enabled": ""}">
      <label class="measurement-toggle measurement-align-toggle"><input type="checkbox" id="alignToSchedule" ${state.measurement.alignToSchedule? "checked": ""}><span><strong>Align to schedule</strong><small>Add recommended P6 activity ID(s) to the BOQ without replacing manually assigned Activity IDs.</small></span></label>
      <label class="measurement-align-select" ${state.measurement.alignToSchedule? "": "hidden"}>Schedule to align against<select id="alignmentScheduleFile" ${state.measurement.alignToSchedule? "required": "disabled"}>${measurementScheduleOptions()}</select><small>PDF, XML or XER schedules only. A selection is required when alignment is enabled.</small></label>
      ${state.measurement.lastAlignment? `<div class="measurement-alignment-result">Last alignment: <strong>${esc(state.measurement.lastAlignment.scheduleName || "Schedule")}</strong> · ${Number(state.measurement.lastAlignment.matched || 0)}/${Number(state.measurement.lastAlignment.total || 0)} BOQ/register rows matched.</div>`: ""}
    </div>
    <div class="measurement-generate-row"><div><strong>Target:</strong> ${esc(target)}<span class="muted"> · ${state.measurement.drawingIds.length} drawing file${state.measurement.drawingIds.length===1? "": "s"} selected${state.measurement.alignToSchedule? " · schedule alignment enabled": ""}</span></div><button class="btn primary measurement-generate" id="measurementGenerate" ${state.measurement.drawingIds.length && (!state.measurement.alignToSchedule || state.measurement.alignmentScheduleFileId)? "": "disabled"}>Generate</button></div>
  </section>
  <section class="panel measurement-settings"><div class="measurement-section-head"><div><h2>Measurement & allocation settings</h2><p>Configure how quantities are measured, grouped and allocated before generation.</p></div></div><div class="form measurement-config-grid">
    <label>Measurement mode<select data-measure-config="measurementMode">${["Quantity take-off & allocation", "Quantity take-off only", "BOQ allocation only", "Verification / remeasurement"].map(x => `<option ${c.measurementMode===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label>Discipline<select data-measure-config="discipline">${["All disciplines", "Electrical", "Mechanical", "CSA / Civil", "Instrumentation & Controls", "Process", "Architectural"].map(x => `<option ${c.discipline===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label>Default unit<select data-measure-config="defaultUnit">${["Auto-detect", "m", "m²", "m³", "nr", "kg", "t", "lot"].map(x => `<option ${c.defaultUnit===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label>Decimal precision<select data-measure-config="precision">${[0, 1, 2, 3, 4].map(x => `<option value="${x}" ${Number(c.precision)===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label>Allocation method<select data-measure-config="allocationMode">${["BOQ item first", "Drawing category first", "Activity / WBS first", "Manual review first"].map(x => `<option ${c.allocationMode===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label>Group generated rows by<select data-measure-config="groupBy">${["BOQ / category", "Drawing", "Discipline", "WBS / activity", "Unit"].map(x => `<option ${c.groupBy===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label>Rounding<select data-measure-config="rounding">${["None", "Nearest whole unit", "Nearest 0.5", "Nearest 0.1"].map(x => `<option ${c.rounding===x? "selected": ""}>${x}</option>`).join("")}</select></label>
    <label class="measurement-toggle"><input type="checkbox" data-measure-config="sourceTrace" ${c.sourceTrace? "checked": ""}><span>Retain drawing/file source against each measured item</span></label>
    <label class="measurement-toggle"><input type="checkbox" data-measure-config="includeUnallocated" ${c.includeUnallocated? "checked": ""}><span>Keep unallocated measurements for review</span></label>
  </div></section>
  <section class="panel measurement-register"><div class="measurement-section-head"><div><h2>Measurement & allocation register</h2><p>Generated quantities and manual adjustments are maintained here.</p></div><div class="muted">${state.quantityRows.length} row${state.quantityRows.length===1? "": "s"}</div></div>${table(["Discipline", "Category", "Item", "Unit", "Quantity", "BOQ Item", ...(state.measurement.alignToSchedule? ["Recommended Activity ID(s)"]: []), "Activity ID", "Norm h/unit", "Calculated hours", ""], state.quantityRows.map((r, i) => [`<input data-q="${i}:discipline" value="${esc(r.discipline || "")}">`, `<input data-q="${i}:category" value="${esc(r.category || "")}">`, `<input data-q="${i}:item" value="${esc(r.item || "")}">`, `<input data-q="${i}:unit" value="${esc(r.unit || "")}">`, `<input type="number" data-q="${i}:quantity" value="${r.quantity || 0}">`, `<input data-q="${i}:boq" value="${esc(r.boq || "")}">`, ...(state.measurement.alignToSchedule? [`<input value="${esc(r.recommendedActivityIds || "")}" readonly title="Recommended from selected schedule">`]: []), `<input data-q="${i}:activityId" value="${esc(r.activityId || "")}">`, `<input type="number" data-q="${i}:norm" value="${r.norm || 0}">`, ((r.quantity || 0) * (r.norm || 0)).toFixed(2), `<button data-delq="${i}">×</button>`]))}</section>`;
  document.querySelectorAll("[data-drawing-file]").forEach(x => x.onchange = () => {
    const id = String(x.dataset.drawingFile), set = new Set(state.measurement.drawingIds.map(String)); x.checked? set.add(id): set.delete(id); state.measurement.drawingIds = [...set]; saveMeasurementState(); renderDrawing()
  });
  $("newBoqTarget").onchange = () => {
    if ($("newBoqTarget").checked) {
      state.measurement.boqMode = "new";
      state.measurement.boqFileId = "";
      saveMeasurementState();
      renderDrawing()
    }
  };
  document.querySelectorAll("[data-boq-file]").forEach(x => x.onchange = () => {
    if (!x.checked)return; state.measurement.boqMode = "existing"; state.measurement.boqFileId = String(x.dataset.boqFile); saveMeasurementState(); renderDrawing()
  });
  $("alignToSchedule").onchange = () => {
    state.measurement.alignToSchedule = $("alignToSchedule").checked;
    if (!state.measurement.alignToSchedule)state.measurement.alignmentScheduleFileId = "";
    saveMeasurementState();
    renderDrawing()
  };
  $("alignmentScheduleFile")?.addEventListener("change", e => {
    state.measurement.alignmentScheduleFileId = String(e.target.value || ""); saveMeasurementState(); renderDrawing()
  });
  document.querySelectorAll("[data-measure-config]").forEach(x => x.onchange = () => {
    const key = x.dataset.measureConfig; state.measurement.config[key] = x.type==="checkbox"? x.checked: x.type==="number"? Number(x.value): key==="precision"? Number(x.value): x.value; saveMeasurementState()
  });
  $("measurementGenerate").onclick = async() => {
    if (!state.measurement.drawingIds.length)return alert("Select at least one drawing/reference file to measure.");
    if (state.measurement.boqMode==="existing" && !state.measurement.boqFileId)return alert("Select a BOQ file or choose NEW BOQ Document.");
    if (state.measurement.alignToSchedule && !state.measurement.alignmentScheduleFileId)return alert("Align to schedule is enabled. Select a PDF, XML or XER schedule before generating.");
    try {
      await withProgress(state.measurement.alignToSchedule? "Generating and aligning measurement": "Generating measurement", async() => {
        let alignment = null; if (state.measurement.alignToSchedule) {
          const rec = state.files.find(f => String(f.id)===String(state.measurement.alignmentScheduleFileId)), index = await measurementAlignmentIndex(state.measurement.alignmentScheduleFileId); alignment = await applyMeasurementAlignment(index); state.measurement.lastAlignment = {
            at: new Date().toISOString(), scheduleFileId: state.measurement.alignmentScheduleFileId, scheduleName: rec?.name || "Schedule", matched: alignment.matched, total: alignment.total
          }; await refreshData()
        }
        state.measurement.lastGenerated = {
          at: new Date().toISOString(), drawingIds: [...state.measurement.drawingIds], boqMode: state.measurement.boqMode, boqFileId: state.measurement.boqFileId, alignToSchedule: state.measurement.alignToSchedule, alignmentScheduleFileId: state.measurement.alignmentScheduleFileId, config: {
            ...state.measurement.config
          }
        }; saveMeasurementState();
      });
      toast(state.measurement.alignToSchedule? `Measurement ready · ${state.measurement.lastAlignment?.matched || 0} BOQ rows aligned`: "Measurement setup ready");
      renderDrawing()
    } catch (error) {
      alert(`Measurement generation failed: ${error.message || error}`)
    }
  };
  document.querySelectorAll("[data-q]").forEach(x => x.onchange = () => {
    const[i, k] = x.dataset.q.split(":"); state.quantityRows[Number(i)][k] = x.type==="number"? Number(x.value): x.value; localStorage.setItem("pcai.quantities", JSON.stringify(state.quantityRows)); renderDrawing()
  });
  document.querySelectorAll("[data-delq]").forEach(x => x.onclick = () => {
    state.quantityRows.splice(Number(x.dataset.delq), 1); localStorage.setItem("pcai.quantities", JSON.stringify(state.quantityRows)); renderDrawing()
  });
  $("addQty").onclick = () => {
    state.quantityRows.push( {
      id: uid("qty"), discipline: "Electrical", category: "", item: "", unit: "m", quantity: 0, boq: "", recommendedActivityIds: "", activityId: "", norm: 0
    });
    localStorage.setItem("pcai.quantities", JSON.stringify(state.quantityRows));
    renderDrawing()
  };
  $("exportQty").onclick = () => downloadBlob(new Blob([toCSV(["Discipline", "Category", "Item", "Unit", "Quantity", "BOQ", RECOMMENDED_HEADER, "Activity ID", "Norm", "Hours"], state.quantityRows.map(r => [r.discipline, r.category, r.item, r.unit, r.quantity, r.boq, r.recommendedActivityIds || "", r.activityId, r.norm, (r.quantity || 0) * (r.norm || 0)]))], {
    type: "text/csv"
  }), "drawing-measurements.csv");
}

// -----------------------------------------------------------------------------
// Manpower Breakout — forward-look and retrospective presentation dashboard
// -----------------------------------------------------------------------------
const MANPOWER_LAYOUT_EXT = /\.(pdf|png|jpe?g|webp|svg)$/i;

function saveManpowerState() {
  localStorage.setItem("pcai.manpower", JSON.stringify({
    mode: state.manpowerMode,
    scheduleId: state.manpowerScheduleId,
    plannedId: state.manpowerPlannedId,
    actualId: state.manpowerActualId,
    layouts: state.manpowerLayouts,
    useAI: state.manpowerUseAI,
    hoursPerPerson: state.manpowerHoursPerPerson,
    overrides: state.manpowerOverrides,
    friday: state.manpowerFriday,
    month: state.manpowerMonth
  }));
}

function manpowerLayoutCandidates() {
  return state.files.filter(f => MANPOWER_LAYOUT_EXT.test(f.name || ""));
}

function manpowerLayoutOptions(value = "") {
  const files = manpowerLayoutCandidates();
  return `<option value="">Select layout…</option>${files.map(f => `<option value="${esc(f.id)}" ${String(f.id)===String(value)?"selected":""}>${esc(f.relativePath || f.name)}</option>`).join("")}`;
}

function formatMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(String(ym || ""))) return ym || "";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function manpowerProgrammeSet() {
  if (state.manpowerMode === "forensic") {
    return [scheduleById(state.manpowerPlannedId), scheduleById(state.manpowerActualId)].filter(Boolean);
  }
  return [scheduleById(state.manpowerScheduleId)].filter(Boolean);
}

function manpowerFridays(programmes) {
  const set = new Set(programmes.flatMap(fridaySeries));
  return [...set].sort();
}

function disciplineClass(name) {
  const idx = Math.max(0, DISCIPLINES.indexOf(name));
  return `discipline-${idx % 10}`;
}

function manpowerFishbone(fridays, selected, month) {
  const monthFridays = fridays.filter(x => x.startsWith(month));
  if (!monthFridays.length) return `<div class="empty-state">No scheduled construction weeks fall inside this month.</div>`;
  return `<div class="manpower-fishbone" role="group" aria-label="Week ending Friday selector"><div class="fishbone-spine"></div>${monthFridays.map((f, i) => `<button class="fishbone-week ${f===selected?"active":""}" data-manpower-friday="${f}" title="Week ending Friday ${f}"><span class="fishbone-bone bone-top"></span><strong>${esc(f)}</strong><small>Fri</small><span class="fishbone-bone bone-bottom"></span></button>`).join("")}</div>`;
}

function areaSummary(rows = []) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.area)) map.set(r.area, { area: r.area, hours: 0, people: 0, activities: 0, disciplines: new Set() });
    const x = map.get(r.area); x.hours += Number(r.hours || 0); x.people += Number(r.people || 0); x.activities++; x.disciplines.add(r.discipline || "General");
  }
  return [...map.values()].map(x => ({ ...x, disciplines: [...x.disciplines] })).sort((a, b) => b.hours - a.hours || a.area.localeCompare(b.area));
}

function manpowerAreaMap(rows = [], title = "Programme area map") {
  const areas = areaSummary(rows);
  if (!areas.length) return `<div class="manpower-area-map empty-state">No construction activities are scheduled for this floor in the selected week.</div>`;
  return `<div class="manpower-area-map"><div class="manpower-area-map-title">${esc(title)}</div><div class="manpower-zone-grid">${areas.map(a => `<div class="manpower-zone" title="${a.activities} activities · ${a.hours.toFixed(1)} h · ${a.people.toFixed(1)} people"><div class="manpower-zone-head"><strong>${esc(a.area)}</strong><span>${a.activities} activities</span></div><div class="discipline-strips">${a.disciplines.map(d => `<span class="discipline-chip ${disciplineClass(d)}">${esc(d)}</span>`).join("")}</div><div class="manpower-zone-metric"><b>${a.hours.toFixed(0)} h</b><span>${a.people.toFixed(1)} people @ ${Number(state.manpowerHoursPerPerson || 45)}h</span></div></div>`).join("")}</div></div>`;
}

function manpowerActivityTable(rows = []) {
  if (!rows.length) return `<div class="empty-state">No activities for this floor/week.</div>`;
  const groups = new Map();
  for (const r of rows) {
    const key = r.wbs || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return `<div class="manpower-activity-groups">${[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([wbs, items]) => `<details class="manpower-wbs" open><summary><strong>${esc(wbs)}</strong><span>${items.length} activit${items.length===1?"y":"ies"}</span></summary>${table(["Activity", "Area", "Discipline", "Start", "Finish", "%", "Hours", "People"], items.sort((a,b)=>String(a.start).localeCompare(String(b.start)) || String(a.id).localeCompare(String(b.id))).map(r => [`<span class="activity-link" data-inspect-activity="${esc(r.id)}"><strong>${esc(r.id)}</strong><small>${esc(r.name)}</small></span>`, esc(r.area), `<span class="discipline-chip ${disciplineClass(r.discipline)}">${esc(r.discipline)}</span>`, esc(r.start || "—"), esc(r.finish || "—"), `${Number(r.percent || 0).toFixed(1)}%`, Number(r.hours || 0).toFixed(1), Number(r.people || 0).toFixed(1)]), { resizable: true, resizeKey: `manpower-${wbs}` })}</details>`).join("")}</div>`;
}

function manpowerCharts(rows = [], suffix = "") {
  const areas = areaSummary(rows).map(x => ({ label: x.area, hours: x.hours, people: x.people }));
  if (!areas.length) return "";
  return `<div class="grid grid2 manpower-small-charts"><section><h3>Hours by area</h3>${interactiveBarChart(areas, { height: 230, series: [{ key: "hours", label: "Hours" }], valueSuffix: " h", defaultMode: "horizontal" })}</section><section><h3>Manpower by area</h3>${interactiveBarChart(areas, { height: 230, series: [{ key: "people", label: `People @ ${Number(state.manpowerHoursPerPerson || 45)}h/week` }], valueSuffix: " people", defaultMode: "horizontal" })}</section></div>`;
}

function manpowerFloorRows(breakout, layout, layoutCount) {
  return (breakout?.rows || []).filter(r => matchFloorLabel(r.floor, layout.label, layoutCount));
}

function manpowerFloorPanel(layout, label, rows, modeLabel) {
  return `<section class="panel manpower-floor-panel"><div class="panel-head-row"><div><h2>${esc(label)}</h2><p class="muted">${esc(modeLabel)} · Week ending Friday ${esc(state.manpowerFriday || "—")}</p></div><div class="manpower-floor-total"><strong>${rows.reduce((n,r)=>n+Number(r.hours||0),0).toFixed(0)} h</strong><span>${rows.reduce((n,r)=>n+Number(r.people||0),0).toFixed(1)} people</span></div></div><div class="manpower-floor-main"><div class="manpower-layout-column"><div class="manpower-layout-reference" data-manpower-layout="${esc(layout.fileId || "")}"><div class="muted">Loading layout reference…</div></div>${manpowerAreaMap(rows, `${modeLabel} area works`)}</div><aside class="manpower-week-activities"><h3>Scheduled activities</h3>${manpowerActivityTable(rows)}</aside></div>${manpowerCharts(rows, modeLabel)}</section>`;
}

async function hydrateManpowerLayoutPreviews() {
  for (const el of document.querySelectorAll("[data-manpower-layout]")) {
    const id = String(el.dataset.manpowerLayout || "");
    if (!id) { el.innerHTML = `<div class="empty-state">No layout selected.</div>`; continue; }
    const file = state.files.find(f => String(f.id) === id);
    if (!file) { el.innerHTML = `<div class="empty-state">Layout file is no longer available.</div>`; continue; }
    try {
      let url = manpowerObjectUrls.get(id);
      if (!url) {
        const blob = await getFileBlob(id);
        if (!blob) throw new Error("File data unavailable");
        url = URL.createObjectURL(blob); manpowerObjectUrls.set(id, url);
      }
      const name = file.name || "layout";
      if (/\.pdf$/i.test(name)) el.innerHTML = `<object data="${esc(url)}" type="application/pdf"><a href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(name)}</a></object>`;
      else el.innerHTML = `<img src="${esc(url)}" alt="${esc(name)}" loading="lazy">`;
    } catch (error) {
      el.innerHTML = `<div class="empty-state">Could not preview ${esc(file.name)}: ${esc(error.message || error)}</div>`;
    }
  }
}

async function generateManpowerBreakout() {
  const programmes = manpowerProgrammeSet();
  if (!programmes.length || (state.manpowerMode === "forensic" && programmes.length < 2)) throw new Error("Select the required programme schedule(s).");
  if (!state.manpowerLayouts.some(x => x.fileId)) throw new Error("Select at least one project/floor layout file.");
  updateProgress({ title: "Generating manpower breakout", detail: "Analysing construction WBS, floors and areas", percent: 8 });
  let overrides = {};
  const ai = selectedAIInfo();
  if (state.manpowerUseAI && ai.engine !== "none" && ai.compatible) {
    updateProgress({ title: "Generating manpower breakout", detail: `AI classification · ${aiLabel()}`, percent: 25 });
    const merged = { ...programmes[0], activities: programmes.flatMap(x => x.activities || []) };
    try {
      const response = await askAI({
        question: wbsClassificationPrompt(merged),
        role: "Construction Planning and Manpower Mapping Specialist",
        current: programmes.at(-1),
        previous: programmes[0],
        revisions: programmes,
        contextFileIds: state.manpowerLayouts.map(x => x.fileId).filter(Boolean)
      });
      overrides = parseClassificationResponse(response.text || "");
    } catch (error) {
      console.warn("AI manpower classification failed; using deterministic schedule classification", error);
      toast(`AI classification unavailable · using schedule/WBS rules`);
    }
  }
  updateProgress({ title: "Generating manpower breakout", detail: "Building Friday week sequence and resource profiles", percent: 72 });
  state.manpowerOverrides = overrides;
  const fridays = manpowerFridays(programmes);
  const preferred = weekEndingFriday(programmes.at(-1)?.dataDate || programmes.at(-1)?.activities?.[0]?.currentStart || programmes.at(-1)?.activities?.[0]?.start);
  if (!state.manpowerFriday || !fridays.includes(state.manpowerFriday)) state.manpowerFriday = fridays.includes(preferred) ? preferred : (fridays[0] || "");
  state.manpowerMonth = state.manpowerFriday?.slice(0, 7) || monthsFromFridays(fridays)[0] || "";
  state.manpowerGenerated = true;
  saveManpowerState();
  updateProgress({ title: "Generating manpower breakout", detail: "Dashboard ready", percent: 100, done: true });
}

function bindManpowerControls() {
  $("manpowerMode")?.addEventListener("change", e => { state.manpowerMode = e.target.value; state.manpowerGenerated = false; saveManpowerState(); renderManpower(); });
  $("manpowerSchedule")?.addEventListener("change", e => { state.manpowerScheduleId = e.target.value; state.manpowerGenerated = false; saveManpowerState(); });
  $("manpowerPlanned")?.addEventListener("change", e => { state.manpowerPlannedId = e.target.value; state.manpowerGenerated = false; saveManpowerState(); });
  $("manpowerActual")?.addEventListener("change", e => { state.manpowerActualId = e.target.value; state.manpowerGenerated = false; saveManpowerState(); });
  $("manpowerUseAI")?.addEventListener("change", e => { state.manpowerUseAI = e.target.checked; saveManpowerState(); });
  $("manpowerHours")?.addEventListener("change", e => { state.manpowerHoursPerPerson = Math.max(1, Number(e.target.value || 45)); saveManpowerState(); if (state.manpowerGenerated) renderManpower(); });
  document.querySelectorAll("[data-manpower-layout-file]").forEach(el => el.addEventListener("change", e => { const row = state.manpowerLayouts.find(x => x.id === e.target.dataset.manpowerLayoutFile); if (row) row.fileId = e.target.value; state.manpowerGenerated = false; saveManpowerState(); }));
  document.querySelectorAll("[data-manpower-layout-label]").forEach(el => el.addEventListener("change", e => { const row = state.manpowerLayouts.find(x => x.id === e.target.dataset.manpowerLayoutLabel); if (row) row.label = e.target.value || "All / Project"; state.manpowerGenerated = false; saveManpowerState(); }));
  document.querySelectorAll("[data-manpower-layout-remove]").forEach(el => el.onclick = () => { state.manpowerLayouts = state.manpowerLayouts.filter(x => x.id !== el.dataset.manpowerLayoutRemove); if (!state.manpowerLayouts.length) state.manpowerLayouts.push({ id: uid("layout"), fileId: "", label: "All / Project" }); state.manpowerGenerated = false; saveManpowerState(); renderManpower(); });
  $("manpowerAddLayout")?.addEventListener("click", () => { state.manpowerLayouts.push({ id: uid("layout"), fileId: "", label: `Floor ${state.manpowerLayouts.length + 1}` }); state.manpowerGenerated = false; saveManpowerState(); renderManpower(); });
  $("manpowerGenerate")?.addEventListener("click", async () => { try { await generateManpowerBreakout(); renderManpower(); } catch (error) { alert(error.message || error); updateProgress({ title: "Manpower breakout", detail: error.message || String(error), percent: 100, done: true }); } });
  $("manpowerMonth")?.addEventListener("change", e => { state.manpowerMonth = e.target.value; const programmes = manpowerProgrammeSet(), f = manpowerFridays(programmes).find(x => x.startsWith(state.manpowerMonth)); if (f) state.manpowerFriday = f; saveManpowerState(); renderManpower(); });
  document.querySelectorAll("[data-manpower-friday]").forEach(el => el.onclick = () => { state.manpowerFriday = el.dataset.manpowerFriday; state.manpowerMonth = state.manpowerFriday.slice(0, 7); saveManpowerState(); renderManpower(); });
  document.querySelectorAll("[data-inspect-activity]").forEach(el => el.onclick = () => { state.inspectorActivityId = el.dataset.inspectActivity; state.assessmentReport = "inspector"; state.view = "assessment"; render(); });
}

function renderManpower() {
  if (!state.manpowerScheduleId) state.manpowerScheduleId = state.activeScheduleId || state.schedules.at(-1)?.id || "";
  if (!state.manpowerActualId) state.manpowerActualId = state.activeScheduleId || state.schedules.at(-1)?.id || "";
  if (!state.manpowerPlannedId) state.manpowerPlannedId = state.previousScheduleId || state.schedules.at(-2)?.id || state.schedules.at(-1)?.id || "";
  const ai = selectedAIInfo(), layoutFiles = manpowerLayoutCandidates();
  const layouts = state.manpowerLayouts.map((x, i) => `<div class="manpower-layout-row"><label>Floor / layout label<input data-manpower-layout-label="${esc(x.id)}" value="${esc(x.label || `Floor ${i + 1}`)}" placeholder="e.g. Level 01"></label><label>Layout file<select data-manpower-layout-file="${esc(x.id)}">${manpowerLayoutOptions(x.fileId)}</select></label><button class="btn danger compact" data-manpower-layout-remove="${esc(x.id)}" type="button">Remove</button></div>`).join("");
  const programmes = manpowerProgrammeSet(), fridays = state.manpowerGenerated ? manpowerFridays(programmes) : [], months = monthsFromFridays(fridays);
  if (state.manpowerGenerated && fridays.length && (!state.manpowerFriday || !fridays.includes(state.manpowerFriday))) state.manpowerFriday = fridays[0];
  if (state.manpowerGenerated && state.manpowerFriday && !state.manpowerMonth) state.manpowerMonth = state.manpowerFriday.slice(0, 7);
  let dashboard = "";
  if (state.manpowerGenerated && programmes.length && state.manpowerFriday) {
    const hours = Number(state.manpowerHoursPerPerson || 45), layoutCount = state.manpowerLayouts.length;
    if (state.manpowerMode === "forensic") {
      const planned = buildWeeklyBreakout(programmes[0], state.manpowerFriday, { actualMode: false, overrides: state.manpowerOverrides, hoursPerPerson: hours });
      const actual = buildWeeklyBreakout(programmes[1], state.manpowerFriday, { actualMode: true, overrides: state.manpowerOverrides, hoursPerPerson: hours });
      dashboard = `<section class="panel manpower-week-selector"><div class="panel-head-row"><div><h2>Weekly fishbone</h2><p class="muted">One shared Friday selector controls every floor. Choose a month, then click a Friday.</p></div><label>Month<select id="manpowerMonth">${months.map(m => `<option value="${m}" ${m===state.manpowerMonth?"selected":""}>${esc(formatMonth(m))}</option>`).join("")}</select></label></div>${manpowerFishbone(fridays, state.manpowerFriday, state.manpowerMonth || months[0])}</section>${state.manpowerLayouts.map(layout => { const pRows = manpowerFloorRows(planned, layout, layoutCount), aRows = manpowerFloorRows(actual, layout, layoutCount); return `<section class="manpower-forensic-floor"><div class="manpower-floor-banner"><h2>${esc(layout.label || "Floor")}</h2><span>Planned vs actual · ${esc(state.manpowerFriday)}</span></div><div class="manpower-compare-grid">${manpowerFloorPanel(layout, layout.label || "Floor", pRows, "Planned")}${manpowerFloorPanel(layout, layout.label || "Floor", aRows, "Actual")}</div></section>`; }).join("")}`;
    } else {
      const forecast = buildWeeklyBreakout(programmes[0], state.manpowerFriday, { actualMode: false, overrides: state.manpowerOverrides, hoursPerPerson: hours });
      dashboard = `<section class="panel manpower-week-selector"><div class="panel-head-row"><div><h2>Weekly fishbone</h2><p class="muted">The fishbone is keyed to week-ending Friday. Choose a month, then select the week to present.</p></div><label>Month<select id="manpowerMonth">${months.map(m => `<option value="${m}" ${m===state.manpowerMonth?"selected":""}>${esc(formatMonth(m))}</option>`).join("")}</select></label></div>${manpowerFishbone(fridays, state.manpowerFriday, state.manpowerMonth || months[0])}</section>${state.manpowerLayouts.map(layout => manpowerFloorPanel(layout, layout.label || "Floor", manpowerFloorRows(forecast, layout, layoutCount), "Forward look")).join("")}`;
    }
  }
  $("workspace").innerHTML = `${viewHead("Manpower Breakout", "Forward-looking and retrospective floor/area presentation of construction work and resource demand", `<button class="btn primary" id="manpowerGenerate" type="button">Generate / Refresh</button>`)}
    <section class="panel manpower-config"><div class="manpower-config-grid"><label>Mode<select id="manpowerMode"><option value="forward" ${state.manpowerMode==="forward"?"selected":""}>Forward Look</option><option value="forensic" ${state.manpowerMode==="forensic"?"selected":""}>Forensic · Planned vs Actual</option></select></label>${state.manpowerMode==="forensic"?`<label>Planned programme${scheduleSelector("manpowerPlanned", state.manpowerPlannedId)}</label><label>Actual / status programme${scheduleSelector("manpowerActual", state.manpowerActualId)}</label>`:`<label>Programme${scheduleSelector("manpowerSchedule", state.manpowerScheduleId)}</label>`}<label>Hours per person / week<input id="manpowerHours" type="number" min="1" step="1" value="${Number(state.manpowerHoursPerPerson || 45)}"></label></div><div class="manpower-ai-row"><label class="measurement-toggle"><input type="checkbox" id="manpowerUseAI" ${state.manpowerUseAI?"checked":""}><span><strong>Use selected AI to refine floor / area / discipline classification</strong><small>${ai.engine==="none"?"No AI is selected; deterministic WBS/activity classification will be used.":`Selected: ${esc(aiLabel())}`}</small></span></label></div><div class="manpower-layout-head"><div><h2>Project / floor layouts</h2><p class="muted">Add one layout per floor where required. Supported presentation references: PDF, PNG, JPG/JPEG, WEBP and SVG.</p></div><button class="btn" id="manpowerAddLayout" type="button">Add floor/layout</button></div>${layoutFiles.length?`<div class="manpower-layout-list">${layouts}</div>`:`<div class="empty-state">No supported layout files are in the Project Repository. Add a PDF or image layout first.</div>`}<p class="muted">Area overlays are schedule-driven schematic groupings. The selected drawing is shown as the visual reference; the toolkit does not pretend inferred zones are survey-accurate geometry.</p></section>${dashboard}`;
  bindManpowerControls();
  hydrateManpowerLayoutPreviews();
  queueMicrotask(() => bindInteractiveCharts(document));
}

// -----------------------------------------------------------------------------
// Schedule Assessment reports and P6-style Gantt interactions
// -----------------------------------------------------------------------------
function assessmentNav() {
  const items = [["overview", "Overview"], ["activities", "Activity Register"], ["inspector", "Activity Inspector"], ["issues", "Issue Register"], ["comparison", "Schedule Comparison"], ["week", "Week-on-Week"], ["progress-integrity", "Progress Integrity"], ["critical", "Critical Path"], ["floatpaths", "Float Paths"], ["logic", "Logic & Health"], ["logicdiff", "Logic Changes"], ["dcma", "DCMA 14-Point"], ["whymove", "Why Date Moved"], ["delay", "Delay Analysis"], ["forensic", "Forensic Review"], ["windows", "Windows Analysis"], ["calendar", "Calendar Analyser"], ["calendardiff", "Calendar Differences"], ["scurve", "S-Curve & Histogram"], ["forecast", "Forecast Confidence"], ["narrative", "Schedule Narrative"], ["gantt", "WBS / Gantt"], ["network", "Nodes"], ["timemachine", "Time Machine"], ["milestones", "Milestone Control"], ["resources", "Resources & EVM"], ["resourceforensics", "Resource Forensics"], ["cost", "Cost Report"], ["baseline", "Baseline Manager"], ["datacentre", "Data-Centre Mode"]];
  return`<div class="report-nav">${items.map(([id, l]) => `<button data-report="${id}" class="${state.assessmentReport===id? "active": ""}">${l}</button>`).join("")}</div>`;
}
function renderAssessment() {
  const fs = filteredSchedule(),
  independent = new Set(["comparison", "week", "delay", "forensic", "windows", "logicdiff", "calendardiff", "resourceforensics", "baseline", "timemachine"]).has(state.assessmentReport);
  const filterMarkup = independent? "": fs? filterBar(): `<div class="filterbar muted">No active schedule is selected. Comparison-oriented reports still work once schedules are selected in their own dropdowns.</div>`;
  $("workspace").innerHTML = `${viewHead("Schedule Assessment", "Primavera P6 / Microsoft Project schedule intelligence, QA, comparison and forensic analysis", `<button class="btn" id="exportReportCsv">Export table CSV</button><button class="btn" id="printReport">Print / PDF</button>`)}${filterMarkup}${assessmentNav()}<div id="reportBody">${assessmentReport(fs)}</div>`;
  if (fs && !independent)bindFilters();
  document.querySelectorAll("[data-report]").forEach(b => b.onclick = () => {
    state.assessmentReport = b.dataset.report; renderAssessment()
  });
  $("printReport").onclick = () => window.print();
  $("exportReportCsv").onclick = () => exportVisibleTables();
  bindAssessmentControls(fs);
}
function pairToolbar(prefix, a, b, {
  labelA = "Schedule A / reference", labelB = "Schedule B / comparison"
}
= {
}) {
  return`<div class="filterbar comparison-selectors"><label>${esc(labelA)} ${scheduleSelector(prefix + "A", a, {
    blank: "Select schedule A…"
  })}</label><label>${esc(labelB)} ${scheduleSelector(prefix + "B", b, {
    blank: "Select schedule B…"
  })}</label></div>`;
}
function scheduleSelectionMessage(text = "Select the schedules to analyse. No relationship between uploaded files is assumed.") {
  return`<div class="empty-state">${esc(text)}</div>`
}
function deletedText(value) {
  return`<span class="deleted-change">${esc(value)}</span>`
}
function activityLink(value, label = null) {
  const raw = String(value || ""), id = raw.includes(" · ") ? raw.split(" · ")[0] : raw;
  return `<button class="activity-link" type="button" data-inspect-activity="${esc(id)}">${esc(label || raw)}</button>`;
}
function changeValue(value, kind = "") {
  const cls = kind === "bad" ? "negative-change" : kind === "good" ? "positive-change" : "";
  return `<span class="${cls}">${esc(value ?? "—")}</span>`;
}
function signedNumber(value, suffix = "", adverseWhenPositive = false) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value), text = `${n > 0 ? "+" : ""}${n}${suffix}`;
  return changeValue(text, adverseWhenPositive ? (n > 0 ? "bad" : n < 0 ? "good" : "") : (n < 0 ? "bad" : n > 0 ? "good" : ""));
}
function calendarLabel(c) {
  return[c?.name || c?.id, c?.hoursPerDay? `${Number(c.hoursPerDay).toFixed(1)}h/day`: "", c?.hoursPerWeek? `${Number(c.hoursPerWeek).toFixed(1)}h/week`: ""].filter(Boolean).join(" · ")
}
function resourceLabel(r) {
  return[r?.name || r?.id, r?.type || r?.raw?.rsrc_type].filter(Boolean).join(" · ")
}
function topBand(path) {
  return String(path || "Unassigned WBS").split(" / ")[0] || "Unassigned WBS"
}
function healthDefinition(name) {
  const defs = {
    "Missing logic": "Share of activities with no predecessor and/or no successor. Excessive open ends weaken CPM integrity and can hide the real driving path.",
    "Logic density": "Average relationships per activity. Very low density can indicate under-developed logic; unusually high density can make the network difficult to maintain.",
    "Hard/soft constraints": "Share of activities carrying date constraints. Constraints can override network logic and should be justified and controlled.",
    "Long durations": "Share of activities with original durations greater than 44 days. Long activities reduce control granularity and can conceal slippage.",
    "High float": "Share of activities with more than 44 days total float. High float can indicate weak logic, broad calendars or disconnected work.",
    "Negative float": "Share of activities with total float below zero, indicating dates later than a required/contractual constraint or other schedule pressure.",
    "Leads": "Relationships with negative lag. Leads can obscure logic intent and are discouraged in robust CPM schedules.",
    "Lags": "Relationships with positive lag. Excessive lag can hide work that is better modelled as an activity.",
    "Cycles": "Circular logic loops. CPM networks should be acyclic; a cycle prevents a clean forward/backward pass."
  };
  return defs[name] || "Schedule health diagnostic.";
}
function resourceChangeSummary(previous, current) {
  const sig = s => {
    const m = new Map();
    for (const x of s?.assignments || []) {
      const k = `${x.activityId}|${x.resourceId}`,
      v = {
        budget: Number(x.target_qty || x.budgetUnits || 0),
        actual: Number(x.act_reg_qty || x.actualUnits || 0),
        remaining: Number(x.remain_qty || x.remainingUnits || 0),
        cost: Number(x.target_cost || x.budgetCost || 0)
      };
      const old = m.get(k) || {
        budget: 0,
        actual: 0,
        remaining: 0,
        cost: 0
      };
      m.set(k, {
        budget: old.budget + v.budget, actual: old.actual + v.actual, remaining: old.remaining + v.remaining, cost: old.cost + v.cost
      })
    }
    return m
  },
  p = sig(previous),
  c = sig(current);
  let added = 0,
  removed = 0,
  changed = 0;
  const details = [];
  for (const[k, v]of c) {
    if (!p.has(k)) {
      added++;
      details.push( {
        type: "Added", key: k
      })
    } else {
      const o = p.get(k);
      if (["budget", "actual", "remaining", "cost"].some(f => Math.abs((v[f] || 0) - (o[f] || 0))>1e-9)) {
        changed++;
        details.push( {
          type: "Changed", key: k
        })
      }
    }
  }
  for (const[k]of p)if (!c.has(k)) {
    removed++;
    details.push( {
      type: "Removed", key: k
    })
  }
  return {
    added,
    removed,
    changed,
    details
  };
}
function forensicEvidencePanels(ordered) {
  const e = buildForensicEvidence(ordered),
  fmt = v => Number(v || 0).toFixed(1),
  signed = v => `${Number(v || 0)>=0? "+": ""}${Number(v || 0).toFixed(1)}`;
  const box = (title, summary, body, cls = "") => `<details class="forensic-evidence-box ${cls}"><summary><span><strong>${esc(title)}</strong><small>${esc(summary)}</small></span><span class="forensic-expand-hint">Open detail</span></summary><div class="forensic-evidence-body">${body}</div></details>`;
  const subset = (rows, transition) => (rows || []).filter(x => x.transition === transition);
  const nested = (title, count, body, open = false) => `<details class="forensic-sub-box" ${open ? "open" : ""}><summary><strong>${esc(title)}</strong><span>${count}</span></summary><div class="forensic-sub-body">${body}</div></details>`;
  const transitionWrap = (transition, summary, body) => `<details class="forensic-transition-box"><summary><span><strong>${esc(transition)}</strong><small>${esc(summary)}</small></span><span>Inspect</span></summary><div class="forensic-transition-body">${body}</div></details>`;

  const activityTransitions = e.transitions.map(t => {
    const rows = subset(e.activities.rows, t.label), added = rows.filter(x => x.type === "Added"), removed = rows.filter(x => x.type === "Removed");
    return transitionWrap(t.label, `${added.length} added · ${removed.length} removed`,
      nested("Activities added", added.length, table(["Activity","WBS","Status"], added.map(x => [`${esc(x.id)} · ${esc(x.name)}`, esc(x.wbs||"—"), esc(x.status||"—")]), {resizable:true,resizeKey:"forensic-act-add"})) +
      nested("Activities removed", removed.length, table(["Activity","WBS","Status"], removed.map(x => [deletedText(`${x.id} · ${x.name}`), deletedText(x.wbs||"—"), deletedText(x.status||"—")]), {resizable:true,resizeKey:"forensic-act-rem"})));
  }).join("");
  const activityBody = `<h3>Revision profile</h3>${interactiveBarChart(e.activities.chartRows, { labelKey:"label", series:[{key:"added",label:"Added"},{key:"removed",label:"Removed"}], xLabels:e.activities.chartRows.map(x=>x.label), rotateLabels:true })}<h3>Revision drill-down</h3>${activityTransitions || `<div class="empty-state">No activity additions/removals.</div>`}`;

  const progressTransitions = e.transitions.map(t => {
    const rows = subset(e.progress.rows, t.label), progress = rows.filter(x => /Progress/i.test(x.type)), actualAdded = rows.filter(x => x.type === "Actual date added"), actualRemoved = rows.filter(x => x.type === "Actual date removed"), actualChanged = rows.filter(x => x.type === "Actual date changed");
    const ptable = xs => table(["Activity","Field","Previous","Current","Δ / action"], xs.map(x => [esc(x.activity),esc(x.field),esc(x.before),esc(x.after), x.type.includes("reduced")||x.type.includes("removed") ? changeValue(x.delta,"bad") : esc(x.delta)]), {resizable:true,resizeKey:"forensic-progress"});
    return transitionWrap(t.label, `${progress.length} progress · ${actualAdded.length} actuals added · ${actualRemoved.length} removed · ${actualChanged.length} changed`,
      nested("Progress changes", progress.length, ptable(progress)) + nested("Actual dates added", actualAdded.length, ptable(actualAdded)) + nested("Actual dates removed", actualRemoved.length, ptable(actualRemoved)) + nested("Actual dates changed", actualChanged.length, ptable(actualChanged)));
  }).join("");
  const progressBody = `<h3>Progress and actual-date profile</h3>${interactiveBarChart(e.progress.chartRows,{labelKey:"label",series:[{key:"progressChanged",label:"Progress changes"},{key:"actualAdded",label:"Actual dates added"},{key:"actualRemoved",label:"Actual dates removed"}],xLabels:e.progress.chartRows.map(x=>x.label),rotateLabels:true})}<h3>Revision drill-down</h3>${progressTransitions || `<div class="empty-state">No progress/actual-date changes.</div>`}`;

  const resourceTransitions = e.transitions.map(t => {
    const master = subset(e.resourcing.masterRows,t.label), rows = subset(e.resourcing.rows,t.label), added = rows.filter(x=>x.type === "Assignment added"), removed = rows.filter(x=>x.type === "Assignment removed"), changed = rows.filter(x=>x.type.includes("changed"));
    const rtable = xs => table(["Activity · Name","Resource · Name","Budget Δ","Actual Δ","Remaining Δ","At Completion Δ"], xs.map(x => [esc(x.activity),esc(x.resource),changeValue(signed(x.budgetDelta ?? (Number(x.budgetAfter||0)-Number(x.budgetBefore||0))),Number(x.budgetDelta ?? (Number(x.budgetAfter||0)-Number(x.budgetBefore||0)))<0?"bad":"good"),changeValue(signed(x.actualDelta),Number(x.actualDelta)<0?"bad":"good"),changeValue(signed(x.remainingDelta ?? (Number(x.remainingAfter||0)-Number(x.remainingBefore||0))),Number(x.remainingDelta ?? (Number(x.remainingAfter||0)-Number(x.remainingBefore||0)))>0?"bad":"good"),changeValue(signed(x.atCompletionDelta),Number(x.atCompletionDelta)<0?"good":"bad")]), {resizable:true,resizeKey:"forensic-resource"});
    return transitionWrap(t.label, `${master.length} master · ${added.length} assignments added · ${removed.length} removed · ${changed.length} loading changes`,
      nested("Resource master changes", master.length, table(["Change","Resource","Previous","Current"],master.map(x=>[esc(x.type),esc(x.resource),esc(x.before),esc(x.after)]))) + nested("Assignments added",added.length,rtable(added)) + nested("Assignments removed",removed.length,rtable(removed)) + nested("Actual / At Completion / budget changes",changed.length,rtable(changed)));
  }).join("");
  const resourceBody = `<h3>Total resource loading across revisions</h3><p class="muted">At Completion = Actual + Remaining units.</p>${interactiveBarChart(e.resourcing.totals,{labelKey:"label",series:[{key:"budget",label:"Budget / target"},{key:"actual",label:"Actual"},{key:"remaining",label:"Remaining"},{key:"atCompletion",label:"At Completion"}],xLabels:e.resourcing.totals.map(x=>x.label),rotateLabels:true})}<h3>Assignment change profile</h3>${interactiveBarChart(e.resourcing.chartRows,{labelKey:"label",series:[{key:"added",label:"Assignments added"},{key:"removed",label:"Assignments removed"},{key:"changed",label:"Loading / actual changes"}],xLabels:e.resourcing.chartRows.map(x=>x.label),rotateLabels:true})}<h3>Revision drill-down</h3>${resourceTransitions || `<div class="empty-state">No resourcing changes.</div>`}`;

  const calendarTransitions = e.transitions.map(t => {
    const defs=subset(e.calendars.definitionRows,t.label), assigns=subset(e.calendars.assignmentRows,t.label), added=defs.filter(x=>x.type.includes("added")), removed=defs.filter(x=>x.type.includes("removed")), changed=defs.filter(x=>x.type.includes("changed"));
    const ctable = xs => table(["Change","Calendar","Previous","Current"],xs.map(x=>[esc(x.type),esc(x.calendar),esc(x.before),esc(x.after)]),{resizable:true,resizeKey:"forensic-calendar"});
    return transitionWrap(t.label, `${added.length} added · ${removed.length} removed · ${changed.length} definitions · ${assigns.length} assignments`, nested("Calendars added",added.length,ctable(added))+nested("Calendars removed",removed.length,ctable(removed))+nested("Calendar definition changes",changed.length,ctable(changed))+nested("Activity calendar assignments",assigns.length,table(["Activity","Previous calendar","Current calendar"],assigns.map(x=>[esc(x.activity),esc(x.before||"—"),esc(x.after||"—")]),{resizable:true,resizeKey:"forensic-cal-assign"})));
  }).join("");
  const calendarBody = `<h3>Calendar change profile</h3>${interactiveBarChart(e.calendars.chartRows,{labelKey:"label",series:[{key:"added",label:"Calendars added"},{key:"removed",label:"Calendars removed"},{key:"changed",label:"Definitions changed"},{key:"assignments",label:"Assignments changed"}],xLabels:e.calendars.chartRows.map(x=>x.label),rotateLabels:true})}<h3>Revision drill-down</h3>${calendarTransitions || `<div class="empty-state">No calendar changes.</div>`}`;

  const relationshipTransitions = e.transitions.map(t => {
    const rows=subset(e.relationships.rows,t.label), added=rows.filter(x=>x.type==="Added"), removed=rows.filter(x=>x.type==="Removed"), changed=rows.filter(x=>x.type==="Changed");
    const ltable = xs => table(["Predecessor","Successor","Previous relationship","Current relationship"],xs.map(x=>[esc(x.predecessor),esc(x.successor),esc(x.before),esc(x.after)]),{resizable:true,resizeKey:"forensic-rel"});
    return transitionWrap(t.label, `${added.length} added · ${removed.length} removed · ${changed.length} changed`, nested("Relationships added",added.length,ltable(added))+nested("Relationships removed",removed.length,ltable(removed))+nested("Type / lag changes",changed.length,ltable(changed)));
  }).join("");
  const relationshipBody = `<h3>Relationship change profile</h3>${interactiveBarChart(e.relationships.chartRows,{labelKey:"label",series:[{key:"added",label:"Added"},{key:"removed",label:"Removed"},{key:"changed",label:"Type / lag changed"}],xLabels:e.relationships.chartRows.map(x=>x.label),rotateLabels:true})}<h3>Revision drill-down</h3>${relationshipTransitions || `<div class="empty-state">No relationship changes.</div>`}`;

  return`<section class="forensic-evidence-stack"><div class="forensic-evidence-title"><div><h2>Forensic evidence explorer</h2><p class="muted">Top-level categories are collapsed by default. Expand a category, then expand the required revision transition and evidence type to audit the change record.</p></div></div>${box("Activities",`${e.activities.added} added · ${e.activities.removed} removed`,activityBody,"forensic-activities")}${box("Progress",`${e.progress.changed} progress changes · ${e.progress.actualAdded} actual dates added · ${e.progress.actualRemoved} removed`,progressBody,"forensic-progress")}${box("Resourcing",`${e.resourcing.added} resources added · ${e.resourcing.removed} removed · ${e.resourcing.changed} master changes · ${e.resourcing.rows.length} loading records`,resourceBody,"forensic-resourcing")}${box("Calendars",`${e.calendars.added} added · ${e.calendars.removed} removed · ${e.calendars.changed} definition changes · ${e.calendars.assignments} assignment changes`,calendarBody,"forensic-calendars")}${box("Relationships",`${e.relationships.added} added · ${e.relationships.removed} removed · ${e.relationships.changed} changed`,relationshipBody,"forensic-relationships")}</section>`;
}
function dcmaVisualCard(c, index) {
  const isCount = c.name==="Cycles",
  actual = isCount? Number(c.count || 0): Number(c.rateNum || 0),
  threshold = isCount? 0: Number(c.limitNum || 0);
  const scaleMax = isCount? Math.max(5, actual * 1.25, 1): Math.min(100, Math.max(10, actual * 1.2, threshold * 2.2, threshold + 5));
  const actualPct = Math.max(0, Math.min(100, actual / Math.max(scaleMax, .0001) * 100)),
  thresholdPct = Math.max(0, Math.min(100, threshold / Math.max(scaleMax, .0001) * 100));
  const unit = isCount? "": "%",
  direction = isCount? "Target 0 cycles": `Threshold ≤ ${Number(threshold).toFixed(threshold<1? 2: 1)}%`;
  return`<div class="quality-card threshold-card" title="${esc(c.definition)}"><div><strong>${esc(c.name)}</strong>${c.pass? badge("PASS", "good"): badge("FAIL", "danger")}</div><div class="threshold-chart" aria-label="${esc(c.name)} actual versus threshold"><div class="threshold-track"><span class="threshold-safe" style="width:${thresholdPct}%"></span><span class="threshold-actual ${c.pass? "pass": "fail"}" style="left:${actualPct}%"></span><i class="threshold-marker" style="left:${thresholdPct}%" title="Threshold ${threshold}${unit}"></i></div><div class="threshold-labels"><span>0${unit}</span><strong>Actual ${actual.toFixed(isCount? 0: 1)}${unit}</strong><span>${scaleMax.toFixed(isCount? 0: 1)}${unit}</span></div></div><small>${esc(direction)} · ${esc(c.definition)}</small></div>`;
}
function wbsDelayRows(comp, current) {
  const map = new Map();
  for (const x of comp.changed.filter(x => x.finishDays>0)) {
    const a = current.activities.find(a => a.id===x.id),
    k = topBand(a?.wbsPath);
    if (!map.has(k))map.set(k, {
      label: k, count: 0, totalSlip: 0, maxSlip: 0
    });
    const r = map.get(k);
    r.count++;
    r.totalSlip+=x.finishDays;
    r.maxSlip = Math.max(r.maxSlip, x.finishDays)
  }
  return[...map.values()].sort((a, b) => b.totalSlip - a.totalSlip);
}
function lookaheadDetailMarkup(schedule) {
  const look = fourWeekLookahead(schedule),
  dd = parseDate(schedule.dataDate) || new Date(),
  end = addDays(dd, 28),
  acts = (schedule.activities || []).filter(a => {
    const st = parseDate(a.currentStart || a.start), fn = parseDate(a.currentFinish || a.finish); return Number(a.percent || 0)<100 && ((st && st>=dd && st<=end) || (fn && fn>=dd && fn<=end))
  });
  const groups = new Map();
  for (const a of acts) {
    const k = a.wbsPath || "Unassigned WBS";
    if (!groups.has(k))groups.set(k, []);
    groups.get(k).push(a)
  }
  const details = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([wbs, list]) => `<details class="lookahead-wbs" open><summary>${esc(wbs)} <small>${list.length} activities</small></summary>${table(["Activity", "Status", "Start", "Finish", "TF", "Progress", "Critical"], list.sort((a, b) => (parseDate(a.currentStart || a.start)?.getTime() || 0) - (parseDate(b.currentStart || b.start)?.getTime() || 0)).map(a => [`${esc(a.id)} · ${esc(a.name)}`, esc(a.status), isoDate(a.currentStart || a.start), isoDate(a.currentFinish || a.finish), Number(a.totalFloat || 0).toFixed(1), `${Number(a.percent || 0).toFixed(1)}%`, a.critical || a.totalFloat<=0? badge("Yes", "danger"): "No"]))}</details>`).join("");
  return`<div class="metrics">${look.map(w => metric(`Week ${w.week}`, `${w.starts.length} starts`, `${w.finishes.length} finishes · ${w.criticalStarts.length} critical starts`)).join("")}</div>${details || `<div class="empty-state">No incomplete activities fall within the next four weeks.</div>`}`;
}
function narrativeActivityDetailMarkup(schedule) {
  const acts = [...(schedule?.activities || [])].sort((a, b) => String(a.wbsPath || "").localeCompare(String(b.wbsPath || "")) || String(a.id).localeCompare(String(b.id)));
  const cell = (value, critical) => critical? `<span class="critical-text">${value}</span>`: value;
  const rows = acts.map(a => {
    const critical = Boolean(a.critical || Number(a.totalFloat)<=0), vals = [`${esc(a.id)} · ${esc(a.name)}`, esc(a.wbsPath || "—"), esc(a.status || "—"), isoDate(a.currentStart || a.start) || "—", isoDate(a.currentFinish || a.finish) || "—", Number(a.originalDuration || 0).toFixed(1), Number(a.remainingDuration || 0).toFixed(1), Number(a.totalFloat || 0).toFixed(1), `${Number(a.percent || 0).toFixed(1)}%`, Number(a.budgetUnits || 0).toFixed(1), Number(a.remainingUnits || 0).toFixed(1)]; return vals.map(v => cell(v, critical))
  });
  return`<details class="narrative-activity-detail"><summary>Activity detail · ${acts.length} activities <span class="muted">(critical / zero-float activities are red)</span></summary>${table(["Activity", "WBS", "Status", "Start", "Finish", "OD", "RD", "TF", "Progress", "Budget units", "Remaining units"], rows)}</details>`;
}
function persistIssueRows() {
  localStorage.setItem("pcai.issueRows", JSON.stringify(state.issueRows || []));
}
function addDcmaFailuresToIssues(schedule) {
  const a = dcma14(schedule, { profile: currentQaProfile() }), created = [];
  for (const check of a.checks.filter(x => x.status === "FAIL")) {
    const details = check.details?.length ? check.details : [{ issue: check.criterion || check.name }];
    for (const d of details.slice(0, 500)) {
      const activity = d.activity || d.relationship || "";
      const row = {
        id: uid("issue"), severity: check.number === 7 || check.number === 12 ? "High" : "Medium",
        category: `DCMA ${check.number} · ${check.name}`, activity, issue: d.issue || d.type || d.constraint || check.criterion || check.name,
        owner: "", status: "Open", comment: "", source: schedule.sourceName || schedule.name || "Schedule", createdAt: new Date().toISOString()
      };
      state.issueRows.push(row); created.push(row);
    }
  }
  persistIssueRows();
  return created.length;
}
function activityInspectorMarkup(schedule) {
  const id = state.inspectorActivityId && schedule.activities.some(a => String(a.id) === String(state.inspectorActivityId)) ? state.inspectorActivityId : schedule.activities[0]?.id || "";
  state.inspectorActivityId = id;
  const a = schedule.activities.find(x => String(x.id) === String(id));
  if (!a) return `<div class="empty-state">No activity is available.</div>`;
  const preds = (schedule.relationships || []).filter(r => String(r.succId) === String(a.id));
  const succs = (schedule.relationships || []).filter(r => String(r.predId) === String(a.id));
  const resMap = new Map((schedule.resources || []).map(r => [String(r.id), r]));
  const assigns = (a.assignments || schedule.assignments?.filter(x => String(x.activityId) === String(a.id) || String(x.activityId) === String(a.uid)) || []);
  const history = state.schedules.filter(x => x.activities?.some(y => String(y.id) === String(a.id))).sort((x,y)=>(parseDate(x.dataDate)?.getTime()||0)-(parseDate(y.dataDate)?.getTime()||0)).map(x => {
    const q=x.activities.find(y=>String(y.id)===String(a.id)); return [scheduleLabel(x), isoDate(q.currentStart||q.start)||"—", isoDate(q.currentFinish||q.finish)||"—", `${Number(q.percent||0).toFixed(1)}%`, Number(q.totalFloat||0).toFixed(1), q.calendarName||q.calendarId||"—", q.status||"—"];
  });
  const relationRows = [...preds.map(r => ["Predecessor", r.predId, r.type || "FS", `${Number(r.lag || 0).toFixed(1)}d`]), ...succs.map(r => ["Successor", r.succId, r.type || "FS", `${Number(r.lag || 0).toFixed(1)}d`])];
  const resourceRows = assigns.map(x => { const r=resMap.get(String(x.resourceId)); return [r?.name||x.resourceId||"—", Number(x.target_qty||x.budgetUnits||0).toFixed(1), Number(x.act_reg_qty||x.actualUnits||0).toFixed(1), Number(x.remain_qty||x.remainingUnits||0).toFixed(1), Number(x.target_cost||x.budgetCost||0).toFixed(2)]; });
  return `<section class="panel"><div class="panel-head-row"><div><h2>Activity Inspector</h2><p class="muted">P6-style drill-down for the selected activity, including revision history.</p></div><label>Activity <select id="inspectorActivity">${schedule.activities.map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(id)?"selected":""}>${esc(x.id)} · ${esc(x.name)}</option>`).join("")}</select></label></div></section>
  <div class="grid grid2"><section class="panel"><h2>General / Status</h2>${table(["Field","Value"], [["Activity",`${esc(a.id)} · ${esc(a.name)}`],["WBS",esc(fullWbsPath(schedule,a)||"—")],["Status",esc(a.status||"—")],["Type",esc(a.activityType||"—")],["Progress",`${Number(a.percent||0).toFixed(1)}%`],["Critical",a.critical||a.totalFloat<=0?badge("Yes","danger"):"No"],["Calendar",esc(a.calendarName||a.calendarId||"—")],["Constraint",esc(a.constraintType||"—")]])}</section>
  <section class="panel"><h2>Dates / Float</h2>${table(["Field","Value"], [["Current Start",isoDate(a.currentStart||a.start)||"—"],["Current Finish",isoDate(a.currentFinish||a.finish)||"—"],["Baseline Start",isoDate(a.baselineStart)||"—"],["Baseline Finish",isoDate(a.baselineFinish)||"—"],["Actual Start",isoDate(a.actualStart)||"—"],["Actual Finish",isoDate(a.actualFinish)||"—"],["Original Duration",`${Number(a.originalDuration||0).toFixed(1)}d`],["Remaining Duration",`${Number(a.remainingDuration||0).toFixed(1)}d`],["Total Float",`${Number(a.totalFloat||0).toFixed(1)}d`],["Free Float",`${Number(a.freeFloat||0).toFixed(1)}d`]])}</section></div>
  <div class="grid grid2"><section class="panel"><h2>Relationships</h2>${table(["Direction","Activity ID","Type","Lag"],relationRows)}</section><section class="panel"><h2>Resources</h2>${table(["Resource","Budget","Actual","Remaining","Budget Cost"],resourceRows)}</section></div>
  <section class="panel"><h2>Codes / UDF</h2>${table(["Field","Value"], [...Object.entries(a.codes||{}),...Object.entries(a.udf||{})].map(([k,v])=>[esc(k),esc(v)]) )}</section>
  <section class="panel"><h2>Revision History</h2>${table(["Revision","Start","Finish","Progress","TF","Calendar","Status"],history,{resizable:true,resizeKey:"inspectorHistory"})}</section>`;
}
function issueRegisterMarkup() {
  const filter = state.issueFilter || "all";
  const rows = (state.issueRows || []).map((r,i)=>({r,i})).filter(({r})=>filter==="all"||String(r.status||"").toLowerCase()===filter);
  return `<section class="panel"><div class="panel-head-row"><div><h2>Schedule Issue Register</h2><p class="muted">Track QA, DCMA and forensic findings through ownership and disposition.</p></div><div class="actions"><button class="btn" id="issueAdd">Add issue</button><button class="btn" id="issueFromDcma">Add current DCMA failures</button><button class="btn" id="issueExport">Export CSV</button><label>Status <select id="issueFilter"><option value="all" ${filter==="all"?"selected":""}>All</option><option value="open" ${filter==="open"?"selected":""}>Open</option><option value="in progress" ${filter==="in progress"?"selected":""}>In Progress</option><option value="closed" ${filter==="closed"?"selected":""}>Closed</option></select></label></div></div>
  ${table(["Severity","Category","Activity / Relationship","Issue","Owner","Status","Comment","Source",""], rows.map(({r,i})=>[
    `<select data-issue="${i}:severity">${["Low","Medium","High","Critical"].map(x=>`<option ${r.severity===x?"selected":""}>${x}</option>`).join("")}</select>`,
    `<input data-issue="${i}:category" value="${esc(r.category||"")}">`,`<input data-issue="${i}:activity" value="${esc(r.activity||"")}">`,`<input data-issue="${i}:issue" value="${esc(r.issue||"")}">`,`<input data-issue="${i}:owner" value="${esc(r.owner||"")}">`,
    `<select data-issue="${i}:status">${["Open","In Progress","Closed"].map(x=>`<option ${r.status===x?"selected":""}>${x}</option>`).join("")}</select>`,`<input data-issue="${i}:comment" value="${esc(r.comment||"")}">`,esc(r.source||""),`<button class="btn compact danger" data-del-issue="${i}">Remove</button>`
  ]),{resizable:true,resizeKey:"issueRegister"})}</section>`;
}
function assessmentNeedsSchedule() {
  return !new Set(["comparison", "week", "delay", "forensic", "windows", "logicdiff", "calendardiff", "resourceforensics", "baseline", "timemachine"]).has(state.assessmentReport)
}

function currentQaProfile() {
  return qaProfile(state.qaProfileId || DEFAULT_QA_PROFILE_ID, state.qaCustomThresholds || {});
}
function qaProfileControls() {
  const profile = currentQaProfile();
  return `<div class="filterbar qa-profile-controls"><label>QA profile <select id="qaProfileSelect">${Object.values(QA_PROFILES).map(p => `<option value="${esc(p.id)}" ${p.id===profile.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><span class="muted">${esc(profile.description)}</span><button class="btn" type="button" id="qaProfileEdit">Edit thresholds</button><button class="btn" type="button" id="qaProfileReset">Reset profile thresholds</button></div>`;
}
function namedGanttLayoutToolbar(kind) {
  const rows = state.namedGanttLayouts[kind] || [], active = state.activeNamedGanttLayout[kind] || "";
  return `<section class="panel gantt-layout-manager"><div class="panel-head-row"><div><h2>Saved Layouts</h2><p class="muted">Save the current columns, widths and bar settings as a named local layout.</p></div><div class="actions"><select id="namedGanttLayout"><option value="">Current / unsaved</option>${rows.map(x => `<option value="${esc(x.name)}" ${x.name===active?"selected":""}>${esc(x.name)}</option>`).join("")}</select><button class="btn" id="loadNamedGanttLayout" type="button">Load</button><button class="btn primary" id="saveNamedGanttLayout" type="button">Save current</button><button class="btn danger" id="deleteNamedGanttLayout" type="button" ${active?"":"disabled"}>Delete</button></div></div></section>`;
}
function progressIntegrityMarkup(schedule) {
  const result = progressIntegrity(schedule), filter = state.progressIntegrityFilter || "all";
  let rows = result.rows;
  if (filter !== "all") rows = rows.filter(r => r.severity.toLowerCase() === filter || r.category.toLowerCase() === filter);
  const chartRows = Object.entries(result.counts).filter(([k]) => ["Critical","High","Medium","Low"].includes(k)).map(([label,value]) => ({label,value}));
  return `<div class="metrics">${metric("Integrity", result.summary.pass?"PASS":"FAIL", result.summary.pass?"No deterministic status contradictions":"Review flagged records")}${metric("Critical", result.summary.critical)}${metric("High", result.summary.high)}${metric("Medium", result.summary.medium)}${metric("Total findings", result.summary.total)}</div><section class="panel"><div class="panel-head-row"><div><h2>Progress Integrity</h2><p class="muted">Deterministic checks for actual dates, data-date consistency, percent complete, remaining duration, expected finish and suspend/resume anomalies.</p></div><label>Filter <select id="progressIntegrityFilter">${[["all","All findings"],["critical","Critical"],["high","High"],["medium","Medium"],["progress","Progress"],["completion","Completion"],["actual dates","Actual Dates"],["data date","Data Date"],["forecast","Forecast"]].map(([v,l])=>`<option value="${v}" ${filter===v?"selected":""}>${l}</option>`).join("")}</select></label></div>${chartRows.length?interactiveBarChart(chartRows,{labelKey:"label",series:[{key:"value",label:"Findings"}],title:"Integrity findings by severity",threshold:0}):""}${table(["Severity","Category","Activity","WBS","Issue","Field","Value"], rows.map(r => [r.severity==="Critical"?badge(r.severity,"danger"):r.severity==="High"?badge(r.severity,"warn"):esc(r.severity),esc(r.category),activityLink(r.activityId,r.activity),esc(r.wbs||"—"),esc(r.issue),esc(r.field||"—"),esc(r.value||"—")]),{resizable:true,resizeKey:"progressIntegrity"})}</section>`;
}
function windowsAnalysisMarkup() {
  const selected = state.windowsScheduleIds.map(scheduleById).filter(Boolean);
  if (selected.length < 2) return `<section class="panel"><h2>Windows Analysis</h2><p class="muted">Select at least two contemporaneous schedule updates in chronological order. Each adjacent pair becomes a forensic analysis window.</p>${scheduleSlots("windowsSlot",state.windowsScheduleIds,8,{label:"Update"})}${scheduleSelectionMessage("Select at least two schedule updates.")}</section>`;
  const w = windowsAnalysis(selected), chartRows = w.windows.map(x => ({label:x.label,finish:x.finishMovementDays,progress:x.progressPoints,logic:x.logicAdded+x.logicRemoved,resources:x.resourceChanges}));
  return `<section class="panel"><h2>Contemporaneous Windows Analysis</h2><p class="muted">Each adjacent selected update is treated as one analysis window. This identifies schedule movement and change evidence; it does not assign contractual responsibility automatically.</p>${scheduleSlots("windowsSlot",state.windowsScheduleIds,8,{label:"Update"})}</section><section class="panel"><h2>Window movement</h2>${interactiveBarChart(chartRows,{labelKey:"label",series:[{key:"finish",label:"Finish movement (d)"},{key:"progress",label:"Progress Δ (pts)"},{key:"logic",label:"Logic changes"},{key:"resources",label:"Resource changes"}],rotateLabels:true,title:"Revision-window profile"})}</section>${w.windows.map(x=>`<details class="forensic-transition-box"><summary><span><strong>${esc(x.label)}</strong><small>${x.finishMovementDays>=0?"+":""}${x.finishMovementDays}d finish · ${x.progressPoints>=0?"+":""}${x.progressPoints.toFixed(1)} pts progress · ${x.adverse.length} adverse/activity-change records</small></span><span>Inspect</span></summary><div class="forensic-transition-body"><div class="metrics">${metric("Finish Δ",`${x.finishMovementDays>=0?"+":""}${x.finishMovementDays}d`)}${metric("Activities + / -",`${x.activitiesAdded} / ${x.activitiesRemoved}`)}${metric("Logic + / -",`${x.logicAdded} / ${x.logicRemoved}`)}${metric("Calendar changes",x.calendarChanges)}${metric("Resource changes",x.resourceChanges)}${metric("Critical entered / left",`${x.criticalEntered} / ${x.criticalLeft}`)}</div>${table(["Activity","Start Δ","Finish Δ","Duration Δ","Calendar","Resources","Constraint"],x.adverse.slice(0,1000).map(a=>[activityLink(a.id,`${a.id} · ${a.name}`),signedNumber(a.startDays,"d",true),signedNumber(a.finishDays,"d",true),signedNumber(a.durationDays,"d",true),a.calendarChanged?badge("Changed","warn"):"—",a.resourceChanged?badge("Changed","warn"):"—",a.constraintChanged?badge("Changed","warn"):"—"]),{resizable:true,resizeKey:`window-${x.index}`})}</div></details>`).join("")}`;
}
function logicChangesMarkup() {
  const a=scheduleById(state.logicAId), b=scheduleById(state.logicBId), toolbar=pairToolbar("logicDiff",state.logicAId,state.logicBId,{labelA:"Earlier / reference",labelB:"Later / comparison"});
  if(!a||!b||a.id===b.id) return `<section class="panel"><h2>Logic Change Explorer</h2><p class="muted">Select two different schedules to audit predecessor/successor additions, removals and type/lag changes.</p>${toolbar}${scheduleSelectionMessage()}</section>`;
  const d=logicChanges(a,b), rows=[...d.added.map(r=>[badge("Added","good"),activityLink(r.predId),activityLink(r.succId),"—",`${esc(r.type||"FS")} ${Number(r.lag||0)>=0?"+":""}${Number(r.lag||0).toFixed(1)}d`]),...d.removed.map(r=>[badge("Removed","danger"),activityLink(r.predId),activityLink(r.succId),`${esc(r.type||"FS")} ${Number(r.lag||0)>=0?"+":""}${Number(r.lag||0).toFixed(1)}d`,"—"]),...d.changed.map(x=>[badge("Changed","warn"),activityLink(x.after.predId),activityLink(x.after.succId),`${esc(x.before.type||"FS")} ${Number(x.before.lag||0)>=0?"+":""}${Number(x.before.lag||0).toFixed(1)}d`,`${esc(x.after.type||"FS")} ${Number(x.after.lag||0)>=0?"+":""}${Number(x.after.lag||0).toFixed(1)}d`])];
  const chart=[{label:"Added",value:d.added.length},{label:"Removed",value:d.removed.length},{label:"Changed",value:d.changed.length}];
  return `<section class="panel"><h2>Logic Change Explorer</h2>${toolbar}</section><div class="metrics">${metric("Added",d.added.length)}${metric("Removed",d.removed.length)}${metric("Type / lag changed",d.changed.length)}</div><section class="panel">${interactiveBarChart(chart,{labelKey:"label",series:[{key:"value",label:"Relationships"}],title:"Logic change profile"})}${table(["Change","Predecessor","Successor","Previous","Current"],rows,{resizable:true,resizeKey:"logicChanges"})}</section>`;
}
function calendarDifferencesMarkup() {
  const a=scheduleById(state.calendarDiffAId), b=scheduleById(state.calendarDiffBId), toolbar=pairToolbar("calendarDiff",state.calendarDiffAId,state.calendarDiffBId,{labelA:"Earlier / reference",labelB:"Later / comparison"});
  if(!a||!b||a.id===b.id) return `<section class="panel"><h2>Calendar Difference Viewer</h2><p class="muted">Compare calendar definitions and activity-calendar assignments between two schedules.</p>${toolbar}${scheduleSelectionMessage()}</section>`;
  const d=calendarDifferences(a,b);
  return `<section class="panel"><h2>Calendar Difference Viewer</h2>${toolbar}</section><div class="grid grid2"><section class="panel"><h2>Calendar definitions</h2>${table(["Change","Calendar","Previous","Current"],[...d.added.map(c=>[badge("Added","good"),esc(c.name||c.id),"—",esc(calendarLabel(c))]),...d.deleted.map(c=>[badge("Removed","danger"),esc(c.name||c.id),esc(calendarLabel(c)),"—"]),...d.changed.map(x=>[badge("Changed","warn"),esc(x.after.name||x.after.id),esc(calendarLabel(x.before)),esc(calendarLabel(x.after))])],{resizable:true,resizeKey:"calendarDefinitions"})}</section><section class="panel"><h2>Activity assignments</h2>${table(["Activity","WBS","Previous calendar","Current calendar"],d.assignments.map(x=>[activityLink(x.activityId,x.activity),esc(x.wbs||"—"),esc(x.before||"—"),esc(x.after||"—")]),{resizable:true,resizeKey:"calendarAssignments"})}</section></div>`;
}
function resourceForensicsMarkup() {
  const a=scheduleById(state.resourceForensicAId), b=scheduleById(state.resourceForensicBId), toolbar=pairToolbar("resourceForensic",state.resourceForensicAId,state.resourceForensicBId,{labelA:"Earlier / reference",labelB:"Later / comparison"});
  if(!a||!b||a.id===b.id) return `<section class="panel"><h2>Resource Forensics</h2><p class="muted">Select two schedules to compare resource masters and activity-resource loading.</p>${toolbar}${scheduleSelectionMessage()}</section>`;
  const r=resourceForensics(a,b), totals=r.totals;
  return `<section class="panel"><h2>Resource Forensics</h2>${toolbar}</section><div class="metrics">${metric("Resources added",r.summary.resourcesAdded)}${metric("Resources removed",r.summary.resourcesRemoved)}${metric("Resource master changes",r.summary.resourcesChanged)}${metric("Assignment/loading records",r.summary.assignmentsChanged)}</div><section class="panel"><h2>Total resource profile</h2>${interactiveBarChart(totals,{labelKey:"label",series:[{key:"budget",label:"Budget / target"},{key:"actual",label:"Actual"},{key:"remaining",label:"Remaining"},{key:"atCompletion",label:"At Completion"}],rotateLabels:true,title:"Loading by revision"})}</section><section class="panel"><h2>Resource master changes</h2>${table(["Transition","Change","Resource","Previous","Current"],r.masterRows.map(x=>[esc(x.transition),x.type.includes("removed")?badge(x.type,"danger"):x.type.includes("added")?badge(x.type,"good"):badge(x.type,"warn"),esc(x.resource),esc(x.before),esc(x.after)]),{resizable:true,resizeKey:"resourceMasterForensics"})}</section><section class="panel"><h2>Activity-resource loading changes</h2>${table(["Activity · Name","Resource · Name","Budget Δ","Actual Δ","Remaining Δ","At Completion Δ"],r.assignmentRows.map(x=>[activityLink(String(x.activity).split(" · ")[0],x.activity),esc(x.resource),signedNumber(x.budgetDelta ?? (Number(x.budgetAfter||0)-Number(x.budgetBefore||0)),"",false),signedNumber(x.actualDelta,"",false),signedNumber(x.remainingDelta ?? (Number(x.remainingAfter||0)-Number(x.remainingBefore||0)),"",true),signedNumber(x.atCompletionDelta,"",true)]),{resizable:true,resizeKey:"resourceLoadingForensics"})}</section>`;
}
function floatPathsMarkup(schedule) {
  const r=analyticalFloatPaths(schedule,Number(state.floatPathCount||5));
  const pathBlocks=r.paths.map(p=>`<details class="forensic-transition-box" ${p.rank===1?"open":""}><summary><span><strong>${esc(p.name)}</strong><small>${p.path.length} activities · ${p.duration.toFixed(1)}d analytical length · target ${esc(p.target?.id||"")}</small></span><span>Inspect</span></summary><div class="forensic-transition-body">${table(["Seq","Activity","WBS","Start","Finish","TF","Duration"],p.path.map((a,i)=>[i+1,activityLink(a.id,`${a.id} · ${a.name}`),esc(fullWbsPath(schedule,a)||"—"),isoDate(a.currentStart||a.start),isoDate(a.currentFinish||a.finish),Number(a.totalFloat||0).toFixed(1),Number(a.remainingDuration||a.originalDuration||0).toFixed(1)]),{resizable:true,resizeKey:`floatPath-${p.rank}`})}</div></details>`).join("");
  return `<section class="panel"><div class="panel-head-row"><div><h2>Float Path / Longest Path Explorer</h2><p class="muted">Analytical paths are derived from the normalized network. They are not claimed to be P6 native Float Path 1/2/3 unless the source explicitly provides that data.</p></div><label>Paths <select id="floatPathCount">${[3,5,10].map(n=>`<option value="${n}" ${Number(state.floatPathCount)===n?"selected":""}>${n}</option>`).join("")}</select></label></div></section><div class="metrics">${metric("Project finish",r.projectFinish?`${r.projectFinish.id} · ${r.projectFinish.name}`:"—")}${metric("Driving chain",r.driving.length)}${metric("Near-critical ≤10d",r.nearCritical.length)}${metric("Analytical paths",r.paths.length)}</div>${pathBlocks}<section class="panel"><h2>Near-critical activity register</h2>${table(["Activity","WBS","Finish","TF"],r.nearCritical.slice(0,1000).map(a=>[activityLink(a.id,`${a.id} · ${a.name}`),esc(fullWbsPath(schedule,a)||"—"),isoDate(a.currentFinish||a.finish),Number(a.totalFloat||0).toFixed(1)]),{resizable:true,resizeKey:"nearCritical"})}</section>`;
}
function baselineManagerMarkup() {
  const current=scheduleById(state.baselineCurrentId);
  const slots=state.baselineSlots || ["","",""];
  const controls=`<div class="filterbar"><label>Current / status ${scheduleSelector("baselineCurrent",state.baselineCurrentId,{blank:"Select current schedule…"})}</label>${slots.map((v,i)=>`<label>${esc(state.baselineSlotNames[i]||`BL${i+1}`)} ${scheduleSelector(`baselineSlot${i}`,v,{blank:`Select BL${i+1}…`})}</label>`).join("")}</div>`;
  if(!current) return `<section class="panel"><h2>Baseline Manager</h2><p class="muted">Assign up to three imported schedules as BL1/BL2/BL3, then compare them against the selected current/status schedule.</p>${controls}${scheduleSelectionMessage("Select the current/status schedule.")}</section>`;
  const blocks=slots.map((id,i)=>{const base=scheduleById(id);if(!base||base.id===current.id)return"";const c=compareSchedules(base,current),changes=c.changed.filter(x=>x.finishDays!==0).sort((a,b)=>Math.abs(b.finishDays)-Math.abs(a.finishDays));return `<details class="forensic-transition-box" ${i===0?"open":""}><summary><span><strong>${esc(state.baselineSlotNames[i]||`BL${i+1}`)} · ${esc(base.sourceName||base.name||base.id)}</strong><small>${c.summary.forecastFinishDays>=0?"+":""}${c.summary.forecastFinishDays}d project finish · ${changes.length} activity finish variances</small></span><span>Inspect</span></summary><div class="forensic-transition-body">${table(["Activity","Baseline finish","Current finish","Variance"],changes.slice(0,1000).map(x=>{const pa=base.activities.find(a=>a.id===x.id),ca=current.activities.find(a=>a.id===x.id);return[activityLink(x.id,`${x.id} · ${x.name}`),isoDate(pa?.currentFinish||pa?.finish),isoDate(ca?.currentFinish||ca?.finish),signedNumber(x.finishDays,"d",true)]}),{resizable:true,resizeKey:`baseline-${i}`})}</div></details>`}).join("");
  return `<section class="panel"><h2>Baseline Manager</h2><p class="muted">BL1/BL2/BL3 are explicit imported schedules. If no imported baseline is selected, embedded baseline dates remain available in the Gantt/Activity Inspector.</p>${controls}</section>${blocks||`<div class="empty-state">Select one or more baseline schedules.</div>`}<section class="panel"><h2>Next four weeks · detailed by WBS</h2>${lookaheadDetailMarkup(current)}</section>`;
}
function forensicRevisionMatrixMarkup(ordered) {
  if(ordered.length<2)return"";
  const search=String(state.forensicMatrixSearch||"").trim().toLowerCase();
  let matrix=activityRevisionMatrix(ordered);
  if(search)matrix=matrix.filter(x=>x.id.toLowerCase().includes(search)||x.revisions.some(r=>String(r.name||"").toLowerCase().includes(search)));
  matrix=matrix.slice(0,500);
  const headers=["Activity",...ordered.map(s=>isoDate(s.dataDate)||s.name||s.sourceName||"Revision")];
  const rows=matrix.map(x=>[activityLink(x.id,x.id),...x.revisions.map(r=>r.exists?`<div class="matrix-cell"><strong>${esc(r.name||"")}</strong><small>${esc(r.status||"")} · ${Number(r.percent||0).toFixed(1)}%</small><small>${esc(r.start||"—")} → ${esc(r.finish||"—")}</small><small>TF ${Number(r.totalFloat||0).toFixed(1)}d · ${esc(r.calendar||"—")}</small></div>`:`<span class="deleted-change">Not present</span>`)]);
  return `<section class="panel"><div class="panel-head-row"><div><h2>Activity Revision Matrix</h2><p class="muted">Follow activity dates, progress, float, calendar and status horizontally through the selected revisions.</p></div><label>Find activity <input id="forensicMatrixSearch" value="${esc(state.forensicMatrixSearch||"")}" placeholder="ID or name"></label></div>${table(headers,rows,{resizable:true,resizeKey:"forensicMatrix"})}${matrix.length>=500?`<p class="muted">First 500 matching activities shown. Use the search box to narrow the matrix.</p>`:""}</section>`;
}

/**
 * Render the currently selected Schedule Assessment report. Pairwise/multi-
 * revision reports resolve their own schedule selections and therefore do not
 * assume that every imported schedule belongs to the same project.
 */
function assessmentReport(s) {
  if (!s && assessmentNeedsSchedule())return`<section class="panel"><h2>${esc(state.assessmentReport==="overview"? "Schedule Assessment": "Select a schedule")}</h2><p class="muted">Choose a parsed schedule in the left pane. Schedule Comparison, Week-on-Week, Delay Analysis, Forensic Review and Baseline & Lookahead have their own independent schedule selectors and can be opened without an active schedule.</p></section>`;
  const h = s? scheduleHealth(s): null;
  switch (state.assessmentReport) {
    case "activities": return`<section class="panel"><h2>Virtualised activity register</h2><p class="muted">Drag the vertical dividers in the column headings to resize each column. Widths are remembered on this browser. Imported XER/XML/MPP data can be copied into the editable Schedule Builder.</p><div class="actions" style="margin-bottom:9px"><button class="btn" id="copyToBuilder">Edit this schedule in Schedule Builder</button></div><div id="virtualActivities" style="height:600px;overflow:auto;position:relative"></div></section>`;
    case "inspector": return activityInspectorMarkup(s);
    case "issues": return issueRegisterMarkup();
    case "comparison": {
      const a = scheduleById(state.comparisonAId),
      b = scheduleById(state.comparisonBId),
      toolbar = pairToolbar("comparison", state.comparisonAId, state.comparisonBId, {
        labelA: "Reference schedule", labelB: "Comparison schedule"
      });
      if (!a || !b)return`<section class="panel"><h2>Schedule Comparison</h2><p class="muted">Select the two schedules explicitly. They may be unrelated projects; the toolkit will not infer a revision relationship.</p>${toolbar}${scheduleSelectionMessage()}</section>`;
      if (a.id===b.id)return`<section class="panel"><h2>Schedule Comparison</h2>${toolbar}<div class="empty-state">Choose two different schedules.</div></section>`;
      const comp = compareSchedules(a, b),
      changeRows = comp.changed.slice().sort((x, y) => Math.abs(y.finishDays) - Math.abs(x.finishDays)),
      projectWarning = (a.projectName && b.projectName && a.projectName!==b.projectName)? `<div class="analysis-warning">The selected schedules report different project names: <strong>${esc(a.projectName)}</strong> and <strong>${esc(b.projectName)}</strong>. Comparison is still allowed because you selected them explicitly.</div>`: "";
      const resourceName = (schedule, id) => schedule.resources?.find(r => String(r.id)===String(id))?.name || id || "Unassigned resource";
      const assignmentLabel = (schedule, x) => `${esc(x.activityId || "—")} · ${esc(resourceName(schedule, x.resourceId))}`;
      const assignmentValue = x => `B ${Number(x.budget || 0).toFixed(1)} · A ${Number(x.actual || 0).toFixed(1)} · R ${Number(x.remaining || 0).toFixed(1)}`;
      const activityRows = [...comp.added.slice(0, 250).map(x => ["Added", `${esc(x.id)} · ${esc(x.name)}`]), ...comp.deleted.slice(0, 250).map(x => [deletedText("Deleted"), deletedText(`${x.id} · ${x.name}`)])];
      const relationshipRows = [...comp.relationshipAdded.slice(0, 250).map(r => ["Added", `${esc(r.predId)} ${esc(r.type)} ${esc(r.succId)}`, `${Number(r.lag || 0).toFixed(1)}d`]), ...comp.relationshipDeleted.slice(0, 250).map(r => [deletedText("Deleted"), deletedText(`${r.predId} ${r.type} ${r.succId}`), deletedText(`${Number(r.lag || 0).toFixed(1)}d`)])];
      const calendarRows = [...comp.calendars.added.map(c => ["Added", esc(c.name || c.id), "—", esc(calendarLabel(c))]), ...comp.calendars.changed.map(x => ["Changed", esc(x.after.name || x.after.id), esc(calendarLabel(x.before)), esc(calendarLabel(x.after))]), ...comp.calendars.deleted.map(c => [deletedText("Deleted"), deletedText(c.name || c.id), deletedText(calendarLabel(c)), deletedText("—")])];
      const resourceRows = [...comp.resources.added.map(r => ["Added", esc(r.name || r.id), "—", esc(resourceLabel(r))]), ...comp.resources.changed.map(x => ["Changed", esc(x.after.name || x.after.id), esc(resourceLabel(x.before)), esc(resourceLabel(x.after))]), ...comp.resources.deleted.map(r => [deletedText("Deleted"), deletedText(r.name || r.id), deletedText(resourceLabel(r)), deletedText("—")])];
      const assignmentRows = [...comp.resourceAssignments.added.map(x => ["Added", assignmentLabel(b, x), "—", assignmentValue(x)]), ...comp.resourceAssignments.changed.map(x => ["Changed", assignmentLabel(b, x.after), assignmentValue(x.before), assignmentValue(x.after)]), ...comp.resourceAssignments.deleted.map(x => [deletedText("Deleted"), deletedText(`${x.activityId} · ${resourceName(a, x.resourceId)}`), deletedText(assignmentValue(x)), deletedText("—")])];
      return`<section class="panel"><h2>Schedule Comparison</h2>${toolbar}${projectWarning}<p class="muted">Comparison includes activities, relationships, calendar definitions/assignments, resource master data and activity-resource loading. Deleted items are shown in red.</p></section>
      <div class="metrics">${metric("Data date interval", `${comp.summary.dataDateDays}d`)}${metric("Forecast movement", `${comp.summary.forecastFinishDays>=0? "+": ""}${comp.summary.forecastFinishDays}d`)}${metric("Progress movement", `${comp.summary.progressPoints>=0? "+": ""}${comp.summary.progressPoints.toFixed(1)} pts`)}${metric("Activities + / -", `${comp.added.length} / ${comp.deleted.length}`)}${metric("Logic + / -", `${comp.relationshipAdded.length} / ${comp.relationshipDeleted.length}`)}${metric("Calendars + / Δ / -", `${comp.calendars.added.length} / ${comp.calendars.changed.length} / ${comp.calendars.deleted.length}`)}${metric("Resources + / Δ / -", `${comp.resources.added.length} / ${comp.resources.changed.length} / ${comp.resources.deleted.length}`)}${metric("Assignments + / Δ / -", `${comp.resourceAssignments.added.length} / ${comp.resourceAssignments.changed.length} / ${comp.resourceAssignments.deleted.length}`)}${metric("Critical entered / left", `${comp.migration.entered.length} / ${comp.migration.left.length}`)}</div>
      <section class="panel"><h2>Material Change Register</h2>${table(["Activity", "Start Δ", "Finish Δ", "Duration Δ", "Float Δ", "Progress Δ", "Calendar", "Resources", "Constraint"], changeRows.slice(0, 750).map(x => [`${esc(x.id)} · ${esc(x.name)}`, `${x.startDays>=0? "+": ""}${x.startDays}d`, `${x.finishDays>=0? "+": ""}${x.finishDays}d`, `${x.durationDays>=0? "+": ""}${x.durationDays.toFixed(1)}d`, `${x.floatDays>=0? "+": ""}${x.floatDays.toFixed(1)}d`, `${x.progressPoints>=0? "+": ""}${x.progressPoints.toFixed(1)} pts`, x.calendarChanged? "Changed": "—", x.resourceChanged? "Changed": "—", x.constraintChanged? "Changed": "—"]))}</section>
      <div class="grid grid2"><section class="panel"><h2>New / deleted activities</h2>${table(["Type", "Activity"], activityRows)}</section><section class="panel"><h2>Relationship changes</h2>${table(["Type", "Relationship", "Lag"], relationshipRows)}</section></div>
      <div class="grid grid2"><section class="panel"><h2>Calendar changes</h2><p class="muted">Detects added/deleted calendars and changes to working-hour/calendar-definition fields available in the imported source.</p>${table(["Type", "Calendar", "Reference", "Comparison"], calendarRows)}</section><section class="panel"><h2>Resource master changes</h2><p class="muted">Detects additions, deletions and changes in imported resource master data.</p>${table(["Type", "Resource", "Reference", "Comparison"], resourceRows)}</section></div>
      <section class="panel"><h2>Activity-resource assignment / loading changes</h2><p class="muted">B = budget/target units, A = actual units, R = remaining units.</p>${table(["Type", "Activity · Resource", "Reference", "Comparison"], assignmentRows.slice(0, 1000))}</section>`;
    }
    case "week": {
      const a = scheduleById(state.weekAId),
      b = scheduleById(state.weekBId),
      toolbar = pairToolbar("week", state.weekAId, state.weekBId, {
        labelA: "Earlier / reference schedule", labelB: "Later / status schedule"
      });
      if (!a || !b)return`<section class="panel"><h2>Week-on-Week</h2><p class="muted">Select the two status files you intend to compare. Nothing is inferred from upload order.</p>${toolbar}${scheduleSelectionMessage()}</section>`;
      if (a.id===b.id)return`<section class="panel"><h2>Week-on-Week</h2>${toolbar}<div class="empty-state">Choose two different schedules.</div></section>`;
      const comp = compareSchedules(a, b), wow = weekOnWeekChanges(a, b), f = state.weekChangeFilter || "all", wbsFilter = String(state.weekWbsFilter || "").trim().toLowerCase();
      let rows = wow.rows.filter(r => !wbsFilter || String(r.wbs || "").toLowerCase().includes(wbsFilter));
      if (f === "progress") rows = rows.filter(r => Number(r.progressDelta || 0) !== 0);
      if (f === "dates") rows = rows.filter(r => Number(r.startDelta || 0) !== 0 || Number(r.finishDelta || 0) !== 0);
      if (f === "actuals") rows = rows.filter(r => r.actualStart?.type !== "—" || r.actualFinish?.type !== "—");
      if (f === "adverse") rows = rows.filter(r => r.adverse);
      if (f === "added") rows = rows.filter(r => r.type === "Added");
      if (f === "deleted") rows = rows.filter(r => r.type === "Deleted");
      const changeRows = rows.slice(0, 5000).map(r => {
        const progKind = Number(r.progressDelta) < 0 ? "bad" : Number(r.progressDelta) > 0 ? "good" : "";
        const actualCell = x => x?.type === "Removed" ? changeValue(`${x.type}: ${x.before}`, "bad") : x?.type === "Added" ? changeValue(`${x.type}: ${x.after}`, "good") : x?.type === "Changed" ? `${esc(x.before)} → ${esc(x.after)}` : "—";
        return [
          r.type === "Deleted" ? deletedText(r.type) : r.type === "Added" ? badge("Added", "good") : esc(r.type),
          activityLink(r.id, `${r.id} · ${r.name}`), esc(r.wbs || "—"), esc(r.status || "—"),
          r.previousPercent == null ? "—" : `${Number(r.previousPercent).toFixed(1)}%`,
          r.currentPercent == null ? "—" : `${Number(r.currentPercent).toFixed(1)}%`,
          r.progressDelta == null ? "—" : changeValue(`${Number(r.progressDelta) >= 0 ? "+" : ""}${Number(r.progressDelta).toFixed(1)} pts`, progKind),
          esc(r.previousStart || "—"), esc(r.currentStart || "—"), signedNumber(r.startDelta, "d", true),
          esc(r.previousFinish || "—"), esc(r.currentFinish || "—"), signedNumber(r.finishDelta, "d", true),
          actualCell(r.actualStart), actualCell(r.actualFinish)
        ];
      });
      const chartRows = [
        { label: "Progress +", value: wow.summary.progressed }, { label: "Progress -", value: wow.summary.progressReduced },
        { label: "Start slips", value: wow.summary.slippedStart }, { label: "Finish slips", value: wow.summary.slippedFinish },
        { label: "Actual starts +", value: wow.summary.actualStartsAdded }, { label: "Actual finishes +", value: wow.summary.actualFinishesAdded },
        { label: "Activities +", value: wow.summary.added }, { label: "Activities -", value: wow.summary.deleted }
      ];
      return`<section class="panel"><h2>Week-on-Week</h2>${toolbar}<p class="muted">Complete status-change register. Red highlights indicate regressions, deleted actuals, or later forecast dates.</p></section>
      <div class="metrics">${metric("New actual starts", wow.summary.actualStartsAdded)}${metric("New actual finishes", wow.summary.actualFinishesAdded)}${metric("Activities progressed", wow.summary.progressed)}${metric("Progress reduced", wow.summary.progressReduced)}${metric("Finish slips", wow.summary.slippedFinish)}${metric("Adverse changes", wow.summary.adverse)}${metric("Progress Δ", `${comp.summary.progressPoints>=0? "+": ""}${comp.summary.progressPoints.toFixed(1)} pts`)}${metric("Forecast Δ", `${comp.summary.forecastFinishDays>=0? "+": ""}${comp.summary.forecastFinishDays}d`)}</div>
      <section class="panel"><h2>Status movement profile</h2>${interactiveBarChart(chartRows, { labelKey: "label", series: [{ key: "value", label: "Activities" }], xLabels: chartRows.map(x => x.label), rotateLabels: true })}</section>
      <section class="panel"><div class="panel-head-row"><div><h2>Week-on-Week Activity Change Register</h2><p class="muted">Showing ${rows.length} changed activities. Use the filters to isolate progress, forecast dates or actual-date changes.</p></div><div class="filterbar"><label>Change <select id="weekChangeFilter">${[["all","All changes"],["progress","Progress"],["dates","Forecast dates"],["actuals","Actual dates"],["adverse","Adverse only"],["added","Added activities"],["deleted","Deleted activities"]].map(([v,l]) => `<option value="${v}" ${f===v? "selected": ""}>${l}</option>`).join("")}</select></label><label>WBS <input id="weekWbsFilter" value="${esc(state.weekWbsFilter || "")}" placeholder="Filter WBS"></label></div></div>
      ${table(["Type", "Activity", "WBS", "Status", "Prev %", "Current %", "Progress Δ", "Prev Start", "Current Start", "Start Δ", "Prev Finish", "Current Finish", "Finish Δ", "Actual Start", "Actual Finish"], changeRows, { resizable: true, resizeKey: "weekOnWeek" })}</section>`;
    }
    case "progress-integrity": return progressIntegrityMarkup(s);
    case "critical": {
      const crit = s.activities.filter(a => a.critical || a.totalFloat<=0),
      layout = state.ganttLayouts.critical || freshGanttLayout("critical");
      return`${namedGanttLayoutToolbar("critical")}${gantt(s, {
        activities: crit, criticalOnly: true, forceRed: true, timescale: state.ganttTimescale, compression: state.ganttCompression, showRelationships: state.ganttRelationships, leftWidth: state.criticalLeftWidth, resizeKey: "criticalLeftWidth", startDate: state.criticalStartDate, endDate: state.criticalFinishDate, fields: layout.fields, fieldWidths: layout.widths, barSettings: layout.bars, layoutKey: "critical", collapsedWbsIds: state.ganttCollapsed.critical
      })}<section class="panel"><h2>Critical / zero-float activities</h2><p class="muted">Drag the vertical dividers in the headings to resize the table columns. The Gantt's WBS/Activity divider can also be dragged wider or narrower.</p>${table(["Activity", "WBS", "Finish", "TF"], crit.map(a => [`${esc(a.id)} · ${esc(a.name)}`, esc(fullWbsPath(s, a)), isoDate(a.currentFinish || a.finish), a.totalFloat.toFixed(1)]), {
        resizable: true, resizeKey: "criticalPath"
      })}</section>`;
    }
    case "floatpaths": return floatPathsMarkup(s);
    case "logic": {
      const n = networkHealth(s),
      oe = openEnds(s),
      cycles = detectCycles(s);
      return`<div class="metrics">${metric("Health", `${h.score}/100`, h.label, "Overall deterministic health score based on the checks shown below.")}${metric("Logic density", n.logicDensity.toFixed(2), "Relationships/activity", healthDefinition("Logic density"))}${metric("Open starts", oe.starts.length, "", healthDefinition("Missing logic"))}${metric("Open finishes", oe.finishes.length, "", healthDefinition("Missing logic"))}${metric("Cycles", cycles.length, "", healthDefinition("Cycles"))}${metric("Leads / lags", `${n.leads} / ${n.lags}`, "", `${healthDefinition("Leads")} ${healthDefinition("Lags")}`)}</div><div class="grid grid2"><section class="panel"><h2>Health checks</h2><p class="muted">Hover a check name for its definition.</p>${table(["Check", "Value", "Penalty"], h.checks.map(x => [`<span class="help-term" title="${esc(healthDefinition(x.name))}">${esc(x.name)} <span class="help-dot">?</span></span>`, typeof x.value==="number"? x.value.toFixed(3): x.value, x.penalty.toFixed(1)]))}</section><section class="panel"><h2>Open ends</h2>${table(["Type", "Activity"], [...oe.starts.slice(0, 100).map(a => ["Open start", `${esc(a.id)} · ${esc(a.name)}`]), ...oe.finishes.slice(0, 100).map(a => ["Open finish", `${esc(a.id)} · ${esc(a.name)}`])])}</section></div>`;
    }
    case "logicdiff": return logicChangesMarkup();
    case "dcma": {
      const assessment = dcma14(s, { profile: currentQaProfile() }), meta = assessment.metadata;
      const summaryRows = assessment.checks.map(c => [
        c.number,
        `<strong>${esc(c.name)}</strong><div class="muted small">${esc(c.criterion || "")}</div>`,
        c.count,
        c.denominator || "—",
        c.rate == null ? (c.value == null ? "—" : Number(c.value).toFixed(3)) : `${Number(c.rate).toFixed(1)}%`,
        esc(c.threshold || "—"),
        c.status === "PASS" ? badge("PASS", "good") : c.status === "FAIL" ? badge("FAIL", "danger") : badge("N/A", "warn")
      ]);
      const profileThresholds = currentQaProfile().thresholds;
      const thresholdById = {
        logic: profileThresholds.logicMissingPctMax, leads: profileThresholds.leadPctMax, lags: profileThresholds.lagPctMax,
        "relationship-types": profileThresholds.fsPctMin, "hard-constraints": profileThresholds.hardConstraintPctMax,
        "high-float": profileThresholds.highFloatPctMax, "negative-float": profileThresholds.negativeFloatPctMax,
        "high-duration": profileThresholds.highDurationPctMax, "invalid-dates": profileThresholds.invalidDateCountMax,
        resources: profileThresholds.resourceMissingPctMax, "missed-tasks": profileThresholds.missedTaskPctMax,
        "critical-path-test": 600, cpli: profileThresholds.cpliMin, bei: profileThresholds.beiMin
      };
      const thresholdRows = assessment.checks.map(c => ({
        label: `${c.number}. ${c.name}`,
        actual: c.id === "critical-path-test" ? Number(c.value || 0) : c.rate != null ? Number(c.rate) : c.value != null ? Number(c.value) : 0,
        threshold: Number(thresholdById[c.id] ?? 0)
      }));
      const details = assessment.checks.map(c => {
        const detailRows = c.details || [];
        const keys = [...new Set(detailRows.flatMap(x => Object.keys(x || {})))];
        const detailTable = detailRows.length ? table(keys.map(k => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, m => m.toUpperCase())), detailRows.map(x => keys.map(k => k === "activity" ? activityLink(x?.[k] ?? "") : esc(x?.[k] ?? "—"))), { resizable: true, resizeKey: `dcma-${c.id}` }) : `<div class="empty-state">No offending/detail records for this check.</div>`;
        return `<details class="dcma-detail-box"><summary><span><strong>${c.number}. ${esc(c.name)}</strong><small>${esc(c.threshold || "")}${c.note ? ` · ${esc(c.note)}` : ""}</small></span>${c.status === "PASS" ? badge("PASS", "good") : c.status === "FAIL" ? badge("FAIL", "danger") : badge("N/A", "warn")}</summary><div class="dcma-detail-body">${detailTable}</div></details>`;
      }).join("");
      return`${qaProfileControls()}<div class="metrics">${metric("Overall", assessment.summary.overall, `${assessment.summary.pass} pass · ${assessment.summary.fail} fail · ${assessment.summary.na} N/A`)}${metric("Assessed score", `${assessment.summary.scorePct.toFixed(1)}%`, `${assessment.summary.pass}/${assessment.summary.assessed || 0}`)}${metric("Baseline coverage", `${meta.baselineCoverage.toFixed(1)}%`, `${meta.baselineTasks}/${meta.positiveDurationTasks} positive-duration tasks`)}${metric("Scoped tasks", meta.scopedActivities)}${metric("Data date", meta.dataDate || "—")}</div>
      <section class="panel"><h2>DCMA 14-Point Schedule Assessment</h2><p class="muted">All fourteen conventional metrics are evaluated. Baseline/resource-dependent metrics return N/A where the imported schedule does not contain enough evidence. The Critical Path Test is a 600-day static network-recalculation proxy; calendars and native P6 constraint recalculation are not simulated.</p>${table(["#", "Check", "Issues / numerator", "Denominator", "Actual", "Threshold", "Result"], summaryRows, { resizable: true, resizeKey: "dcma14" })}</section>
      <section class="panel"><h2>Metric profile</h2><p class="muted">Use the chart workbench to filter, change chart type, hide series, set a threshold line, resize, inspect points or export data/graphics.</p>${interactiveBarChart(thresholdRows, { labelKey: "label", series: [{ key: "actual", label: "Actual" }, { key: "threshold", label: "Threshold / reference" }], xLabels: thresholdRows.map(x => x.label), rotateLabels: true, title: "DCMA metric profile" })}</section>
      <section class="forensic-evidence-stack"><div class="forensic-evidence-title"><div><h2>DCMA drill-down</h2><p class="muted">Expand any check to see the activities/relationships behind the result.</p></div><button class="btn" id="dcmaAddIssues" type="button">Add failures to Issue Register</button></div>${details}</section>`;
    }
    case "delay": {
      const a = scheduleById(state.delayAId), b = scheduleById(state.delayBId), toolbar = pairToolbar("delay", state.delayAId, state.delayBId, { labelA: "Earlier / reference schedule", labelB: "Later / impact schedule" });
      if (!a || !b) return `<section class="panel"><h2>Delay Analysis</h2><p>This view identifies where forecast dates moved between two explicitly selected schedules and ranks movement by activity/WBS with deterministic schedule evidence.</p>${toolbar}${scheduleSelectionMessage("Choose two schedules to begin.")}</section>`;
      if (a.id===b.id) return `<section class="panel"><h2>Delay Analysis</h2>${toolbar}<div class="empty-state">Choose two different schedules.</div></section>`;
      const comp=compareSchedules(a,b), slips=comp.changed.filter(x=>x.finishDays>0).sort((x,y)=>y.finishDays-x.finishDays), critSlips=slips.filter(x=>{const q=b.activities.find(k=>k.id===x.id);return q?.critical||q?.totalFloat<=0;}), wbs=wbsDelayRows(comp,b);
      return `<section class="panel"><h2>Delay Analysis</h2><p class="muted">Schedule movement analysis only; contractual entitlement, causation and responsibility require contemporaneous evidence and contract review.</p>${toolbar}</section><div class="metrics">${metric("Slipped activities",slips.length)}${metric("Critical slipped",critSlips.length)}${metric("Forecast project Δ",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}${metric("Entered critical",comp.migration.entered.length)}${metric("Logic added",comp.relationshipAdded.length)}${metric("Logic removed",comp.relationshipDeleted.length)}</div><div class="grid grid2"><section class="panel"><h2>Delay by WBS band</h2>${interactiveBarChart(wbs.slice(0,30),{labelKey:"label",series:[{key:"totalSlip",label:"Total slipped days"},{key:"maxSlip",label:"Maximum activity movement"}],rotateLabels:true,title:"WBS delay concentration"})}${table(["WBS band","Slipped activities","Total movement","Maximum activity movement"],wbs.map(x=>[esc(x.label),x.count,`${x.totalSlip}d`,`${x.maxSlip}d`]))}</section><section class="panel"><h2>Interpretation guide</h2><p>Review project-finish movement and critical-path migration first, then WBS concentrations and individual activities. Large movements without duration growth commonly indicate predecessor, calendar, constraint or progress effects.</p></section></div><section class="panel"><h2>Delay movement register</h2>${table(["Activity","Finish Δ","Start Δ","Duration Δ","Float Δ","Likely schedule evidence"],slips.slice(0,1000).map(x=>{const ev=whyDidDateMove(a,b,x.id);return[activityLink(x.id,`${x.id} · ${x.name}`),signedNumber(x.finishDays,"d",true),signedNumber(x.startDays,"d",true),signedNumber(x.durationDays,"d",true),signedNumber(x.floatDays,"d",false),esc(ev.evidence.slice(0,5).map(e=>e.cause).join("; "))]}),{resizable:true,resizeKey:"delayMovement"})}</section>`;
    }
    case "forensic": {
      const selected=state.forensicScheduleIds.map(scheduleById).filter(Boolean), ordered=[...new Map(selected.map(x=>[x.id,x])).values()].sort((a,b)=>(parseDate(a.dataDate)?.getTime()||0)-(parseDate(b.dataDate)?.getTime()||0));
      const selectors=scheduleSlots("forensicSlot",state.forensicScheduleIds,10,{label:"Schedule",blank:"Not selected"});
      if(ordered.length<2)return `<section class="panel"><h2>Forensic Review</h2><p class="muted">Select between 2 and 10 schedules. Only selected schedules are included and are reviewed in data-date order.</p>${selectors}${scheduleSelectionMessage("Select at least two schedules.")}</section>`;
      const w=windowsAnalysis(ordered), transitions=w.windows.map(x=>({label:x.label,addedActivities:x.activitiesAdded,deletedActivities:x.activitiesRemoved,logicAdded:x.logicAdded,logicRemoved:x.logicRemoved,resourceChanges:x.resourceChanges,finishMove:x.finishMovementDays,criticalEntered:x.criticalEntered}));
      const mixed=[...new Set(ordered.map(x=>x.projectName).filter(Boolean))].length>1?`<div class="analysis-warning">Selected schedules report different project names. ID-based comparison still runs because the selection was explicit; interpret results carefully.</div>`:"";
      const detail=w.windows.flatMap(x=>x.adverse.slice(0,250).map(a=>[esc(x.label),activityLink(a.id,`${a.id} · ${a.name}`),signedNumber(a.finishDays,"d",true),signedNumber(a.durationDays,"d",true),a.calendarChanged?"Yes":"No",a.resourceChanged?"Yes":"No",a.constraintChanged?"Yes":"No"]));
      return `<section class="panel"><div class="panel-head-row"><div><h2>Forensic Review · up to 10 schedules</h2><p class="muted">Adjacent revisions are compared across activities, progress/actuals, logic, calendars, resources, critical-path migration and forecast movement.</p></div><button class="btn primary" id="exportEvidencePack" type="button">Export Evidence Pack ZIP</button></div>${selectors}${mixed}</section><section class="panel"><h2>Change profile across revisions</h2>${interactiveBarChart(transitions,{labelKey:"label",series:[{key:"addedActivities",label:"Activities added"},{key:"deletedActivities",label:"Activities removed"},{key:"logicAdded",label:"Logic added"},{key:"logicRemoved",label:"Logic removed"},{key:"resourceChanges",label:"Resource changes"}],rotateLabels:true,title:"Forensic transition profile"})}</section><section class="panel"><h2>Revision-to-revision summary</h2>${table(["Transition","Finish Δ","Activities + / -","Logic + / -","Resource changes","Entered critical"],transitions.map(x=>[esc(x.label),signedNumber(x.finishMove,"d",true),`${x.addedActivities} / ${x.deletedActivities}`,`${x.logicAdded} / ${x.logicRemoved}`,x.resourceChanges,x.criticalEntered]),{resizable:true,resizeKey:"forensicSummary"})}</section><section class="panel"><h2>Material activity changes</h2>${table(["Transition","Activity","Finish Δ","Duration Δ","Calendar","Resources","Constraint"],detail,{resizable:true,resizeKey:"forensicMaterial"})}</section>${forensicEvidencePanels(ordered)}${forensicRevisionMatrixMarkup(ordered)}`;
    }
    case "windows": return windowsAnalysisMarkup();
    case "whymove": {
      const prev = previousSchedule(),
      id = state.whyActivityId || s.activities[0]?.id || "",
      x = prev && id? whyDidDateMove(prev, s, id): null;
      return`<section class="panel"><h2>Why Did My Date Move?</h2><div class="filterbar"><label>Comparative programme ${revisionSelector("whyPrev", state.previousScheduleId)}</label><label>Activity <select id="whyActivity">${s.activities.slice(0, 10000).map(a => `<option value="${esc(a.id)}" ${a.id===id? "selected": ""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select></label></div>${!prev? `<div class="muted">Choose a comparative programme.</div>`: x? `${metric("Finish movement", `${x.finishMovementDays>=0? "+": ""}${x.finishMovementDays}d`, "Current vs comparison")} ${table(["Evidence", "Impact", "Confidence"], x.evidence.map(e => [esc(e.cause), e.impactDays==null? "—": `${e.impactDays>=0? "+": ""}${e.impactDays}d`, badge(e.confidence, e.confidence==="Confirmed"? "good": "warn")]))}`: ""}</section>`;
    }
    case "calendar": {
      const years = projectYears(s),
      used = new Set(s.activities.map(a => a.calendarId)),
      cals = s.calendars.filter(c => used.has(c.id) || s.activities.some(a => a.calendarName===c.name));
      return`<section class="panel"><h2>Calendar Analyser</h2><p class="muted">Non-work days are shaded red; identifiable calendar exceptions are amber. Raw P6 definitions remain preserved for audit.</p></section>${cals.map(c => `<section class="panel"><h2>${esc(c.name)}</h2>${years.map(y => {
        const cy = calendarYear(c, y); return`<div class="calendar-year"><h3>${y}</h3><div class="calendar-grid">${Array.from( {
          length: 12
        }, (_, m) => calendarMonth(cy, m)).join("")}</div></div>`
      }).join("")}</section>`).join("") || `<div class="panel muted">No assigned calendars found.</div>`}`;
    }
    case "calendardiff": return calendarDifferencesMarkup();
    case "scurve": {
      const resources = s.resources || [];
      if (state.scurveBasis==="resource" && !state.scurveResourceId)state.scurveResourceId = resources[0]?.id || "";
      const baseRows = curveSeries(s, {
        basis: state.scurveBasis, resourceId: state.scurveResourceId, resourceIds: state.scurveResourceIds
      }),
      fullStart = baseRows[0]?.start,
      fullFinish = baseRows.at( - 1)?.end,
      startValue = state.scurveStartDate || isoDate(fullStart),
      finishValue = state.scurveFinishDate || isoDate(fullFinish),
      rows = curveSeries(s, {
        basis: state.scurveBasis, resourceId: state.scurveResourceId, resourceIds: state.scurveResourceIds, startDate: startValue, endDate: finishValue
      }),
      xLabels = rows.map(r => isoDate(r.friday));
      const selectedResources = new Set(state.scurveResourceIds.map(String)),
      resourceSummary = selectedResources.has("__NONE__")? "No resources": selectedResources.size? `${selectedResources.size} selected`: "All resources",
      basisLabel = state.scurveBasis==="activities"? "Activities": state.scurveBasis==="cost"? "Cost": state.scurveBasis==="resource"? `Resource: ${resources.find(r => String(r.id)===String(state.scurveResourceId))?.name || state.scurveResourceId}`: "Loaded units / man-hours",
      enabled = state.scurveSeries;
      const lineSeries = [enabled.planned? {
        name: "Planned cumulative", values: rows.map((r, i) => ( {
          x: i, y: r.plannedCum
        }))
      }
      : null, enabled.actual? {
        name: "Actual cumulative", values: rows.map((r, i) => ( {
          x: i, y: r.actualCum
        }))
      }
      : null, enabled.forecast? {
        name: "Forecast cumulative", values: rows.map((r, i) => ( {
          x: i, y: r.forecastCum
        }))
      }
      : null].filter(Boolean),
      barSeries = [enabled.planned? {
        key: "plannedWeekly", label: "Planned"
      }
      : null, enabled.actual? {
        key: "actualWeekly", label: "Actual"
      }
      : null, enabled.forecast? {
        key: "forecastWeekly", label: "Forecast"
      }
      : null].filter(Boolean);
      const resourceFilter = state.scurveBasis!=="resource" && resources.length? `<details class="scurve-resource-filter"><summary>Resource filter · ${resourceSummary}</summary><div class="scurve-resource-actions"><button class="btn compact" id="scurveAllResources" type="button">All</button><button class="btn compact" id="scurveNoResources" type="button">None</button></div><div class="scurve-resource-list">${resources.map(r => `<label><input type="checkbox" data-scurve-resource="${esc(r.id)}" ${selectedResources.has(String(r.id))? "checked": ""}> ${esc(r.name || r.id)}</label>`).join("")}</div></details>`: "";
      const headers = ["Week", "Friday"],
      rowKeys = [];
      if (enabled.planned) {
        headers.push("Planned weekly", "Planned cumulative");
        rowKeys.push("plannedWeekly", "plannedCum")
      }
      if (enabled.actual) {
        headers.push("Actual weekly", "Actual cumulative");
        rowKeys.push("actualWeekly", "actualCum")
      }
      if (enabled.forecast) {
        headers.push("Forecast weekly", "Forecast cumulative");
        rowKeys.push("forecastWeekly", "forecastCum")
      }
      return`<section class="panel"><div class="gantt-title-row"><div><h2>S-Curve & Histogram</h2><p class="muted">P6-style resource/profile controls. Filter resources and visible series, then focus or expand the date window. Values are bucketed weekly using the time-phased information available in the imported schedule. X-axis dates are Fridays.</p></div><span class="badge">${esc(basisLabel)}</span></div><div class="scurve-control-grid"><label>Basis <select id="scurveBasis"><option value="activities" ${state.scurveBasis==="activities"? "selected": ""}>Activity count</option><option value="units" ${state.scurveBasis==="units"? "selected": ""}>Loaded units / man-hours</option><option value="cost" ${state.scurveBasis==="cost"? "selected": ""}>Cost</option><option value="resource" ${state.scurveBasis==="resource"? "selected": ""}>Individual resource</option></select></label>${state.scurveBasis==="resource"? `<label>Resource <select id="scurveResource">${resources.map(r => `<option value="${esc(r.id)}" ${String(r.id)===String(state.scurveResourceId)? "selected": ""}>${esc(r.name || r.id)}</option>`).join("")}</select></label>`: ""}<label>From <input type="date" id="scurveStartDate" value="${esc(startValue)}"></label><label>To <input type="date" id="scurveFinishDate" value="${esc(finishValue)}"></label><div class="scurve-range-actions"><button class="btn compact" id="scurveContract" type="button">Contract 4w</button><button class="btn compact" id="scurveExpand" type="button">Expand 4w</button><button class="btn compact" id="scurveFullRange" type="button">Full range</button></div><fieldset class="series-filter"><legend>Series</legend><label><input id="scurvePlanned" type="checkbox" ${enabled.planned? "checked": ""}> Planned</label><label><input id="scurveActual" type="checkbox" ${enabled.actual? "checked": ""}> Actual</label><label><input id="scurveForecast" type="checkbox" ${enabled.forecast? "checked": ""}> Forecast</label></fieldset></div>${resourceFilter}</section><section class="panel"><h2>Weekly S-Curve · ${esc(basisLabel)}</h2>${lineSeries.length? lineChart(lineSeries, {
        xLabels, rotateLabels: true
      }): `<div class="empty-state">Select at least one series.</div>`}</section><section class="panel"><h2>Weekly Histogram · ${esc(basisLabel)}</h2>${barSeries.length? interactiveBarChart(rows, {
        labelKey: "week", series: barSeries, xLabels, rotateLabels: true, dateKey: "friday"
      }): `<div class="empty-state">Select at least one series.</div>`}</section><section class="panel"><h2>Weekly copyable data</h2>${table(headers, rows.map(r => [r.week, isoDate(r.friday), ...rowKeys.map(k => Number(r[k] || 0).toFixed(2))]))}</section>`;
    }
    case "narrative": {
      const prev = previousSchedule(),
      n = scheduleNarrative(s, prev),
      bars = n.lookahead.map(w => `<div class="metric"><small>Week ${w.week} · ${isoDate(w.start)}</small><strong>${w.starts.length} starts</strong><small>${w.finishes.length} finishes · ${w.criticalStarts.length} critical starts</small></div>`).join("");
      return`<section class="panel"><div class="filterbar"><label>Optional comparison schedule ${revisionSelector("narrativePrev", state.previousScheduleId)}</label></div><h2>Executive Schedule Narrative</h2>${n.paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}<h3>Phase / WBS position</h3>${table(["Phase / top WBS", "Activities", "Progress", "Critical", "Negative float", "Budget units", "Remaining units"], n.phases.map(p => [esc(p.name), p.activities, `${p.progress.toFixed(1)}%`, p.critical, p.negative, p.budgetUnits.toFixed(1), p.remainingUnits.toFixed(1)]))}<h3>Next four weeks</h3><div class="grid grid4">${bars}</div>${table(["Week", "Period", "Starts", "Finishes", "Critical starts", "Key upcoming activities"], n.lookahead.map(w => [`Week ${w.week}`, `${isoDate(w.start)} – ${isoDate(w.end)}`, w.starts.length, w.finishes.length, w.criticalStarts.length, w.starts.slice(0, 8).map(a => `${esc(a.id)} ${esc(a.name)}`).join("; ")]))}${narrativeActivityDetailMarkup(s)}</section>`;
    }
    case "gantt": {
      const layout = state.ganttLayouts.wbs || freshGanttLayout("wbs");
      return `${namedGanttLayoutToolbar("wbs")}${gantt(s, {
        timescale: state.ganttTimescale, compression: state.ganttCompression, showRelationships: state.ganttRelationships, leftWidth: state.ganttLeftWidth, resizeKey: "ganttLeftWidth", startDate: state.ganttStartDate, endDate: state.ganttFinishDate, fields: layout.fields, fieldWidths: layout.widths, barSettings: layout.bars, layoutKey: "wbs", collapsedWbsIds: state.ganttCollapsed.wbs
      })}`
    }
    case "network": {
      const conv = pathConvergence(s).slice(0, 40),
      lp = longestPath(s);
      return`<section class="panel"><h2>Nodes</h2><p class="muted">The network is laid out by logical depth. Hover any node for dates, float, incoming/outgoing relationships and detected issues. Use − / + / Reset to zoom.</p>${networkGraph(s, {
        maxNodes: 120
      })}</section><div class="grid grid2"><section class="panel"><h2>Network graph intelligence</h2>${metric("Longest path", `${lp.duration.toFixed(1)}d`, `${lp.path.length} activities`)}${table(["Activity", "Incoming", "Outgoing"], conv.map(x => [`${esc(x.activity.id)} · ${esc(x.activity.name)}`, x.incoming, x.outgoing]))}</section><section class="panel"><h2>Trace to milestone / activity</h2><select id="traceActivity">${s.activities.filter(a => a.milestone || a.critical).slice(0, 2000).map(a => `<option value="${esc(a.id)}" ${a.id===state.traceActivityId? "selected": ""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select><div id="traceResult">${renderTrace(s)}</div></section></div>`;
    }
    case "timemachine": {
      const selected = state.timeMachineScheduleIds.map(scheduleById).filter(Boolean),
      ordered = [...new Map(selected.map(x => [x.id, x])).values()].sort((a, b) => (parseDate(a.dataDate)?.getTime() || 0) - (parseDate(b.dataDate)?.getTime() || 0)),
      source = ordered.at( - 1) || null,
      id = state.timeActivityId || source?.activities.find(a => a.milestone)?.id || source?.activities[0]?.id || "",
      hist = ordered.length && id? activityHistory(ordered, id): [],
      vals = hist.map((x, i) => ( {
        x: i, y: parseDate(x.finish)?.getTime() / 86400000 || 0
      }));
      return`<section class="panel"><h2>Schedule Time Machine</h2><p><strong>Purpose:</strong> track one activity or milestone through a revision sequence to see how its forecast start, finish, float, progress and critical status changed over time. The tool uses only the schedules you explicitly select below, so unrelated projects are never automatically mixed.</p>${scheduleSlots("timeSlot", state.timeMachineScheduleIds, 8, {
        label: "Revision", blank: "Not selected"
      })}${source? `<div class="filterbar" style="margin-top:10px"><label>Activity <select id="timeActivity">${source.activities.slice(0, 10000).map(a => `<option value="${esc(a.id)}" ${a.id===id? "selected": ""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select></label></div>${lineChart([ {
        name: "Forecast finish (serial day)", values: vals
      }], {
        xLabels: hist.map(x => isoDate(x.dataDate)), rotateLabels: true
      })}${table(["Revision", "Data date", "Start", "Finish", "TF", "Progress", "Critical"], hist.map(x => [esc(x.scheduleName), isoDate(x.dataDate), isoDate(x.start), isoDate(x.finish), Number(x.totalFloat).toFixed(1), `${Number(x.percent).toFixed(1)}%`, x.critical? "Yes": "No"]))}`: scheduleSelectionMessage("Select one or more schedules; two or more are recommended for trend analysis.")}</section>`;
    }
    case "milestones": {
      const revisionSet = state.dashboardLineageIds.map(scheduleById).filter(Boolean),
      revs = revisionSet.length? revisionSet: [s],
      ms = s.activities.filter(isMilestoneActivity),
      hist = milestoneHistory(revs);
      return`<section class="panel"><h2>Milestone Control Centre</h2><p class="muted">Movement/confidence uses the explicit Dashboard Revision Lineage selection when present; otherwise it uses only the active schedule.</p>${table(["Milestone", "Forecast", "Previous", "Movement", "Float", "Confidence"], ms.map(a => {
        const hh = hist.find(x => x.id===a.id)?.history || [], p = hh.length>1? hh.at( - 2): null, move = p? daysBetween(p.finish, a.currentFinish || a.finish): 0, conf = forecastConfidence(revs, a.id); return[`${esc(a.id)} · ${esc(a.name)}`, isoDate(a.currentFinish || a.finish), isoDate(p?.finish), p? `${move>=0? "+": ""}${move}d`: "—", a.totalFloat.toFixed(1), `${conf.score}% ${conf.label}`]
      }))}</section>`;
    }
    case "forecast": {
      const selected = state.dashboardLineageIds.map(scheduleById).filter(Boolean),
      revs = selected.length? selected: [s],
      ms = s.activities.filter(a => a.milestone),
      overall = forecastConfidence(revs),
      rows = ms.map(a => {
        const c = forecastConfidence(revs, a.id); return[`${esc(a.id)} · ${esc(a.name)}`, `<span title="Confidence combines schedule health, revision volatility, average positive slip and available float.">${c.score}%</span>`, c.label, `<span title="Standard deviation of finish-date movement across the explicitly selected revision set.">${c.volatility.toFixed(1)}</span>`, `<span title="Average positive finish-date movement (slippage) across the selected revisions.">${c.avgSlip.toFixed(1)}</span>`, isoDate(a.currentFinish || a.finish)]
      });
      return`<p class="muted">Hover the confidence statistics for definitions. Revision-based calculations use the schedules explicitly selected in Dashboard → Revision Lineage; if none are selected, only the active schedule is used.</p><div class="metrics">${metric("Overall confidence", `${overall.score}%`, overall.label, "Derived from schedule health, revision volatility, average positive slippage and target float where applicable.")}${metric("Revision volatility", overall.volatility.toFixed(1), "days std dev", "Standard deviation of finish movement between selected revisions. Higher volatility reduces confidence.")}${metric("Average positive slip", overall.avgSlip.toFixed(1), "days", "Average positive movement in forecast finish between selected revisions; negative/early movement is not counted as slip.")}${metric("Revisions analysed", overall.rows.length, "", "Number of explicitly selected schedules containing a usable target/project finish date.")}${metric("Current critical", s.activities.filter(a => a.critical || a.totalFloat<=0).length, "", "Activities currently critical or at zero/negative total float.")}${metric("Current negative float", s.activities.filter(a => a.totalFloat<0).length, "", "Activities whose total float is below zero, indicating schedule pressure against required dates or constraints.")}</div><section class="panel"><h2>Milestone Forecast Confidence</h2>${table(["Milestone", "Confidence", "Band", "Volatility", "Avg slip", "Current forecast"], rows)}</section>`;
    }
    case "resourceforensics": return resourceForensicsMarkup();
    case "cost": {
      const budget = s.activities.reduce((n, a) => n + Number(a.budgetCost || 0), 0),
      actual = s.activities.reduce((n, a) => n + Number(a.actualCost || 0), 0),
      remaining = s.activities.reduce((n, a) => n + Number(a.remainingCost || 0), 0);
      return`<div class="metrics">${metric("Budget cost", budget.toFixed(0))}${metric("Actual cost", actual.toFixed(0))}${metric("Remaining cost", remaining.toFixed(0))}${metric("Forecast cost", (actual + remaining).toFixed(0))}${metric("Cost variance", (budget - (actual + remaining)).toFixed(0))}${metric("Cost loaded activities", s.activities.filter(a => a.budgetCost || a.actualCost || a.remainingCost).length)}</div><section class="panel"><h2>Cost by WBS</h2><p class="muted">WBS headings follow the imported schedule hierarchy. Expand a WBS to see child WBS elements and activities.</p>${costTreeMarkup(s)}</section>`;
    }
    case "resources": {
      const assigns = s.assignments || [],
      resources = s.resources || [],
      resourceRows = resources.map(r => {
        const xs = assigns.filter(x => String(x.resourceId)===String(r.id)), budget = xs.reduce((n, x) => n + Number(x.target_qty || x.budgetUnits || 0), 0), actual = xs.reduce((n, x) => n + Number(x.act_reg_qty || x.actualUnits || 0), 0), remaining = xs.reduce((n, x) => n + Number(x.remain_qty || x.remainingUnits || 0), 0); return[esc(r.name || r.id), budget.toFixed(1), actual.toFixed(1), remaining.toFixed(1), budget? `${(actual / budget * 100).toFixed(1)}%`: "—"]
      }),
      budgetUnits = s.activities.reduce((n, a) => n + Number(a.budgetUnits || 0), 0),
      actualUnits = s.activities.reduce((n, a) => n + Number(a.actualUnits || 0), 0),
      budgetCost = s.activities.reduce((n, a) => n + Number(a.budgetCost || 0), 0),
      actualCost = s.activities.reduce((n, a) => n + Number(a.actualCost || 0), 0),
      pv = budgetUnits? weeklySeries(s).at( - 1)?.plannedPct || 0: 0,
      ev = avgProgress(s),
      spi = pv? ev / pv: 0,
      cpi = actualCost? ((budgetCost * (ev / 100)) / actualCost): 0;
      return`<div class="metrics">${metric("Budget units", budgetUnits.toFixed(1))}${metric("Actual units", actualUnits.toFixed(1))}${metric("Budget cost", budgetCost.toFixed(0))}${metric("Actual cost", actualCost.toFixed(0))}${metric("SPI", spi? spi.toFixed(2): "—", "Indicative")}${metric("CPI", cpi? cpi.toFixed(2): "—", "Indicative")}</div><section class="panel"><h2>Resource / EVM view</h2><p class="muted">EVM indicators are shown only from source values available in the imported schedule; they are not a substitute for a cost-management system.</p>${table(["Resource", "Budget units", "Actual units", "Remaining units", "Actual / budget"], resourceRows)}</section>`;
    }
    case "baseline": return baselineManagerMarkup();
    case "datacentre": {
      const dc = dataCentreReadiness(s),
      gates = readinessGates(s);
      return`<div class="grid grid2"><section class="panel"><h2>Data-centre lifecycle readiness</h2>${table(["Stage", "Activities", "Complete", "Progress", "Critical"], dc.map(x => [x.stage, x.activities, x.complete, `${x.progress.toFixed(1)}%`, x.critical]))}</section><section class="panel"><h2>Readiness gates</h2>${table(["Gate", "Mapped milestone", "Forecast", "Float"], gates.map(g => [g.name, g.activity? `${esc(g.activity.id)} · ${esc(g.activity.name)}`: "Not mapped", isoDate(g.activity?.currentFinish || g.activity?.finish), g.activity? g.activity.totalFloat.toFixed(1): "—"]))}</section></div>`;
    }
    default: {
      const summary = scheduleSummary(s);
      return`<div class="metrics">${metric("Activities", summary.activities)}${metric("Progress", `${summary.progress.toFixed(1)}%`)}${metric("Forecast finish", summary.forecastFinish || "—")}${metric("Health", `${h.score}/100`, h.label)}${metric("Critical", summary.critical)}${metric("Negative float", summary.negativeFloat)}</div><section class="panel"><h2>Assessment overview</h2><p class="muted">Use the report tabs above. Comparison-style reports now require explicit schedule selections so unrelated uploaded projects are never treated as revisions by default.</p></section>`;
    }
  }
}
function renderTrace(s) {
  const id = state.traceActivityId || s.activities.find(a => a.milestone)?.id || "";
  if (!id)return`<div class="muted">Select an activity.</div>`;
  const x = traceToMilestone(s, id);
  return table(["Sequence", "Activity", "Finish", "TF"], x.drivingChain.map((a, i) => [i + 1, `${esc(a.id)} · ${esc(a.name)}`, isoDate(a.currentFinish || a.finish), a.totalFloat.toFixed(1)]));
}
function bindResizableTables(root = document) {
  root.querySelectorAll(".table-wrap.resizable-wrap").forEach(wrap => {
    const table = wrap.querySelector("table.resizable-table"), headers = [...table?.querySelectorAll("thead th") || []], cols = [...table?.querySelectorAll("colgroup col") || []]; if (!table || !headers.length || cols.length!==headers.length)return; const key = wrap.dataset.resizeKey? `pcai.tableWidths.${wrap.dataset.resizeKey}`: ""; let saved = []; try {
      saved = key? JSON.parse(localStorage.getItem(key) || "[]"): []
    } catch (_) {
      saved = []
    }
    const measured = headers.map((th, i) => Math.max(60, Number(saved[i]) || Math.round(th.getBoundingClientRect().width) || 100)); const apply = widths => {
      widths.forEach((w, i) => {
        if (cols[i])cols[i].style.width = `${Math.max(60, Math.round(w))}px`
      }); table.style.tableLayout = "fixed"; table.style.width = `${widths.reduce((n, w) => n + Math.max(60, Math.round(w)), 0)}px`; table.style.minWidth = "100%";
    }; apply(measured); headers.forEach((th, i) => {
      const handle = th.querySelector(".col-resizer"); if (!handle)return; handle.onpointerdown = e => {
        if (e.button!=null && e.button!==0)return; e.preventDefault(); e.stopPropagation(); const widths = cols.map((c, j) => parseFloat(c.style.width) || measured[j] || headers[j].getBoundingClientRect().width), startX = e.clientX, startW = widths[i]; handle.setPointerCapture?.(e.pointerId); document.documentElement.classList.add("resizing-column"); const move = ev => {
          widths[i] = Math.max(60, startW + ev.clientX - startX); apply(widths)
        }; const up = () => {
          document.documentElement.classList.remove("resizing-column"); if (key)localStorage.setItem(key, JSON.stringify(widths.map(Math.round))); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up)
        }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      };
    });
  });
}
function money(v) {
  return Number(v || 0).toFixed(0)
}
function costTreeMarkup(schedule) {
  const nodes = new Map((schedule.wbs || []).map(w => [String(w.id), {
    ...w, children: [], activities: []
  }])),
  roots = [];
  for (const n of nodes.values()) {
    const p = nodes.get(String(n.parentId || ""));
    if (p)p.children.push(n);
    else roots.push(n)
  }
  const unassigned = [];
  for (const a of schedule.activities || []) {
    const n = nodes.get(String(a.wbsId || ""));
    (n? n.activities: unassigned).push(a)
  }
  const sumActivity = a => ( {
    budget: Number(a.budgetCost || 0), actual: Number(a.actualCost || 0), remaining: Number(a.remainingCost || 0)
  });
  const add = (x, y) => ( {
    budget: x.budget + y.budget, actual: x.actual + y.actual, remaining: x.remaining + y.remaining
  });
  const total = n => {
    let t = {
      budget: 0,
      actual: 0,
      remaining: 0
    };
    for (const a of n.activities)t = add(t, sumActivity(a));
    for (const c of n.children)t = add(t, total(c));
    n._total = t;
    return t
  };
  roots.forEach(total);
  const vals = t => `<span>${money(t.budget)}</span><span>${money(t.actual)}</span><span>${money(t.remaining)}</span><span>${money(t.actual + t.remaining)}</span><span>${money(t.budget - (t.actual + t.remaining))}</span>`;
  const activity = a => {
    const t = sumActivity(a);
    return`<div class="cost-row cost-activity"><span class="cost-name">${esc(a.id)} · ${esc(a.name)}</span>${vals(t)}</div>`
  };
  const renderNode = (n, depth = 0) => `<details class="cost-node" ${depth<1? "open": ""}><summary class="cost-row" style="--cost-depth:${depth}"><span class="cost-name"><strong>${esc(n.code || n.name || n.id)}</strong>${n.name && n.code? ` · ${esc(n.name)}`: ""}</span>${vals(n._total || {
    budget: 0, actual: 0, remaining: 0
  })}</summary><div class="cost-children">${n.children.sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name))).map(c => renderNode(c, depth + 1)).join("")}${n.activities.sort((a, b) => String(a.id).localeCompare(String(b.id))).map(activity).join("")}</div></details>`;
  const unassignedMarkup = unassigned.length? `<details class="cost-node"><summary class="cost-row"><span class="cost-name"><strong>Unassigned WBS</strong></span>${vals(unassigned.map(sumActivity).reduce(add, {
    budget: 0, actual: 0, remaining: 0
  }))}</summary><div class="cost-children">${unassigned.map(activity).join("")}</div></details>`: "";
  if (!roots.length && unassigned.length)return`<div class="cost-tree"><div class="cost-row cost-header"><span>WBS / Activity</span><span>Budget</span><span>Actual</span><span>Remaining</span><span>Forecast</span><span>Variance</span></div>${unassignedMarkup}</div>`;
  return`<div class="cost-tree"><div class="cost-row cost-header"><span>WBS / Activity</span><span>Budget</span><span>Actual</span><span>Remaining</span><span>Forecast</span><span>Variance</span></div>${roots.sort((a, b) => String(a.code || a.name).localeCompare(String(b.code || b.name))).map(n => renderNode(n)).join("")}${unassignedMarkup}</div>`;
}
/**
 * Bind P6-style Gantt interactions after markup is mounted: pane/column resize,
 * relationship redraw, field chooser, bar styling and WBS double-click collapse.
 */
function bindGanttInteractions(schedule) {
  const panel = document.querySelector('[data-gantt-panel]'),
  g = panel?.querySelector('.gantt');
  if (!panel || !g || !schedule)return;
  const key = panel.dataset.resizeKey || "ganttLeftWidth",
  layoutKey = panel.dataset.layoutKey || "wbs",
  layout = state.ganttLayouts[layoutKey] || (state.ganttLayouts[layoutKey] = freshGanttLayout(layoutKey)),
  overlay = panel.querySelector('.gantt-rel-overlay');
  let redrawTimer = 0;
  const drawLinks = () => {
    if (!overlay)return;
    overlay.innerHTML = "";
    if (g.dataset.showRelationships!=="1")return;
    const gr = g.getBoundingClientRect(),
    width = Math.max(g.scrollWidth, g.clientWidth),
    height = Math.max(g.scrollHeight, g.clientHeight);
    overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
    overlay.setAttribute('width', String(width));
    overlay.setAttribute('height', String(height));
    const ns = 'http://www.w3.org/2000/svg',
    defs = document.createElementNS(ns, 'defs'),
    marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'ganttArrow');
    marker.setAttribute('viewBox', '0 0 6 6');
    marker.setAttribute('refX', '5.7');
    marker.setAttribute('refY', '3');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    marker.setAttribute('orient', 'auto');
    const tip = document.createElementNS(ns, 'path');
    tip.setAttribute('d', 'M0,0 L0,6 L6,3 z');
    tip.setAttribute('class', 'gantt-link-arrow');
    marker.appendChild(tip);
    defs.appendChild(marker);
    overlay.appendChild(defs);
    const rows = new Map([...g.querySelectorAll('.gantt-row[data-activity-id]')].map(r => [r.dataset.activityId, r]));
    for (const rel of schedule.relationships || []) {
      const pr = rows.get(String(rel.predId)),
      sr = rows.get(String(rel.succId));
      if (!pr || !sr || pr.offsetParent===null || sr.offsetParent===null)continue;
      const pb = pr.querySelector('.bar,.milestone'),
      sb = sr.querySelector('.bar,.milestone');
      if (!pb || !sb)continue;
      const a = pb.getBoundingClientRect(),
      b = sb.getBoundingClientRect(),
      type = String(rel.type || 'FS').toUpperCase(),
      predFinish = type[0]!=="S",
      succFinish = type[1]==="F",
      x1 = (predFinish? a.right: a.left) - gr.left + g.scrollLeft,
      y1 = a.top + a.height / 2 - gr.top + g.scrollTop,
      x2 = (succFinish? b.right: b.left) - gr.left + g.scrollLeft,
      y2 = b.top + b.height / 2 - gr.top + g.scrollTop;
      let bend;
      if (x2>x1 + 18)bend = x1 + (x2 - x1) / 2;
      else bend = Math.max(x1, x2) + 26;
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)} H${bend.toFixed(1)} V${y2.toFixed(1)} H${x2.toFixed(1)}`);
      path.setAttribute('class', 'gantt-link p6-link');
      path.setAttribute('marker-end', 'url(#ganttArrow)');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${rel.predId} ${type} ${rel.succId}${Number(rel.lag || 0)? ` · lag ${Number(rel.lag).toFixed(1)}d`: ''}`;
      path.appendChild(title);
      overlay.appendChild(path);
    }
  };
  const scheduleRedraw = () => {
    clearTimeout(redrawTimer);
    redrawTimer = setTimeout(drawLinks, 20)
  };
  panel.querySelectorAll('.gantt-field-resizer').forEach(handle => handle.onpointerdown = e => {
    if (e.button!=null && e.button!==0)return; e.preventDefault(); e.stopPropagation(); const field = handle.dataset.gcol, start = e.clientX, startW = Number(layout.widths[field] || GANTT_FIELDS[field]?.width || 100); document.documentElement.classList.add('resizing-column'); handle.setPointerCapture?.(e.pointerId); const move = ev => {
      layout.widths[field] = Math.max(60, Math.min(600, startW + ev.clientX - start)); const widths = layout.fields.map(k => Math.max(60, Number(layout.widths[k]) || GANTT_FIELDS[k]?.width || 100)); const template = widths.map(x => `${Math.round(x)}px`).join(' '), total = widths.reduce((n, x) => n + x, 0); g.style.setProperty('--gantt-left', `${total}px`); panel.querySelectorAll('.gantt-fields-row,.gantt-fields-header,.gantt-summary-fields').forEach(x => x.style.setProperty('--gantt-field-template', template)); scheduleRedraw()
    }; const up = () => {
      document.documentElement.classList.remove('resizing-column'); saveGanttLayout(layoutKey); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); drawLinks()
    }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  });
  const selectedValues = id => [...($(id)?.selectedOptions || [])].map(o => o.value),
  rerender = () => {
    saveGanttLayout(layoutKey);
    renderAssessment()
  };
  $('ganttFieldAdd')?.addEventListener('click', () => {
    for (const k of selectedValues('ganttFieldsAvailable'))if (GANTT_FIELDS[k] && !layout.fields.includes(k))layout.fields.push(k); rerender()
  });
  $('ganttFieldRemove')?.addEventListener('click', () => {
    const remove = new Set(selectedValues('ganttFieldsDisplayed')); if (layout.fields.length - remove.size<1) {
      alert('Keep at least one displayed field.'); return
    }
    layout.fields = layout.fields.filter(k => !remove.has(k)); rerender()
  });
  const moveField = delta => {
    const sel = selectedValues('ganttFieldsDisplayed');
    if (sel.length!==1)return;
    const i = layout.fields.indexOf(sel[0]),
    j = Math.max(0, Math.min(layout.fields.length - 1, i + delta));
    if (i===j)return;
    const[x] = layout.fields.splice(i, 1);
    layout.fields.splice(j, 0, x);
    rerender()
  };
  $('ganttFieldUp')?.addEventListener('click', () => moveField( - 1));
  $('ganttFieldDown')?.addEventListener('click', () => moveField(1));
  $('ganttFieldReset')?.addEventListener('click', () => {
    state.ganttLayouts[layoutKey] = freshGanttLayout(layoutKey); rerender()
  });
  $('ganttApplyStyle')?.addEventListener('click', () => {
    layout.bars = {
      ...layout.bars, showBaseline: $('ganttShowBaseline')?.checked, showActual: $('ganttShowActual')?.checked, showProgress: $('ganttShowProgress')?.checked, showDataDate: $('ganttShowDataDate')?.checked, groupWbs: $('ganttGroupWbs')?.checked, labelMode: $('ganttBarLabel')?.value || 'none', normalColor: $('ganttNormalColor')?.value || '#2b78a8', criticalColor: $('ganttCriticalColor')?.value || '#c63535', baselineColor: $('ganttBaselineColor')?.value || '#7f8f99', progressColor: $('ganttProgressColor')?.value || '#5aa874', barHeight: Number($('ganttBarHeight')?.value || 12)
    }; rerender()
  });
  $('ganttResetStyle')?.addEventListener('click', () => {
    layout.bars = {
      ...freshGanttLayout(layoutKey).bars
    }; rerender()
  });
  panel.querySelectorAll('[data-wbs-summary]').forEach(summary => summary.addEventListener('dblclick', e => {
    e.preventDefault(); const id = String(summary.dataset.wbsSummary || ''), node = summary.closest('.gantt-wbs-node'); if (!id || !node)return; node.classList.toggle('collapsed'); const set = new Set((state.ganttCollapsed[layoutKey] || []).map(String)); node.classList.contains('collapsed')? set.add(id): set.delete(id); state.ganttCollapsed[layoutKey] = [...set]; localStorage.setItem(`pcai.ganttCollapsed.${layoutKey}`, JSON.stringify(state.ganttCollapsed[layoutKey])); const twist = summary.querySelector('.gantt-wbs-twist'); if (twist)twist.textContent = node.classList.contains('collapsed')? '▸': '▾'; scheduleRedraw();
  }));
  g.closest('.gantt-wrap')?.addEventListener('scroll', scheduleRedraw, {
    passive: true
  });
  window.addEventListener('resize', scheduleRedraw, {
    once: true
  });
  requestAnimationFrame(drawLinks);
}
function bindNetworkZoom() {
  const widget = document.querySelector('[data-network-widget]');
  if (!widget)return;
  const canvas = widget.querySelector('.network-canvas'),
  svg = canvas?.querySelector('svg'),
  label = widget.querySelector('.network-zoom-label');
  if (!canvas || !svg)return;
  const baseW = parseFloat(canvas.style.width) || 900,
  baseH = parseFloat(canvas.style.height) || 500;
  let zoom = Number(widget.dataset.zoom || 1);
  const apply = () => {
    zoom = Math.max(.4, Math.min(2.5, zoom));
    widget.dataset.zoom = String(zoom);
    canvas.style.width = `${baseW * zoom}px`;
    canvas.style.height = `${baseH * zoom}px`;
    svg.style.transform = `scale(${zoom})`;
    svg.style.transformOrigin = '0 0';
    if (label)label.textContent = `${Math.round(zoom * 100)}%`
  };
  widget.querySelectorAll('[data-net-zoom]').forEach(b => b.onclick = () => {
    const action = b.dataset.netZoom; zoom = action==='in'? zoom + .15: action==='out'? zoom - .15: 1; apply()
  });
  apply();
}
function bindAssessmentControls(s) {
  bindResizableTables($("reportBody"));
  $("reportBody")?.querySelectorAll("[data-inspect-activity]").forEach(el => el.addEventListener("click", () => {
    state.inspectorActivityId = el.dataset.inspectActivity; state.assessmentReport = "inspector"; renderAssessment();
  }));
  // Interactive charts emit a semantic selection event. Reports can use it to
  // open the corresponding evidence rather than leaving charts decorative.
  $("reportBody")?.addEventListener("chartselect", event => {
    const label = String(event.detail?.label || "");
    if (!label) return;
    if (state.assessmentReport === "week") {
      const l = label.toLowerCase();
      if (l.includes("progress")) state.weekChangeFilter = "progress";
      else if (l.includes("actual")) state.weekChangeFilter = "actuals";
      else if (l.includes("start") || l.includes("finish") || l.includes("date")) state.weekChangeFilter = "dates";
      else if (l.includes("added")) state.weekChangeFilter = "added";
      else if (l.includes("deleted") || l.includes("removed")) state.weekChangeFilter = "deleted";
      renderAssessment();
      return;
    }
    // Forensic/window chart labels are revision-transition labels. Open the
    // matching evidence block in-place when one exists.
    const blocks = [...$("reportBody").querySelectorAll("details.forensic-transition-box")];
    const block = blocks.find(d => String(d.querySelector("summary strong")?.textContent || "").includes(label));
    if (block) { block.open = true; block.scrollIntoView({ behavior: "smooth", block: "start" }); }
  });
  if (state.assessmentReport==="activities" && s) {
    mountVirtualActivities($("virtualActivities"), s.activities);
    $("copyToBuilder")?.addEventListener("click", () => {
      const bySucc = new Map(); for (const r of s.relationships || []) {
        if (!bySucc.has(r.succId))bySucc.set(r.succId, []); bySucc.get(r.succId).push(r)
      }
      state.builderRows = s.activities.map(a => ( {
        id: a.id, name: a.name, wbs: a.wbsPath || "", start: isoDate(a.currentStart || a.start), finish: isoDate(a.currentFinish || a.finish), duration: Number(a.originalDuration || 0), predecessors: (bySucc.get(a.id) || []).map(r => `${r.predId}:${r.type || "FS"}${Number(r.lag || 0)? `${Number(r.lag)>0? "+": ""}${Number(r.lag)}d`: ""}`).join(", "), milestone: isMilestoneActivity(a)
      })); localStorage.setItem("pcai.builder", JSON.stringify(state.builderRows)); state.view = "builder"; render(); toast(`Loaded ${state.builderRows.length} activities into Schedule Builder`)
    })
  }
  const pair = (prefix, aKey, bKey) => {
    $(`${prefix}A`)?.addEventListener('change', e => {
      state[aKey] = e.target.value; renderAssessment()
    });
    $(`${prefix}B`)?.addEventListener('change', e => {
      state[bKey] = e.target.value; renderAssessment()
    })
  };
  if (state.assessmentReport==="inspector") $("inspectorActivity")?.addEventListener("change", e => { state.inspectorActivityId = e.target.value; renderAssessment(); });
  if (state.assessmentReport==="issues") {
    $("issueFilter")?.addEventListener("change", e => { state.issueFilter = e.target.value; renderAssessment(); });
    $("issueAdd")?.addEventListener("click", () => { state.issueRows.push({ id: uid("issue"), severity: "Medium", category: "Manual", activity: "", issue: "", owner: "", status: "Open", comment: "", source: s?.sourceName || s?.name || "Manual", createdAt: new Date().toISOString() }); persistIssueRows(); renderAssessment(); });
    $("issueFromDcma")?.addEventListener("click", () => { const count = addDcmaFailuresToIssues(s); toast(`${count} DCMA issue${count===1?"":"s"} added`); renderAssessment(); });
    $("issueExport")?.addEventListener("click", () => downloadBlob(new Blob([toCSV(["Severity","Category","Activity / Relationship","Issue","Owner","Status","Comment","Source"], (state.issueRows || []).map(r => [r.severity,r.category,r.activity,r.issue,r.owner,r.status,r.comment,r.source]))], {type:"text/csv"}), "schedule-issue-register.csv"));
    document.querySelectorAll("[data-issue]").forEach(el => el.addEventListener("change", () => { const [i,key] = el.dataset.issue.split(":"); if (state.issueRows[Number(i)]) { state.issueRows[Number(i)][key] = el.value; persistIssueRows(); } }));
    document.querySelectorAll("[data-del-issue]").forEach(el => el.addEventListener("click", () => { state.issueRows.splice(Number(el.dataset.delIssue), 1); persistIssueRows(); renderAssessment(); }));
  }
  if (state.assessmentReport === "dcma") {
    $("qaProfileSelect")?.addEventListener("change", e => {
      state.qaProfileId = e.target.value || DEFAULT_QA_PROFILE_ID;
      state.qaCustomThresholds = {};
      localStorage.setItem("pcai.qaProfileId", state.qaProfileId);
      localStorage.removeItem("pcai.qaCustomThresholds");
      renderAssessment();
    });
    $("qaProfileReset")?.addEventListener("click", () => {
      state.qaCustomThresholds = {};
      localStorage.removeItem("pcai.qaCustomThresholds");
      renderAssessment();
    });
    $("qaProfileEdit")?.addEventListener("click", () => { state.view = "settings"; render(); requestAnimationFrame(() => $("qaProfileSettings")?.scrollIntoView({behavior:"smooth"})); });
  }
  if (state.assessmentReport==="dcma") $("dcmaAddIssues")?.addEventListener("click", () => { const count = addDcmaFailuresToIssues(s); toast(`${count} DCMA issue${count===1?"":"s"} added`); });
  if (state.assessmentReport==="progress-integrity") $("progressIntegrityFilter")?.addEventListener("change", e => { state.progressIntegrityFilter = e.target.value; renderAssessment(); });
  if (state.assessmentReport==="floatpaths") $("floatPathCount")?.addEventListener("change", e => { state.floatPathCount = Number(e.target.value || 5); renderAssessment(); });
  if (state.assessmentReport==="comparison")pair('comparison', 'comparisonAId', 'comparisonBId');
  if (state.assessmentReport==="week") {
    pair('week', 'weekAId', 'weekBId');
    $("weekChangeFilter")?.addEventListener("change", e => { state.weekChangeFilter = e.target.value; renderAssessment(); });
    $("weekWbsFilter")?.addEventListener("change", e => { state.weekWbsFilter = e.target.value; renderAssessment(); });
  }
  if (state.assessmentReport==="delay")pair('delay', 'delayAId', 'delayBId');
  if (state.assessmentReport==="logicdiff") pair('logicDiff', 'logicAId', 'logicBId');
  if (state.assessmentReport==="calendardiff") pair('calendarDiff', 'calendarDiffAId', 'calendarDiffBId');
  if (state.assessmentReport==="resourceforensics") pair('resourceForensic', 'resourceForensicAId', 'resourceForensicBId');
  if (state.assessmentReport==="windows") state.windowsScheduleIds.forEach((_, i) => $(`windowsSlot${i}`)?.addEventListener('change', e => {
    state.windowsScheduleIds[i] = e.target.value; renderAssessment();
  }));
  if (state.assessmentReport==="baseline") {
    $("baselineCurrent")?.addEventListener("change", e => { state.baselineCurrentId = e.target.value; renderAssessment(); });
    state.baselineSlots.forEach((_, i) => $(`baselineSlot${i}`)?.addEventListener("change", e => {
      state.baselineSlots[i] = e.target.value;
      localStorage.setItem("pcai.baselineSlots", JSON.stringify(state.baselineSlots));
      renderAssessment();
    }));
  }
  if (state.assessmentReport==="forensic") {
    state.forensicScheduleIds.forEach((_, i) => $(`forensicSlot${i}`)?.addEventListener('change', e => {
      state.forensicScheduleIds[i] = e.target.value; renderAssessment();
    }));
    $("forensicMatrixSearch")?.addEventListener("input", e => { state.forensicMatrixSearch = e.target.value; });
    $("forensicMatrixSearch")?.addEventListener("change", () => renderAssessment());
    $("exportEvidencePack")?.addEventListener("click", async () => {
      const button = $("exportEvidencePack");
      const ordered = state.forensicScheduleIds.map(scheduleById).filter(Boolean).sort((a,b) => (parseDate(a.dataDate)?.getTime()||0) - (parseDate(b.dataDate)?.getTime()||0));
      if (!ordered.length) return toast("Select at least one schedule first");
      if (button) { button.disabled = true; button.textContent = "Building evidence pack…"; }
      try {
        const sourceBlobs = {};
        for (const schedule of ordered) {
          const fileId = schedule.sourceFileId || state.files.find(f => f.name === schedule.sourceName)?.id;
          if (fileId) { try { sourceBlobs[schedule.id] = await getFileBlob(fileId); } catch (_) {} }
        }
        const pack = await buildEvidencePack({ schedules: ordered, activeSchedule: ordered.at(-1), issues: state.issueRows, claims: state.claims, sourceBlobs, qaProfile: currentQaProfile() });
        downloadBlob(pack.blob, `forensic-evidence-pack-${isoDate(new Date()) || "export"}.zip`);
        toast("Forensic evidence pack exported");
      } catch (error) { alert(`Evidence pack failed: ${error?.message || error}`); }
      finally { if (button) { button.disabled = false; button.textContent = "Export Evidence Pack ZIP"; } }
    });
  }
  if (state.assessmentReport==="timemachine")state.timeMachineScheduleIds.forEach((_, i) => $(`timeSlot${i}`)?.addEventListener('change', e => {
    state.timeMachineScheduleIds[i] = e.target.value; renderAssessment()
  }));
  if (state.assessmentReport==="scurve") {
    $("scurveBasis")?.addEventListener('change', e => {
      state.scurveBasis = e.target.value; state.scurveStartDate = ""; state.scurveFinishDate = ""; renderAssessment()
    });
    $("scurveResource")?.addEventListener('change', e => {
      state.scurveResourceId = e.target.value; state.scurveStartDate = ""; state.scurveFinishDate = ""; renderAssessment()
    });
    $("scurveStartDate")?.addEventListener('change', e => {
      state.scurveStartDate = e.target.value; renderAssessment()
    });
    $("scurveFinishDate")?.addEventListener('change', e => {
      state.scurveFinishDate = e.target.value; renderAssessment()
    });
    for (const[id, key]of[["scurvePlanned", "planned"], ["scurveActual", "actual"], ["scurveForecast", "forecast"]])$(id)?.addEventListener('change', e => {
      state.scurveSeries[key] = e.target.checked; renderAssessment()
    });
    document.querySelectorAll('[data-scurve-resource]').forEach(x => x.addEventListener('change', () => {
      state.scurveResourceIds = [...document.querySelectorAll('[data-scurve-resource]:checked')].map(y => y.dataset.scurveResource); state.scurveStartDate = ""; state.scurveFinishDate = ""; renderAssessment()
    }));
    $("scurveAllResources")?.addEventListener('click', () => {
      state.scurveResourceIds = []; state.scurveStartDate = ""; state.scurveFinishDate = ""; renderAssessment()
    });
    $("scurveNoResources")?.addEventListener('click', () => {
      state.scurveResourceIds = ["__NONE__"]; state.scurveStartDate = ""; state.scurveFinishDate = ""; renderAssessment()
    });
    const shiftRange = weeks => {
      const a = parseDate($("scurveStartDate")?.value),
      b = parseDate($("scurveFinishDate")?.value);
      if (!a || !b)return;
      state.scurveStartDate = isoDate(addDays(a, - weeks * 7));
      state.scurveFinishDate = isoDate(addDays(b, weeks * 7));
      renderAssessment()
    };
    $("scurveExpand")?.addEventListener('click', () => shiftRange(4));
    $("scurveContract")?.addEventListener('click', () => {
      const a = parseDate($("scurveStartDate")?.value), b = parseDate($("scurveFinishDate")?.value); if (!a || !b || daysBetween(a, b)<=56)return; state.scurveStartDate = isoDate(addDays(a, 28)); state.scurveFinishDate = isoDate(addDays(b, - 28)); renderAssessment()
    });
    $("scurveFullRange")?.addEventListener('click', () => {
      state.scurveStartDate = ""; state.scurveFinishDate = ""; renderAssessment()
    });
  }
  if (state.assessmentReport==="whymove") {
    $("whyActivity")?.addEventListener("change", e => {
      state.whyActivityId = e.target.value; renderAssessment()
    });
    $("whyPrev")?.addEventListener("change", e => {
      state.previousScheduleId = e.target.value || null; renderAssessment()
    });
  }
  if (state.assessmentReport==="narrative")$("narrativePrev")?.addEventListener("change", e => {
    state.previousScheduleId = e.target.value || null; renderAssessment()
  });
  if ((state.assessmentReport==="gantt" || state.assessmentReport==="critical") && s) {
    $("ganttTimescale")?.addEventListener("change", e => {
      state.ganttTimescale = e.target.value; renderAssessment()
    });
    $("ganttCompression")?.addEventListener("change", e => {
      state.ganttCompression = e.target.value; renderAssessment()
    });
    $("ganttRelationships")?.addEventListener("change", e => {
      state.ganttRelationships = e.target.checked; renderAssessment()
    });
    const startKey = state.assessmentReport==="critical"? "criticalStartDate": "ganttStartDate",
    finishKey = state.assessmentReport==="critical"? "criticalFinishDate": "ganttFinishDate";
    $("ganttStartDate")?.addEventListener("change", e => {
      state[startKey] = e.target.value; if (state[finishKey] && state[startKey]>state[finishKey])state[finishKey] = state[startKey]; renderAssessment()
    });
    $("ganttFinishDate")?.addEventListener("change", e => {
      state[finishKey] = e.target.value; if (state[startKey] && state[finishKey]<state[startKey])state[startKey] = state[finishKey]; renderAssessment()
    });
    $("ganttResetRange")?.addEventListener("click", () => {
      state[startKey] = ""; state[finishKey] = ""; renderAssessment()
    });
    const layoutKind = state.assessmentReport === "critical" ? "critical" : "wbs";
    $("loadNamedGanttLayout")?.addEventListener("click", () => {
      const name = $("namedGanttLayout")?.value || "";
      const saved = (state.namedGanttLayouts[layoutKind] || []).find(x => x.name === name);
      if (!saved) return;
      state.ganttLayouts[layoutKind] = JSON.parse(JSON.stringify(saved.layout));
      state.activeNamedGanttLayout[layoutKind] = name;
      saveGanttLayout(layoutKind);
      renderAssessment();
    });
    $("saveNamedGanttLayout")?.addEventListener("click", () => {
      const proposed = prompt("Layout name", state.activeNamedGanttLayout[layoutKind] || "")?.trim();
      if (!proposed) return;
      const rows = [...(state.namedGanttLayouts[layoutKind] || [])];
      const record = { name: proposed, layout: JSON.parse(JSON.stringify(state.ganttLayouts[layoutKind] || freshGanttLayout(layoutKind))) };
      const idx = rows.findIndex(x => x.name.toLowerCase() === proposed.toLowerCase());
      if (idx >= 0) rows[idx] = record; else rows.push(record);
      rows.sort((a,b) => a.name.localeCompare(b.name));
      state.namedGanttLayouts[layoutKind] = rows;
      state.activeNamedGanttLayout[layoutKind] = proposed;
      saveNamedGanttLayouts(layoutKind, rows);
      toast(`Saved layout: ${proposed}`);
      renderAssessment();
    });
    $("deleteNamedGanttLayout")?.addEventListener("click", () => {
      const name = $("namedGanttLayout")?.value || state.activeNamedGanttLayout[layoutKind] || "";
      if (!name || !confirm(`Delete saved layout “${name}”?`)) return;
      const rows = (state.namedGanttLayouts[layoutKind] || []).filter(x => x.name !== name);
      state.namedGanttLayouts[layoutKind] = rows;
      state.activeNamedGanttLayout[layoutKind] = "";
      saveNamedGanttLayouts(layoutKind, rows);
      renderAssessment();
    });
    $("namedGanttLayout")?.addEventListener("change", e => { state.activeNamedGanttLayout[layoutKind] = e.target.value; });
    bindGanttInteractions(s);
  }
  if (state.assessmentReport==="network") {
    $("traceActivity")?.addEventListener("change", e => {
      state.traceActivityId = e.target.value; renderAssessment()
    });
    bindNetworkZoom()
  }
  if (state.assessmentReport==="timemachine")$("timeActivity")?.addEventListener("change", e => {
    state.timeActivityId = e.target.value; renderAssessment()
  });
}
function mountVirtualActivities(container, activities) {
  if (!container)return;
  const rowH = 32,
  headerH = 32,
  total = activities.length,
  key = "pcai.activityRegisterWidths",
  defaults = [120, 320, 180, 110, 110, 75, 75];
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(key) || "[]")
  } catch (_) {
    saved = []
  }
  const cols = defaults.map((w, i) => Math.max(60, Number(saved[i]) || w));
  container.style.setProperty("--va-cols", cols.map(x => `${x}px`).join(" "));
  const labels = ["ID", "Activity", "WBS", "Start", "Finish", "TF", "%"];
  const totalWidth = () => cols.reduce((a, b) => a + b, 0),
  apply = () => {
    container.style.setProperty("--va-cols", cols.map(x => `${Math.round(x)}px`).join(" "));
    if (container.firstElementChild)container.firstElementChild.style.minWidth = `${totalWidth()}px`
  };
  container.innerHTML = `<div style="height:${headerH + total * rowH}px;position:relative;min-width:${totalWidth()}px"><div class="virtual-header">${labels.map((x, i) => `<strong>${x}<span class="virtual-resizer" data-vcol="${i}" role="separator" aria-orientation="vertical" aria-label="Resize ${esc(x)} column" title="Drag to resize column"></span></strong>`).join("")}</div><div id="virtualRows"></div></div>`;
  const rows = container.querySelector("#virtualRows");
  const paint = () => {
    const top = container.scrollTop,
    from = Math.max(0, Math.floor((top - headerH) / rowH) - 8),
    count = Math.ceil(container.clientHeight / rowH) + 16,
    to = Math.min(total, from + count);
    rows.innerHTML = activities.slice(from, to).map((a, i) => `<div class="virtual-row" style="top:${headerH + (from + i) * rowH}px"><span>${esc(a.id)}</span><span title="${esc(a.name)}">${esc(a.name)}</span><span title="${esc(a.wbsPath)}">${esc(a.wbsPath)}</span><span>${isoDate(a.currentStart || a.start)}</span><span>${isoDate(a.currentFinish || a.finish)}</span><span>${a.totalFloat.toFixed(1)}</span><span>${a.percent.toFixed(1)}</span></div>`).join("");
  };
  container.querySelectorAll(".virtual-resizer").forEach(handle => handle.onpointerdown = e => {
    if (e.button!=null && e.button!==0)return; e.preventDefault(); e.stopPropagation(); const i = Number(handle.dataset.vcol), startX = e.clientX, startW = cols[i]; handle.setPointerCapture?.(e.pointerId); document.documentElement.classList.add("resizing-column"); const move = ev => {
      cols[i] = Math.max(60, startW + ev.clientX - startX); apply()
    }; const up = () => {
      document.documentElement.classList.remove("resizing-column"); localStorage.setItem(key, JSON.stringify(cols.map(Math.round))); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up)
    }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up)
  });
  container.onscroll = paint;
  paint();
}
function exportVisibleTables() {
  const tables = [...$("workspace").querySelectorAll("table")];
  if (!tables.length) {
    alert("This report does not contain a table to export.");
    return
  }
  const blocks = tables.map((tbl, ti) => {
    const rows = [...tbl.querySelectorAll("tr")].map(tr => [...tr.children].map(td => td.innerText.trim())); return[`Report Table ${ti + 1}`, ...rows.map(r => r.map(v => String(v).replace(/\t/g, " ")).join("\t"))].join("\n");
  });
  downloadBlob(new Blob([blocks.join("\n\n")], {
    type: "text/tab-separated-values"
  }), `${state.assessmentReport}-report.tsv`);
}
function fieldFrom(row, names, def = "") {
  for (const n of names)if (row[n]!=null && String(row[n]).trim()!=="")return row[n];
  const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ""), v]));
  for (const n of names) {
    const k = n.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (lower[k]!=null && String(lower[k]).trim()!=="")return lower[k]
  }
  return def
}
async function importRiskCsv(file) {
  const rows = csvObjects(await file.text()),
  existing = new Map(state.risks.map(r => [String(r.code || "").toLowerCase(), r]));
  let count = 0;
  for (const row of rows) {
    const code = String(fieldFrom(row, ["ID", "Code", "Risk ID"], `R-${String(state.risks.length + count + 1).padStart(3, "0")}`)).trim(),
    old = existing.get(code.toLowerCase());
    await saveRisk( {
      ...(old || {
      }), code, title: fieldFrom(row, ["Risk", "Title", "Risk Title"]), probability: Number(fieldFrom(row, ["Probability", "Probability %", "ProbabilityPct"], 0)) || 0, impactDays: Number(fieldFrom(row, ["Impact Days", "ImpactDays", "Impact"], 0)) || 0, activityIds: String(fieldFrom(row, ["Activity IDs", "ActivityIDs", "Mapped Activities"], "")).split(/[;,]/).map(x => x.trim()).filter(Boolean), mitigation: fieldFrom(row, ["Mitigation", "Response"], "")
    });
    count++
  }
  await refreshData();
  return count
}
function exportRiskCsv() {
  const rows = state.risks.map(r => [r.code || r.id, r.title || "", Number(r.probability || 0), Number(r.impactDays || 0), (r.activityIds || []).join(";"), r.mitigation || ""]);
  downloadBlob(new Blob([toCSV(["ID", "Risk", "Probability %", "Impact Days", "Activity IDs", "Mitigation"], rows)], {
    type: "text/csv"
  }), "risk-register.csv")
}
async function importClaimCsv(file) {
  const rows = csvObjects(await file.text()),
  existing = new Map(state.claims.map(r => [String(r.code || "").toLowerCase(), r]));
  let count = 0;
  for (const row of rows) {
    const code = String(fieldFrom(row, ["ID", "Code", "Event ID"], `CE-${String(state.claims.length + count + 1).padStart(3, "0")}`)).trim(),
    old = existing.get(code.toLowerCase());
    await saveClaim( {
      ...(old || {
      }), code, title: fieldFrom(row, ["Event", "Title", "Event Title"]), date: fieldFrom(row, ["Date", "Event Date"], ""), description: fieldFrom(row, ["Description", "Narrative"], ""), category: fieldFrom(row, ["Category", "Change Category"], old?.category || ""), impactDays: Number(fieldFrom(row, ["Impact Days", "Delay Days", "Movement Days"], old?.impactDays || 0)) || 0, source: fieldFrom(row, ["Source", "Identification Source"], old?.source || ""), activityIds: String(fieldFrom(row, ["Activity IDs", "ActivityIDs", "Activities"], "")).split(/[;,]/).map(x => x.trim()).filter(Boolean), milestoneId: fieldFrom(row, ["Milestone ID", "MilestoneID"], ""), notice: fieldFrom(row, ["Notice", "Notice Ref", "Correspondence"], ""), instruction: fieldFrom(row, ["Instruction", "Instruction Ref"], "")
    });
    count++
  }
  await refreshData();
  return count
}
function exportClaimCsv() {
  const rows = state.claims.map(c => [c.code || c.id, c.title || "", c.date || "", c.category || "", Number(c.impactDays || 0), c.description || "", (c.activityIds || []).join(";"), c.milestoneId || "", c.notice || "", c.instruction || "", c.source || ""]);
  downloadBlob(new Blob([toCSV(["ID", "Event", "Date", "Category", "Impact Days", "Description", "Activity IDs", "Milestone ID", "Notice", "Instruction", "Source"], rows)], {
    type: "text/csv"
  }), "claims-forensics-events.csv")
}
// -----------------------------------------------------------------------------
// Risk and claims / forensic workflows
// -----------------------------------------------------------------------------
function renderRisk() {
  const s = activeSchedule();
  const risks = s? state.risks.map(r => mapRiskToSchedule(r, s)): state.risks.map(r => ( {
    ...r, activities: []
  }));
  $("workspace").innerHTML = `${viewHead("Risk Analysis", "Risk register, schedule mapping, QSRA, criticality and mitigation", `<input id="riskCsvInput" type="file" accept=".csv,text/csv" hidden><button class="btn" id="riskImportCsv">Import CSV</button><button class="btn" id="riskExportCsv">Export CSV</button><button class="btn primary" id="runMonte" ${s? "": "disabled"}>Run Monte Carlo</button>`)}
  <div class="grid grid2"><section class="panel"><h2>Risk Register</h2>${table(["ID", "Risk", "Probability", "Impact days", "Mapped activities", "Mitigation"], risks.map(r => [esc(r.code || r.id), esc(r.title), `${Number(r.probability || 0)}%`, Number(r.impactDays || 0), r.activities.map(a => esc(a.id)).join(", "), esc(r.mitigation || "")]))}
  <form id="riskForm" class="form"><label>Risk title<input name="title" required></label><label>Probability %<input name="probability" type="number" min="0" max="100" value="30"></label><label>Impact days<input name="impactDays" type="number" value="10"></label><label>Activity IDs (comma separated)<input name="activityIds"></label><label>Mitigation<textarea name="mitigation"></textarea></label><button class="btn primary">Add Risk</button></form></section>
  <section class="panel"><h2>Quantitative Schedule Risk Analysis</h2>${!s? `<div class="muted">Import/select a schedule to run Monte Carlo analysis. The risk register and CSV import/export remain available without a schedule.</div>`: state.monte? renderMonte(state.monte): `<div class="muted">Run Monte Carlo to calculate P10/P50/P80/P90 and criticality.</div>`}</section></div>`;
  $("riskForm").onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await saveRisk( {
      code: `R-${String(state.risks.length + 1).padStart(3, "0")}`, title: fd.get("title"), probability: Number(fd.get("probability")), impactDays: Number(fd.get("impactDays")), activityIds: String(fd.get("activityIds") || "").split(",").map(x => x.trim()).filter(Boolean), mitigation: fd.get("mitigation")
    });
    await refreshData();
    renderRisk()
  };
  $("riskExportCsv").onclick = exportRiskCsv;
  $("riskImportCsv").onclick = () => $("riskCsvInput").click();
  $("riskCsvInput").onchange = async e => {
    const file = e.target.files?.[0];
    if (!file)return;
    try {
      const n = await importRiskCsv(file);
      toast(`Imported ${n} risk row(s)`);
      renderRisk()
    } catch (error) {
      alert(`Risk CSV import failed: ${error.message}`)
    }
    e.target.value = ""
  };
  if ($("runMonte") && s)$("runMonte").onclick = async() => {
    await withProgress("Running Monte Carlo", async() => {
      state.monte = await runMonteWorker(s, {
        iterations: 2000, seed: 42, uncertainty: .2
      })
    });
    renderRisk()
  };
}
function renderMonte(m) {
  if (m.error)return`<div class="badge danger">${esc(m.error)}</div>`;
  return`<div class="metrics" style="grid-template-columns:repeat(4,1fr)">${metric("P10", `${m.p10.toFixed(1)}d`)}${metric("P50", `${m.p50.toFixed(1)}d`)}${metric("P80", `${m.p80.toFixed(1)}d`)}${metric("P90", `${m.p90.toFixed(1)}d`)}</div>${table(["Activity", "Criticality"], m.criticality.slice(0, 30).map(x => [esc(x.id), `${x.probability.toFixed(1)}%`]))}`;
}
async function runMonteWorker(schedule, options) {
  if (typeof Worker==="undefined")return runMonteCarlo(schedule, options);
  return await new Promise((resolve, reject) => {
    const w = new Worker(new URL("../workers/montecarlo-worker.js", import.meta.url), {
      type: "module"
    }), id = uid("mc"); w.onmessage = e => {
      if (e.data.id!==id)return; w.terminate(); e.data.ok? resolve(e.data.result): reject(new Error(e.data.error))
    }; w.onerror = e => {
      w.terminate(); reject(e.error || new Error(e.message))
    }; w.postMessage( {
      id, schedule, options
    });
  });
}
function delayCandidateMarkup() {
  if (!state.identifiedDelayEvents.length)return`<div class="empty-state">Select two schedules and click <strong>Identify delay events</strong>. Candidate events will be generated from confirmed schedule-data changes and can be edited before being added to the register.</div>`;
  return`<div class="delay-candidate-toolbar"><label><input type="checkbox" id="delaySelectAll" ${state.identifiedDelayEvents.every(x => x.selected!==false)? "checked": ""}> Select all</label><span class="muted">${state.identifiedDelayEvents.length} candidate event(s)</span><button class="btn primary" id="addDelayCandidates">Add selected to Delay Event Register</button><button class="btn" id="clearDelayCandidates">Clear candidates</button></div><div class="delay-candidate-list">${state.identifiedDelayEvents.map((e, i) => `<article class="delay-candidate ${e.selected===false? "not-selected": ""}" data-delay-candidate="${i}"><div class="delay-candidate-head"><label><input type="checkbox" data-delay-select="${i}" ${e.selected===false? "": "checked"}> Include</label><strong>${esc((e.activityIds || []).join(", ") || e.source || "Schedule change")}</strong><span class="badge ${Number(e.impactDays || 0)>0? "danger": ""}">${Number(e.impactDays || 0).toFixed(1)}d movement</span></div><div class="delay-candidate-grid"><label>Event title<input data-delay-field="${i}:title" value="${esc(e.title || "")}"></label><label>Event date<input type="date" data-delay-field="${i}:date" value="${esc(e.date || "")}"></label><label>Category<input data-delay-field="${i}:category" value="${esc(e.category || "")}"></label><label>Impact / movement days<input type="number" step="0.1" data-delay-field="${i}:impactDays" value="${Number(e.impactDays || 0)}"></label><label class="delay-description">Description<textarea data-delay-field="${i}:description">${esc(e.description || "")}</textarea></label></div></article>`).join("")}</div>`;
}
/**
 * Claims & Forensics workspace. Deterministic schedule observations can be
 * promoted into editable delay-event register entries, but the toolkit does not
 * infer contractual causation or entitlement.
 */
function renderClaims() {
  const s = activeSchedule(),
  a = scheduleById(state.claimCompareAId),
  b = scheduleById(state.claimCompareBId),
  canIdentify = a && b && a.id!==b.id;
  $("workspace").innerHTML = `${viewHead("Claims & Forensics", "Delay-event chronology, schedule evidence, notices and forensic evidence packs", `<input id="claimCsvInput" type="file" accept=".csv,text/csv" hidden><button class="btn" id="claimImportCsv">Import CSV</button><button class="btn" id="claimExportCsv">Export CSV</button>`)}
  <div class="grid grid2"><section class="panel"><h2>Delay / Change Event Register</h2>${table(["ID", "Event", "Date", "Category", "Movement", "Activities", "Notice"], state.claims.map(c => [esc(c.code || c.id), esc(c.title), esc(c.date || ""), esc(c.category || "—"), Number(c.impactDays || 0)? `${Number(c.impactDays).toFixed(1)}d`: "—", esc((c.activityIds || []).join(", ")), esc(c.notice || "")]))}
  <form id="claimForm" class="form"><label>Event title<input name="title" required></label><label>Event date<input name="date" type="date"></label><label>Category<input name="category" placeholder="e.g. Late start / calendar / resource"></label><label>Impact / movement days<input name="impactDays" type="number" step="0.1" value="0"></label><label>Description<textarea name="description"></textarea></label><label>Affected activity IDs<input name="activityIds" placeholder="A100, A200"></label><label>Milestone ID<input name="milestoneId"></label><label>Notice / correspondence ref<input name="notice"></label><label>Instruction ref<input name="instruction"></label><button class="btn primary">Add Event</button></form></section>
  <section class="panel"><h2>Evidence Pack Generator</h2>${s? "": `<div class="analysis-warning">Import/select a schedule to generate a schedule evidence pack. Event CSV import/export remains available.</div>`}<select id="claimSelect"><option value="">Select event</option>${state.claims.map(c => `<option value="${c.id}">${esc(c.code || c.id)} · ${esc(c.title)}</option>`).join("")}</select><button class="btn" id="buildClaim" ${s? "": "disabled"}>Generate Delay Event File</button><div id="claimResult" style="margin-top:10px"></div></section></div>
  <section class="panel identify-delay-events"><div class="gantt-title-row"><div><h2>Identify Delay Events</h2><p class="muted">Compare two explicitly selected schedules. The toolkit proposes editable events from activity additions/removals, later starts/finishes, duration increases, calendar changes, resource/loading changes, constraint changes and relationship/logic changes. These are schedule-data observations, not contractual entitlement conclusions.</p></div><button class="btn" id="claimsImportSchedules" type="button">Import schedule files</button></div><div class="filterbar comparison-selectors"><label>Earlier / reference schedule ${scheduleSelector("claimCompareA", state.claimCompareAId, {
    blank: "Select earlier schedule…"
  })}</label><label>Later / comparison schedule ${scheduleSelector("claimCompareB", state.claimCompareBId, {
    blank: "Select later schedule…"
  })}</label><button class="btn primary" id="identifyDelayEvents" ${canIdentify? "": "disabled"}>Identify delay events</button></div>${a && b && a.id===b.id? `<div class="analysis-warning">Choose two different schedules.</div>`: ""}${delayCandidateMarkup()}</section>`;
  $("claimForm").onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await saveClaim( {
      code: `CE-${String(state.claims.length + 1).padStart(3, "0")}`, title: fd.get("title"), date: fd.get("date"), category: fd.get("category"), impactDays: Number(fd.get("impactDays") || 0), description: fd.get("description"), activityIds: String(fd.get("activityIds") || "").split(",").map(x => x.trim()).filter(Boolean), milestoneId: fd.get("milestoneId"), notice: fd.get("notice"), instruction: fd.get("instruction")
    });
    await refreshData();
    renderClaims()
  };
  $("claimExportCsv").onclick = exportClaimCsv;
  $("claimImportCsv").onclick = () => $("claimCsvInput").click();
  $("claimCsvInput").onchange = async e => {
    const file = e.target.files?.[0];
    if (!file)return;
    try {
      const n = await importClaimCsv(file);
      toast(`Imported ${n} claim/event row(s)`);
      renderClaims()
    } catch (error) {
      alert(`Claims CSV import failed: ${error.message}`)
    }
    e.target.value = ""
  };
  if ($("buildClaim") && s)$("buildClaim").onclick = async() => {
    const c = state.claims.find(x => x.id===$("claimSelect").value);
    if (!c)return;
    const pack = buildDelayEventFile( {
      event: c, current: s, previous: previousSchedule(), documents: state.files
    });
    $("claimResult").innerHTML = `<pre style="white-space:pre-wrap">${esc(JSON.stringify(pack, null, 2).slice(0, 30000))}</pre><button class="btn" id="downloadPack">Download JSON</button>`;
    $("downloadPack").onclick = () => downloadBlob(new Blob([JSON.stringify(pack, null, 2)], {
      type: "application/json"
    }), `${c.code || "delay-event"}.json`)
  };
  $("claimCompareA")?.addEventListener("change", e => {
    state.claimCompareAId = e.target.value; state.identifiedDelayEvents = []; renderClaims()
  });
  $("claimCompareB")?.addEventListener("change", e => {
    state.claimCompareBId = e.target.value; state.identifiedDelayEvents = []; renderClaims()
  });
  $("claimsImportSchedules")?.addEventListener("click", () => $("fileInput")?.click());
  $("identifyDelayEvents")?.addEventListener("click", () => {
    const p = scheduleById(state.claimCompareAId), c = scheduleById(state.claimCompareBId); if (!p || !c || p.id===c.id)return; state.identifiedDelayEvents = identifyDelayEvents(p, c); renderClaims(); toast(`Identified ${state.identifiedDelayEvents.length} candidate delay event(s)`)
  });
  document.querySelectorAll("[data-delay-select]").forEach(x => x.onchange = () => {
    const i = Number(x.dataset.delaySelect); state.identifiedDelayEvents[i].selected = x.checked; x.closest(".delay-candidate")?.classList.toggle("not-selected", !x.checked)
  });
  document.querySelectorAll("[data-delay-field]").forEach(x => x.onchange = () => {
    const[i, k] = x.dataset.delayField.split(":"); state.identifiedDelayEvents[Number(i)][k] = x.type==="number"? Number(x.value): x.value
  });
  $("delaySelectAll")?.addEventListener("change", e => {
    state.identifiedDelayEvents.forEach(x => x.selected = e.target.checked); renderClaims()
  });
  $("clearDelayCandidates")?.addEventListener("click", () => {
    state.identifiedDelayEvents = []; renderClaims()
  });
  $("addDelayCandidates")?.addEventListener("click", async() => {
    const selected = state.identifiedDelayEvents.filter(x => x.selected!==false); if (!selected.length) {
      alert("Select at least one candidate event."); return
    }
    let n = state.claims.length; for (const e of selected) {
      n++; await saveClaim( {
        code: `CE-${String(n).padStart(3, "0")}`, title: e.title, date: e.date, category: e.category, impactDays: Number(e.impactDays || 0), description: e.description, activityIds: e.activityIds || [], source: e.source || "Schedule comparison", notice: "", instruction: ""
      })
    }
    state.identifiedDelayEvents = state.identifiedDelayEvents.filter(x => x.selected===false); await refreshData(); renderClaims(); toast(`Added ${selected.length} delay event(s) to the register`)
  });
}
const BUILDER_STEPS = ["Schedule Type", "Detail Level", "Specifications", "Disciplines", "Phases", "Responsibility Matrix", "Milestones", "Similar Schedules", "Reference Documents", "Reference Drawings", "Calendars", "Review & Generate"];
const BUILDER_DISCIPLINES = ["Project / General", "Civil / Structural", "Architectural", "Mechanical", "Electrical", "Instrumentation & Controls", "Process", "Fire Protection", "ICT / ELV", "Security", "Commissioning"];
const BUILDER_PHASES = ["Concept / Feasibility", "Design", "Procurement", "Off-site / Fabrication", "Construction", "Testing", "Commissioning", "Handover / Closeout"];
const BUILDER_ROLES = ["Client", "Project Manager", "Designer / Consultant", "Main Contractor", "Subcontractor", "Vendor / OEM", "Commissioning Agent", "Other"];
// -----------------------------------------------------------------------------
// Schedule Builder wizard and AI-assisted generation
// -----------------------------------------------------------------------------
function defaultBuilderWizard() {
  return {
    scheduleType: "Data Centre",
    detailLevel: "Level 4",
    specificationNotes: "",
    specFileIds: [],
    disciplines: ["Mechanical", "Electrical", "Commissioning"],
    phases: ["Design", "Procurement", "Construction", "Testing", "Commissioning", "Handover / Closeout"],
    responsibilities: {
    },
    projectStart: isoDate(new Date()),
    milestones: [ {
      name: "Project Start", date: isoDate(new Date())
    }, {
      name: "Construction Start", date: ""
    }, {
      name: "Mechanical Completion", date: ""
    }, {
      name: "Ready for Commissioning", date: ""
    }, {
      name: "Practical Completion / Handover", date: ""
    }],
    similarScheduleIds: [],
    referenceFileIds: [],
    drawingFileIds: [],
    calendars: [ {
      id: uid("cal"), name: "Standard 5 Day", pattern: "5d", workingDays: [1, 2, 3, 4, 5], hoursPerDay: 8, country: "NONE", includePublicHolidays: true, customHolidays: "", appliesTo: "All disciplines / phases"
    }]
  }
}
function builderWizard() {
  if (!state.builderWizard)state.builderWizard = defaultBuilderWizard();
  return state.builderWizard
}
function saveBuilderWizard() {
  localStorage.setItem("pcai.builderWizard", JSON.stringify(builderWizard()))
}
function responsibilityItems(type) {
  const common = ["30% Design", "60% Design", "90% Design", "IFC / AFC Design", "Long-lead equipment approvals", "Construction release", "Testing completion", "Commissioning completion", "Handover documentation"];
  if (type==="Data Centre")return[...common, "FIA / skids", "Energisation", "IST / integrated systems testing", "RFS / Ready for Service"];
  if (type==="Life Sciences / Pharma")return[...common, "Design qualification", "Mechanical completion", "CQV turnover", "IQ / OQ support"];
  if (type==="Industrial / Process")return[...common, "HAZOP closeout", "Vendor FAT", "Mechanical completion", "Pre-commissioning", "Performance testing"];
  if (type==="Commercial Building")return[...common, "Planning / statutory approval", "Building envelope complete", "Services energisation", "Practical completion"];
  return common;
}
function wizardChecklist(items, selected, attr) {
  const set = new Set(selected || []);
  return`<div class="wizard-check-grid">${items.map(x => `<label><input type="checkbox" ${attr}="${esc(x)}" ${set.has(x)? "checked": ""}> ${esc(x)}</label>`).join("")}</div>`
}
function wizardFiles(group, filter = () => true) {
  const w = builderWizard(),
  selected = new Set(w[group] || []),
  files = state.files.filter(filter);
  return files.length? `<div class="wizard-file-list">${files.map(f => `<label><input type="checkbox" data-wiz-filegroup="${group}" value="${esc(f.id)}" ${selected.has(f.id)? "checked": ""}><span><strong>${esc(f.name)}</strong><small>${esc(f.relativePath || f.category || "")}</small></span></label>`).join("")}</div>`: `<div class="empty-state">No matching repository files are available yet. Add them in the left Project Repository pane.</div>`
}
function builderCalendarPreview(cal) {
  const start = parseDate(builderWizard().projectStart) || new Date(),
  years = [start.getFullYear(), start.getFullYear() + 1],
  rows = cal.includePublicHolidays? years.flatMap(y => publicHolidays(cal.country, y)).slice(0, 18): [];
  return rows.length? `<div class="calendar-preview"><strong>National holiday preview</strong>${rows.map(h => `<span>${esc(h.date)} · ${esc(h.name)}</span>`).join("")}</div>`: `<div class="muted">No built-in national holidays applied. Custom dates can still be entered below.</div>`
}
function builderStepMarkup(step) {
  const w = builderWizard();
  if (step===0)return`<h2>1. Choose schedule type</h2><p class="muted">The type drives the responsibility matrix, suggested milestones and AI generation context.</p><div class="wizard-choice-grid">${["Data Centre", "Life Sciences / Pharma", "Industrial / Process", "Commercial Building", "Infrastructure", "General Construction", "Other"].map(x => `<label class="choice-card"><input type="radio" name="builderType" value="${esc(x)}" ${w.scheduleType===x? "checked": ""}><span><strong>${esc(x)}</strong><small>${x==="Data Centre"? "Design → procurement → construction → commissioning → RFS": x==="Life Sciences / Pharma"? "Design → construction → CQV / qualification": "Configurable project lifecycle"}</small></span></label>`).join("")}</div>`;
  if (step===1)return`<h2>2. Choose schedule detail</h2><p class="muted">Level 3 is management/control level, Level 4 is detailed discipline/area control, and Level 5 is work-package / installation-detail level.</p><div class="wizard-choice-grid">${[["Level 3", "Management / control schedule"], ["Level 4", "Detailed project-controls schedule"], ["Level 5", "Work-package / installation-detail schedule"]].map(([x, d]) => `<label class="choice-card"><input type="radio" name="builderLevel" value="${x}" ${w.detailLevel===x? "checked": ""}><span><strong>${x}</strong><small>${d}</small></span></label>`).join("")}</div>`;
  if (step===2)return`<h2>3. Schedule specifications</h2><p class="muted">Select schedule specifications/guidelines already in the repository and add any governing rules the generator must follow.</p>${wizardFiles("specFileIds", f => !(/\.(xer|mpp)$/i.test(f.name)))}<label class="wizard-textarea">Additional specification requirements<textarea id="builderSpecNotes" rows="8" placeholder="Example: P6 level of detail, coding structure, calendars, mandatory milestones, constraints policy, client schedule specification…">${esc(w.specificationNotes)}</textarea></label>`;
  if (step===3)return`<h2>4. Disciplines</h2><p class="muted">Select every discipline that must appear in the generated WBS and activity set.</p>${wizardChecklist(BUILDER_DISCIPLINES, w.disciplines, "data-wiz-discipline")}`;
  if (step===4)return`<h2>5. Project phases</h2><p class="muted">Choose the lifecycle phases to include.</p>${wizardChecklist(BUILDER_PHASES, w.phases, "data-wiz-phase")}`;
  if (step===5) {
    const items = responsibilityItems(w.scheduleType);
    return`<h2>6. Responsibility matrix</h2><p class="muted">Assign the primary party responsible for each control point. The matrix changes with the selected schedule type.</p><div class="responsibility-matrix"><div class="resp-head"><strong>Deliverable / control point</strong>${BUILDER_ROLES.map(r => `<strong>${esc(r)}</strong>`).join("")}</div>${items.map((item, i) => `<div class="resp-row"><span>${esc(item)}</span>${BUILDER_ROLES.map(role => `<label title="${esc(role)}"><input type="radio" name="resp-${i}" data-responsibility="${esc(item)}" value="${esc(role)}" ${(w.responsibilities[item] || BUILDER_ROLES[2])===role? "checked": ""}></label>`).join("")}</div>`).join("")}</div>`
  }
  if (step===6)return`<h2>7. Milestone dates</h2><p class="muted">Enter contractual, client, readiness and internal control milestones. Blank dates are allowed where a date is not yet agreed.</p><label>Project / schedule start<input id="builderProjectStart" type="date" value="${esc(w.projectStart || "")}"></label><div class="wizard-milestones">${w.milestones.map((m, i) => `<div class="milestone-edit"><input data-builder-ms="${i}:name" value="${esc(m.name)}" placeholder="Milestone"><input type="date" data-builder-ms="${i}:date" value="${esc(m.date || "")}"><button class="btn compact" data-del-builder-ms="${i}" type="button">Remove</button></div>`).join("")}</div><button class="btn" id="builderAddMilestone" type="button">Add milestone</button>`;
  if (step===7) {
    const selected = new Set(w.similarScheduleIds || []);
    return`<h2>8. Similar schedules</h2><p class="muted">Select zero or more comparable schedules. They are references only; unrelated uploads are never automatically treated as revisions.</p>${state.schedules.length? `<div class="wizard-file-list">${state.schedules.map(x => `<label><input type="checkbox" data-wiz-similar="${esc(x.id)}" ${selected.has(x.id)? "checked": ""}><span><strong>${esc(scheduleLabel(x))}</strong><small>${x.activities.length} activities</small></span></label>`).join("")}</div>`: `<div class="empty-state">No parsed schedules are currently available.</div>`}`
  }
  if (step===8)return`<h2>9. Reference documents</h2><p class="muted">Choose contracts, scope documents, BOQs, specifications, reports or other project information that should influence the generated schedule.</p>${wizardFiles("referenceFileIds", f => !(/\.(dwg|dxf|ifc|rvt|nwd|nwc)$/i.test(f.name)))}`;
  if (step===9)return`<h2>10. Reference drawings / models</h2><p class="muted">Choose drawings or model references. PDFs are shown here as well because many issued drawings are PDF-based.</p>${wizardFiles("drawingFileIds", f => /\.(pdf|dwg|dxf|ifc|rvt|nwd|nwc|png|jpg|jpeg)$/i.test(f.name))}`;
  if (step===10)return`<h2>11. Calendars & public holidays</h2><p class="muted">Add one or more calendars. Built-in country profiles cover national/common public holidays; regional holidays, shutdowns and project-specific exceptions should be added as custom dates and verified against the contract.</p><div class="builder-calendars">${w.calendars.map((c, i) => `<section class="builder-calendar"><header><strong>Calendar ${i + 1}</strong><button class="btn compact" data-del-builder-cal="${i}" type="button" ${w.calendars.length===1? "disabled": ""}>Remove</button></header><div class="form grid grid2"><label>Name<input data-builder-cal="${i}:name" value="${esc(c.name)}"></label><label>Pattern<select data-builder-cal="${i}:pattern"><option value="5d" ${c.pattern==="5d"? "selected": ""}>5 days · Mon–Fri</option><option value="6d" ${c.pattern==="6d"? "selected": ""}>6 days · Mon–Sat</option><option value="7d" ${c.pattern==="7d"? "selected": ""}>7 days · Mon–Sun</option><option value="custom" ${c.pattern==="custom"? "selected": ""}>Custom working days</option></select></label><label>Hours / working day<input type="number" min="1" max="24" step="0.5" data-builder-cal="${i}:hoursPerDay" value="${Number(c.hoursPerDay || 8)}"></label><label>Country / national holidays<select data-builder-cal="${i}:country">${HOLIDAY_COUNTRIES.map(([code, name]) => `<option value="${code}" ${c.country===code? "selected": ""}>${esc(name)}</option>`).join("")}</select></label><label>Applies to<input data-builder-cal="${i}:appliesTo" value="${esc(c.appliesTo || "All disciplines / phases")}" placeholder="All / Construction / Electrical…"></label><label class="checkline"><input type="checkbox" data-builder-cal="${i}:includePublicHolidays" ${c.includePublicHolidays? "checked": ""}> Exclude built-in public holidays from working time</label></div><div class="working-day-grid">${[[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]].map(([day, name]) => `<label><input type="checkbox" data-cal-day="${i}:${day}" ${(c.workingDays || []).includes(day)? "checked": ""} ${c.pattern!=="custom"? "disabled": ""}> ${name}</label>`).join("")}</div><label class="wizard-textarea">Custom non-working dates<textarea data-builder-cal-custom="${i}" rows="3" placeholder="YYYY-MM-DD, one per line or comma-separated">${esc(c.customHolidays || "")}</textarea></label>${builderCalendarPreview(c)}</section>`).join("")}</div><button class="btn" id="builderAddCalendar" type="button">Add calendar</button>`;
  const ai = selectedAIInfo(),
  refs = (w.referenceFileIds || []).map(id => state.files.find(f => f.id===id)?.name).filter(Boolean),
  drawings = (w.drawingFileIds || []).map(id => state.files.find(f => f.id===id)?.name).filter(Boolean),
  similar = (w.similarScheduleIds || []).map(id => scheduleById(id)).filter(Boolean);
  return`<h2>12. Review & Generate</h2><div class="builder-review-grid"><section><h3>Schedule definition</h3><dl><dt>Type</dt><dd>${esc(w.scheduleType)}</dd><dt>Detail</dt><dd>${esc(w.detailLevel)}</dd><dt>Disciplines</dt><dd>${esc(w.disciplines.join(", ") || "None")}</dd><dt>Phases</dt><dd>${esc(w.phases.join(", ") || "None")}</dd><dt>Project start</dt><dd>${esc(w.projectStart || "—")}</dd></dl></section><section><h3>Reference set</h3><dl><dt>Specifications</dt><dd>${w.specFileIds.length}</dd><dt>Similar schedules</dt><dd>${similar.length}</dd><dt>Documents</dt><dd>${refs.length}</dd><dt>Drawings/models</dt><dd>${drawings.length}</dd><dt>Calendars</dt><dd>${w.calendars.length}</dd></dl></section></div><div class="ai-readiness ${ai.engine!=="none" && ai.compatible? "ready": "not-ready"}"><strong>AI engine: ${esc(aiLabel())}</strong><span>${ai.engine==="none"? "Select and apply an AI engine on Settings before generation.": ai.compatible? "Ready for schedule generation.": esc(ai.compatibilityMessage)}</span></div><div class="actions"><button class="btn primary" id="builderGenerate" type="button" ${ai.engine==="none" || !ai.compatible? "disabled": ""}>Generate schedule with AI</button><button class="btn" id="builderReviewExport" type="button">Download wizard brief</button></div><div class="builder-generation"><div class="builder-progress"><i id="builderProgressBar" style="width:${Number(state.builderGeneration?.percent || 0)}%"></i></div><strong id="builderProgressLabel">${esc(state.builderGeneration?.message || "Ready")}</strong><pre id="builderGenerationLog">${esc(state.builderGeneration?.log || "")}</pre></div>`;
}
function captureBuilderStep() {
  const w = builderWizard(),
  step = state.builderStep;
  if (step===0) {
    const x = document.querySelector('input[name="builderType"]:checked');
    if (x && x.value!==w.scheduleType) {
      w.scheduleType = x.value;
      w.responsibilities = {
      }
    }
  }
  if (step===1) {
    const x = document.querySelector('input[name="builderLevel"]:checked');
    if (x)w.detailLevel = x.value
  }
  if (step===2)w.specificationNotes = $("builderSpecNotes")?.value || "";
  if (step===3)w.disciplines = [...document.querySelectorAll('[data-wiz-discipline]:checked')].map(x => x.dataset.wizDiscipline);
  if (step===4)w.phases = [...document.querySelectorAll('[data-wiz-phase]:checked')].map(x => x.dataset.wizPhase);
  if (step===5)document.querySelectorAll('[data-responsibility]:checked').forEach(x => w.responsibilities[x.dataset.responsibility] = x.value);
  if (step===6)w.projectStart = $("builderProjectStart")?.value || w.projectStart;
  for (const group of["specFileIds", "referenceFileIds", "drawingFileIds"]) {
    const els = [...document.querySelectorAll(`[data-wiz-filegroup="${group}"]:checked`)];
    if (els.length || document.querySelector(`[data-wiz-filegroup="${group}"]`))w[group] = els.map(x => x.value)
  }
  if (document.querySelector('[data-wiz-similar]'))w.similarScheduleIds = [...document.querySelectorAll('[data-wiz-similar]:checked')].map(x => x.dataset.wizSimilar);
  saveBuilderWizard();
  return w;
}
function bindBuilderStep() {
  const w = builderWizard();
  document.querySelectorAll('[data-builder-ms]').forEach(x => x.onchange = () => {
    const[i, k] = x.dataset.builderMs.split(':'); w.milestones[Number(i)][k] = x.value; saveBuilderWizard()
  });
  document.querySelectorAll('[data-del-builder-ms]').forEach(x => x.onclick = () => {
    w.milestones.splice(Number(x.dataset.delBuilderMs), 1); saveBuilderWizard(); renderBuilder()
  });
  $("builderAddMilestone")?.addEventListener('click', () => {
    w.milestones.push( {
      name: "New Milestone", date: ""
    }); saveBuilderWizard(); renderBuilder()
  });
  document.querySelectorAll('[data-builder-cal]').forEach(x => x.onchange = () => {
    const[i, k] = x.dataset.builderCal.split(':'), cal = w.calendars[Number(i)]; cal[k] = x.type==='checkbox'? x.checked: x.type==='number'? Number(x.value): x.value; if (k==='pattern') {
      cal.workingDays = x.value==='5d'? [1, 2, 3, 4, 5]: x.value==='6d'? [1, 2, 3, 4, 5, 6]: x.value==='7d'? [0, 1, 2, 3, 4, 5, 6]: cal.workingDays
    }
    saveBuilderWizard(); renderBuilder()
  });
  document.querySelectorAll('[data-cal-day]').forEach(x => x.onchange = () => {
    const[i, day] = x.dataset.calDay.split(':').map(Number), cal = w.calendars[i], set = new Set(cal.workingDays || []); x.checked? set.add(day): set.delete(day); cal.workingDays = [...set].sort((a, b) => a - b); saveBuilderWizard()
  });
  document.querySelectorAll('[data-builder-cal-custom]').forEach(x => x.onchange = () => {
    w.calendars[Number(x.dataset.builderCalCustom)].customHolidays = x.value; saveBuilderWizard()
  });
  document.querySelectorAll('[data-del-builder-cal]').forEach(x => x.onclick = () => {
    if (w.calendars.length>1)w.calendars.splice(Number(x.dataset.delBuilderCal), 1); saveBuilderWizard(); renderBuilder()
  });
  $("builderAddCalendar")?.addEventListener('click', () => {
    w.calendars.push( {
      id: uid('cal'), name: `Calendar ${w.calendars.length + 1}`, pattern: '5d', workingDays: [1, 2, 3, 4, 5], hoursPerDay: 8, country: 'NONE', includePublicHolidays: true, customHolidays: '', appliesTo: 'All'
    }); saveBuilderWizard(); renderBuilder()
  });
}
function builderBrief(w) {
  return {
    scheduleType: w.scheduleType,
    detailLevel: w.detailLevel,
    specificationNotes: w.specificationNotes,
    disciplines: w.disciplines,
    phases: w.phases,
    responsibilities: w.responsibilities,
    projectStart: w.projectStart,
    milestones: w.milestones,
    similarSchedules: (w.similarScheduleIds || []).map(id => scheduleLabel(scheduleById(id))).filter(Boolean),
    specificationFiles: (w.specFileIds || []).map(id => state.files.find(f => f.id===id)?.name).filter(Boolean),
    referenceDocuments: (w.referenceFileIds || []).map(id => state.files.find(f => f.id===id)?.name).filter(Boolean),
    referenceDrawings: (w.drawingFileIds || []).map(id => state.files.find(f => f.id===id)?.name).filter(Boolean),
    calendars: w.calendars.map(c => ( {
      ...c, publicHolidayProfile: HOLIDAY_COUNTRIES.find(x => x[0]===c.country)?.[1] || c.country
    }))
  }
}
function builderPrompt(w) {
  const brief = builderBrief(w),
  levelCount = w.detailLevel==="Level 5"? "high-detail work-package activities": w.detailLevel==="Level 4"? "detailed control activities": "management/control activities";
  return`Generate a professional ${w.scheduleType} ${w.detailLevel} project schedule using ${levelCount}. Use the supplied repository evidence and similar schedules as references but do not invent contractual facts. Follow the selected phases, disciplines, responsibilities, milestones and calendar assumptions. Return ONLY valid JSON with this exact shape: {"activities":[{"id":"A1000","name":"Activity name","wbs":"Phase / Discipline / Area","start":"YYYY-MM-DD","duration":5,"predecessors":"A0990:FS","milestone":false,"calendar":"Calendar name","responsible":"Party","discipline":"Electrical","phase":"Construction"}],"assumptions":["..."]}. Use unique activity IDs, logical FS/SS/FF/SF predecessor strings, realistic durations, and zero duration for milestones. Do not wrap JSON in markdown.\n\nWIZARD BRIEF:\n${JSON.stringify(brief)}`
}
function parseBuilderAI(text) {
  const raw = String(text || "").trim(),
  candidate = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  try {
    const x = JSON.parse(candidate);
    return {
      rows: Array.isArray(x)? x: (x.activities || []),
      assumptions: x.assumptions || []
    }
  } catch (_) {
    const a = candidate.indexOf('{'),
    b = candidate.lastIndexOf('}');
    if (a>=0 && b>a) {
      const x = JSON.parse(candidate.slice(a, b + 1));
      return {
        rows: x.activities || [],
        assumptions: x.assumptions || []
      }
    }
    throw new Error('The AI response did not contain valid schedule JSON.')
  }
}
function calendarOptions(cal, w) {
  const custom = String(cal.customHolidays || "").split(/[\s,;]+/).map(x => x.trim()).filter(Boolean),
  dates = [w.projectStart, ...w.milestones.map(m => m.date)].map(parseDate).filter(Boolean),
  min = dates.length? Math.min(...dates.map(x => x.getFullYear())): new Date().getFullYear(),
  max = dates.length? Math.max(...dates.map(x => x.getFullYear())): min + 3,
  years = [];
  for (let y = min - 1; y<=max + 4; y++)years.push(y);
  return {
    workingDays: cal.workingDays || [1, 2, 3, 4, 5],
    holidaySet: cal.includePublicHolidays? calendarHolidaySet( {
      country: cal.country, years, customDates: custom
    }): calendarHolidaySet( {
      country: 'NONE', years, customDates: custom
    })
  }
}
function normaliseBuilderRows(rows, w) {
  const calendars = w.calendars.length? w.calendars: defaultBuilderWizard().calendars,
  defaultCal = calendars[0],
  calByName = new Map(calendars.map(c => [c.name.toLowerCase(), c])),
  startFallback = parseDate(w.projectStart) || new Date();
  return rows.map((r, i) => {
    const cal = calByName.get(String(r.calendar || '').toLowerCase()) || defaultCal, duration = Math.max(0, Number(r.duration ?? r.originalDuration ?? 0) || 0), rawStart = parseDate(r.start) || startFallback, start = addWorkingDays(addDays(rawStart, - 1), 1, calendarOptions(cal, w)), finish = r.milestone || duration===0? start: addWorkingDays(start, Math.max(0, Math.round(duration) - 1), calendarOptions(cal, w)); return {
      id: String(r.id || `A${String((i + 1) * 10).padStart(4, '0')}`), name: String(r.name || `Generated activity ${i + 1}`), wbs: String(r.wbs || r.wbsPath || `${r.phase || 'Project'} / ${r.discipline || 'General'}`), start: isoDate(start), finish: isoDate(finish), duration, milestone: Boolean(r.milestone) || duration===0, predecessors: String(r.predecessors || ''), calendar: cal.name, responsible: String(r.responsible || ''), discipline: String(r.discipline || ''), phase: String(r.phase || '')
    }
  })
}
function deterministicBuilderRows(w) {
  const level = w.detailLevel==="Level 5"? 8: w.detailLevel==="Level 4"? 5: 3,
  rows = [],
  start = parseDate(w.projectStart) || new Date();
  let cursor = start,
  n = 10,
  previous = "";
  const verbs = ["Plan", "Develop", "Review", "Approve", "Mobilise", "Execute", "Inspect", "Complete", "Test", "Turn over"];
  for (const phase of w.phases)for (const discipline of w.disciplines) {
    for (let i = 0; i<level; i++) {
      const id = `A${String(n).padStart(4, '0')}`,
      duration = i===level - 1? 3: 5,
      resp = w.responsibilities[responsibilityItems(w.scheduleType)[Math.min(i, responsibilityItems(w.scheduleType).length - 1)]] || "Main Contractor";
      rows.push( {
        id, name: `${verbs[Math.min(i, verbs.length - 1)]} ${discipline} · ${phase}`, wbs: `${phase} / ${discipline}`, start: isoDate(cursor), duration, predecessors: previous? `${previous}:FS`: '', milestone: false, calendar: w.calendars[0]?.name || 'Standard 5 Day', responsible: resp, discipline, phase
      });
      previous = id;
      cursor = addDays(cursor, duration);
      n+=10
    }
  }
  for (const m of w.milestones.filter(x => x.name)) {
    rows.push( {
      id: `M${String(n).padStart(4, '0')}`, name: m.name, wbs: 'Project Milestones', start: m.date || isoDate(cursor), duration: 0, predecessors: previous? `${previous}:FS`: '', milestone: true, calendar: w.calendars[0]?.name || 'Standard 5 Day', responsible: w.responsibilities[m.name] || 'Project Manager', discipline: 'Project / General', phase: 'Milestones'
    });
    n+=10
  }
  return normaliseBuilderRows(rows, w)
}
function setBuilderProgress(percent, message, append = "") {
  state.builderGeneration = {
    percent,
    message,
    log: `${state.builderGeneration?.log || ''}${append? `${append}\n`: ''}`
  };
  const bar = $("builderProgressBar"),
  label = $("builderProgressLabel"),
  log = $("builderGenerationLog");
  if (bar)bar.style.width = `${percent}%`;
  if (label)label.textContent = message;
  if (log)log.textContent = state.builderGeneration.log
}
/**
 * Execute the final Schedule Builder step. Only explicitly selected references
 * are provided to the configured AI provider; invalid AI JSON falls back to a
 * deterministic scaffold so the editor remains usable.
 */
async function generateBuilderSchedule() {
  const w = captureBuilderStep(),
  ai = selectedAIInfo();
  if (ai.engine==="none" || !ai.compatible) {
    alert('Select and apply a compatible AI engine in Settings first.');
    return
  }
  try {
    setBuilderProgress(5, 'Validating wizard', 'Wizard configuration validated.');
    const similar = (w.similarScheduleIds || []).map(scheduleById).filter(Boolean);
    setBuilderProgress(18, 'Building generation brief', `${similar.length} similar schedule(s) selected.`);
    const prompt = builderPrompt(w);
    setBuilderProgress(30, `Generating with ${aiLabel()}`, 'AI generation request started.');
    const contextFileIds = [...new Set([...(w.specFileIds || []), ...(w.referenceFileIds || []), ...(w.drawingFileIds || [])])],
    out = await askAI( {
      question: prompt, role: 'Senior Planning Manager / Schedule Author', current: similar.at( - 1) || activeSchedule(), previous: similar.length>1? similar.at( - 2): null, revisions: similar, history: [], contextFileIds
    });
    setBuilderProgress(78, 'Validating generated schedule', 'AI response received.');
    let parsed;
    try {
      parsed = parseBuilderAI(out.text)
    } catch (error) {
      setBuilderProgress(82, 'AI JSON needed repair', `${error.message} Using deterministic wizard scaffold so the builder remains usable.`);
      parsed = {
        rows: deterministicBuilderRows(w),
        assumptions: ['AI response was not valid schedule JSON; deterministic wizard scaffold generated.']
      }
    }
    const rows = Array.isArray(parsed.rows) && parsed.rows.length && parsed.rows[0]?.finish? parsed.rows: normaliseBuilderRows(parsed.rows, w);
    state.builderRows = rows;
    localStorage.setItem('pcai.builder', JSON.stringify(rows));
    setBuilderProgress(94, 'Applying calendars and controls', `${rows.length} activities normalised into the editable builder.`);
    setBuilderProgress(100, 'Generation complete', `Generated ${rows.length} editable activities. Assumptions: ${(parsed.assumptions || []).join(' | ') || 'See activity set and wizard brief.'}`);
    renderBuilder()
  } catch (error) {
    setBuilderProgress(100, 'Generation failed', error.message || String(error));
    alert(`Schedule generation failed: ${error.message || error}`)
  }
}
function builderEditorMarkup() {
  return`<details class="panel builder-editor" ${state.builderRows.length? 'open': ''}><summary><strong>Generated / Editable Schedule</strong><span>${state.builderRows.length} activities</span></summary><div class="actions builder-editor-actions"><button class="btn" id="builderAdd">Add activity</button><button class="btn" id="builderExport">Export CSV</button><button class="btn danger" id="builderRemoveAll" ${state.builderRows.length? '': 'disabled'}>Remove all</button></div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Activity</th><th>WBS</th><th>Start</th><th>Finish</th><th>Duration d</th><th>Predecessors</th><th>Calendar</th><th>Responsible</th><th>Discipline</th><th>Phase</th><th>Milestone</th><th></th></tr></thead><tbody>${state.builderRows.map((r, i) => `<tr><td><input data-b="${i}:id" value="${esc(r.id || '')}"></td><td><input data-b="${i}:name" value="${esc(r.name || '')}"></td><td><input data-b="${i}:wbs" value="${esc(r.wbs || '')}"></td><td><input type="date" data-b="${i}:start" value="${esc(r.start || '')}"></td><td><input type="date" data-b="${i}:finish" value="${esc(r.finish || '')}"></td><td><input type="number" data-b="${i}:duration" value="${Number(r.duration || 0)}"></td><td><input data-b="${i}:predecessors" value="${esc(r.predecessors || '')}"></td><td><input data-b="${i}:calendar" value="${esc(r.calendar || '')}"></td><td><input data-b="${i}:responsible" value="${esc(r.responsible || '')}"></td><td><input data-b="${i}:discipline" value="${esc(r.discipline || '')}"></td><td><input data-b="${i}:phase" value="${esc(r.phase || '')}"></td><td><input type="checkbox" data-b="${i}:milestone" ${r.milestone? 'checked': ''}></td><td><button data-delb="${i}">×</button></td></tr>`).join('') || `<tr><td colspan="13" class="muted">Complete the wizard and generate a schedule, or load an imported schedule from Schedule Assessment → Activity Register.</td></tr>`}</tbody></table></div></details>`
}
function renderBuilder() {
  const w = builderWizard(),
  step = Math.max(0, Math.min(BUILDER_STEPS.length - 1, state.builderStep));
  state.builderStep = step;
  const progress = ((step + 1) / BUILDER_STEPS.length * 100).toFixed(0);
  $("workspace").innerHTML = `${viewHead("Schedule Builder", "Guided AI-assisted schedule authoring with project references, responsibilities, milestones and project calendars.", `<button class="btn" id="builderResetWizard">Reset wizard</button>`)}<div class="builder-shell"><aside class="builder-stepper"><div class="wizard-progress"><i style="width:${progress}%"></i></div>${BUILDER_STEPS.map((x, i) => `<button class="builder-step ${i===step? 'active': ''} ${i<step? 'done': ''}" data-builder-step="${i}"><span>${i + 1}</span>${esc(x)}</button>`).join('')}</aside><main class="panel builder-wizard"><div class="builder-step-head"><span>Step ${step + 1} of ${BUILDER_STEPS.length}</span><strong>${esc(BUILDER_STEPS[step])}</strong></div>${builderStepMarkup(step)}<div class="builder-nav"><button class="btn" id="builderPrev" ${step===0? 'disabled': ''}>← Previous</button><button class="btn primary" id="builderNext" ${step===BUILDER_STEPS.length - 1? 'disabled': ''}>Next →</button></div></main></div>${builderEditorMarkup()}`;
  bindBuilderStep();
  document.querySelectorAll('[data-builder-step]').forEach(x => x.onclick = () => {
    captureBuilderStep(); state.builderStep = Number(x.dataset.builderStep); renderBuilder()
  });
  $("builderPrev").onclick = () => {
    captureBuilderStep();
    state.builderStep = Math.max(0, state.builderStep - 1);
    renderBuilder()
  };
  $("builderNext").onclick = () => {
    captureBuilderStep();
    state.builderStep = Math.min(BUILDER_STEPS.length - 1, state.builderStep + 1);
    renderBuilder()
  };
  $("builderResetWizard").onclick = () => {
    if (confirm('Reset the schedule-generation wizard? Existing generated activities will be kept.')) {
      state.builderWizard = defaultBuilderWizard();
      state.builderStep = 0;
      saveBuilderWizard();
      renderBuilder()
    }
  };
  $("builderGenerate")?.addEventListener('click', generateBuilderSchedule);
  $("builderReviewExport")?.addEventListener('click', () => downloadBlob(new Blob([JSON.stringify(builderBrief(captureBuilderStep()), null, 2)], {
    type: 'application/json'
  }), 'schedule-builder-brief.json'));
  document.querySelectorAll('[data-b]').forEach(x => x.onchange = () => {
    const[i, k] = x.dataset.b.split(':'); state.builderRows[Number(i)][k] = x.type==='checkbox'? x.checked: x.type==='number'? Number(x.value): x.value; localStorage.setItem('pcai.builder', JSON.stringify(state.builderRows))
  });
  document.querySelectorAll('[data-delb]').forEach(x => x.onclick = () => {
    state.builderRows.splice(Number(x.dataset.delb), 1); localStorage.setItem('pcai.builder', JSON.stringify(state.builderRows)); renderBuilder()
  });
  $("builderAdd")?.addEventListener('click', () => {
    state.builderRows.push( {
      id: `A${String(state.builderRows.length + 1).padStart(4, '0')}`, name: 'New Activity', wbs: '', start: '', finish: '', duration: 5, predecessors: '', calendar: w.calendars[0]?.name || '', responsible: '', discipline: '', phase: '', milestone: false
    }); localStorage.setItem('pcai.builder', JSON.stringify(state.builderRows)); renderBuilder()
  });
  $("builderRemoveAll")?.addEventListener('click', () => {
    if (!state.builderRows.length)return; if (confirm(`Remove all ${state.builderRows.length} generated activities?`)) {
      state.builderRows = []; localStorage.setItem('pcai.builder', '[]'); renderBuilder(); toast('All generated activities removed')
    }
  });
  $("builderExport")?.addEventListener('click', () => downloadBlob(new Blob([toCSV(["ID", "Activity", "WBS", "Start", "Finish", "Duration", "Predecessors", "Calendar", "Responsible", "Discipline", "Phase", "Milestone"], state.builderRows.map(r => [r.id, r.name, r.wbs, r.start, r.finish, r.duration, r.predecessors, r.calendar, r.responsible, r.discipline, r.phase, r.milestone]))], {
    type: 'text/csv'
  }), 'schedule-builder.csv'));
}
// -----------------------------------------------------------------------------
// Settings and AI-provider configuration
// -----------------------------------------------------------------------------
function renderSettings() {
  const c = ollamaConfig(),
  selectedValue = preferredAI(),
  cloudIds = cloudProviderIds(),
  cloudConfigs = Object.fromEntries(cloudIds.map(id => [id, cloudConfig(id)])),
  qa = currentQaProfile(),
  qaThresholdLabels = {
    logicMissingPctMax: "Missing logic max %", leadPctMax: "Leads max %", lagPctMax: "Lags max %", fsPctMin: "FS relationships min %", sfCountMax: "SF relationships max count", hardConstraintPctMax: "Hard constraints max %", highFloatPctMax: "High float max %", negativeFloatPctMax: "Negative float max %", highDurationPctMax: "Long duration max %", invalidDateCountMax: "Invalid dates max count", resourceMissingPctMax: "Missing resources max %", missedTaskPctMax: "Missed tasks max %", cpliMin: "CPLI minimum", beiMin: "BEI minimum", durationLimitDays: "Long-duration limit (days)", highFloatLimitDays: "High-float limit (days)"
  },
  cloudProviderCards = cloudIds.map(provider => {
    const cfg = cloudConfigs[provider], meta = cloudProviderMeta(provider), cap = provider[0].toUpperCase() + provider.slice(1);
    const showEndpoint = provider === "custom" || provider === "deepseek" || provider === "nvidia";
    return `<div class="cloud-provider"><div class="cloud-provider-head"><strong>${esc(meta.label)}</strong><span>${esc(cfg.protocol)}</span></div><div class="form">
      <label>${esc(meta.label)} API key<input id="${provider}ApiKey" type="password" autocomplete="off" placeholder="Paste API key" value="${esc(cfg.apiKey)}"></label>
      <label>Model<input id="${provider}Model" list="${provider}ModelList" value="${esc(cfg.model)}" placeholder="${esc(meta.model || "model-name")}"><datalist id="${provider}ModelList"></datalist></label>
      ${showEndpoint ? `<label>API endpoint<input id="${provider}BaseUrl" value="${esc(cfg.baseUrl)}" placeholder="https://.../v1/chat/completions"></label>` : ""}
      ${provider === "custom" ? `<label>Protocol<select id="customProtocol"><option value="openai-chat" ${cfg.protocol==="openai-chat"?"selected":""}>OpenAI Chat Completions</option><option value="openai-responses" ${cfg.protocol==="openai-responses"?"selected":""}>OpenAI Responses</option><option value="anthropic" ${cfg.protocol==="anthropic"?"selected":""}>Anthropic Messages</option></select></label>` : ""}
      <div class="actions"><button class="btn primary" id="save${cap}">Save locally</button><button class="btn" id="test${cap}">Test ${esc(meta.label)}</button>${["openai-chat","openai-responses"].includes(cfg.protocol)?`<button class="btn" id="models${cap}" type="button">Refresh models</button>`:""}<button class="btn" id="clear${cap}">Clear key</button></div>
      <div id="${provider}Diag" class="muted">${cfg.apiKey? "API key is stored locally in this browser.": `No ${esc(meta.label)} API key stored.`}</div></div></div>`;
  }).join("");
  $("workspace").innerHTML = `${viewHead("Settings", "AI model selection, project-controls profile and local Ollama setup")}
  <div class="grid grid2 settings-grid">
    <section class="panel"><h2>Global AI Model</h2>
      <p class="muted"><strong>No AI is the default.</strong> Nothing is downloaded or invoked until you explicitly select and apply a model here.</p>
      <div class="form"><label>Selected model<select id="settingsAiSelect">${[...catalogueGroups().entries()].map(([group, entries]) => `<optgroup label="${esc(group)}">${entries.map(entry => {
    const cp = aiCompatibility(entry.value); return`<option value="${esc(entry.value)}" ${entry.value===selectedValue? "selected": ""} ${entry.disabled? "disabled": ""}>${esc(entry.label)}${!cp.ok && !entry.disabled? " · unavailable here": ""}</option>`
  }).join("")}</optgroup>`).join("")}</select></label><div class="actions"><button class="btn primary" id="applyAiModel">Apply model</button><button class="btn" id="testSelectedAI">Test selected AI</button></div></div>
      <div id="selectedAiCard" class="ai-config-card" style="margin-top:10px"></div>
      <div id="browserAiDiag" class="muted" style="margin-top:8px">Browser models download only after selection and first test/use.</div>
    </section>
    <section class="panel cloud-ai-panel"><h2>Cloud AI providers</h2>
      <p class="muted">Choose a preset provider or configure a custom OpenAI-compatible endpoint. DeepSeek and NVIDIA NIM use their current OpenAI-compatible chat endpoints. Keys remain in this browser profile and are never written into the GitHub package.</p>
      ${cloudProviderCards}
      <p class="muted cloud-key-warning">For a public/production deployment, route long-lived cloud keys through a backend/Worker proxy. Direct browser keys are intended for the requested personal bring-your-own-key workflow.</p>
    </section>
    <section class="panel"><h2>Ollama</h2><div class="form"><label>Host<input id="ollamaHost" value="${esc(c.baseUrl)}"></label><label>Chat model<select id="ollamaModel"><option value="${esc(c.model)}">${esc(c.model || "Detect installed models")}</option></select></label><label>Embedding model<select id="embedModel"><option value="${esc(c.embeddingModel || "")}">${esc(c.embeddingModel || "Keyword-only")}</option></select></label><label>Keep alive<select id="keepAlive">${["default", "0", "5m", "15m", "30m", "1h", "2h", "4h"].map(x => `<option ${c.keepAlive===x? "selected": ""}>${x}</option>`).join("")}</select></label><label>Reasoning<select id="thinking">${["off", "auto", "on"].map(x => `<option ${c.thinking===x? "selected": ""}>${x}</option>`).join("")}</select><div class="actions"><button class="btn" id="checkOllama">Check Ollama</button><button class="btn" id="detectOllama">Detect & classify</button><button class="btn primary" id="testOllama">Test & Save</button></div><div id="ollamaDiag" class="muted">Expected local API: http://localhost:11434</div><div id="ollamaHelp" class="ollama-help" hidden></div></div></section>
    <section class="panel" id="qaProfileSettings"><h2>QA / Schedule Quality Profile</h2><p class="muted">Choose a preset and optionally override individual thresholds. The full 14-point screen and DCMA issue generation use this profile.</p><div class="form"><label>QA profile<select id="settingsQaProfile">${Object.values(QA_PROFILES).map(p=>`<option value="${esc(p.id)}" ${p.id===qa.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label><div class="qa-threshold-grid">${Object.entries(qaThresholdLabels).map(([key,label])=>`<label>${esc(label)}<input type="number" step="0.01" data-qa-threshold="${esc(key)}" value="${Number(qa.thresholds[key] ?? 0)}"></label>`).join("")}</div><div class="actions"><button class="btn primary" id="applyQaProfile" type="button">Apply QA profile</button><button class="btn" id="resetQaProfile" type="button">Reset preset thresholds</button></div><div id="qaProfileDiag" class="muted">Current: ${esc(qa.name)} · ${esc(qa.description)}</div></div></section>
    <section class="panel"><h2>Project Controls Profile</h2><div class="form"><label>Specialism<select id="profile">${["General Project Controls", "Data Centre", "Life Sciences / Pharma", "Industrial / Process"].map(x => `<option ${state.profile===x? "selected": ""}>${x}</option>`).join("")}</select></label><div class="actions"><button class="btn primary" id="applyProfile">Apply profile</button></div><div id="profileDiag" class="muted">Current profile: ${esc(state.profile)}</div></div></section>
    <section class="panel"><h2>Set up Ollama on Windows</h2><ol class="muted"><li>Download <code>setup-ollama.bat</code> from this site/repository.</li><li>Right-click it and choose <strong>Run as administrator</strong>.</li><li>Enter this GitHub Pages origin when prompted, for example <code>https://your-name.github.io</code>.</li><li>The script installs Ollama with Windows Package Manager when needed, configures <code>OLLAMA_ORIGINS</code>, starts Ollama and pulls a small default model.</li><li>Return here, click <strong>Check Ollama</strong>, then <strong>Detect & classify</strong>, select a chat model, and use <strong>Test & Save</strong>.</li></ol><a class="btn" href="./setup-ollama.bat" download>Download setup-ollama.bat</a><p class="muted" style="margin-top:10px">The website remains static on GitHub Pages. Ollama runs locally on the user's Windows computer; no paid AI service is required.</p></section>
    <section class="panel"><h2>Local Microsoft Project (.mpp) Parser</h2><p class="muted">GitHub Pages cannot execute a native MPP parser itself. This helper runs only on the user's PC, converts MPP to MSPDI XML locally, and returns the XML to this page so it can be normalised into the same editable internal schedule model as XER/XML.</p><ol class="muted"><li>Download <code>setup-mpp-bridge.bat</code> together with the <code>tools</code> folder from this build.</li><li>Double-click the BAT file. It installs Node.js LTS if needed, installs the MPP parser, and starts <code>127.0.0.1:8765</code>.</li><li>Leave that window open while importing or linking <code>.mpp</code> files.</li><li>Use <strong>Test MPP parser</strong> below. Then import the MPP from the left repository pane.</li></ol><div class="form"><label>Local parser URL<input id="mppBridgeUrl" value="${esc(mppBridgeUrl())}"></label><div class="actions"><button class="btn" id="testMppBridge">Test MPP parser</button><a class="btn" href="./setup-mpp-bridge.bat" download>Download MPP setup BAT</a></div><div id="mppBridgeDiag" class="muted">Expected local API: http://127.0.0.1:8765</div></div></section>
  </div>`;
  const refreshSelectedCard = () => {
    const selected = selectedAIInfo();
    $("selectedAiCard").innerHTML = `<div class="ai-config-title">${esc(aiLabel())}</div><div class="ai-config-meta"><span>${esc(selected.engine==="none"? "Disabled": selected.engine==="ollama"? "Ollama": cloudProviderIds().includes(selected.engine)? `${cloudProviderMeta(selected.engine).label} API`: selected.engine==="cpu"? "CPU / WASM": selected.engine==="gpu-transformers"? "WebGPU / Transformers.js": "WebGPU / WebLLM")}</span><span>${esc(selected.memory || "")}</span></div><div class="${selected.compatible? "ai-ok": "ai-warning"}">${selected.engine==="none"? "No AI calls will be made.": selected.compatible? "Compatible with this browser.": esc(selected.compatibilityMessage)}</div>`;
    $("testSelectedAI").disabled = selected.engine==="none" || selected.engine==="ollama" || !selected.compatible;
  };
  refreshSelectedCard();
  $("applyAiModel").onclick = async() => {
    const requested = $("settingsAiSelect").value,
    compat = aiCompatibility(requested);
    if (!compat.ok) {
      alert(compat.reason);
      return
    }
    try {
      await setPreferredAI(requested);
      renderAIModelDisplay();
      refreshSelectedCard();
      toast(`AI model: ${aiLabel(requested)}`)
    } catch (error) {
      alert(error.message || String(error))
    }
  };
  $("testSelectedAI").onclick = async() => {
    const d = $("browserAiDiag");
    d.textContent = `Testing ${aiLabel()}…`;
    const result = await testSelectedAI();
    d.textContent = result.ok? `✓ ${result.message}`: `✕ ${result.message}`
  };
  $("applyProfile").onclick = () => {
    state.profile = $("profile").value;
    localStorage.setItem("pcai.profile", state.profile);
    $("profileDiag").textContent = `Applied: ${state.profile}`;
    toast(`Profile applied: ${state.profile}`)
  };
  $("settingsQaProfile")?.addEventListener("change", e => {
    state.qaProfileId = e.target.value || DEFAULT_QA_PROFILE_ID;
    state.qaCustomThresholds = {};
    localStorage.setItem("pcai.qaProfileId", state.qaProfileId);
    localStorage.removeItem("pcai.qaCustomThresholds");
    renderSettings();
  });
  $("applyQaProfile")?.addEventListener("click", () => {
    const overrides = {};
    document.querySelectorAll("[data-qa-threshold]").forEach(el => {
      const value = Number(el.value); if (Number.isFinite(value)) overrides[el.dataset.qaThreshold] = value;
    });
    state.qaCustomThresholds = overrides;
    localStorage.setItem("pcai.qaProfileId", state.qaProfileId || DEFAULT_QA_PROFILE_ID);
    localStorage.setItem("pcai.qaCustomThresholds", JSON.stringify(overrides));
    $("qaProfileDiag").textContent = `Applied: ${currentQaProfile().name} with ${Object.keys(overrides).length} configured thresholds.`;
    toast("QA profile thresholds applied");
  });
  $("resetQaProfile")?.addEventListener("click", () => {
    state.qaCustomThresholds = {};
    localStorage.removeItem("pcai.qaCustomThresholds");
    renderSettings();
  });
  const bindCloudProvider = (provider) => {
    const cap = provider[0].toUpperCase() + provider.slice(1),
    display = cloudProviderMeta(provider).label,
    keyEl = $(provider + "ApiKey"),
    modelEl = $(provider + "Model"),
    baseUrlEl = $(provider + "BaseUrl"),
    protocolEl = $(provider + "Protocol"),
    diag = $(provider + "Diag");
    $("save" + cap).onclick = () => {
      const cfg = saveCloudConfig(provider, {
        apiKey: keyEl.value, model: modelEl.value, baseUrl: baseUrlEl?.value, protocol: protocolEl?.value
      });
      diag.textContent = `✓ ${display} settings saved locally · ${cfg.model}`;
      renderAIModelDisplay();
      refreshSelectedCard();
      toast(`${display} API settings saved locally`)
    };
    $("clear" + cap).onclick = () => {
      clearCloudKey(provider);
      keyEl.value = "";
      diag.textContent = `${display} API key cleared from this browser.`;
      renderAIModelDisplay();
      refreshSelectedCard()
    };
    $("test" + cap).onclick = async() => {
      saveCloudConfig(provider, {
        apiKey: keyEl.value, model: modelEl.value, baseUrl: baseUrlEl?.value, protocol: protocolEl?.value
      });
      diag.textContent = `Testing ${display}…`;
      const r = await testCloudAI(provider);
      diag.textContent = r.ok? `✓ ${r.message}`: `✕ ${r.message}`
    };
    $("models" + cap)?.addEventListener("click", async () => {
      saveCloudConfig(provider, { apiKey: keyEl.value, model: modelEl.value, baseUrl: baseUrlEl?.value, protocol: protocolEl?.value });
      diag.textContent = `Refreshing ${display} models…`;
      try {
        const models = await listCloudModels(provider);
        const list = $(provider + "ModelList");
        if (list) list.innerHTML = models.map(m => `<option value="${esc(m)}"></option>`).join("");
        diag.textContent = models.length ? `✓ ${models.length} model identifiers loaded. Type or choose a model above.` : `No model list was returned. You can still enter the model identifier manually.`;
      } catch (error) { diag.textContent = `✕ Model discovery unavailable: ${error?.message || error}. Manual model entry remains available.`; }
    });
  };
  cloudIds.forEach(bindCloudProvider);
  const showOllamaHelp = (resultOrError) => {
    const box = $("ollamaHelp"),
    diag = $("ollamaDiag");
    const result = resultOrError?.help? resultOrError: {
      ok: false,
      message: String(resultOrError?.message || resultOrError || "Ollama connection failed"),
      help: ["Install Ollama if it is not installed.", "Start Ollama and confirm it is running.", `Check ${$("ollamaHost").value || "http://localhost:11434"} locally.`, "For GitHub Pages, allow this site's origin using OLLAMA_ORIGINS and restart Ollama.", "Return here and click Check Ollama."]
    };
    diag.textContent = `✕ ${result.message}`;
    box.hidden = false;
    box.innerHTML = `<strong>Ollama connection help</strong><ol>${result.help.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      <div class="muted">The browser cannot always distinguish “not installed” from “not running” or a blocked local-origin request, so the toolkit checks all three possibilities instead of showing a misleading error.</div>`;
  };
  $("checkOllama").onclick = async() => {
    const d = $("ollamaDiag"),
    box = $("ollamaHelp");
    box.hidden = true;
    d.textContent = "Checking Ollama…";
    saveOllamaConfig( {
      baseUrl: $("ollamaHost").value
    });
    const r = await probeOllama( {
      baseUrl: $("ollamaHost").value
    });
    if (r.ok) {
      d.textContent = `✓ ${r.message} at ${r.baseUrl}`;
      box.hidden = true
    } else showOllamaHelp(r);
  };
  $("detectOllama").onclick = async() => {
    const d = $("ollamaDiag"),
    box = $("ollamaHelp");
    box.hidden = true;
    d.textContent = "Detecting…";
    try {
      saveOllamaConfig( {
        baseUrl: $("ollamaHost").value
      });
      const models = await inspectModels(),
      chat = models.filter(x => x.supportsChat),
      embed = models.filter(x => x.supportsEmbedding);
      $("ollamaModel").innerHTML = chat.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("") || `<option value="">No chat-capable models</option>`;
      $("embedModel").innerHTML = `<option value="">Keyword-only</option>` + embed.map(x => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("");
      if (chat.some(x => x.name===c.model))$("ollamaModel").value = c.model;
      d.textContent = `✓ ${models.length} installed · ${chat.length} chat · ${embed.length} embedding`
    } catch (e) {
      showOllamaHelp(e)
    }
  };
  $("testOllama").onclick = async() => {
    const d = $("ollamaDiag"),
    box = $("ollamaHelp");
    box.hidden = true;
    d.textContent = "Testing Ollama…";
    try {
      saveOllamaConfig( {
        baseUrl: $("ollamaHost").value, model: $("ollamaModel").value, embeddingModel: $("embedModel").value, keepAlive: $("keepAlive").value, thinking: $("thinking").value
      });
      const r = await testOllama( {
        model: $("ollamaModel").value
      });
      d.textContent = r.ok? `✓ Ollama ready: ${r.selectedModel}`: `✕ ${r.message}`;
      if (r.ok) {
        await setPreferredAI("ollama:auto");
        renderAIModelDisplay()
      } else showOllamaHelp(r)
    } catch (e) {
      showOllamaHelp(e)
    }
  };
  $("testMppBridge").onclick = async() => {
    const d = $("mppBridgeDiag"),
    url = setMppBridgeUrl($("mppBridgeUrl").value);
    d.textContent = "Checking local MPP parser…";
    const r = await probeMppBridge(url);
    d.textContent = r.ok? `✓ ${r.message}${r.version? ` · v${r.version}`: ""}`: `✕ ${r.message} Run setup-mpp-bridge.bat and leave its window open.`
  };
}
init().catch(e => {
  $("workspace").innerHTML = `<div class="panel"><h2>Startup error</h2><pre>${esc(e.stack || e.message)}</pre></div>`
});
