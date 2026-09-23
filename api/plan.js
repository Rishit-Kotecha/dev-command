import { json, readBody, fail } from '../lib/http.js';
import { askJson } from '../lib/claude.js';
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
    const b = await readBody(req);
    if (!b.prompt) return json(res, 400, { error: 'prompt is required' });
    const data = await askJson(String(b.prompt).slice(0, 40000), { maxTokens: 3000 });
    json(res, 200, { tasks: Array.isArray(data) ? data : (data && data.tasks) || [] });
  } catch (e) { fail(res, e); }
}
