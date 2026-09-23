import { json, query, fail, env } from '../lib/http.js';
async function sb(path) {
  const t = env('SUPABASE_ACCESS_TOKEN');
  if (!t) { const e = new Error('SUPABASE_ACCESS_TOKEN is not set'); e.status = 503; throw e; }
  const r = await fetch('https://api.supabase.com/v1' + path, { headers: { Authorization: 'Bearer ' + t } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Supabase ' + r.status + ': ' + (data.message || r.statusText)); e.status = r.status; throw e; }
  return data;
}
export default async function handler(req, res) {
  try {
    const q = query(req);
    if (!/^[a-z0-9]{15,30}$/.test(q.ref || '')) return json(res, 400, { error: 'ref is required' });
    const [project, migrations] = await Promise.all([sb('/projects/' + q.ref), sb('/projects/' + q.ref + '/database/migrations').catch(() => [])]);
    json(res, 200, { project: { name: project.name, status: project.status, region: project.region, version: project.database && project.database.version }, migrations: Array.isArray(migrations) ? migrations : [], at: Date.now() });
  } catch (e) { fail(res, e); }
}
