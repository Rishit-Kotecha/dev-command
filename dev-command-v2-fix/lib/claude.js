import { env } from './http.js';
export async function askJson(prompt, opts = {}) {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) { const e = new Error('ANTHROPIC_API_KEY is not set'); e.status = 503; throw e; }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env('CLAUDE_MODEL') || 'claude-sonnet-5',
      max_tokens: opts.maxTokens || 2000,
      system: opts.system || 'You reply with valid JSON only. No prose, no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Claude API ' + r.status + ': ' + ((data.error && data.error.message) || r.statusText)); e.status = r.status; throw e; }
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch { const start = clean.indexOf('['), obj = clean.indexOf('{'); const i = start >= 0 && (obj < 0 || start < obj) ? start : obj; if (i >= 0) { try { return JSON.parse(clean.slice(i)); } catch { /* fall through */ } } const e = new Error('Claude did not return JSON'); e.status = 502; e.detail = clean.slice(0, 500); throw e; }
}
