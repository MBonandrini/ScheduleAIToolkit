/**
 * Multi-revision forensic evidence engine. Produces auditable transition records
 * for activities, progress, resources, calendars and relationships.
 */
import {
  compareSchedules
} from "./comparison.js";
import {
  isoDate
} from "../core/utils.js";
const n = v => Number(v || 0);
const s = v => String(v ?? "");
const activityMap = schedule => new Map((schedule?.activities || []).map(a => [String(a.id), a]));
const resourceMap = schedule => new Map((schedule?.resources || []).map(r => [String(r.id), r]));
const calendarMap = schedule => new Map((schedule?.calendars || []).map(c => [String(c.id), c]));
const scheduleLabel = (schedule, index = 0) => isoDate(schedule?.dataDate) || schedule?.name || schedule?.sourceName || `Revision ${index + 1}`;
const transitionLabel = (a, b, idx) => `${scheduleLabel(a, idx)} → ${scheduleLabel(b, idx + 1)}`;
const fmtDate = v => v? isoDate(v): "";
const assignmentKey = x => `${s(x?.activityId || x?.task_id)}|${s(x?.resourceId || x?.rsrc_id)}`;
const assignmentSnapshot = x => ( {
  budget: n(x?.target_qty ?? x?.budgetUnits), actual: n(x?.act_reg_qty ?? x?.actualUnits), remaining: n(x?.remain_qty ?? x?.remainingUnits), atCompletion: n(x?.act_reg_qty ?? x?.actualUnits) + n(x?.remain_qty ?? x?.remainingUnits), budgetCost: n(x?.target_cost ?? x?.budgetCost), actualCost: n(x?.act_reg_cost ?? x?.actualCost), remainingCost: n(x?.remain_cost ?? x?.remainingCost)
});
function aggregateAssignments(schedule) {
  const out = new Map();
  for (const x of schedule?.assignments || []) {
    const key = assignmentKey(x);
    if (key==="|")continue;
    const snap = assignmentSnapshot(x),
    old = out.get(key) || {
      activityId: s(x.activityId || x.task_id),
      resourceId: s(x.resourceId || x.rsrc_id),
      budget: 0,
      actual: 0,
      remaining: 0,
      atCompletion: 0,
      budgetCost: 0,
      actualCost: 0,
      remainingCost: 0
    };
    for (const k of["budget", "actual", "remaining", "atCompletion", "budgetCost", "actualCost", "remainingCost"])old[k]+=snap[k];
    out.set(key, old);
  }
  return out;
}
function totalResourceProfile(schedule) {
  const assignments = [...aggregateAssignments(schedule).values()];
  if (assignments.length)return assignments.reduce((o, x) => {
    for (const k of["budget", "actual", "remaining", "atCompletion"])o[k]+=n(x[k]); return o
  }, {
    budget: 0, actual: 0, remaining: 0, atCompletion: 0
  });
  return(schedule?.activities || []).reduce((o, a) => {
    o.budget+=n(a.budgetUnits); o.actual+=n(a.actualUnits); o.remaining+=n(a.remainingUnits); o.atCompletion+=n(a.actualUnits) + n(a.remainingUnits); return o
  }, {
    budget: 0, actual: 0, remaining: 0, atCompletion: 0
  });
}
function relationPairKey(r) {
  return`${s(r?.predId)}|${s(r?.succId)}`
}
function relationExactKey(r) {
  return`${relationPairKey(r)}|${s(r?.type || "FS").toUpperCase()}|${n(r?.lag).toFixed(6)}`
}
/**
 * Compare relationships by predecessor/successor pair first. Exact matches are
 * removed; remaining before/after records on the same pair become a single
 * "Changed" record (type/lag changed) instead of a misleading add + remove.
 */
function relationshipDelta(previous, current) {
  const pByPair = new Map(),
  cByPair = new Map();
  for (const r of previous?.relationships || []) {
    const k = relationPairKey(r);
    if (!pByPair.has(k))pByPair.set(k, []);
    pByPair.get(k).push(r)
  }
  for (const r of current?.relationships || []) {
    const k = relationPairKey(r);
    if (!cByPair.has(k))cByPair.set(k, []);
    cByPair.get(k).push(r)
  }
  const added = [],
  removed = [],
  changed = [];
  for (const pair of new Set([...pByPair.keys(), ...cByPair.keys()])) {
    let old = [...(pByPair.get(pair) || [])],
    now = [...(cByPair.get(pair) || [])];
    const exactNow = new Map();
    for (const r of now) {
      const k = relationExactKey(r);
      if (!exactNow.has(k))exactNow.set(k, []);
      exactNow.get(k).push(r)
    }
    const unmatchedOld = [];
    for (const r of old) {
      const k = relationExactKey(r),
      bucket = exactNow.get(k);
      if (bucket?.length)bucket.shift();
      else unmatchedOld.push(r)
    }
    now = [...exactNow.values()].flat();
    old = unmatchedOld;
    while (old.length && now.length) {
      changed.push( {
        before: old.shift(), after: now.shift()
      })
    }
    removed.push(...old);
    added.push(...now);
  }
  return {
    added,
    removed,
    changed
  };
}
function activityLabel(map, id) {
  const a = map.get(String(id));
  return a? `${a.id} · ${a.name}`: String(id || "")
}
function resourceLabel(map, id) {
  const r = map.get(String(id));
  return r? `${r.id} · ${r.name}`: String(id || "")
}
function calendarLabel(map, id, fallback = "") {
  const c = map.get(String(id));
  return c? `${c.id} · ${c.name}`: (fallback || String(id || ""))
}
/**
 * Build revision-to-revision forensic evidence for an explicitly ordered set of
 * schedules. The function is pure: it returns evidence records and summary
 * series without mutating any source schedule.
 */
export function buildForensicEvidence(schedules = []) {
  const ordered = (schedules || []).filter(Boolean);
  const evidence = {
    transitions: [],
    activities: {
      rows: [],
      chartRows: [],
      added: 0,
      removed: 0
    },
    progress: {
      rows: [],
      chartRows: [],
      changed: 0,
      actualAdded: 0,
      actualRemoved: 0
    },
    resourcing: {
      totals: [],
      masterRows: [],
      rows: [],
      chartRows: [],
      added: 0,
      removed: 0,
      changed: 0
    },
    calendars: {
      definitionRows: [],
      assignmentRows: [],
      chartRows: [],
      added: 0,
      removed: 0,
      changed: 0,
      assignments: 0
    },
    relationships: {
      rows: [],
      chartRows: [],
      added: 0,
      removed: 0,
      changed: 0
    }
  };
  evidence.resourcing.totals = ordered.map((schedule, i) => ( {
    label: scheduleLabel(schedule, i), ...totalResourceProfile(schedule)
  }));
  for (let i = 1; i<ordered.length; i++) {
    const previous = ordered[i - 1],
    current = ordered[i],
    label = transitionLabel(previous, current, i - 1),
    comp = compareSchedules(previous, current),
    pActs = activityMap(previous),
    cActs = activityMap(current),
    pRes = resourceMap(previous),
    cRes = resourceMap(current),
    pCal = calendarMap(previous),
    cCal = calendarMap(current);
    const transition = {
      label,
      previous,
      current,
      comparison: comp
    };
    evidence.transitions.push(transition);
    for (const a of comp.added)evidence.activities.rows.push( {
      transition: label, type: "Added", id: a.id, name: a.name, wbs: a.wbsPath || "", status: a.status || ""
    });
    for (const a of comp.deleted)evidence.activities.rows.push( {
      transition: label, type: "Removed", id: a.id, name: a.name, wbs: a.wbsPath || "", status: a.status || ""
    });
    evidence.activities.added+=comp.added.length;
    evidence.activities.removed+=comp.deleted.length;
    evidence.activities.chartRows.push( {
      label, added: comp.added.length, removed: comp.deleted.length
    });
    let progressChanged = 0,
    actualAdded = 0,
    actualRemoved = 0;
    for (const[id, now]of cActs) {
      const old = pActs.get(id);
      if (!old)continue;
      const delta = n(now.percent) - n(old.percent);
      if (Math.abs(delta)>1e-9) {
        progressChanged++;
        evidence.progress.rows.push( {
          transition: label, type: delta>=0? "Progress increased": "Progress reduced/reset", activity: `${id} · ${now.name}`, field: "Progress", before: `${n(old.percent).toFixed(1)}%`, after: `${n(now.percent).toFixed(1)}%`, delta: `${delta>=0? "+": ""}${delta.toFixed(1)} pts`
        })
      }
      for (const[field, caption]of[["actualStart", "Actual Start"], ["actualFinish", "Actual Finish"]]) {
        const before = old[field],
        after = now[field];
        if (!before && after) {
          actualAdded++;
          evidence.progress.rows.push( {
            transition: label, type: "Actual date added", activity: `${id} · ${now.name}`, field: caption, before: "—", after: fmtDate(after), delta: "Added"
          })
        } else if (before && !after) {
          actualRemoved++;
          evidence.progress.rows.push( {
            transition: label, type: "Actual date removed", activity: `${id} · ${now.name}`, field: caption, before: fmtDate(before), after: "—", delta: "Removed"
          })
        } else if (before && after && fmtDate(before)!==fmtDate(after)) {
          evidence.progress.rows.push( {
            transition: label, type: "Actual date changed", activity: `${id} · ${now.name}`, field: caption, before: fmtDate(before), after: fmtDate(after), delta: "Changed"
          })
        }
      }
    }
    evidence.progress.changed+=progressChanged;
    evidence.progress.actualAdded+=actualAdded;
    evidence.progress.actualRemoved+=actualRemoved;
    evidence.progress.chartRows.push( {
      label, progressChanged, actualAdded, actualRemoved
    });
    for (const r of comp.resources.added) {
      evidence.resourcing.masterRows.push( {
        transition: label, type: "Resource added", resource: resourceLabel(cRes, r.id), before: "—", after: r.type || r.raw?.rsrc_type || ""
      });
      evidence.resourcing.added++
    }
    for (const r of comp.resources.deleted) {
      evidence.resourcing.masterRows.push( {
        transition: label, type: "Resource removed", resource: resourceLabel(pRes, r.id), before: r.type || r.raw?.rsrc_type || "", after: "—"
      });
      evidence.resourcing.removed++
    }
    for (const r of comp.resources.changed) {
      evidence.resourcing.masterRows.push( {
        transition: label, type: "Resource master changed", resource: resourceLabel(cRes, r.after?.id || r.key), before: JSON.stringify(r.beforeSnapshot), after: JSON.stringify(r.afterSnapshot)
      });
      evidence.resourcing.changed++
    }
    const pAssign = aggregateAssignments(previous),
    cAssign = aggregateAssignments(current);
    let assignmentAdded = 0,
    assignmentRemoved = 0,
    loadingChanged = 0;
    for (const[key, now]of cAssign) {
      const old = pAssign.get(key);
      const[activityId, resourceId] = key.split("|");
      if (!old) {
        assignmentAdded++;
        evidence.resourcing.rows.push( {
          transition: label, type: "Assignment added", activity: activityLabel(cActs, activityId), resource: resourceLabel(cRes, resourceId), actualBefore: 0, actualAfter: now.actual, actualDelta: now.actual, atCompletionBefore: 0, atCompletionAfter: now.atCompletion, atCompletionDelta: now.atCompletion, budgetBefore: 0, budgetAfter: now.budget
        })
      } else {
        const actualDelta = now.actual - old.actual,
        atCompletionDelta = now.atCompletion - old.atCompletion,
        budgetDelta = now.budget - old.budget,
        remainingDelta = now.remaining - old.remaining;
        if ([actualDelta, atCompletionDelta, budgetDelta, remainingDelta].some(v => Math.abs(v)>1e-9)) {
          loadingChanged++;
          evidence.resourcing.rows.push( {
            transition: label, type: "Loading / actuals changed", activity: activityLabel(cActs, activityId), resource: resourceLabel(cRes, resourceId), actualBefore: old.actual, actualAfter: now.actual, actualDelta, atCompletionBefore: old.atCompletion, atCompletionAfter: now.atCompletion, atCompletionDelta, budgetBefore: old.budget, budgetAfter: now.budget
          })
        }
      }
    }
    for (const[key, old]of pAssign)if (!cAssign.has(key)) {
      const[activityId, resourceId] = key.split("|");
      assignmentRemoved++;
      evidence.resourcing.rows.push( {
        transition: label, type: "Assignment removed", activity: activityLabel(pActs, activityId), resource: resourceLabel(pRes, resourceId), actualBefore: old.actual, actualAfter: 0, actualDelta: -old.actual, atCompletionBefore: old.atCompletion, atCompletionAfter: 0, atCompletionDelta: -old.atCompletion, budgetBefore: old.budget, budgetAfter: 0
      })
    }
    evidence.resourcing.chartRows.push( {
      label, added: assignmentAdded, removed: assignmentRemoved, changed: loadingChanged
    });
    for (const c of comp.calendars.added) {
      evidence.calendars.definitionRows.push( {
        transition: label, type: "Calendar added", calendar: calendarLabel(cCal, c.id, c.name), before: "—", after: `${c.hoursPerDay || 0}h/day · ${c.hoursPerWeek || 0}h/week`
      });
      evidence.calendars.added++
    }
    for (const c of comp.calendars.deleted) {
      evidence.calendars.definitionRows.push( {
        transition: label, type: "Calendar removed", calendar: calendarLabel(pCal, c.id, c.name), before: `${c.hoursPerDay || 0}h/day · ${c.hoursPerWeek || 0}h/week`, after: "—"
      });
      evidence.calendars.removed++
    }
    for (const c of comp.calendars.changed) {
      evidence.calendars.definitionRows.push( {
        transition: label, type: "Calendar definition changed", calendar: calendarLabel(cCal, c.after?.id || c.key, c.after?.name), before: JSON.stringify(c.beforeSnapshot), after: JSON.stringify(c.afterSnapshot)
      });
      evidence.calendars.changed++
    }
    let assignmentChanges = 0;
    for (const[id, now]of cActs) {
      const old = pActs.get(id);
      if (!old)continue;
      if (String(old.calendarId || old.calendarName)!==String(now.calendarId || now.calendarName)) {
        assignmentChanges++;
        evidence.calendars.assignmentRows.push( {
          transition: label, activity: `${id} · ${now.name}`, before: calendarLabel(pCal, old.calendarId, old.calendarName), after: calendarLabel(cCal, now.calendarId, now.calendarName)
        })
      }
    }
    evidence.calendars.assignments+=assignmentChanges;
    evidence.calendars.chartRows.push( {
      label, added: comp.calendars.added.length, removed: comp.calendars.deleted.length, changed: comp.calendars.changed.length, assignments: assignmentChanges
    });
    const rel = relationshipDelta(previous, current);
    for (const r of rel.added)evidence.relationships.rows.push( {
      transition: label, type: "Added", predecessor: activityLabel(cActs, r.predId), successor: activityLabel(cActs, r.succId), before: "—", after: `${r.type || "FS"} ${n(r.lag)? `${n(r.lag)}d lag`: "0d lag"}`
    });
    for (const r of rel.removed)evidence.relationships.rows.push( {
      transition: label, type: "Removed", predecessor: activityLabel(pActs, r.predId), successor: activityLabel(pActs, r.succId), before: `${r.type || "FS"} ${n(r.lag)? `${n(r.lag)}d lag`: "0d lag"}`, after: "—"
    });
    for (const r of rel.changed)evidence.relationships.rows.push( {
      transition: label, type: "Changed", predecessor: activityLabel(cActs, r.after.predId), successor: activityLabel(cActs, r.after.succId), before: `${r.before.type || "FS"} ${n(r.before.lag)? `${n(r.before.lag)}d lag`: "0d lag"}`, after: `${r.after.type || "FS"} ${n(r.after.lag)? `${n(r.after.lag)}d lag`: "0d lag"}`
    });
    evidence.relationships.added+=rel.added.length;
    evidence.relationships.removed+=rel.removed.length;
    evidence.relationships.changed+=rel.changed.length;
    evidence.relationships.chartRows.push( {
      label, added: rel.added.length, removed: rel.removed.length, changed: rel.changed.length
    });
  }
  return evidence;
}
