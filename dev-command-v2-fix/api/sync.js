// Reads every open task that has a GitHub issue, looks at GitHub and Vercel, and moves statuses forward.
import { json, readBody, fail, env } from '../lib/http.js';
import { readState, writeState } from '../lib/state.js';
import { thread } from '../lib/gh.js';
import { deployments, previewFor } from '../lib/vercel.js';
import { derive, LABEL } from '../lib/derive.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
    if (!env('GITHUB_TOKEN')) return json(res, 503, { error: 'GITHUB_TOKEN is not set' });
    const body = await readBody(req);
    const { state } = await readState();
    const projects = Object.fromEntries(state.projects.map((p) => [p.id, p]));
    const tasks = state.tasks.filter((t) => t.issueNumber && t.status !== 'deployed' && projects[t.projectId] && projects[t.projectId].repo && (!body.taskId || t.id === body.taskId));
    const deps = {};
    const changes = [], errors = [];
    for (const t of tasks) {
      const p = projects[t.projectId];
      try {
        if (p.vercelProjectId && env('VERCEL_TOKEN') && !(p.id in deps)) deps[p.id] = await deployments(p.vercelProjectId, p.vercelTeamId, 30).catch(() => null);
        const th = await thread(p.repo, t.issueNumber, p.code + '-' + t.num);
        const preview = deps[p.id] ? previewFor(deps[p.id], { branch: th.pr && th.pr.head, sha: th.pr && th.pr.sha, code: p.code + '-' + t.num }) : null;
        const { to, facts } = derive(t, th, preview);
        t.gh = facts;
        if (facts.prUrl && !t.prUrl) t.prUrl = facts.prUrl;
        if (facts.prHead) t.branch = facts.prHead;
        if (preview && preview.state === 'READY' && !t.previewUrl) t.previewUrl = preview.url;
        if (to !== (t.status || 'backlog')) {
          changes.push({ id: t.id, code: p.code + '-' + t.num, from: t.status, to });
          t.history = [...(t.history || []), { at: Date.now(), text: 'GitHub: moved to ' + LABEL[to] }].slice(-30);
          t.status = to;
        }
        t.updatedAt = Date.now();
      } catch (e) { errors.push({ id: t.id, code: p.code + '-' + t.num, error: e.message }); }
    }
    let sha = null;
    if (tasks.length) sha = (await writeState(state, 'Dev Command: sync from GitHub', { expect: state.updatedAt })).sha;
    json(res, 200, { checked: tasks.length, changes, errors, state: tasks.length ? (await readState()).state : state, sha });
  } catch (e) { fail(res, e); }
}
