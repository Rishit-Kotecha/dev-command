import { json, query, fail } from '../lib/http.js';
import { deployments } from '../lib/vercel.js';
export default async function handler(req, res) {
  try {
    const q = query(req);
    if (!q.projectId) return json(res, 400, { error: 'projectId is required' });
    const list = await deployments(q.projectId, q.teamId, Number(q.limit) || 20);
    json(res, 200, { deployments: list, at: Date.now() });
  } catch (e) { fail(res, e); }
}
