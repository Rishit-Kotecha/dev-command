import { json, query, readBody, fail, env } from '../lib/http.js';
import { thread, createIssue, createComment, mergePR, closeIssue, getIssue, repoOk } from '../lib/gh.js';
export default async function handler(req, res) {
  try {
    if (!env('GITHUB_TOKEN')) return json(res, 503, { error: 'GITHUB_TOKEN is not set' });
    if (req.method === 'GET') {
      const q = query(req);
      if (!repoOk(q.repo) || !q.issue) return json(res, 400, { error: 'repo and issue are required' });
      return json(res, 200, await thread(q.repo, Number(q.issue), q.code || ''));
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Use GET or POST' });
    const b = await readBody(req);
    if (!repoOk(b.repo)) return json(res, 400, { error: 'repo must look like owner/name' });
    switch (b.action) {
      case 'issue': {
        if (!b.title || !b.body) return json(res, 400, { error: 'title and body are required' });
        const i = await createIssue(b.repo, String(b.title).slice(0, 250), String(b.body).slice(0, 60000), Array.isArray(b.labels) ? b.labels : ['dev-command']);
        return json(res, 200, { number: i.number, url: i.html_url });
      }
      case 'comment': {
        if (!b.issue || !b.body) return json(res, 400, { error: 'issue and body are required' });
        const c = await createComment(b.repo, Number(b.issue), String(b.body).slice(0, 60000));
        return json(res, 200, { id: c.id, url: c.html_url });
      }
      case 'merge': {
        if (!b.pr) return json(res, 400, { error: 'pr is required' });
        const m = await mergePR(b.repo, Number(b.pr), b.title ? String(b.title).slice(0, 200) : undefined);
        let closed = false;
        if (b.issue) { try { const i = await getIssue(b.repo, Number(b.issue)); if (i.state === 'open') { await closeIssue(b.repo, Number(b.issue)); closed = true; } } catch { /* ignore */ } }
        return json(res, 200, { merged: !!(m && m.merged), sha: m && m.sha, message: m && m.message, issueClosed: closed });
      }
      case 'close': {
        if (!b.issue) return json(res, 400, { error: 'issue is required' });
        await closeIssue(b.repo, Number(b.issue));
        return json(res, 200, { closed: true });
      }
      default: return json(res, 400, { error: 'Unknown action' });
    }
  } catch (e) { fail(res, e); }
}
