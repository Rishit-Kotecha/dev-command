// GitHub REST helpers. Token: fine-grained PAT with Issues, Pull requests, Contents (read/write) on the repos you manage.
import { env } from './http.js';

const API = 'https://api.github.com';
function token() { return env('GITHUB_TOKEN'); }

export async function gh(path, opts = {}) {
  const r = await fetch(path.startsWith('http') ? path : API + path, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + token(),
      Accept: opts.accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'dev-command',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 204) return null;
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const e = new Error('GitHub ' + r.status + ': ' + ((data && data.message) || text || r.statusText));
    e.status = r.status; e.detail = data; throw e;
  }
  return data;
}

export function repoOk(repo) { return /^[\w.-]+\/[\w.-]+$/.test(String(repo || '')); }
function must(repo) { if (!repoOk(repo)) { const e = new Error('Repo must look like owner/name'); e.status = 400; throw e; } return repo; }

export const createIssue = (repo, title, body, labels) => gh(`/repos/${must(repo)}/issues`, { method: 'POST', body: { title, body, labels: labels || [] } });
export const getIssue = (repo, n) => gh(`/repos/${must(repo)}/issues/${n}`);
export const closeIssue = (repo, n) => gh(`/repos/${must(repo)}/issues/${n}`, { method: 'PATCH', body: { state: 'closed' } });
export const listComments = (repo, n) => gh(`/repos/${must(repo)}/issues/${n}/comments?per_page=100`);
export const createComment = (repo, n, body) => gh(`/repos/${must(repo)}/issues/${n}/comments`, { method: 'POST', body: { body } });
export const getPR = (repo, n) => gh(`/repos/${must(repo)}/pulls/${n}`);
export const listReviews = (repo, n) => gh(`/repos/${must(repo)}/pulls/${n}/reviews?per_page=100`);
export const listReviewComments = (repo, n) => gh(`/repos/${must(repo)}/pulls/${n}/comments?per_page=100`);
export const listPRFiles = (repo, n) => gh(`/repos/${must(repo)}/pulls/${n}/files?per_page=100`);
export const listCheckRuns = (repo, sha) => gh(`/repos/${must(repo)}/commits/${sha}/check-runs?per_page=100`);
export const combinedStatus = (repo, sha) => gh(`/repos/${must(repo)}/commits/${sha}/status`);
export const mergePR = (repo, n, title) => gh(`/repos/${must(repo)}/pulls/${n}/merge`, { method: 'PUT', body: { merge_method: 'squash', commit_title: title } });
export const listPulls = (repo, state) => gh(`/repos/${must(repo)}/pulls?state=${state || 'all'}&sort=updated&direction=desc&per_page=50`);
export const issueTimeline = (repo, n) => gh(`/repos/${must(repo)}/issues/${n}/timeline?per_page=100`);

// Find the pull request(s) that belong to an issue: cross-references on the timeline first,
// then any PR whose branch or title mentions the issue number or the task code.
export async function findPRs(repo, issueNumber, taskCode) {
  const found = new Map();
  try {
    const tl = await issueTimeline(repo, issueNumber);
    for (const ev of tl || []) {
      const src = ev && ev.source && ev.source.issue;
      if (ev.event === 'cross-referenced' && src && src.pull_request && src.number) found.set(src.number, src.number);
    }
  } catch { /* timeline may be unavailable; fall back below */ }
  try {
    const pulls = await listPulls(repo, 'all');
    const codeRe = taskCode ? new RegExp('(^|[^A-Za-z0-9])' + taskCode.replace(/-/g, '\\-') + '(?![0-9])', 'i') : null;
    for (const pr of pulls || []) {
      const head = (pr.head && pr.head.ref) || '';
      const text = (pr.title || '') + ' ' + (pr.body || '');
      const refIssue = new RegExp('(^|[^0-9])#' + issueNumber + '(?![0-9])').test(text) || new RegExp('issue[-_/]' + issueNumber + '(?![0-9])', 'i').test(head);
      if (refIssue || (codeRe && (codeRe.test(text) || codeRe.test(head)))) found.set(pr.number, pr.number);
    }
  } catch { /* ignore */ }
  return [...found.keys()].sort((a, b) => b - a);
}

function trim(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

// One consolidated view of an issue and its main pull request.
export async function thread(repo, issueNumber, taskCode) {
  const [issue, comments] = await Promise.all([getIssue(repo, issueNumber), listComments(repo, issueNumber)]);
  const prNums = await findPRs(repo, issueNumber, taskCode);
  let pr = null;
  if (prNums.length) {
    // Prefer an open PR, else the most recent merged one.
    let chosen = null;
    for (const n of prNums) {
      const p = await getPR(repo, n);
      if (!chosen || (p.state === 'open' && chosen.state !== 'open') || (p.merged && !chosen.merged && chosen.state !== 'open')) chosen = p;
      if (p.state === 'open') break;
    }
    const p = chosen;
    const sha = p.head && p.head.sha;
    const [reviews, rcomments, checks, status] = await Promise.all([
      listReviews(repo, p.number).catch(() => []),
      listReviewComments(repo, p.number).catch(() => []),
      sha ? listCheckRuns(repo, sha).catch(() => null) : null,
      sha ? combinedStatus(repo, sha).catch(() => null) : null,
    ]);
    const runs = (checks && checks.check_runs) || [];
    const contexts = (status && status.statuses) || [];
    pr = {
      number: p.number, url: p.html_url, title: p.title, state: p.merged ? 'merged' : p.state, merged: !!p.merged, draft: !!p.draft,
      head: p.head && p.head.ref, sha, base: p.base && p.base.ref, mergeable: p.mergeable, mergeableState: p.mergeable_state,
      additions: p.additions, deletions: p.deletions, changedFiles: p.changed_files, updatedAt: p.updated_at,
      reviews: (reviews || []).filter((r) => r.state !== 'PENDING').map((r) => ({ user: r.user && r.user.login, state: r.state, body: trim(r.body, 1200), at: r.submitted_at, url: r.html_url })),
      reviewComments: (rcomments || []).slice(-30).map((c) => ({ user: c.user && c.user.login, path: c.path, body: trim(c.body, 600), at: c.created_at })),
      checks: [
        ...runs.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion, url: c.html_url })),
        ...contexts.map((s) => ({ name: s.context, status: s.state === 'pending' ? 'in_progress' : 'completed', conclusion: s.state === 'success' ? 'success' : s.state === 'pending' ? null : 'failure', url: s.target_url })),
      ],
    };
  }
  return {
    issue: { number: issue.number, url: issue.html_url, state: issue.state, title: issue.title, updatedAt: issue.updated_at },
    comments: (comments || []).slice(-15).map((c) => ({ id: c.id, user: c.user && c.user.login, bot: c.user && c.user.type === 'Bot', body: trim(c.body, 1500), at: c.created_at, url: c.html_url })),
    pr,
    otherPRs: prNums.filter((n) => !pr || n !== pr.number),
  };
}
