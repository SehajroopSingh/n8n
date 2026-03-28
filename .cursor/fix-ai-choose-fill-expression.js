/**
 * Fixes AI Choose + Fill:
 * 1. Single prompt in `text` only (Prompt User Message).
 * 2. Explicit empty messageValues so stale Chat Messages cannot persist.
 * 3. join(String.fromCharCode(10)) — avoids \\n escaping issues in JSON.
 * 4. No apostrophes inside single-quoted strings in the prompt lines.
 */
const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, 'workflow-clean-8.json');
const outPath = path.join(__dirname, 'workflow-clean-9.json');

const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

// Build expression body (inside {{ ... }} only the inner part uses n8n $json / $('...')
const inner = `(() => {
  const source = $('Set Input').item.json || {};
  const templates = $json.templates || [];
  const goal = String(source.goal || '').trim();
  const compactTemplates = templates.map((t) => ({
    id: t.id || t.templateId || t.slug || null,
    job: t.job || null,
    themeVariants: Array.isArray(t.themeVariants) ? t.themeVariants : [],
    contentDensity: t.contentDensity || null,
    fields: Array.isArray(t.fields)
      ? t.fields.map((f) => ({
          name: f.name || f.key || f.id || null,
          required: Boolean(f.required),
          prompt: f.prompt || f.description || null,
        }))
      : [],
  }));
  const parts = [
    'You are selecting a social image template and filling its fields.',
    'Return ONLY valid JSON (no markdown code fences, no extra text).',
    '',
    '## Post goal',
    goal || '(none)',
    '',
    '## Available templates (JSON)',
    JSON.stringify(compactTemplates, null, 2),
    '',
    '## Required JSON shape',
    '{',
    '  "templateId": "<must match a template id from the list>",',
    '  "themeVariant": "<must be one of that template themeVariants>",',
    '  "payload": { "<field name>": "<value>", "...": "..." }',
    '}',
    '',
    '## Rules',
    '- Pick the single best template for the goal.',
    '- templateId must exist in the list above.',
    '- themeVariant must be valid for that template (use the first listed if unsure).',
    '- payload keys MUST exactly match that template field names.',
    '- For each field, follow any per-field prompt or description in the template JSON.',
    '- Fill all required fields.',
    '- Keep copy concise and social-media ready.',
  ];
  return parts.join(String.fromCharCode(10));
})()`;

const textParam = `={{ ${inner} }}`;

for (const node of wf.nodes) {
  if (node.id === 'ai-choose-fill-1') {
    node.parameters = {
      promptType: 'define',
      text: textParam,
      messages: {
        messageValues: [],
      },
      hasOutputParser: false,
    };
  }
}

fs.writeFileSync(outPath, JSON.stringify(wf));
console.log('Wrote', outPath);
