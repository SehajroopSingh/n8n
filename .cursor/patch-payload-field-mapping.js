const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '../workflows/social-image-render-workflow.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const chooseTemplateCode = `const aiText = $input.first().json.message?.content ?? $input.first().json.text ?? '';
const templatesSource = $('Get Templates').first().json;
const templates = Array.isArray(templatesSource.templates) ? templatesSource.templates : [];
if (!templates.length) {
  throw new Error('No templates returned from /api/templates');
}

const source = $('Set Input').first().json ?? {};
const goal = String(source.goal ?? '').trim();

const cleanJsonText = (text) => {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
};

let aiSelection = {};
try {
  const parsed = JSON.parse(cleanJsonText(aiText));
  if (parsed && typeof parsed === 'object') aiSelection = parsed;
} catch (error) {
  aiSelection = {};
}

const getTemplateId = (template) => template.id ?? template.templateId ?? template.slug;
const templatesById = new Map(templates.map((t) => [String(getTemplateId(t)), t]));

const requestedId = aiSelection.templateId !== undefined && aiSelection.templateId !== null
  ? String(aiSelection.templateId)
  : '';

const fallbackTemplate = templates[0];
const selectedTemplate = templatesById.get(requestedId) ?? fallbackTemplate;
const selectedTemplateId = String(getTemplateId(selectedTemplate));

const variants = Array.isArray(selectedTemplate.themeVariants) ? selectedTemplate.themeVariants : [];
const requestedVariant = typeof aiSelection.themeVariant === 'string' ? aiSelection.themeVariant : '';
const themeVariant = variants.includes(requestedVariant)
  ? requestedVariant
  : (variants[0] ?? requestedVariant ?? 'default');

const aiPayload = aiSelection.payload && typeof aiSelection.payload === 'object' && !Array.isArray(aiSelection.payload)
  ? { ...aiSelection.payload }
  : {};

const fieldDefs = Array.isArray(selectedTemplate.fields) ? selectedTemplate.fields : [];
const fieldKeys = fieldDefs.map((f) => f.name ?? f.key ?? f.id).filter(Boolean);

const payload = {};

const str = (v) => (v === undefined || v === null ? '' : String(v));

for (const field of fieldDefs) {
  const key = field.name ?? field.key ?? field.id;
  if (!key) continue;

  if (aiPayload[key] !== undefined && aiPayload[key] !== null && str(aiPayload[key]).trim() !== '') {
    payload[key] = aiPayload[key];
    continue;
  }

  const lowerKey = String(key).toLowerCase();
  if (lowerKey.includes('title')) {
    payload[key] = aiPayload.title ?? (goal ? goal.slice(0, 90) : 'Social post idea');
    continue;
  }
  if (lowerKey.includes('subtitle') || lowerKey.includes('tagline')) {
    payload[key] = aiPayload.subtitle ?? 'Clear message. Better results.';
    continue;
  }
  if (lowerKey.includes('myth') || lowerKey.includes('misconception')) {
    payload[key] = aiPayload.myth ?? aiPayload.title ?? (goal ? goal.slice(0, 90) : 'Common misconception');
    continue;
  }
  if (lowerKey.includes('truth') || lowerKey.includes('reality') || lowerKey.includes('insight')) {
    payload[key] = aiPayload.truth ?? aiPayload.subtitle ?? 'Clear message. Better results.';
    continue;
  }
  if (lowerKey.includes('text') || lowerKey.includes('body')) {
    payload[key] = aiPayload.body ?? aiPayload.text ?? goal;
  }
}

const genericPool = [
  aiPayload.title,
  aiPayload.subtitle,
  aiPayload.headline,
  aiPayload.tagline,
  aiPayload.body,
  aiPayload.text,
  aiPayload.myth,
  aiPayload.truth,
].filter((v) => v !== undefined && v !== null && str(v).trim() !== '');

let gi = 0;
for (const key of fieldKeys) {
  const missing = payload[key] === undefined || payload[key] === null || str(payload[key]).trim() === '';
  if (missing && gi < genericPool.length) {
    payload[key] = genericPool[gi];
    gi += 1;
  }
}

for (const key of fieldKeys) {
  const missing = payload[key] === undefined || payload[key] === null || str(payload[key]).trim() === '';
  if (missing) {
    payload[key] = goal ? goal.slice(0, 120) : '—';
  }
}

return [{
  json: {
    templateId: selectedTemplateId,
    themeVariant,
    payload,
    selectedTemplate,
    templatesCount: templates.length,
    aiRaw: aiText,
  },
}];`;

const correctPayloadCode = `const base = $('Choose Template').item.json;
const details = $input.first().json?.error?.details ?? [];
const payload = { ...(base.payload ?? {}) };
const fieldDefs = Array.isArray(base.selectedTemplate?.fields) ? base.selectedTemplate.fields : [];
const fieldKeys = fieldDefs.length
  ? fieldDefs.map((f) => f.name ?? f.key ?? f.id).filter(Boolean)
  : ['title', 'subtitle'];

for (const [key, value] of Object.entries(payload)) {
  if (typeof value === 'string' && value.length > 140) {
    payload[key] = \`\${value.slice(0, 137)}...\`;
  }
}

for (const key of fieldKeys) {
  const missing = payload[key] === undefined || payload[key] === null || payload[key] === '';
  if (missing) {
    payload[key] = key.toLowerCase().includes('title') || key.toLowerCase().includes('myth')
      ? 'Untitled idea'
      : 'Auto-generated line';
  }
}

if (Object.keys(payload).length === 0 && fieldKeys.length) {
  for (let i = 0; i < fieldKeys.length; i++) {
    payload[fieldKeys[i]] = i === 0 ? 'Untitled idea' : 'Auto-generated line';
  }
}

return [{
  json: {
    templateId: base.templateId,
    themeVariant: base.themeVariant,
    payload,
    correctionReason: details,
  },
}];`;

for (const node of wf.nodes) {
  if (node.id === 'choose-template-1') {
    node.parameters.jsCode = chooseTemplateCode;
  }
  if (node.id === 'correct-payload-1') {
    node.parameters.jsCode = correctPayloadCode;
  }
}

fs.writeFileSync(wfPath, JSON.stringify(wf));
console.log('Patched', wfPath);
