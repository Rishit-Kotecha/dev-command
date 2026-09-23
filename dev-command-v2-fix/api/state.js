import { json, readBody, fail } from '../lib/http.js';
import { readState, writeState } from '../lib/state.js';
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') { const r = await readState(); return json(res, 200, r); }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const s = body && body.state;
      if (!s || !Array.isArray(s.projects) || !Array.isArray(s.agents) || !Array.isArray(s.tasks)) return json(res, 400, { error: 'state needs projects, agents and tasks arrays' });
      try {
        const r = await writeState(s, body.message, { expect: body.expect, force: !!body.force });
        return json(res, 200, r);
      } catch (e) {
        if (e.status === 409) return json(res, 409, { error: e.message, state: e.detail && e.detail.state });
        throw e;
      }
    }
    json(res, 405, { error: 'Use GET or PUT' });
  } catch (e) { fail(res, e); }
}
