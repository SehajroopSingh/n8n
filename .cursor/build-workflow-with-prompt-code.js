/**
 * Inserts "Build LLM Prompt" Code node; AI Choose + Fill uses only text: {{ $json.prompt }}.
 * Omits `messages` from chainLlm so no Chat Messages / systemMessage can persist.
 */
const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, 'workflow-clean-9.json');
const outPath = path.join(__dirname, 'workflow-clean-10.json');

const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const buildPromptJs = `const templatesResponse = $input.first().json;
const templates = Array.isArray(templatesResponse.templates) ? templatesResponse.templates : [];
const goal = String(($('Set Input').first().json || {}).goal || '').trim();

const compactTemplates = templates.map((t) => ({
  id: t.id ?? t.templateId ?? t.slug ?? null,
  job: t.job ?? null,
  themeVariants: Array.isArray(t.themeVariants) ? t.themeVariants : [],
  contentDensity: t.contentDensity ?? null,
  fields: Array.isArray(t.fields)
    ? t.fields.map((f) => ({
        name: f.name ?? f.key ?? f.id ?? null,
        required: Boolean(f.required),
        prompt: f.prompt ?? f.description ?? null,
      }))
    : [],
}));

const lines = [
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

return [{ json: { prompt: lines.join(String.fromCharCode(10)) } }];`;

const buildPromptNode = {
  id: 'build-llm-prompt-1',
  name: 'Build LLM Prompt',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1280, 220],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: buildPromptJs,
  },
};

// Insert after get-templates in nodes array (before ai-choose-fill)
const gtIdx = wf.nodes.findIndex((n) => n.id === 'get-templates-1');
const aiIdx = wf.nodes.findIndex((n) => n.id === 'ai-choose-fill-1');
if (gtIdx === -1 || aiIdx === -1) throw new Error('missing nodes');
if (!wf.nodes.some((n) => n.id === 'build-llm-prompt-1')) {
  wf.nodes.splice(aiIdx, 0, buildPromptNode);
}

// AI Choose + Fill: only prompt reference — no messages key
for (const node of wf.nodes) {
  if (node.id === 'ai-choose-fill-1') {
    node.position = [1520, 180];
    node.parameters = {
      promptType: 'define',
      text: '={{ $json.prompt }}',
      hasOutputParser: false,
    };
  }
}

// Connections
wf.connections['Get Templates'] = {
  main: [[{ node: 'Build LLM Prompt', type: 'main', index: 0 }]],
};
wf.connections['Build LLM Prompt'] = {
  main: [[{ node: 'AI Choose + Fill', type: 'main', index: 0 }]],
};
wf.connections['Google Gemini Chat Model'] = wf.connections['Google Gemini Chat Model'] || {
  ai_languageModel: [[{ node: 'AI Choose + Fill', type: 'ai_languageModel', index: 0 }]],
};

fs.writeFileSync(outPath, JSON.stringify(wf));
console.log('Wrote', outPath);
