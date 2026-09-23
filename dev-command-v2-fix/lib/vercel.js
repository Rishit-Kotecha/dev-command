import { env } from './http.js';
export async function vercel(path) {
  const t = env('VERCEL_TOKEN');
  if (!t) { const e = new Error('VERCEL_TOKEN is not set'); e.status = 503; throw e; }
  const r = await fetch('https://api.vercel.com' + path, { headers: { Authorization: 'Bearer ' + t } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error('Vercel ' + r.status + ': ' + ((data.error && data.error.message) || r.statusText)); e.status = r.status; throw e; }
  return data;
}
export async function deployments(projectId, teamId, limit) {
  const q = new URLSearchParams({ projectId, limit: String(limit || 20) });
  const team = teamId || env('VERCEL_TEAM_ID');
  if (team) q.set('teamId', team);
  const d = await vercel('/v6/deployments?' + q.toString());
  return (d.deployments || []).map((x) => ({
    url: x.url, state: x.state || x.readyState, target: x.target, created: x.created || x.createdAt, inspectorUrl: x.inspectorUrl,
    meta: { githubCommitRef: x.meta && x.meta.githubCommitRef, githubCommitMessage: x.meta && x.meta.githubCommitMessage, githubCommitSha: x.meta && x.meta.githubCommitSha, githubPrId: x.meta && x.meta.githubPrId },
  }));
}
export function previewFor(list, { branch, sha, code }) {
  const tag = code ? new RegExp('(^|[^A-Za-z0-9])' + code.replace(/-/g, '\\-') + '(?![0-9])', 'i') : null;
  const hits = (list || []).filter((d) => d.target !== 'production' && (
    (sha && d.meta.githubCommitSha === sha) || (branch && d.meta.githubCommitRef === branch) ||
    (tag && (tag.test(String(d.meta.githubCommitMessage || '')) || tag.test(String(d.meta.githubCommitRef || ''))))
  )).sort((a, b) => (b.created || 0) - (a.created || 0));
  return hits[0] ? { url: 'https://' + String(hits[0].url).replace(/^https?:\/\//, ''), state: hits[0].state, created: hits[0].created, ref: hits[0].meta.githubCommitRef } : null;
}
