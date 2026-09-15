/**
 * Application state and persisted Gantt layout preferences.
 *
 * Keeping mutable UI state in one small module makes the main application
 * controller easier to read and prevents view-rendering code from redefining
 * defaults in multiple places.  No storage is read at module load time; the
 * explicit load/save helpers are called during application initialisation.
 */
import {
  GANTT_FIELDS
} from "./render.js";
export const DEFAULT_GANTT_BAR_SETTINGS = {
  showBaseline: true,
  showActual: true,
  showProgress: true,
  showDataDate: true,
  groupWbs: true,
  labelMode: "none",
  normalColor: "#2b78a8",
  criticalColor: "#c63535",
  baselineColor: "#7f8f99",
  progressColor: "#5aa874",
  barHeight: 12,
};
export const DEFAULT_GANTT_LAYOUTS = {
  critical: {
    fields: ["id", "name", "wbs", "start", "finish", "originalDuration", "remainingDuration", "totalFloat", "freeFloat", "calendar", "constraint",],
    widths: {
    },
    bars: {
      ...DEFAULT_GANTT_BAR_SETTINGS,
      labelMode: "id"
    },
  },
  wbs: {
    fields: ["id", "name", "wbs", "start", "finish", "originalDuration", "remainingDuration", "totalFloat", "status", "percent",],
    widths: {
    },
    bars: {
      ...DEFAULT_GANTT_BAR_SETTINGS
    },
  },
};
export const roles = ["Planner", "Forensic Planner", "Risk Analyst", "Commercial Manager", "Contract Analyst", "Project Controls Manager", "Executive Reviewer",];
export const noRepoViews = new Set(["notebook", "builder", "settings"]);
/**
 * Central transient UI state. Project/schedule records themselves remain in
 * IndexedDB; this object only tracks the current view, selections and filters.
 */
export const state = {
  view: "dashboard",
  project: null,
  files: [],
  schedules: [],
  risks: [],
  claims: [],
  activeScheduleId: null,
  previousScheduleId: null,
  assessmentReport: "overview",
  filters: {
    search: "",
    wbs: "",
    status: "",
    floatMax: ""
  },
  ganttTimescale: "weekly",
  ganttCompression: "standard",
  ganttRelationships: true,
  ganttLeftWidth: 410,
  criticalLeftWidth: 410,
  ganttStartDate: "",
  ganttFinishDate: "",
  criticalStartDate: "",
  criticalFinishDate: "",
  whyActivityId: "",
  timeActivityId: "",
  traceActivityId: "",
  dashboardLineageIds: ["", "", "", "", ""],
  comparisonAId: "",
  comparisonBId: "",
  weekAId: "",
  weekBId: "",
  weekChangeFilter: "all",
  weekWbsFilter: "",
  qaProfileId: "dcma-standard",
  qaCustomThresholds: {},
  windowsScheduleIds: Array(8).fill(""),
  logicAId: "",
  logicBId: "",
  calendarDiffAId: "",
  calendarDiffBId: "",
  resourceForensicAId: "",
  resourceForensicBId: "",
  baselineSlots: ["", "", ""],
  baselineSlotNames: ["BL1", "BL2", "BL3"],
  floatPathCount: 5,
  progressIntegrityFilter: "all",
  forensicMatrixSearch: "",
  delayAId: "",
  delayBId: "",
  forensicScheduleIds: Array(10).fill(""),
  baselineCurrentId: "",
  baselineCompareId: "",
  timeMachineScheduleIds: Array(8).fill(""),
  scurveBasis: "activities",
  scurveResourceId: "",
  scurveResourceIds: [],
  scurveStartDate: "",
  scurveFinishDate: "",
  scurveSeries: {
    planned: true,
    actual: true,
    forecast: true
  },
  notebookOutputs: {
  },
  ganttLayouts: {
    critical: null,
    wbs: null
  },
  ganttCollapsed: {
    critical: [],
    wbs: []
  },
  namedGanttLayouts: { critical: [], wbs: [] },
  activeNamedGanttLayout: { critical: "", wbs: "" },
  monte: null,
  chats: {
  },
  quantityRows: [],
  measurement: null,
  builderRows: [],
  builderWizard: null,
  builderStep: 0,
  builderGeneration: null,
  riskEdit: null,
  claimCompareAId: "",
  claimCompareBId: "",
  identifiedDelayEvents: [],
  inspectorActivityId: "",
  issueRows: [],
  issueFilter: "all",
  profile: "Data Centre",
  manpowerMode: "forward",
  manpowerScheduleId: "",
  manpowerPlannedId: "",
  manpowerActualId: "",
  manpowerLayouts: [{ id: "layout-1", fileId: "", label: "All / Project" }],
  manpowerUseAI: true,
  manpowerHoursPerPerson: 45,
  manpowerOverrides: {},
  manpowerFriday: "",
  manpowerMonth: "",
  manpowerGenerated: false,
};
export function freshGanttLayout(kind) {
  const defaults = DEFAULT_GANTT_LAYOUTS[kind] || DEFAULT_GANTT_LAYOUTS.wbs;
  return {
    fields: [...defaults.fields],
    widths: {
      ...defaults.widths
    },
    bars: {
      ...defaults.bars
    },
  };
}
export function loadGanttLayout(kind) {
  try {
    const saved = JSON.parse(localStorage.getItem(`pcai.ganttLayout.${kind}`) || "null",);
    if (saved?.fields?.length) {
      return {
        fields: saved.fields.filter((key) => GANTT_FIELDS[key]),
        widths: saved.widths || {
        },
        bars: {
          ...(DEFAULT_GANTT_LAYOUTS[kind]?.bars || DEFAULT_GANTT_BAR_SETTINGS),
          ...(saved.bars || {
          }),
        },
      };
    }
  } catch {
    // Corrupt/local legacy preferences should never stop the application.
  }
  return freshGanttLayout(kind);
}
export function saveGanttLayout(kind) {
  const layout = state.ganttLayouts[kind];
  if (layout) {
    localStorage.setItem(`pcai.ganttLayout.${kind}`, JSON.stringify(layout));
  }
}

export function loadNamedGanttLayouts(kind) {
  try {
    const rows = JSON.parse(localStorage.getItem(`pcai.namedGanttLayouts.${kind}`) || "[]");
    return Array.isArray(rows) ? rows.filter(x => x?.name && x?.layout) : [];
  } catch { return []; }
}
export function saveNamedGanttLayouts(kind, rows) {
  localStorage.setItem(`pcai.namedGanttLayouts.${kind}`, JSON.stringify(Array.isArray(rows) ? rows : []));
}
