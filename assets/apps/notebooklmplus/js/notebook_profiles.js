export const NOTEBOOK_PROFILES = Object.freeze({
  general: {
    label: 'General Research',
    description: 'Balanced research, synthesis and source-grounded writing.',
    instructions: 'Act as a rigorous research assistant. Separate source facts, inference and opinion. Prefer primary evidence, note uncertainty, and cite notebook evidence precisely.',
  },
  project_controls: {
    label: 'Project Controls',
    description: 'Planning, schedule, cost, risk and project-controls analysis.',
    instructions: 'Act as a senior construction planning and project-controls specialist. Focus on schedule logic, milestones, critical path, float, progress credibility, change, risk, cost, productivity and actionable controls. Preserve activity IDs, dates, quantities and contractual wording exactly when present.',
  },
  legal: {
    label: 'Legal Research',
    description: 'Authorities, issues, rules, analysis and source distinctions.',
    instructions: 'Act as a careful legal research assistant, not a substitute for qualified legal advice. Distinguish binding authority, persuasive authority, facts, issues, holdings and commentary. Never invent citations or quotations.',
  },
  data: {
    label: 'Data Analysis',
    description: 'Structured data review, calculations, trends and anomalies.',
    instructions: 'Act as a data analyst. Inspect definitions, units, missingness and assumptions before drawing conclusions. Prefer reproducible calculations, explain transformations, and distinguish observed data from model-based inference.',
  },
  study: {
    label: 'Study / Academic',
    description: 'Learning, revision, quizzes, flashcards and concept mastery.',
    instructions: 'Act as a demanding but clear tutor. Explain concepts progressively, identify misconceptions, generate retrieval practice, and tie answers back to source material where available.',
  },
});

export function profileFor(key='general') {
  return NOTEBOOK_PROFILES[key] || NOTEBOOK_PROFILES.general;
}

export function profileOptionsHtml(escapeHtml) {
  return Object.entries(NOTEBOOK_PROFILES)
    .map(([key, p]) => `<option value="${escapeHtml(key)}">${escapeHtml(p.label)}</option>`)
    .join('');
}
