import { escapeHtml } from './utils.js';

export const STUDIO_TYPES = Object.freeze({
  summary: { label:'Executive Summary', icon:'▣', structured:false },
  briefing: { label:'Briefing Document', icon:'▤', structured:false },
  study_guide: { label:'Study Guide', icon:'⌁', structured:false },
  report: { label:'Detailed Report', icon:'▧', structured:false },
  mind_map: { label:'Mind Map', icon:'◎', structured:true },
  quiz: { label:'Quiz', icon:'?', structured:true },
  flashcards: { label:'Flashcards', icon:'▱', structured:true },
  presentation: { label:'Presentation', icon:'▥', structured:true },
  spreadsheet: { label:'Spreadsheet / Data Analysis', icon:'▦', structured:true },
  audio_overview: { label:'Audio Overview', icon:'◉', structured:true },
});

const JSON_SHAPES = {
  mind_map: `Return ONLY valid JSON with this shape:\n{"title":"...","children":[{"title":"...","note":"...","children":[...]}]}`,
  quiz: `Return ONLY valid JSON with this shape:\n{"title":"...","questions":[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","sourceHint":"[S1] or blank"}]}`,
  flashcards: `Return ONLY valid JSON with this shape:\n{"title":"...","cards":[{"front":"...","back":"...","sourceHint":"[S1] or blank"}]}`,
  presentation: `Return ONLY valid JSON with this shape:\n{"title":"...","slides":[{"title":"...","bullets":["..."],"speakerNotes":"...","sourceHints":["[S1]"]}]}`,
  spreadsheet: `Return ONLY valid JSON with this shape:\n{"title":"...","summary":"...","columns":["Metric","Value","Comment"],"rows":[["...","...","..."]],"findings":["..."],"calculations":[{"label":"...","formula":"...","result":"..."}],"chart":{"type":"bar","title":"...","labels":["A","B"],"values":[1,2]}}`,
  audio_overview: `Return ONLY valid JSON with this shape:\n{"title":"...","durationMinutes":10,"speakers":["Host A","Host B"],"dialogue":[{"speaker":"Host A","text":"..."},{"speaker":"Host B","text":"..."}]}`,
};

export function studioType(key) { return STUDIO_TYPES[key] || STUDIO_TYPES.summary; }

export function buildStudioPrompt({ type, topic='', profileLabel='General Research', profileInstructions='', evidenceText='', hasEvidence=false }) {
  const sourceRule = hasEvidence
    ? 'Use the supplied notebook evidence as the primary factual basis. Cite source-grounded claims inline with the exact [S#] markers provided.'
    : 'No notebook evidence is available. You may use general model knowledge, but explicitly avoid implying that unsupported facts came from notebook sources.';
  const shared = `You are generating a NotebookLM+ Studio artifact.\nNotebook profile: ${profileLabel}.\n${profileInstructions}\n${sourceRule}\nNever invent file names, page numbers, clauses, dates, figures or quotations.\nUser focus: ${topic || 'Create the artifact from the notebook as a whole.'}`;
  const evidence = hasEvidence ? `\n\nNotebook evidence:\n${evidenceText}` : '';
  switch (type) {
    case 'summary': return `${shared}\nCreate an executive summary with: purpose, key findings, important evidence, implications, open questions and recommended next actions. Keep it concise but substantive.${evidence}`;
    case 'briefing': return `${shared}\nCreate a professional briefing document with Situation, Key Evidence, Analysis, Risks/Issues, Decisions Needed, and Next Actions.${evidence}`;
    case 'study_guide': return `${shared}\nCreate a study guide with learning objectives, core concepts, definitions, worked explanations, likely misconceptions, self-test questions and a revision checklist.${evidence}`;
    case 'report': return `${shared}\nCreate a detailed report with executive summary, background, methodology/evidence basis, findings, analysis, risks/limitations, recommendations and conclusion.${evidence}`;
    case 'mind_map': return `${shared}\nCreate a hierarchical concept map that captures the main topic, major branches and useful sub-branches. Notes should be short. ${JSON_SHAPES.mind_map}${evidence}`;
    case 'quiz': return `${shared}\nCreate 12 challenging multiple-choice questions. Use source evidence where available. Provide four plausible options, the zero-based correct answer index and a concise explanation. ${JSON_SHAPES.quiz}${evidence}`;
    case 'flashcards': return `${shared}\nCreate 20 high-value flashcards using retrieval-practice principles. Fronts should be questions/prompts, backs concise but complete. ${JSON_SHAPES.flashcards}${evidence}`;
    case 'presentation': return `${shared}\nCreate a presentation suitable for a professional audience. Use 8-12 slides, strong slide titles, concise bullets, and useful speaker notes. ${JSON_SHAPES.presentation}${evidence}`;
    case 'spreadsheet': return `${shared}\nExtract or synthesise the most useful structured table from the evidence. Include calculations and findings where justified. Do not fabricate numeric values. ${JSON_SHAPES.spreadsheet}${evidence}`;
    case 'audio_overview': return `${shared}\nWrite an engaging two-speaker audio overview. The speakers should explain, connect and challenge the material rather than merely read a summary. Target about 8-12 minutes at normal speaking speed. ${JSON_SHAPES.audio_overview}${evidence}`;
    default: return `${shared}\nCreate a useful source-grounded artifact.${evidence}`;
  }
}

export function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('The model returned an empty structured artifact.');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || raw;
  try { return JSON.parse(candidate); }
  catch {
    const startObj = candidate.indexOf('{');
    const endObj = candidate.lastIndexOf('}');
    if (startObj >= 0 && endObj > startObj) return JSON.parse(candidate.slice(startObj, endObj + 1));
    throw new Error('The model did not return valid JSON for this Studio artifact. Try again or use a model with stronger structured-output support.');
  }
}

function renderMindNode(node, depth=0) {
  const children = Array.isArray(node?.children) ? node.children : [];
  const title = escapeHtml(node?.title || 'Untitled');
  const note = node?.note ? `<div class="mind-note">${escapeHtml(node.note)}</div>` : '';
  if (!children.length) return `<div class="mind-leaf"><strong>${title}</strong>${note}</div>`;
  return `<details class="mind-node" ${depth < 2 ? 'open' : ''}><summary><strong>${title}</strong></summary>${note}<div class="mind-children">${children.map(c => renderMindNode(c, depth+1)).join('')}</div></details>`;
}

export function renderStructuredArtifact(type, data) {
  if (!data || typeof data !== 'object') return '<div class="empty-state">No structured data.</div>';
  if (type === 'mind_map') return `<div class="mind-map"><h3>${escapeHtml(data.title || 'Mind Map')}</h3>${(data.children || []).map(c => renderMindNode(c)).join('')}</div>`;
  if (type === 'quiz') return `<div class="quiz-view"><h3>${escapeHtml(data.title || 'Quiz')}</h3>${(data.questions || []).map((q,i) => `<details class="quiz-question"><summary>${i+1}. ${escapeHtml(q.question || '')}</summary><ol type="A">${(q.options || []).map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ol><div class="quiz-answer"><strong>Answer:</strong> ${escapeHtml((q.options || [])[Number(q.answer)] || String(q.answer ?? ''))}<br><span>${escapeHtml(q.explanation || '')}</span>${q.sourceHint ? `<div class="muted">${escapeHtml(q.sourceHint)}</div>` : ''}</div></details>`).join('')}</div>`;
  if (type === 'flashcards') return `<div class="flashcard-grid">${(data.cards || []).map((c,i) => `<button class="flashcard" type="button" data-flashcard><span class="flash-front"><small>Card ${i+1}</small>${escapeHtml(c.front || '')}</span><span class="flash-back"><small>Answer</small>${escapeHtml(c.back || '')}${c.sourceHint ? `<em>${escapeHtml(c.sourceHint)}</em>` : ''}</span></button>`).join('')}</div>`;
  if (type === 'presentation') return `<div class="slide-grid"><h3>${escapeHtml(data.title || 'Presentation')}</h3>${(data.slides || []).map((s,i) => `<article class="slide-card"><div class="slide-number">${i+1}</div><h4>${escapeHtml(s.title || '')}</h4><ul>${(s.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>${s.speakerNotes ? `<details><summary>Speaker notes</summary><p>${escapeHtml(s.speakerNotes)}</p></details>` : ''}</article>`).join('')}</div>`;
  if (type === 'spreadsheet') {
    const labels=Array.isArray(data.chart?.labels)?data.chart.labels:[]; const values=Array.isArray(data.chart?.values)?data.chart.values.map(Number):[]; const finite=values.filter(Number.isFinite); const max=finite.length?Math.max(...finite.map(Math.abs),1):1;
    const chart=labels.length&&values.length?`<div class="mini-chart"><h4>${escapeHtml(data.chart?.title||'Chart')}</h4>${labels.slice(0,30).map((label,i)=>{const v=Number(values[i]);const pct=Number.isFinite(v)?Math.min(100,Math.abs(v)/max*100):0;return `<div class="chart-row"><span>${escapeHtml(label)}</span><div class="chart-track"><div class="chart-bar" style="width:${pct.toFixed(2)}%"></div></div><strong>${escapeHtml(Number.isFinite(v)?v:'')}</strong></div>`}).join('')}</div>`:'';
    return `<div class="table-artifact"><h3>${escapeHtml(data.title || 'Data Analysis')}</h3>${data.summary ? `<p>${escapeHtml(data.summary)}</p>` : ''}${chart}<div class="table-scroll"><table><thead><tr>${(data.columns || []).map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${(data.rows || []).map(r=>`<tr>${(r || []).map(c=>`<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${(data.findings || []).length ? `<h4>Findings</h4><ul>${data.findings.map(f=>`<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  if (type === 'audio_overview') return `<div class="audio-script"><h3>${escapeHtml(data.title || 'Audio Overview')}</h3><div class="audio-controls"><button type="button" class="btn primary" data-audio-play>▶ Play</button><button type="button" class="btn secondary" data-audio-stop>■ Stop</button></div>${(data.dialogue || []).map(line=>`<div class="dialogue-line"><strong>${escapeHtml(line.speaker || 'Speaker')}</strong><p>${escapeHtml(line.text || '')}</p></div>`).join('')}</div>`;
  return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

export function artifactPlainText(type, data, fallback='') {
  if (!data || typeof data !== 'object') return fallback;
  if (type === 'mind_map') {
    const lines = [data.title || 'Mind Map'];
    const walk = (nodes, depth=0) => (nodes || []).forEach(n => { lines.push(`${'  '.repeat(depth)}- ${n.title || ''}${n.note ? ` — ${n.note}` : ''}`); walk(n.children, depth+1); });
    walk(data.children); return lines.join('\n');
  }
  if (type === 'quiz') return (data.questions || []).map((q,i)=>`${i+1}. ${q.question}\n${(q.options || []).map((o,j)=>`  ${String.fromCharCode(65+j)}. ${o}`).join('\n')}\nAnswer: ${(q.options || [])[Number(q.answer)] || q.answer}\n${q.explanation || ''}`).join('\n\n');
  if (type === 'flashcards') return (data.cards || []).map((c,i)=>`${i+1}. ${c.front}\n   ${c.back}`).join('\n\n');
  if (type === 'presentation') return (data.slides || []).map((s,i)=>`Slide ${i+1}: ${s.title}\n${(s.bullets || []).map(b=>`- ${b}`).join('\n')}\n${s.speakerNotes || ''}`).join('\n\n');
  if (type === 'spreadsheet') return `${data.title || ''}\n${data.summary || ''}\n\n${(data.columns || []).join('\t')}\n${(data.rows || []).map(r=>(r || []).join('\t')).join('\n')}`;
  if (type === 'audio_overview') return (data.dialogue || []).map(l=>`${l.speaker}: ${l.text}`).join('\n\n');
  return fallback || JSON.stringify(data, null, 2);
}
