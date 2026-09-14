/**
 * BOQ-to-schedule recommendation engine. Builds activity search indexes and ranks
 * likely P6 activity IDs without overwriting manually assigned activity IDs.
 */
const STOP = new Set(["the", "and", "for", "with", "from", "into", "onto", "per", "each", "all", "new", "existing", "supply", "provide", "including", "incl", "complete", "works", "work", "item", "items", "qty", "quantity", "unit", "units", "nr", "lot", "mm", "cm", "meter", "metre", "meters", "metres"]);
function normalToken(x) {
  const aliases = {
    installation: "install",
    installations: "install",
    installed: "install",
    installing: "install",
    cables: "cable",
    pipes: "pipe",
    drawings: "drawing",
    fixtures: "fixture",
    panels: "panel",
    systems: "system",
    rooms: "room",
    areas: "area"
  };
  if (aliases[x])return aliases[x];
  if (x.length>4 && x.endsWith("s") && !x.endsWith("ss"))return x.slice(0, - 1);
  return x;
}
export function alignmentTokens(value) {
  return[...new Set(String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).map(normalToken).filter(x => x.length>1 && !STOP.has(x)))];
}
export function activityAlignmentIndex(activities = []) {
  return activities.filter(a => a?.id).map(a => ( {
    id: String(a.id), name: String(a.name || ""), wbs: String(a.wbsPath || a.wbs || ""), discipline: String(a.discipline || ""), tokens: alignmentTokens(`${a.id} ${a.name || ""} ${a.wbsPath || a.wbs || ""} ${a.discipline || ""}`)
  }));
}
export function pdfScheduleCandidates(text) {
  const map = new Map(),
  lines = String(text || "").split(/\r?\n/).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
  const idRe = /\b(?=[A-Za-z0-9_.-]{3,24}\b)(?=[A-Za-z0-9_.-]*[A-Za-z])(?=[A-Za-z0-9_.-]*\d)[A-Za-z0-9][A-Za-z0-9_.-]*\b/g;
  for (const line of lines) {
    const ids = line.match(idRe) || [];
    for (const raw of ids) {
      const id = raw.replace(/[.,;:]$/g, "");
      if (/^\d{4}[-/.]\d{1,2}/.test(id) || map.has(id))continue;
      const pos = line.indexOf(raw),
      name = (line.slice(pos + raw.length).replace(/^\s*[-–—:|]+\s*/, "") || line.replace(raw, "")).trim();
      if (name.length<2)continue;
      map.set(id, {
        id, name, wbs: "", discipline: "", tokens: alignmentTokens(`${id} ${name}`)
      });
    }
  }
  return[...map.values()];
}
function rowText(row) {
  if (row==null)return "";
  if (typeof row==="string")return row;
  if (Array.isArray(row))return row.join(" ");
  return[row.discipline, row.category, row.item, row.boq, row.description, row.name, row.unit, ...Object.values(row)].filter(Boolean).join(" ");
}
export function recommendActivityIds(row, index, {
  limit = 3, minScore = .14
}
= {
}) {
  const raw = rowText(row),
  q = alignmentTokens(raw);
  if (!q.length || !index?.length)return[];
  const qset = new Set(q),
  rawLower = raw.toLowerCase();
  const scored = index.map(a => {
    const aset = new Set(a.tokens || alignmentTokens(`${a.id} ${a.name} ${a.wbs}`)); let hit = 0; for (const t of qset)if (aset.has(t))hit+=t.length>=6? 1.35: 1; let score = hit / Math.max(2, qset.size); if (a.name && rawLower.includes(a.name.toLowerCase()))score+=1.5; if (a.id && rawLower.includes(a.id.toLowerCase()))score+=2; const nameTokens = alignmentTokens(a.name); if (nameTokens.length) {
      const nh = nameTokens.filter(t => qset.has(t)).length; score+=.55 * (nh / nameTokens.length)
    }
    return {
      id: a.id, score
    };
  }).filter(x => x.score>=minScore).sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  if (!scored.length)return[];
  const best = scored[0].score,
  band = scored.filter(x => x.score>=Math.max(minScore, best * .62));
  return band.slice(0, limit).map(x => x.id);
}
export function alignMeasurementRows(rows, index, opts = {
}) {
  return(rows || []).map(row => ( {
    ...row, recommendedActivityIds: recommendActivityIds(row, index, opts).join("; ")
  }));
}
