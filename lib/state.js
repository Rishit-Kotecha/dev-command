// State lives as data/state.json on the DATA_BRANCH of the app's own repo, written through the GitHub Contents API.
import { gh, repoOk } from './gh.js';
import { dataRepo, env } from './http.js';

const PATH = 'data/state.json';
export const EMPTY = { version: 1, projects: [], agents: [], tasks: [], updatedAt: 0 };
const branch = () => env('DATA_BRANCH') || 'data';

function repo() {
  const r = dataRepo();
  if (!repoOk(r)) { const e = new Error('DATA_REPO is not set (owner/name of the repo that stores data/state.json)'); e.status = 503; throw e; }
  return r;
}

async function ensureBranch(r) {
  try { await gh(`/repos/${r}/git/ref/heads/${branch()}`); return; } catch (e) { if (e.status !== 404) throw e; }
  const meta = await gh(`/repos/${r}`);
  const base = await gh(`/repos/${r}/git/ref/heads/${meta.default_branch}`);
  await gh(`/repos/${r}/git/refs`, { method: 'POST', body: { ref: 'refs/heads/' + branch(), sha: base.object.sha } });
}

export async function readState() {
  const r = repo();
  try {
    const f = await gh(`/repos/${r}/contents/${PATH}?ref=${encodeURIComponent(branch())}`);
    const text = Buffer.from(f.content || '', 'base64').toString('utf8');
    const state = text ? JSON.parse(text) : { ...EMPTY };
    return { state: { ...EMPTY, ...state }, sha: f.sha };
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  // No data branch yet: start from the seed file on the default branch, if there is one.
  try {
    const f = await gh(`/repos/${r}/contents/${PATH}`);
    const text = Buffer.from(f.content || '', 'base64').toString('utf8');
    return { state: { ...EMPTY, ...(text ? JSON.parse(text) : {}) }, sha: null, seeded: true };
  } catch (e) {
    if (e.status === 404) return { state: { ...EMPTY }, sha: null };
    throw e;
  }
}

export async function writeState(state, message) {
  const r = repo();
  await ensureBranch(r);
  const cur = await readState();
  const body = { ...EMPTY, ...state, updatedAt: Date.now() };
  const res = await gh(`/repos/${r}/contents/${PATH}`, {
    method: 'PUT',
    body: {
      message: message || 'Dev Command: update state',
      content: Buffer.from(JSON.stringify(body, null, 1)).toString('base64'),
      branch: branch(),
      ...(cur.sha ? { sha: cur.sha } : {}),
    },
  });
  return { state: body, sha: res && res.content && res.content.sha };
}
