(function () {
'use strict';

/* ---------- constants ---------- */
const ROLES = [
  { k: 'cto', name: 'CTO', noun: 'CTO', duty: 'Owns the architecture, splits features into tasks and reviews direction across every task and phase.' },
  { k: 'developer', name: 'Developer', noun: 'developer', duty: 'Writes the code for a task on its own branch.' },
  { k: 'pr', name: 'PR owner', noun: 'PR owner', duty: 'Opens and updates pull requests and keeps branches current with the base branch.' },
  { k: 'sql', name: 'SQL runner', noun: 'SQL runner', duty: 'Writes append-only migrations and runs them on the preview database only.' },
  { k: 'reviewer', name: 'Reviewer', noun: 'reviewer', duty: 'Reviews every pull request before the manager sees it. Never reviews its own code.' },
  { k: 'designer', name: 'Designer', noun: 'designer', duty: 'Designs screens and flows before code starts.' },
  { k: 'qa', name: 'QA tester', noun: 'QA tester', duty: 'Tests the preview build against what done looks like.' },
  { k: 'advisor', name: 'Advisor', noun: 'advisor', duty: 'Gives second opinions on plans and writes docs and manuals.' },
  { k: 'workers', name: 'Workers', noun: 'worker', duty: 'Extra hands that pick up parallel tasks.' },
];
const ROLE = Object.fromEntries(ROLES.map((r) => [r.k, r]));
const TASK_ROLES = ['developer', 'sql', 'designer', 'qa', 'reviewer', 'advisor', 'cto', 'workers'];
const CAPS = [
  { k: 'code', label: 'Writes code', verb: 'write code' },
  { k: 'pr', label: 'Opens PRs', verb: 'open pull requests' },
  { k: 'sql', label: 'Runs SQL', verb: 'run SQL' },
  { k: 'review', label: 'Reviews code', verb: 'review code' },
  { k: 'design', label: 'Designs UI', verb: 'design screens' },
  { k: 'test', label: 'Tests builds', verb: 'test builds' },
  { k: 'plan', label: 'Plans work', verb: 'plan work' },
  { k: 'docs', label: 'Writes docs', verb: 'write docs' },
];
const CAP = Object.fromEntries(CAPS.map((c) => [c.k, c]));
const ROLE_CAP = { developer: 'code', pr: 'pr', sql: 'sql', reviewer: 'review', designer: 'design', qa: 'test', cto: 'plan' };
const KINDS = { coding: 'Coding agent (works in the repo)', chat: 'Chat assistant', design: 'Design tool', review: 'Review and QA agent', human: 'Person' };
const STATUSES = [
  { k: 'backlog', label: 'Backlog' },
  { k: 'assigned', label: 'Assigned' },
  { k: 'working', label: 'In progress' },
  { k: 'pr', label: 'PR open' },
  { k: 'review', label: 'In review' },
  { k: 'verify', label: 'Check preview' },
  { k: 'approved', label: 'Ready to merge' },
  { k: 'deployed', label: 'Deployed' },
  { k: 'blocked', label: 'Blocked' },
];
const ST = Object.fromEntries(STATUSES.map((s) => [s.k, s]));
const NEXT = {
  backlog: { to: 'assigned', label: 'Hand out' },
  assigned: { to: 'working', label: 'Mark started' },
  working: { to: 'pr', label: 'PR opened' },
  pr: { to: 'review', label: 'Send to review' },
  review: { to: 'verify', label: 'Review passed' },
  verify: { to: 'approved', label: 'Preview checked', you: true },
  approved: { to: 'deployed', label: 'Mark deployed', you: true },
  blocked: { to: 'working', label: 'Unblock', you: true },
};
const NEEDS_YOU = ['verify', 'approved', 'blocked'];
const WITH_AGENTS = ['assigned', 'working', 'pr', 'review'];
const RELATIONS = { depends: 'Depends on', 'shares-db': 'Shares a database with', 'shares-code': 'Shares code with', api: 'Calls the API of' };
const PROJECT_STATUS = { active: 'Active', paused: 'Paused', done: 'Finished' };
const COLORS = [['#1F7A3A', 'Vitagreen green'], ['#AE2220', 'MML red'], ['#422774', 'MML purple'], ['#2F5FD0', 'Blue'], ['#0F7C80', 'Teal'], ['#9A5B00', 'Amber'], ['#4B5B64', 'Slate']];
const PRESETS = [
  { id: 'claude', name: 'Claude', kind: 'chat', caps: ['plan', 'review', 'docs', 'sql'], openUrl: 'https://claude.ai', branchPrefix: 'claude' },
  { id: 'claude-code', name: 'Claude Code', kind: 'coding', caps: ['code', 'pr', 'sql', 'test'], openUrl: 'https://claude.ai/code', branchPrefix: 'claude', ghMention: '@claude' },
  { id: 'codex', name: 'Codex', kind: 'coding', caps: ['code', 'pr', 'review', 'test'], openUrl: 'https://chatgpt.com/codex', branchPrefix: 'codex', ghMention: '@codex' },
  { id: 'chatgpt', name: 'ChatGPT', kind: 'chat', caps: ['plan', 'docs', 'review'], openUrl: 'https://chatgpt.com', branchPrefix: '' },
  { id: 'gemini', name: 'Gemini', kind: 'review', caps: ['review', 'test', 'code'], openUrl: 'https://gemini.google.com', branchPrefix: 'gemini' },
  { id: 'stitch', name: 'Stitch', kind: 'design', caps: ['design'], openUrl: 'https://stitch.withgoogle.com', branchPrefix: '' },
  { id: 'cursor', name: 'Cursor', kind: 'coding', caps: ['code', 'pr'], openUrl: 'https://cursor.com', branchPrefix: 'cursor' },
  { id: 'copilot', name: 'GitHub Copilot', kind: 'coding', caps: ['code', 'pr', 'review'], openUrl: 'https://github.com/copilot', branchPrefix: 'copilot' },
  { id: 'v0', name: 'v0', kind: 'design', caps: ['design', 'code'], openUrl: 'https://v0.app', branchPrefix: 'v0' },
];
const ICON = {
  today: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 11l2 2 4-4M9 17h6"/></svg>',
  projects: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  team: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.4c2.3.2 4 1.8 4.5 4.6"/></svg>',
};

/* ---------- state ---------- */
const S = {
  projects: [], agents: [], tasks: [],
  loaded: { projects: false, agents: false, tasks: false },
  mode: 'connecting',
  dbErr: '',
  view: { tab: 'today', projectId: null, sub: 'tasks', filter: 'open' },
  sheet: null,
  live: {},
  planCtl: null,
};

/* ---------- helpers ---------- */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s, n) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n || 40).replace(/-+$/, '');
const now = () => Date.now();
const uid = () => Math.random().toString(36).slice(2, 9) + now().toString(36).slice(-5);
const cap1 = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const encPath = (b) => String(b).split('/').map(encodeURIComponent).join('/');
const cssEsc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));
function ago(ts) {
  if (!ts) return '';
  const s = Math.max(0, (now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : d + ' days ago';
}
function safeUrl(u) { const s = String(u || '').trim(); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ''; }
function shortUrl(u) { const s = String(u || '').replace(/^https?:\/\//, ''); return s.length > 52 ? s.slice(0, 50) + '…' : s; }
function normRepo(v) {
  const s = String(v || '').trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const m = s.match(/^([\w.-]+)\/([\w.-]+)/);
  return m ? m[1] + '/' + m[2] : '';
}
function pc(p) { const c = p && p.color; return /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#4B5B64'; }
function hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function initials(n) { const w = String(n || '?').trim().split(/\s+/); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '')[1] || '')).toUpperCase(); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

const byId = (col, id) => S[col].find((x) => x.id === id);
const agent = (id) => (id ? byId('agents', id) : undefined);
const project = (id) => (id ? byId('projects', id) : undefined);
const task = (id) => (id ? byId('tasks', id) : undefined);
const manager = () => S.agents.find((a) => a.isManager);
const agentName = (id) => (agent(id) ? agent(id).name : 'Nobody');
const projTasks = (pid) => S.tasks.filter((t) => t.projectId === pid);
function code(t) { const p = project(t.projectId); return (p ? p.code : '?') + '-' + (t.num == null ? '?' : t.num); }
function prio(t) { return { high: 0, normal: 1, low: 2 }[t.priority || 'normal'] ?? 1; }
function byPrio(a, b) { return prio(a) - prio(b) || (a.num || 0) - (b.num || 0); }
function sortedAgents() {
  return [...S.agents].sort((a, b) => (b.isManager ? 1 : 0) - (a.isManager ? 1 : 0) || (a.order ?? 99) - (b.order ?? 99) || String(a.name).localeCompare(String(b.name)));
}
function sortedProjects() {
  return [...S.projects].sort((a, b) => ((a.status || 'active') === 'active' ? 0 : 1) - ((b.status || 'active') === 'active' ? 0 : 1) || String(a.name).localeCompare(String(b.name)));
}
function roleIds(p, k) { return p && p.roles && Array.isArray(p.roles[k]) ? p.roles[k] : []; }
function liveIds(p, k) { return roleIds(p, k).filter((id) => agent(id)); }
function rolesReady(p) { return liveIds(p, 'developer').length > 0 && liveIds(p, 'reviewer').length > 0; }
function roleWarnings(p) {
  const w = [];
  const dev = liveIds(p, 'developer'), rev = liveIds(p, 'reviewer');
  if (!dev.length) w.push({ k: 'nodev', lvl: 'stop', text: 'No developer yet. Tasks can’t start until someone writes the code.' });
  if (!rev.length) w.push({ k: 'norev', lvl: 'stop', text: 'No reviewer yet. Every pull request needs a second agent to check it.' });
  else if (rev.every((id) => dev.includes(id))) w.push({ k: 'self', lvl: 'warn', text: 'Every reviewer is also a developer here, so someone will end up checking their own code. Add a reviewer who doesn’t write code on this project.' });
  const both = dev.filter((id) => rev.includes(id));
  if (both.length && !rev.every((id) => dev.includes(id))) w.push({ k: 'self2', lvl: 'info', text: both.map(agentName).join(' and ') + (both.length > 1 ? ' are' : ' is') + ' both developer and reviewer. Their tasks will go to a different reviewer.' });
  for (const [k, c] of Object.entries(ROLE_CAP)) {
    for (const id of liveIds(p, k)) {
      const a = agent(id);
      if (!(a.caps || []).includes(c)) w.push({ k: 'cap', lvl: 'info', text: a.name + ' is ' + ROLE[k].noun + ' but isn’t marked as able to ' + CAP[c].verb + '.' });
    }
  }
  if (!p.repo) w.push({ k: 'repo', lvl: 'info', text: 'No GitHub repo connected. Agents need it to know where to work.' });
  return w;
}
function defaultAgentFor(p, role) { const ids = liveIds(p, role); if (ids.length) return ids[0]; return liveIds(p, 'workers')[0] || ''; }
function defaultReviewer(p, assignee) { return liveIds(p, 'reviewer').find((id) => id !== assignee) || ''; }
function branchFor(p, t) {
  const a = agent(t.agentId);
  const pre = slug((a && a.branchPrefix) || 'task', 20) || 'task';
  return (pre + '/' + slug(p.code, 10) + '-' + t.num + '-' + slug(t.title, 36)).replace(/-+$/, '');
}
function nextNum(p) { return Math.max(p.nextNum || 1, ...projTasks(p.id).map((t) => (t.num || 0) + 1)); }
function unmetDeps(t) { return (t.dependsOn || []).map(task).filter((d) => d && d.status !== 'deployed'); }

/* ---------- storage: the app's own API, state kept on the repo's data branch ---------- */
function clean(obj) { const copy = Object.assign({}, obj); delete copy.id; return JSON.parse(JSON.stringify(copy)); }
const enc = encodeURIComponent;
const API = {
  async get(path, opts) {
    const r = await fetch(path, { cache: 'no-store', signal: opts && opts.signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || ('HTTP ' + r.status)), { status: r.status, detail: d.detail });
    return d;
  },
  async send(path, method, body, opts) {
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: opts && opts.signal });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error || ('HTTP ' + r.status)), { status: r.status, detail: d.detail });
    return d;
  },
};
function applyState(st) { S.projects = (st && st.projects) || []; S.agents = (st && st.agents) || []; S.tasks = (st && st.tasks) || []; }
function snapshotState() { return { version: 1, projects: S.projects, agents: S.agents, tasks: S.tasks }; }
S.saveTimer = 0; S.dirty = false; S.saving = false; S.health = null; S.threads = {}; S.syncing = false; S.lastSync = 0;
function scheduleSave(msg) { S.dirty = true; clearTimeout(S.saveTimer); S.saveTimer = setTimeout(() => flushSave(msg), 500); }
async function flushSave(msg) {
  if (S.saving) return;
  clearTimeout(S.saveTimer);
  S.saving = true; S.dirty = false;
  try { await API.send('/api/state', 'PUT', { state: snapshotState(), message: msg || 'Dev Command: update' }); }
  catch (e) { S.dirty = true; toast('Couldn’t save: ' + e.message); }
  finally { S.saving = false; if (S.dirty) scheduleSave(msg); }
}
async function save(col, id, data) {
  const body = clean(data);
  const arr = S[col];
  const i = arr.findIndex((x) => x.id === id);
  const rec = Object.assign({}, body, { id });
  if (i >= 0) arr[i] = rec; else arr.push(rec);
  render();
  scheduleSave();
  return true;
}
async function patch(col, id, p) { const cur = byId(col, id); if (!cur) return false; return save(col, id, Object.assign({}, cur, p)); }
async function remove(col, id) { S[col] = S[col].filter((x) => x.id !== id); render(); scheduleSave(); return true; }
async function refreshState() {
  if (S.dirty || S.saving) return;
  try { const r = await API.get('/api/state'); if (!S.dirty && !S.saving) { applyState(r.state); render(); } } catch (_) { /* keep what we have */ }
}

/* ---------- boot ---------- */
async function boot() {
  render();
  try { S.health = await API.get('/api/health'); } catch (_) { S.health = {}; }
  try { const r = await API.get('/api/state'); applyState(r.state); S.mode = 'server'; }
  catch (e) { S.mode = 'error'; S.dbErr = e.message; }
  S.loaded = { projects: true, agents: true, tasks: true };
  render();
  if (S.mode === 'server' && S.health && S.health.github) syncGitHub(true);
  setInterval(() => { if (document.visibilityState === 'visible' && S.mode === 'server' && S.health && S.health.github && !S.sheet) syncGitHub(true); }, 180000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.mode === 'server') refreshState(); });
}
async function syncGitHub(quiet, taskId) {
  if (S.syncing) return;
  S.syncing = true; render();
  try {
    if (S.dirty || S.saving) await flushSave();
    const r = await API.send('/api/sync', 'POST', taskId ? { taskId } : {});
    if (!S.dirty && !S.saving) applyState(r.state);
    S.lastSync = Date.now();
    if (taskId) { const t = task(taskId); if (t && t.issueNumber) await loadThread(t, true); }
    if (r.changes && r.changes.length) toast(r.changes.map((c) => c.code + ' → ' + (LABELS[c.to] || c.to)).join(', '));
    else if (!quiet) toast(r.checked ? 'Checked ' + plural(r.checked, 'task', 'tasks') + ' on GitHub. Nothing moved.' : 'No tasks are on GitHub yet.');
    if (r.errors && r.errors.length && !quiet) toast(r.errors[0].code + ': ' + r.errors[0].error);
  } catch (e) { if (!quiet) toast('GitHub check failed: ' + e.message); }
  finally { S.syncing = false; render(); }
}
const LABELS = { backlog: 'Backlog', assigned: 'Assigned', working: 'In progress', pr: 'PR open', review: 'In review', verify: 'Check preview', approved: 'Ready to merge', deployed: 'Deployed', blocked: 'Blocked' };

/* ---------- small renderers ---------- */
function avatar(a, size) {
  if (!a) return '<span class="av av-none ' + (size || '') + '" aria-hidden="true">?</span>';
  if (a.isManager) return '<span class="av av-you ' + (size || '') + '" aria-hidden="true">' + esc(initials(a.name)) + '</span>';
  return '<span class="av ' + (size || '') + '" style="--h:' + hue(a.name) + '" aria-hidden="true">' + esc(initials(a.name)) + '</span>';
}
function who(a) { return a ? '<span class="who">' + avatar(a) + '<span>' + esc(a.name) + '</span></span>' : '<span class="muted">Nobody</span>'; }
function stamp(t) { const s = ST[t.status] || ST.backlog; return '<span class="stamp s-' + s.k + '">' + s.label + '</span>'; }
function extLink(url, label, cls) { const u = safeUrl(url); return u ? '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + esc(u) + '" target="_blank" rel="noopener">' + (label || esc(shortUrl(u))) + '</a>' : ''; }
function pageHead(title, sub, actions) {
  return '<header class="page-head"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="row">' + actions + '</div>' : '') + '</header>';
}
function stateLabel(s) {
  return ({ READY: 'Ready', ERROR: 'Failed', BUILDING: 'Building', QUEUED: 'Queued', CANCELED: 'Cancelled', INITIALIZING: 'Starting', BLOCKED: 'Blocked' })[s] || cap1(String(s || 'Unknown').toLowerCase());
}
function stateCls(s) { return s === 'READY' ? 'ok' : (s === 'ERROR' || s === 'CANCELED') ? 'bad' : 'mid'; }
function detectPreview(t) {
  const L = S.live[t.projectId];
  const list = L && L.vercel && L.vercel.list;
  if (!list) return null;
  const tag = new RegExp('(^|[^A-Za-z0-9])' + code(t).replace(/[-]/g, '\\-') + '(?![0-9])', 'i');
  const hits = list.filter((d) => d && d.meta && d.target !== 'production' &&
    ((t.branch && d.meta.githubCommitRef === t.branch) || tag.test(String(d.meta.githubCommitMessage || '')) || tag.test(String(d.meta.githubCommitRef || '')))
  ).sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!hits.length) return null;
  const d = hits[0];
  return { url: 'https://' + String(d.url || '').replace(/^https?:\/\//, ''), state: d.state || d.readyState || '', created: d.created, ref: d.meta.githubCommitRef || '' };
}
function previewFor(t) { if (safeUrl(t.previewUrl)) return t.previewUrl; const d = detectPreview(t); return d && d.state === 'READY' ? d.url : ''; }

function taskCard(t, opts) {
  const p = project(t.projectId);
  const a = agent(t.agentId);
  const n = NEXT[t.status || 'backlog'];
  const unmet = unmetDeps(t);
  const prev = previewFor(t);
  const acts = [];
  if (opts && opts.action) {
    if (t.status === 'verify' && prev) acts.push(extLink(prev, 'Open preview', 'btn sm'));
    if (t.status === 'approved' && safeUrl(t.prUrl)) acts.push(extLink(t.prUrl, 'Open PR to merge', 'btn sm'));
    if (n) acts.push('<button class="btn sm' + (n.you ? ' you' : '') + '" data-act="task-next" data-id="' + esc(t.id) + '">' + n.label + '</button>');
  }
  return '<article class="job" style="--pc:' + pc(p) + '">' +
    '<button class="job-open" data-act="task" data-id="' + esc(t.id) + '">' +
      '<span class="job-code">' + esc(code(t)) + '</span>' +
      '<span class="job-title">' + esc(t.title) + '</span>' +
      '<span class="job-meta">' + (a ? '<span class="who">' + avatar(a) + '<span>' + esc(a.name) + '</span></span>' : '<span class="muted">Nobody assigned</span>') +
        (t.priority === 'high' ? '<span class="pri">High priority</span>' : '') +
        (t.status === 'blocked' && t.blockedReason ? '<span class="waiting">' + esc(t.blockedReason) + '</span>' : '') +
        (unmet.length ? '<span class="waiting">Waits for ' + unmet.map((d) => esc(code(d))).join(', ') + '</span>' : '') +
        ghFacts(t) +
      '</span></button>' + stamp(t) +
    (acts.length ? '<div class="job-act">' + acts.join('') + '</div>' : '') +
  '</article>';
}
function ghFacts(t) {
  const g = t.gh;
  if (!t.issueNumber) return '';
  if (!g) return '<span class="tag">Issue #' + esc(t.issueNumber) + '</span>';
  let h = '';
  if (g.prNumber) h += '<span class="tag">PR #' + esc(g.prNumber) + (g.prState === 'merged' ? ', merged' : '') + '</span>';
  else h += '<span class="tag">Issue #' + esc(t.issueNumber) + '</span>';
  if (g.prNumber && g.checks && g.checks !== 'none') h += '<span class="tag ' + (g.checks === 'pass' ? 'ok-tag' : g.checks === 'fail' ? 'bad-tag' : '') + '">Checks ' + esc(g.checks === 'pass' ? 'pass' : g.checks === 'fail' ? 'fail' : 'running') + '</span>';
  if (g.reviewCount) h += '<span class="tag">' + esc(plural(g.reviewCount, 'review', 'reviews')) + '</span>';
  if (t.verdict) h += '<span class="tag ' + (t.verdict.ready ? 'ok-tag' : 'bad-tag') + '">' + (t.verdict.ready ? 'Verdict: ready' : 'Verdict: not ready') + '</span>';
  return h;
}
function line(t) {
  return '<li><button class="line" data-act="task" data-id="' + esc(t.id) + '"><span class="line-code">' + esc(code(t)) + '</span><span class="line-title">' + esc(t.title) + '</span>' + stamp(t) + '</button></li>';
}

/* ---------- render loop ---------- */
let rafId = 0;
function render() {
  if (rafId) return;
  const run = () => { rafId = 0; draw(); };
  rafId = (window.requestAnimationFrame || ((f) => setTimeout(f, 16)))(run);
}
function draw() {
  drawRail();
  drawTabbar();
  $('#main').innerHTML = mainHtml();
  if (S.sheet && S.sheet.kind === 'task') drawTaskSheet();
}
function curTab() { return S.view.tab === 'project' ? 'projects' : S.view.tab; }
function navItems() {
  const needs = S.tasks.filter((t) => NEEDS_YOU.includes(t.status)).length;
  return [['today', 'Today', needs], ['projects', 'Projects', 0], ['team', 'Team', 0]];
}
function drawRail() {
  const items = navItems();
  $('#rail').innerHTML =
    '<div class="brand"><strong>Dev Command</strong><span>Your AI development team</span></div>' +
    '<nav class="rail-nav" aria-label="Main">' + items.map(([k, l, c]) =>
      '<button data-act="nav" data-tab="' + k + '" aria-current="' + (curTab() === k ? 'page' : 'false') + '">' + ICON[k] + '<span>' + l + '</span>' + (c ? '<span class="badge" aria-label="' + c + ' need you">' + c + '</span>' : '') + '</button>').join('') + '</nav>' +
    (S.projects.length ? '<div class="rail-projects"><h2>Projects</h2>' + sortedProjects().map((p) =>
      '<button data-act="project" data-id="' + esc(p.id) + '" aria-current="' + (S.view.tab === 'project' && S.view.projectId === p.id) + '" style="--pc:' + pc(p) + '"><span class="pdot"></span><span>' + esc(p.name) + '</span></button>').join('') + '</div>' : '') +
    '<div class="rail-foot">' + (S.mode === 'server' ? (S.dirty || S.saving ? 'Saving…' : 'Saved to the data branch') + (S.lastSync ? '. GitHub checked ' + ago(S.lastSync) : '') : S.mode === 'error' ? 'Not connected' : 'Connecting…') + '</div>';
}
function drawTabbar() {
  $('#tabbar').innerHTML = navItems().map(([k, l, c]) =>
    '<button data-act="nav" data-tab="' + k + '" aria-current="' + (curTab() === k ? 'page' : 'false') + '">' + ICON[k] + '<span>' + l + '</span>' + (c ? '<span class="badge" aria-label="' + c + ' need you">' + c + '</span>' : '') + '</button>').join('');
}
function mainHtml() {
  const ready = S.mode !== 'connecting' && S.loaded.projects && S.loaded.agents && S.loaded.tasks;
  let banner = '';
  if (S.mode === 'error') banner += '<p class="note stop">Can’t load saved data: ' + esc(S.dbErr || 'unknown error') + '. Check GITHUB_TOKEN and DATA_REPO in this app’s Vercel environment variables, then reload.</p>';
  else if (S.health && !S.health.github) banner += '<p class="note warn">GITHUB_TOKEN isn’t set, so tasks can’t be sent to GitHub or checked. Add it in Vercel and redeploy.</p>';
  if (!ready) return banner + '<div class="loading" role="status">Loading your team…</div>';
  const v = S.view.tab;
  return banner + (v === 'project' ? viewProject() : v === 'projects' ? viewProjects() : v === 'team' ? viewTeam() : viewToday());
}
function go(v) {
  S.view = Object.assign({}, S.view, v);
  if (S.view.tab === 'project' && S.view.sub === 'live') fetchLive(project(S.view.projectId), false, 'all');
  window.scrollTo(0, 0);
  render();
}

/* ---------- today ---------- */
function viewToday() {
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  if (!S.agents.some((a) => !a.isManager) || !S.projects.length || !manager()) return pageHead('Today', esc(date)) + onboarding();
  const order = { blocked: 0, verify: 1, approved: 2, backlog: 3 };
  const live = S.tasks.filter((t) => project(t.projectId));
  const needs = live.filter((t) => (t.status || 'backlog') in order).sort((a, b) => order[a.status || 'backlog'] - order[b.status || 'backlog'] || byPrio(a, b));
  const active = live.filter((t) => WITH_AGENTS.includes(t.status));
  const waiting = live.filter((t) => t.status !== 'deployed' && unmetDeps(t).some((d) => d.projectId !== t.projectId));
  const needTxt = needs.length ? plural(needs.length, 'task needs', 'tasks need') + ' you.' : 'Nothing is waiting on you.';
  const actTxt = active.length ? active.length + ' ' + (active.length === 1 ? 'is' : 'are') + ' with agents.' : 'No agent is working right now.';
  let h = pageHead('Today', esc(date) + '. ' + needTxt + ' ' + actTxt, syncButton());

  h += '<h2 class="sec">Needs you <span class="count">' + needs.length + '</span></h2>';
  h += needs.length ? '<div class="jobs">' + needs.map((t) => taskCard(t, { action: true })).join('') + '</div>'
    : '<p class="empty">Nothing is waiting on you. Open a project and hand out the next task.</p>';

  h += '<h2 class="sec">With agents <span class="count">' + active.length + '</span></h2>';
  if (!active.length) h += '<p class="empty">Nobody is working on anything. Hand out a backlog task to get started.</p>';
  else {
    const groups = {};
    active.forEach((t) => { (groups[t.agentId || '_'] = groups[t.agentId || '_'] || []).push(t); });
    h += Object.keys(groups).sort((x, y) => agentName(x).localeCompare(agentName(y))).map((aid) => {
      const a = agent(aid);
      const ts = groups[aid].sort((x, y) => (ST[y.status] ? STATUSES.indexOf(ST[y.status]) : 0) - (ST[x.status] ? STATUSES.indexOf(ST[x.status]) : 0));
      return '<section class="crew"><header class="crew-head">' + avatar(a) + '<strong>' + esc(a ? a.name : 'Nobody') + '</strong><span class="muted">' + ts.length + ' active</span>' +
        (a && safeUrl(a.openUrl) ? extLink(a.openUrl, 'Open ' + esc(a.name), 'btn sm') : '') + '</header><ul class="lines">' + ts.map(line).join('') + '</ul></section>';
    }).join('');
  }
  if (waiting.length) {
    h += '<h2 class="sec">Waiting on another project <span class="count">' + waiting.length + '</span></h2><div class="jobs">' + waiting.map((t) => taskCard(t)).join('') + '</div>';
  }
  h += '<h2 class="sec">Projects</h2><div class="sums">' + sortedProjects().map((p) => {
    const ts = projTasks(p.id);
    const open = ts.filter((t) => t.status !== 'deployed').length;
    const need = ts.filter((t) => NEEDS_YOU.includes(t.status)).length;
    return '<button class="sum" data-act="project" data-id="' + esc(p.id) + '" style="--pc:' + pc(p) + '"><span class="pdot"></span><span><strong>' + esc(p.name) + '</strong><br><span class="muted">' + open + ' open' + (need ? ', <span class="you-txt">' + need + ' need you</span>' : '') + '</span></span>' +
      (rolesReady(p) ? '<span class="tag">Team set</span>' : '<span class="tag you-tag">Set roles</span>') + '</button>';
  }).join('') + '</div>';
  return h;
}
function syncButton() {
  if (!S.health || !S.health.github) return '';
  return '<button class="btn" data-act="sync" ' + (S.syncing ? 'disabled' : '') + '>' + (S.syncing ? 'Checking GitHub…' : 'Check GitHub') + '</button>';
}
function onboarding() {
  const hasMgr = !!manager();
  const hasTeam = S.agents.some((a) => !a.isManager);
  const hasProj = S.projects.length > 0;
  return '<div class="panel"><h2 class="sec" style="margin-top:0">Set up your AI team</h2><ol class="steps">' +
    '<li class="' + (hasMgr ? 'done' : '') + '"><strong>Add yourself as manager.</strong> You check previews, merge and deploy. Nobody else does.' + (hasMgr ? '' : '<br><button class="btn you sm" data-act="manager-new">Add me as manager</button>') + '</li>' +
    '<li class="' + (hasTeam ? 'done' : '') + '"><strong>Add your agents.</strong> Claude, Claude Code, Codex, Gemini, Stitch or anything new.' + (hasTeam ? '' : '<br><button class="btn sm" data-act="nav" data-tab="team">Open team</button>') + '</li>' +
    '<li class="' + (hasProj ? 'done' : '') + '"><strong>Add a project.</strong> Connect its GitHub repo, Vercel project and Supabase database.' + (hasProj ? '' : '<br><button class="btn sm" data-act="project-new">New project</button>') + '</li>' +
    '<li><strong>Set roles.</strong> Decide who writes code, opens PRs, runs SQL, reviews, designs and leads as CTO.</li>' +
    '<li><strong>Hand out tasks.</strong> Each task gets its own branch, a reviewer and a brief you paste into the agent.</li>' +
    '</ol></div>';
}

/* ---------- projects ---------- */
function connBadges(p) {
  const b = [];
  if (p.repo) b.push('GitHub');
  if (p.vercelProjectId) b.push('Vercel');
  if (p.supabaseRef) b.push('Supabase');
  if (safeUrl(p.stitchUrl)) b.push('Stitch');
  (p.links || []).forEach((l) => b.push(l.label || 'Link'));
  return b.length ? b.map((x) => '<span class="tag">' + esc(x) + '</span>').join('') : '<span class="muted small">Nothing connected</span>';
}
function viewProjects() {
  let h = pageHead('Projects', 'Each project has its own team, connections and task board.', '<button class="btn primary" data-act="project-new">New project</button>');
  if (!S.projects.length) return h + '<p class="empty">No projects yet. Add one and connect its GitHub repo, Vercel project and Supabase database.</p>';
  return h + '<div class="tiles">' + sortedProjects().map((p) => {
    const ts = projTasks(p.id);
    const open = ts.filter((t) => t.status !== 'deployed').length;
    const need = ts.filter((t) => NEEDS_YOU.includes(t.status)).length;
    const st = p.status && p.status !== 'active' ? ' ' + esc(PROJECT_STATUS[p.status] || p.status) + '.' : '';
    return '<button class="tile" style="--pc:' + pc(p) + '" data-act="project" data-id="' + esc(p.id) + '">' +
      '<span class="tile-code">' + esc(p.code) + '</span><span class="tile-name">' + esc(p.name) + '</span>' +
      (p.description ? '<span class="tile-desc">' + esc(p.description) + '</span>' : '') +
      '<span class="tile-conn">' + connBadges(p) + '</span>' +
      '<span class="tile-foot">' + open + ' open' + (need ? ', <strong class="you-txt">' + need + ' need you</strong>' : '') + '. ' +
      (rolesReady(p) ? 'Team set.' : '<strong class="warn-txt">Roles not set.</strong>') + st + '</span></button>';
  }).join('') + '</div>';
}
function viewProject() {
  const p = project(S.view.projectId);
  if (!p) { S.view.tab = 'projects'; return viewProjects(); }
  const sub = S.view.sub || 'tasks';
  const openCount = projTasks(p.id).filter((t) => t.status !== 'deployed').length;
  const subs = [['tasks', 'Tasks'], ['roles', 'Roles'], ['connect', 'Connections'], ['live', 'Live']];
  let h = '<button class="back" data-act="nav" data-tab="projects">All projects</button>' +
    '<header class="proj-head" style="--pc:' + pc(p) + '"><div><span class="proj-code">' + esc(p.code) + '</span><h1>' + esc(p.name) + '</h1>' + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + '</div>' +
    '<button class="btn" data-act="project-edit" data-id="' + esc(p.id) + '">Edit project</button></header>' +
    '<nav class="subnav" aria-label="Project sections">' + subs.map(([k, l]) =>
      '<button data-act="sub" data-sub="' + k + '" aria-current="' + (k === sub) + '">' + l +
      (k === 'tasks' ? ' <span class="count">' + openCount + '</span>' : '') +
      (k === 'roles' && !rolesReady(p) ? ' <span class="dot-warn" role="img" aria-label="needs setup"></span>' : '') + '</button>').join('') + '</nav>';
  h += sub === 'roles' ? subRoles(p) : sub === 'connect' ? subConnect(p) : sub === 'live' ? subLive(p) : subTasks(p);
  return h;
}
function subTasks(p) {
  if (!rolesReady(p)) {
    return '<div class="gate panel"><h2>Set the team before the first task</h2><p>Every project needs at least a developer and a reviewer, so no agent checks its own work. Decide who does what, then tasks can start.</p>' +
      '<button class="btn primary" data-act="roles-edit" data-id="' + esc(p.id) + '">Set roles</button></div>';
  }
  const f = S.view.filter || 'open';
  const all = projTasks(p.id);
  const sel = all.filter((t) => f === 'all' ? true : f === 'you' ? (NEEDS_YOU.includes(t.status) || (t.status || 'backlog') === 'backlog') : f === 'done' ? t.status === 'deployed' : t.status !== 'deployed');
  const filters = [['open', 'Open'], ['you', 'Needs you'], ['done', 'Deployed'], ['all', 'All']];
  let h = '<div class="toolbar"><div class="row"><button class="btn primary" data-act="task-new" data-id="' + esc(p.id) + '">New task</button>' +
    (S.health && S.health.claude ? '<button class="btn" data-act="plan" data-id="' + esc(p.id) + '">Plan a feature with Claude</button>' : '') + syncButton() + '</div>' +
    '<div class="chips" role="group" aria-label="Show">' + filters.map(([k, l]) => '<button class="chip" data-act="filter" data-f="' + k + '" aria-pressed="' + (f === k) + '">' + l + '</button>').join('') + '</div></div>';
  if (!sel.length) {
    return h + '<p class="empty">' + (f === 'done' ? 'Nothing deployed yet.' : f === 'you' ? 'Nothing is waiting on you here.' : 'No tasks yet. Create one' + (S.health && S.health.claude ? ', or describe a feature and let Claude split it into tasks' : '') + '.') + '</p>';
  }
  for (const s of STATUSES) {
    const g = sel.filter((t) => (t.status || 'backlog') === s.k).sort(byPrio);
    if (!g.length) continue;
    h += '<h2 class="sec">' + s.label + ' <span class="count">' + g.length + '</span></h2><div class="jobs">' + g.map((t) => taskCard(t, { action: true })).join('') + '</div>';
  }
  return h;
}
function subRoles(p) {
  const w = roleWarnings(p);
  let h = '<div class="toolbar"><p class="muted" style="margin:0">Who does what on ' + esc(p.name) + '. New tasks and briefs follow this roster.</p><button class="btn primary" data-act="roles-edit" data-id="' + esc(p.id) + '">Edit roles</button></div>';
  h += w.map((x) => '<p class="note ' + x.lvl + '">' + esc(x.text) + '</p>').join('');
  const mgr = manager();
  h += '<div class="roster-wrap"><table class="roster"><tbody>' + ROLES.map((r) => {
    const ids = liveIds(p, r.k);
    return '<tr><th scope="row">' + r.name + '<small>' + r.duty + '</small></th><td>' + (ids.length ? '<div class="whos">' + ids.map((id) => who(agent(id))).join('') + '</div>' : '<span class="muted">Nobody</span>') + '</td></tr>';
  }).join('') +
    '<tr class="locked"><th scope="row">Manager<small>Checks the preview, merges, deploys and approves production SQL. This seat is always yours.</small></th><td>' + (mgr ? who(mgr) : '<button class="btn sm you" data-act="manager-new">Add me as manager</button>') + '</td></tr>' +
    '</tbody></table></div>';
  const load = sortedAgents().filter((a) => !a.isManager).map((a) => [a, projTasks(p.id).filter((t) => t.agentId === a.id && WITH_AGENTS.includes(t.status)).length]).filter((x) => x[1]);
  if (load.length) h += '<h2 class="sec">Working on this project now</h2><div class="whos">' + load.map(([a, n]) => who(a) + '<span class="muted">' + n + '</span>').join('') + '</div>';
  return h;
}
function subConnect(p) {
  const none = '<span class="muted">Not set</span>';
  const rows = [
    ['GitHub repo', p.repo ? extLink('https://github.com/' + encPath(p.repo), '<span class="mono">' + esc(p.repo) + '</span>') : none],
    ['Base branch', '<span class="mono">' + esc(p.baseBranch || 'main') + '</span>'],
    ['Vercel project', p.vercelProjectId ? '<span class="mono">' + esc(p.vercelProjectId) + '</span>' : none],
    ['Vercel team', p.vercelTeamId ? '<span class="mono">' + esc(p.vercelTeamId) + '</span>' : none],
    ['Supabase', p.supabaseRef ? extLink('https://supabase.com/dashboard/project/' + encodeURIComponent(p.supabaseRef), '<span class="mono">' + esc(p.supabaseRef) + '</span>') : none],
    ['Stitch', safeUrl(p.stitchUrl) ? extLink(p.stitchUrl, 'Open designs') : none],
  ];
  (p.links || []).forEach((l) => { if (safeUrl(l.url)) rows.push([esc(l.label || 'Link'), extLink(l.url)]); });
  let h = '<div class="toolbar"><p class="muted" style="margin:0">Where this project lives. Briefs and live status read from here.</p><button class="btn" data-act="project-edit" data-id="' + esc(p.id) + '">Edit connections and rules</button></div>';
  h += '<dl class="facts panel">' + rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>';

  const out = (p.relations || []).filter((r) => project(r.projectId));
  const inc = [];
  S.projects.forEach((q) => { if (q.id !== p.id) (q.relations || []).forEach((r) => { if (r.projectId === p.id) inc.push([q, r]); }); });
  h += '<h2 class="sec">Connected projects</h2>';
  if (!out.length && !inc.length) h += '<p class="empty">Not connected to other projects. Link projects that share a database, code or an API so cross-project work is easy to track.</p>';
  else {
    h += '<ul class="rel-list">' +
      out.map((r) => '<li><span>' + esc(RELATIONS[r.type] || r.type) + ' <button class="linkish" data-act="project" data-id="' + esc(r.projectId) + '">' + esc(project(r.projectId).name) + '</button>' + (r.note ? '<br><span class="muted small">' + esc(r.note) + '</span>' : '') + '</span></li>').join('') +
      inc.map(([q, r]) => '<li><span><button class="linkish" data-act="project" data-id="' + esc(q.id) + '">' + esc(q.name) + '</button> ' + esc((RELATIONS[r.type] || r.type).toLowerCase()) + ' this project' + (r.note ? '<br><span class="muted small">' + esc(r.note) + '</span>' : '') + '</span></li>').join('') +
      '</ul>';
  }
  if (S.projects.length > 1) h += '<button class="btn" data-act="relations-edit" data-id="' + esc(p.id) + '">Edit connected projects</button>';

  const rules = String(p.rules || '').split('\n').map((s) => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
  h += '<h2 class="sec">Project rules</h2>';
  h += rules.length ? '<div class="panel"><ul class="rules">' + rules.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul><p class="stale">Every brief for this project includes these rules.</p></div>'
    : '<p class="empty">No rules yet. Add the standing rules every agent must follow, one per line.</p>';
  return h;
}

/* ---------- live status via the app's API ---------- */
async function fetchLive(p, force, which) {
  if (!p || !S.health) return;
  const L = S.live[p.id] || (S.live[p.id] = {});
  const jobs = [];
  if (p.vercelProjectId && S.health.vercel && (which === 'all' || which === 'vercel')) {
    L.vercel = Object.assign({}, L.vercel || {}, { loading: true });
    jobs.push(API.get('/api/vercel?projectId=' + enc(p.vercelProjectId) + '&teamId=' + enc(p.vercelTeamId || '') + '&limit=20')
      .then((r) => { L.vercel = { list: r.deployments || [], at: r.at || now() }; })
      .catch((e) => { L.vercel = { err: 'Vercel: ' + e.message, errLvl: e.status === 503 ? 'stop' : 'warn', list: L.vercel && L.vercel.list, at: L.vercel && L.vercel.at }; }));
  }
  if (p.supabaseRef && S.health.supabase && which === 'all') {
    L.supa = Object.assign({}, L.supa || {}, { loading: true });
    L.mig = Object.assign({}, L.mig || {}, { loading: true });
    jobs.push(API.get('/api/supabase?ref=' + enc(p.supabaseRef))
      .then((r) => { L.supa = { item: r.project ? { name: r.project.name, status: r.project.status, region: r.project.region, database: { version: r.project.version } } : null, missing: !r.project, at: r.at }; L.mig = { list: r.migrations || [], at: r.at }; })
      .catch((e) => { const err = 'Supabase: ' + e.message, lvl = e.status === 503 ? 'stop' : 'warn'; L.supa = { err, errLvl: lvl, item: L.supa && L.supa.item }; L.mig = { err, errLvl: lvl, list: L.mig && L.mig.list }; }));
  }
  if (!jobs.length) return;
  render();
  await Promise.all(jobs);
  render();
}
function subLive(p) {
  const H = S.health || {};
  if (!H.vercel && !H.supabase) return '<p class="empty">Add VERCEL_TOKEN (and SUPABASE_ACCESS_TOKEN for database status) to this app’s environment variables in Vercel to see live builds here.</p>';
  if (!p.vercelProjectId && !p.supabaseRef) {
    return '<p class="empty">Add this project’s Vercel project ID or Supabase project ref under Connections to see live builds and database status.</p><p><button class="btn" data-act="project-edit" data-id="' + esc(p.id) + '">Add connections</button></p>';
  }
  const L = S.live[p.id] || {};
  let h = '<div class="toolbar"><p class="muted" style="margin:0">Read straight from your Vercel and Supabase accounts.</p><button class="btn" data-act="live-refresh" data-id="' + esc(p.id) + '">Refresh</button></div>';
  if (p.vercelProjectId && H.vercel) {
    const V = L.vercel;
    h += '<h2 class="sec">Vercel builds</h2>';
    if (!V || (V.loading && !V.list)) h += '<p class="muted" role="status">Checking Vercel…</p>';
    else {
      if (V.err) h += '<p class="note ' + V.errLvl + '">' + esc(V.err) + '</p>';
      if (V.list) {
        h += V.list.length ? '<ul class="deps">' + V.list.slice(0, 12).map((d) => depRow(d, p)).join('') + '</ul>' : '<p class="empty">No builds yet for this project.</p>';
        if (V.at) h += '<p class="stale">Updated ' + ago(V.at) + (V.loading ? ', refreshing…' : '') + '</p>';
      }
    }
  }
  if (p.supabaseRef && H.supabase) {
    const Sp = L.supa, M = L.mig;
    h += '<h2 class="sec">Supabase database</h2>';
    if (!Sp || (Sp.loading && !Sp.item && !Sp.missing)) h += '<p class="muted" role="status">Checking Supabase…</p>';
    else {
      if (Sp.err) h += '<p class="note ' + Sp.errLvl + '">' + esc(Sp.err) + '</p>';
      if (Sp.item) {
        const it = Sp.item;
        const healthy = String(it.status || '') === 'ACTIVE_HEALTHY';
        h += '<dl class="facts panel"><dt>Project</dt><dd>' + esc(it.name || p.supabaseRef) + '</dd><dt>Status</dt><dd><span class="st ' + (healthy ? 'ok' : 'mid') + '">' + (healthy ? 'Healthy' : esc(cap1(String(it.status || 'Unknown').toLowerCase().replace(/_/g, ' ')))) + '</span></dd>' +
          (it.region ? '<dt>Region</dt><dd>' + esc(it.region) + '</dd>' : '') +
          (it.database && it.database.version ? '<dt>Postgres</dt><dd>' + esc(it.database.version) + '</dd>' : '') + '</dl>';
      } else if (Sp.missing) h += '<p class="note warn">No Supabase project with ref ' + esc(p.supabaseRef) + ' in your connected account.</p>';
    }
    h += '<h2 class="sec">Recorded migrations</h2>';
    if (!M || (M.loading && !M.list)) h += '<p class="muted" role="status">Checking migrations…</p>';
    else {
      if (M.err) h += '<p class="note ' + M.errLvl + '">' + esc(M.err) + '</p>';
      if (M.list) {
        const ms = [...M.list].sort((a, b) => String(b.version).localeCompare(String(a.version))).slice(0, 8);
        h += ms.length ? '<ul class="deps">' + ms.map((m) => '<li class="dep"><div class="dep-main"><span class="mono">' + esc(m.name || '(unnamed)') + '</span></div><div class="dep-side"><span class="mono muted">' + esc(m.version || '') + '</span></div></li>').join('') + '</ul>'
          : '<p class="empty">No migrations recorded in Supabase’s migration history.</p>';
        h += '<p class="stale">Migrations recorded on the live database. Production changes should arrive only through PRs you merge.</p>';
      }
    }
  }
  return h;
}
function depRow(d, p) {
  const meta = d.meta || {};
  const ref = meta.githubCommitRef || '';
  const msg = String(meta.githubCommitMessage || '').split('\n')[0];
  const t = S.tasks.find((x) => x.projectId === p.id && ((ref && x.branch === ref) || new RegExp('(^|[^A-Za-z0-9])' + code(x) + '(?![0-9])', 'i').test(msg + ' ' + ref)));
  const url = d.url ? 'https://' + String(d.url).replace(/^https?:\/\//, '') : '';
  const state = d.state || d.readyState || '';
  return '<li class="dep"><div class="dep-main"><span class="mono">' + esc(ref || '(no branch)') + '</span>' +
    (t ? '<span><button class="linkish" data-act="task" data-id="' + esc(t.id) + '">' + esc(code(t)) + ' ' + esc(t.title) + '</button></span>' : '') +
    (msg ? '<span class="dep-msg">' + esc(msg) + '</span>' : '') + '</div>' +
    '<div class="dep-side"><span class="st ' + stateCls(state) + '">' + esc(stateLabel(state)) + '</span>' +
    (d.target === 'production' ? '<span class="tag">Production</span>' : '') +
    '<span class="muted">' + ago(d.created || d.createdAt) + '</span>' + (url ? extLink(url, 'Open') : '') + '</div></li>';
}

/* ---------- team ---------- */
function viewTeam() {
  const mgr = manager();
  let h = pageHead('Team', 'Everyone you hand work to. Roles are set inside each project.', '<button class="btn primary" data-act="agent-new">Add agent</button>');
  if (!mgr) h += '<div class="panel" style="margin-bottom:12px"><h2 class="sec" style="margin-top:0">Add yourself first</h2><p style="margin:0 0 12px">You are the manager: you check previews, merge and deploy.</p><button class="btn you" data-act="manager-new">Add me as manager</button></div>';
  const list = sortedAgents();
  if (list.length) h += '<div class="agents">' + list.map(agentRow).join('') + '</div>';
  const missing = PRESETS.filter((pr) => !S.agents.some((a) => a.id === pr.id || String(a.name).toLowerCase() === pr.name.toLowerCase()));
  if (missing.length) h += '<h2 class="sec">Quick add</h2><p class="muted small" style="margin:-4px 0 10px">Common tools, set up with sensible defaults. Edit them after adding.</p><div class="chips">' + missing.map((pr) => '<button class="chip" data-act="preset-add" data-id="' + pr.id + '">' + esc(pr.name) + '</button>').join('') + '</div>';
  h += '<p class="muted small" style="margin-top:22px">GitHub, Vercel and Supabase aren’t agents. Connect them to each project under Connections.</p>';
  return h;
}
function agentRow(a) {
  const seats = [];
  if (a.isManager) seats.push('Manager on every project');
  else S.projects.forEach((p) => { const rs = ROLES.filter((r) => roleIds(p, r.k).includes(a.id)).map((r) => r.name); if (rs.length) seats.push(p.code + ': ' + rs.join(', ')); });
  const active = S.tasks.filter((t) => t.agentId === a.id && WITH_AGENTS.includes(t.status)).length;
  return '<article class="agent">' + avatar(a, 'lg') + '<div><h3>' + esc(a.name) + (a.isManager ? ' <span class="tag you-tag">Manager</span>' : '') + '</h3>' +
    '<p class="muted">' + esc(KINDS[a.kind] || 'Agent') + (active ? '. ' + plural(active, 'active task', 'active tasks') : '') + '</p>' +
    ((a.caps || []).length ? '<div class="chips caps">' + a.caps.map((c) => '<span class="tag">' + esc(CAP[c] ? CAP[c].label : c) + '</span>').join('') + '</div>' : '') +
    (seats.length ? '<p class="seats">' + esc(seats.join('. ')) + '</p>' : '<p class="seats muted">No roles yet.</p>') +
    (a.notes ? '<p class="notes">' + esc(a.notes) + '</p>' : '') + '</div>' +
    '<div class="agent-act">' + (safeUrl(a.openUrl) ? extLink(a.openUrl, 'Open', 'btn sm') : '') + '<button class="btn sm" data-act="agent-edit" data-id="' + esc(a.id) + '">Edit</button></div></article>';
}

/* ---------- briefs ---------- */
function ghMention(a) { const m = String((a && a.ghMention) || '').trim(); return /^@[A-Za-z0-9][A-Za-z0-9_-]*$/.test(m) ? m : ''; }
function buildBrief(t, mode, opts) {
  const p = project(t.projectId) || {};
  const base = p.baseBranch || 'main';
  const review = mode === 'review';
  const doer = agent(review ? t.reviewerId : t.agentId);
  const role = review ? ROLE.reviewer : (ROLE[t.role] || ROLE.developer);
  const inRepo = !!doer && (doer.caps || []).includes('pr');
  const gh = !!(opts && opts.gh) && !review && !!ghMention(doer);
  const L = [];
  if (gh) L.push(ghMention(doer) + ' please do the task below and open a pull request into ' + base + '. Start every commit message with ' + code(t) + '.', '');
  L.push('# ' + code(t) + ': ' + t.title, '');
  L.push('Project: ' + (p.name || '') + ' (' + (p.code || '') + ')');
  if (p.description) L.push('About: ' + p.description);
  if (p.repo) L.push('Repository: https://github.com/' + p.repo + ' (base branch ' + base + ')');
  L.push('Your role: ' + role.name + '. ' + role.duty);
  if (doer) L.push('Assigned to: ' + doer.name);
  if (!review && t.branch && !gh) L.push('Work branch: ' + t.branch + '. Create it from ' + base + '. Never commit to ' + base + ' directly.');
  if (!review) L.push('Commit messages: start every one with ' + code(t) + ' so the task board can track this work.');
  if (review && t.branch) L.push('Branch under review: ' + t.branch);
  if (safeUrl(t.prUrl)) L.push('Pull request: ' + t.prUrl);
  const prev = previewFor(t);
  if (prev) L.push('Preview build: ' + prev);
  L.push('', review ? '## What the author was asked to do' : '## What to do', String(t.detail || '').trim() || 'No details written yet. Ask the manager before you start.');
  const fixes = t.fixes || [];
  if (fixes.length) { L.push('', review ? '## Fixes the manager asked for' : '## Fixes requested by the manager'); fixes.slice(-5).forEach((f) => L.push('- ' + f.text)); }
  const deps = (t.dependsOn || []).map(task).filter(Boolean);
  if (deps.length) {
    L.push('', '## Waits for');
    deps.forEach((d) => L.push('- ' + code(d) + ' ' + d.title + ' (' + (ST[d.status] || ST.backlog).label + (d.projectId !== t.projectId ? ', in ' + ((project(d.projectId) || {}).name || 'another project') : '') + ')'));
  }
  const rules = String(p.rules || '').split('\n').map((s) => s.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
  if (rules.length) { L.push('', '## Project rules. Follow every one.'); rules.forEach((r) => L.push('- ' + r)); }
  const team = ROLES.map((r) => { const n = liveIds(p, r.k).map((id) => agent(id).name); return n.length ? '- ' + r.name + ': ' + n.join(', ') : ''; }).filter(Boolean);
  const mgr = manager();
  team.push('- Manager: ' + (mgr ? mgr.name : 'the manager') + '. Checks the preview, merges and deploys. Nobody else merges.');
  if (!review && agent(t.reviewerId)) team.push('- Reviewer for this task: ' + agent(t.reviewerId).name);
  L.push('', '## Team', ...team);
  L.push('', '## When you finish');
  const steps = [];
  if (review) {
    steps.push('Read the whole diff, not just the summary.',
      'Check it against "What the author was asked to do" and every project rule.',
      'Check that any migration is a new, append-only file and safe to run twice.',
      'Comment on the pull request. Approve it or request changes. Do not merge.',
      'Reply with your verdict (approve or changes needed) and the three most important issues.');
  } else if (t.role === 'designer') {
    steps.push('Design the screens this task needs, mobile first.', 'Share a link or export with the manager. Do not write production code.', 'List any new components or states the developer will need.');
  } else if (t.role === 'advisor' || t.role === 'cto') {
    steps.push('Reply with your recommendation and the reasons behind it.', 'If the work should be split, list the tasks with a role for each.', 'Do not change code.');
  } else if (t.role === 'qa') {
    steps.push('Test the preview build' + (prev ? ' at ' + prev : '') + ' against "What to do".', 'Try it on a phone as a field user, and on desktop.', 'Reply with pass or fail for each point, with steps to reproduce any failure.');
  } else if (inRepo) {
    steps.push('Push ' + (t.branch || 'your branch') + ' and open a pull request into ' + base + ' titled "' + code(t) + ': ' + t.title + '".',
      'In the PR description: what changed, how to test it on the preview build, and any migration files.',
      'Make sure install, build and lint pass before you open it.',
      'Do not merge. Reply with the pull request link.');
  } else {
    steps.push('Reply with the complete revised file for every file you change. Never fragments or snippets.', 'Give the full path of each file.', 'Put any database migration in its own new file and say so.');
  }
  if (t.role === 'sql' && !review) steps.push('Migrations are append-only new files. Run them on the preview database only. Never run SQL on production.');
  steps.forEach((s, i) => L.push((i + 1) + '. ' + s));
  return L.join('\n');
}
function issueUrl(t) {
  const p = project(t.projectId);
  if (!p || !p.repo) return '';
  let body = buildBrief(t, 'work', { gh: true });
  if (body.length > 6000) body = body.slice(0, 6000) + '\n…';
  return 'https://github.com/' + encPath(p.repo) + '/issues/new?title=' + encodeURIComponent(code(t) + ': ' + t.title) + '&body=' + encodeURIComponent(body);
}

/* ---------- sheets ---------- */
const sheetEl = document.getElementById('sheet');
function sheetHead(titleHtml, extra) {
  return '<header class="sheet-head"><h2 id="sheet-title">' + titleHtml + (extra || '') + '</h2><button type="button" class="icon-btn" data-act="close" aria-label="Close">×</button></header>';
}
function sheetFoot(inner) { return '<footer class="sheet-foot">' + inner + '</footer>'; }
function openSheet(html, onMount, kind) {
  if (S.planCtl) { S.planCtl.abort(); S.planCtl = null; }
  S.sheet = { kind: kind || 'form' };
  sheetEl.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' + html + '</div>';
  sheetEl.hidden = false;
  document.body.classList.add('locked');
  const panel = sheetEl.firstElementChild;
  if (onMount) onMount(panel);
  const wide = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
  const first = panel.querySelector('input:not([type=radio]):not([type=checkbox]), textarea:not([readonly]), select');
  if (first && wide) first.focus(); else { const c = panel.querySelector('.icon-btn'); if (c && wide) c.focus(); }
}
function closeSheet() {
  if (S.planCtl) { S.planCtl.abort(); S.planCtl = null; }
  S.sheet = null;
  sheetEl.hidden = true;
  sheetEl.innerHTML = '';
  document.body.classList.remove('locked');
}

/* task sheet */
function openTask(id, tries) {
  const t = task(id);
  if (!t) { if ((tries || 0) < 6) setTimeout(() => openTask(id, (tries || 0) + 1), 250); return; }
  const mode = ['pr', 'review'].includes(t.status) && agent(t.reviewerId) ? 'review' : 'work';
  openSheet('', null, 'task');
  S.sheet = { kind: 'task', id, mode };
  drawTaskSheet();
  const p = project(t.projectId);
  if (p && p.vercelProjectId && S.health && S.health.vercel) {
    const V = S.live[p.id] && S.live[p.id].vercel;
    if (!V || (!V.list && !V.loading && !V.err)) fetchLive(p, false, 'vercel');
  }
  if (t.issueNumber && p && p.repo && S.health && S.health.github) loadThread(t, false);
}
function drawTaskSheet() {
  const panel = sheetEl.firstElementChild;
  if (!panel || !S.sheet) return;
  const t = task(S.sheet.id);
  if (!t) { closeSheet(); return; }
  const body = panel.querySelector('.sheet-body');
  const top = body ? body.scrollTop : 0;
  const hist = panel.querySelector('details.hist');
  const histOpen = hist ? hist.open : false;
  panel.innerHTML = taskSheetHtml(t);
  const nb = panel.querySelector('.sheet-body');
  if (nb) nb.scrollTop = top;
  const nh = panel.querySelector('details.hist');
  if (nh) nh.open = histOpen;
}
function taskSheetHtml(t) {
  const p = project(t.projectId) || {};
  const a = agent(t.agentId), rv = agent(t.reviewerId);
  const n = NEXT[t.status || 'backlog'];
  const base = p.baseBranch || 'main';
  const mode = S.sheet && S.sheet.mode === 'review' && rv ? 'review' : 'work';
  const target = mode === 'review' ? rv : a;
  const deps = (t.dependsOn || []).map(task).filter(Boolean);
  const holding = S.tasks.filter((x) => (x.dependsOn || []).includes(t.id));
  const det = detectPreview(t);
  const warn = [];
  if (a && rv && a.id === rv.id) warn.push(a.name + ' is set to review its own work. Pick a different reviewer.');
  if (!rv && t.role !== 'reviewer') warn.push('No reviewer on this task yet.');
  const unmet = deps.filter((d) => d.status !== 'deployed');
  if (unmet.length) warn.push('Waits for ' + unmet.map(code).join(', ') + ' to be deployed.');
  if (t.status === 'blocked' && t.blockedReason) warn.push('Blocked: ' + t.blockedReason);
  const repo = p.repo ? 'https://github.com/' + encPath(p.repo) : '';
  const branchHtml = t.branch
    ? '<span class="mono">' + esc(t.branch) + '</span>' + (repo ? '<span class="links">' + extLink(repo + '/tree/' + encPath(t.branch), 'View branch') + extLink(repo + '/compare/' + encPath(base) + '...' + encPath(t.branch) + '?expand=1', 'Open PR form') + '</span>' : '')
    : '<span class="muted">Not set</span>';
  let prevHtml = safeUrl(t.previewUrl) ? extLink(t.previewUrl) : '<span class="muted">No preview link yet</span>';
  if (det && det.url !== t.previewUrl) {
    prevHtml += '<div class="detected"><span>Vercel built this task’s code ' + ago(det.created) + ':</span><span class="st ' + stateCls(det.state) + '">' + esc(stateLabel(det.state)) + '</span>' + extLink(det.url, 'Open') +
      (det.state === 'READY' ? '<button class="btn sm" data-act="use-preview" data-id="' + esc(t.id) + '" data-url="' + esc(det.url) + '">Save as preview link</button>' : '') + '</div>';
  } else if (p.vercelProjectId && S.live[p.id] && S.live[p.id].vercel && S.live[p.id].vercel.loading && !safeUrl(t.previewUrl)) {
    prevHtml += ' <span class="muted small">Checking Vercel…</span>';
  }
  const roleName = (ROLE[t.role] || ROLE.developer).noun;
  const facts = [
    ['Assigned to', a ? who(a) + ' <span class="muted">as ' + esc(roleName) + '</span>' : '<span class="muted">Nobody yet</span>'],
    ['Reviewer', rv ? who(rv) : '<span class="muted">None</span>'],
    ['Priority', esc(cap1(t.priority || 'normal'))],
    ['Branch', branchHtml],
    ['Pull request', safeUrl(t.prUrl) ? extLink(t.prUrl) : '<span class="muted">Not opened yet</span>'],
    ['Preview', prevHtml],
  ];
  const fixes = (t.fixes || []).slice(-3).reverse();
  const hist = [...(t.history || [])].reverse();
  const brief = buildBrief(t, mode);
  const iss = mode === 'work' ? issueUrl(t) : '';
  const canSend = mode === 'work' && !t.issueNumber && !!p.repo && !!ghMention(a) && S.health && S.health.github;
  return sheetHead('<span class="code-lg">' + esc(code(t)) + '</span>', stamp(t)) +
    '<div class="sheet-body">' +
      '<h3 class="t-title">' + esc(t.title) + '</h3>' +
      '<p class="muted small" style="margin:0">In <button class="linkish" data-act="project-from-task" data-id="' + esc(p.id || '') + '">' + esc(p.name || 'a deleted project') + '</button>. Created ' + ago(t.createdAt) + (t.updatedAt && t.updatedAt !== t.createdAt ? ', updated ' + ago(t.updatedAt) : '') + '.</p>' +
      warn.map((w) => '<p class="note warn" style="margin-top:10px">' + esc(w) + '</p>').join('') +
      '<dl class="facts">' + facts.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl>' +
      (deps.length ? '<h4 class="mini">Waits for</h4><ul class="lines">' + deps.map(line).join('') + '</ul>' : '') +
      (holding.length ? '<h4 class="mini">Holding up</h4><ul class="lines">' + holding.map(line).join('') + '</ul>' : '') +
      '<h4 class="mini">What done looks like</h4><p class="detail">' + (t.detail ? esc(t.detail) : '<span class="muted">No details yet. Add them so the agent knows when it’s finished.</span>') + '</p>' +
      (fixes.length ? '<h4 class="mini">Fixes you asked for</h4><ul class="fixes">' + fixes.map((f) => '<li>' + esc(f.text) + ' <span class="muted small">' + ago(f.at) + '</span></li>').join('') + '</ul>' : '') +
      (t.issueNumber ? githubSection(t, p, a, rv) : '') +
      '<h4 class="mini">' + (t.issueNumber ? 'Brief that was sent' : 'Brief') + '</h4>' +
      (a && rv && a.id !== rv.id ? '<div class="chips brief-modes" role="group" aria-label="Brief for"><button class="chip" data-act="brief-mode" data-mode="work" aria-pressed="' + (mode === 'work') + '">For ' + esc(a.name) + '</button><button class="chip" data-act="brief-mode" data-mode="review" aria-pressed="' + (mode === 'review') + '">For reviewer ' + esc(rv.name) + '</button></div>' : '') +
      '<textarea id="brief" class="brief" readonly rows="14" aria-label="Brief">' + esc(brief) + '</textarea>' +
      '<div class="row brief-act"><button class="btn primary" data-act="copy-brief">Copy brief</button>' +
        (target && safeUrl(target.openUrl) ? extLink(target.openUrl, 'Open ' + esc(target.name), 'btn') : '') +
        (canSend ? '<button class="btn you" data-act="send-gh" data-id="' + esc(t.id) + '">Send to ' + esc(a.name) + ' on GitHub</button>' :
          (iss && !t.issueNumber ? (ghMention(a) ? '<a class="btn" data-act="sent-gh" data-id="' + esc(t.id) + '" href="' + esc(iss) + '" target="_blank" rel="noopener">Open GitHub issue form</a>' : extLink(iss, 'Create GitHub issue', 'btn')) : '')) + '</div>' +
      (canSend ? '<p class="stale">Creates the GitHub issue for you. ' + esc(a.name) + ' picks it up in the cloud, works on a branch and opens a pull request. This board then tracks it.</p>' : '') +
      '<details class="hist"><summary>History (' + hist.length + ')</summary><ul>' + hist.map((x) => '<li><span class="muted">' + ago(x.at) + '</span> ' + esc(x.text) + '</li>').join('') + '</ul></details>' +
    '</div>' +
    sheetFoot(
      '<button class="btn" data-act="task-edit" data-id="' + esc(t.id) + '">Edit</button>' +
      (['pr', 'review', 'verify', 'approved'].includes(t.status) ? '<button class="btn" data-act="task-back" data-id="' + esc(t.id) + '">Send back</button>' : '') +
      (!['blocked', 'deployed'].includes(t.status) ? '<button class="btn" data-act="task-block" data-id="' + esc(t.id) + '">Block</button>' : '') +
      (n ? '<button class="btn push ' + (n.you ? 'you' : 'primary') + '" data-act="task-next" data-id="' + esc(t.id) + '">' + n.label + '</button>' : ''));
}

/* GitHub thread for a task */
async function loadThread(t, force) {
  const p = project(t.projectId);
  if (!p || !p.repo || !t.issueNumber) return;
  const T = S.threads[t.id] || (S.threads[t.id] = {});
  if (!force && T.data && now() - (T.at || 0) < 60000) return;
  T.loading = true;
  if (S.sheet && S.sheet.kind === 'task' && S.sheet.id === t.id) drawTaskSheet();
  try { T.data = await API.get('/api/github?repo=' + enc(p.repo) + '&issue=' + enc(t.issueNumber) + '&code=' + enc(code(t))); T.err = ''; T.at = now(); }
  catch (e) { T.err = e.message; }
  T.loading = false;
  if (S.sheet && S.sheet.kind === 'task' && S.sheet.id === t.id) drawTaskSheet();
}
function githubSection(t, p, a, rv) {
  const T = S.threads[t.id] || {};
  const d = T.data;
  const g = t.gh || {};
  const pr = d && d.pr;
  const mention = ghMention(a);
  const rvMention = ghMention(rv);
  const busy = !!T.loading;
  let h = '<h4 class="mini">On GitHub</h4><div class="gh">';
  h += '<div class="row gh-head">' + extLink(t.issueUrl || ('https://github.com/' + encPath(p.repo) + '/issues/' + t.issueNumber), 'Issue #' + esc(t.issueNumber), 'tag') +
    (pr ? extLink(pr.url, 'PR #' + esc(pr.number) + (pr.state === 'merged' ? ', merged' : pr.state === 'open' ? '' : ', closed'), 'tag') : (g.prUrl ? extLink(g.prUrl, 'PR #' + esc(g.prNumber), 'tag') : '<span class="tag">No pull request yet</span>')) +
    (pr && pr.checks.length ? '<span class="tag ' + (summarizeChecks(pr.checks) === 'pass' ? 'ok-tag' : summarizeChecks(pr.checks) === 'fail' ? 'bad-tag' : '') + '">Checks ' + esc(summarizeChecks(pr.checks) === 'pass' ? 'pass' : summarizeChecks(pr.checks) === 'fail' ? 'fail' : 'running') + '</span>' : '') +
    (pr ? '<span class="tag">' + esc('+' + (pr.additions || 0) + ' −' + (pr.deletions || 0) + ' in ' + plural(pr.changedFiles || 0, 'file', 'files')) + '</span>' : '') +
    '<span class="muted small">' + (busy ? 'Checking…' : T.at ? 'Checked ' + ago(T.at) : '') + '</span></div>';
  if (T.err) h += '<p class="note warn">' + esc(T.err) + '</p>';
  if (pr && pr.reviews.length) {
    h += '<p class="gh-label">Reviews</p><ul class="gh-list">' + pr.reviews.slice(-4).map((r) => '<li><strong>' + esc(r.user) + '</strong> <span class="' + (r.state === 'APPROVED' ? 'st ok' : r.state === 'CHANGES_REQUESTED' ? 'st bad' : 'muted') + '">' + esc(reviewLabel(r.state)) + '</span> <span class="muted small">' + ago(Date.parse(r.at)) + '</span>' + (r.body ? '<div class="gh-body">' + esc(r.body.slice(0, 500)) + '</div>' : '') + '</li>').join('') + '</ul>';
    if (pr.reviewComments.length) h += '<p class="gh-label">Review comments</p><ul class="gh-list">' + pr.reviewComments.slice(-5).map((c) => '<li><strong>' + esc(c.user) + '</strong> <span class="mono muted">' + esc(c.path) + '</span><div class="gh-body">' + esc(c.body.slice(0, 300)) + '</div></li>').join('') + '</ul>';
  }
  if (d && d.comments.length) {
    h += '<p class="gh-label">Latest replies</p><ul class="gh-list">' + d.comments.slice(-3).map((c) => '<li><strong>' + esc(c.user) + '</strong> <span class="muted small">' + ago(Date.parse(c.at)) + '</span>' + (c.url ? ' ' + extLink(c.url, 'open', 'small') : '') + '<div class="gh-body">' + esc(c.body.slice(0, 700)) + '</div></li>').join('') + '</ul>';
  } else if (d && !busy) h += '<p class="muted small">No replies on the issue yet.</p>';
  if (t.verdict) {
    const v = t.verdict;
    h += '<div class="verdict ' + (v.ready ? 'ok' : 'bad') + '"><div class="verdict-head"><strong>' + (v.ready ? 'Ready to merge' : 'Not ready yet') + '</strong><span class="muted small">Claude, ' + ago(v.at) + (pr && v.pr === pr.number && v.sha !== pr.sha ? ', before the latest commit' : '') + '</span></div>' +
      '<p>' + esc(v.summary) + '</p>' +
      (v.checks.length ? '<ul class="verdict-checks">' + v.checks.map((c) => '<li class="' + (c.ok ? 'ok' : 'bad') + '"><span>' + esc(c.label) + '</span>' + (c.note ? '<span class="muted">' + esc(c.note) + '</span>' : '') + '</li>').join('') + '</ul>' : '') +
      (v.risks.length ? '<p class="gh-label">Test on the preview</p><ul class="gh-list plain">' + v.risks.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>' : '') +
      (!v.ready && v.askAgent ? '<button class="btn sm" data-act="gh-post-ask" data-id="' + esc(t.id) + '">Send these fixes to ' + esc(a ? a.name : 'the author') + '</button>' : '') + '</div>';
  }
  h += '<div class="row gh-actions">' +
    '<button class="btn sm" data-act="gh-refresh" data-id="' + esc(t.id) + '" ' + (busy || S.syncing ? 'disabled' : '') + '>Refresh</button>' +
    (pr && pr.state === 'open' && rvMention ? '<button class="btn sm" data-act="gh-review" data-id="' + esc(t.id) + '">Ask ' + esc(rv.name) + ' to review</button>' : '') +
    (mention && (d || t.issueNumber) ? '<button class="btn sm" data-act="gh-fix" data-id="' + esc(t.id) + '">Send fixes to ' + esc(a.name) + '</button>' : '') +
    (pr && pr.state === 'open' && S.health && S.health.claude ? '<button class="btn sm" data-act="gh-verdict" data-id="' + esc(t.id) + '">' + (t.verdict ? 'Verdict again' : 'Get verdict') + '</button>' : '') +
    (pr && pr.state === 'open' ? '<button class="btn sm you" data-act="gh-merge" data-id="' + esc(t.id) + '">Merge and deploy</button>' : '') +
    '</div></div>';
  return h;
}
function reviewLabel(s) { return ({ APPROVED: 'approved', CHANGES_REQUESTED: 'changes requested', COMMENTED: 'commented', DISMISSED: 'dismissed' })[s] || String(s || '').toLowerCase(); }
function summarizeChecks(checks) {
  if (!checks || !checks.length) return 'none';
  if (checks.some((c) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c.conclusion))) return 'fail';
  if (checks.some((c) => c.status !== 'completed')) return 'pending';
  return 'pass';
}
async function sendToGitHub(id) {
  const t = task(id); const p = t && project(t.projectId); const a = t && agent(t.agentId);
  if (!t || !p || !p.repo || !ghMention(a)) return;
  const btn = sheetEl.querySelector('[data-act="send-gh"]'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    const r = await API.send('/api/github', 'POST', { action: 'issue', repo: p.repo, title: code(t) + ': ' + t.title, body: buildBrief(t, 'work', { gh: true }), labels: ['dev-command', 'role:' + (t.role || 'developer')] });
    const hist = [...(t.history || []), { at: now(), text: 'Sent to ' + a.name + ' on GitHub (issue #' + r.number + ')' }].slice(-30);
    await save('tasks', t.id, Object.assign({}, t, { issueNumber: r.number, issueUrl: r.url, status: ['backlog', 'assigned'].includes(t.status || 'backlog') ? 'working' : t.status, updatedAt: now(), history: hist }));
    toast(code(t) + ' sent. ' + a.name + ' will reply on issue #' + r.number + '.');
    loadThread(task(t.id), true);
  } catch (e) { toast('Couldn’t create the issue: ' + e.message); if (btn) { btn.disabled = false; btn.textContent = 'Send to ' + a.name + ' on GitHub'; } }
}
async function ghComment(t, target, body, note) {
  const p = project(t.projectId);
  await API.send('/api/github', 'POST', { action: 'comment', repo: p.repo, issue: target, body });
  const hist = [...(t.history || []), { at: now(), text: note }].slice(-30);
  await save('tasks', t.id, Object.assign({}, t, { updatedAt: now(), history: hist }));
}
async function askReview(id) {
  const t = task(id); const rv = t && agent(t.reviewerId); const T = S.threads[id]; const pr = T && T.data && T.data.pr;
  if (!t || !rv || !pr) return;
  try { await ghComment(t, pr.number, ghMention(rv) + ' review', 'Asked ' + rv.name + ' to review PR #' + pr.number); toast('Asked ' + rv.name + ' to review. Check back in a few minutes.'); }
  catch (e) { toast('Couldn’t post the request: ' + e.message); }
}
function sendFixes(id) {
  const t = task(id); const a = t && agent(t.agentId);
  if (!t || !a || !ghMention(a)) return;
  promptSheet({
    title: code(t) + ': send fixes to ' + a.name, label: 'What should change?', multiline: true, okLabel: 'Post on GitHub',
    placeholder: 'The total doesn’t include GST. Keep the migration append-only.',
    onOk: async (v) => {
      const T = S.threads[id]; const pr = T && T.data && T.data.pr;
      const target = pr && pr.state === 'open' ? pr.number : t.issueNumber;
      try {
        await ghComment(t, target, ghMention(a) + ' ' + v + '\n\nUpdate the same branch and pull request. Start every commit message with ' + code(t) + '.', 'Fixes sent to ' + a.name + ': ' + v);
        const cur = task(id);
        await save('tasks', id, Object.assign({}, cur, { status: 'working', fixes: [...(cur.fixes || []), { at: now(), text: v }].slice(-10), updatedAt: now() }));
        toast('Posted. ' + a.name + ' will update the pull request.');
      } catch (e) { toast('Couldn’t post: ' + e.message); }
    },
  });
}
async function getVerdict(id) {
  const t = task(id); if (!t) return;
  const btn = sheetEl.querySelector('[data-act="gh-verdict"]'); if (btn) { btn.disabled = true; btn.textContent = 'Reading the pull request…'; }
  try {
    const r = await API.send('/api/verdict', 'POST', { taskId: id });
    const cur = task(id);
    if (cur) await save('tasks', id, Object.assign({}, cur, { verdict: r.verdict, updatedAt: now() }));
    toast(r.verdict.ready ? code(t) + ' looks ready. Check the preview, then merge.' : code(t) + ' isn’t ready yet. See why in the task.');
  } catch (e) { toast('Verdict failed: ' + e.message); if (btn) { btn.disabled = false; btn.textContent = 'Get verdict'; } }
}
async function postAsk(id) {
  const t = task(id); const a = t && agent(t.agentId); const v = t && t.verdict;
  if (!t || !v || !v.askAgent) return;
  const T = S.threads[id]; const pr = T && T.data && T.data.pr;
  const target = pr && pr.state === 'open' ? pr.number : t.issueNumber;
  const body = (ghMention(a) && !v.askAgent.trim().startsWith('@') ? ghMention(a) + ' ' : '') + v.askAgent;
  try { await ghComment(t, target, body, 'Verdict fixes sent to ' + (a ? a.name : 'the author')); await save('tasks', id, Object.assign({}, task(id), { status: 'working', updatedAt: now() })); toast('Posted on GitHub.'); }
  catch (e) { toast('Couldn’t post: ' + e.message); }
}
async function mergeTask(id, btn) {
  const t = task(id); const p = t && project(t.projectId); const T = S.threads[id]; const pr = T && T.data && T.data.pr;
  if (!t || !p || !pr || pr.state !== 'open') return;
  if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Tap again to merge PR #' + pr.number + ' into ' + (pr.base || p.baseBranch || 'main'); return; }
  btn.disabled = true; btn.textContent = 'Merging…';
  try {
    const r = await API.send('/api/github', 'POST', { action: 'merge', repo: p.repo, pr: pr.number, issue: t.issueNumber, title: code(t) + ': ' + t.title });
    if (!r.merged) throw new Error(r.message || 'GitHub refused the merge');
    const cur = task(id);
    await save('tasks', id, Object.assign({}, cur, { status: 'deployed', updatedAt: now(), history: [...(cur.history || []), { at: now(), text: 'Merged PR #' + pr.number + '. Production deploy started.' }].slice(-30) }));
    toast(code(t) + ' merged. Vercel is deploying production.');
    loadThread(task(id), true);
  } catch (e) { toast('Merge failed: ' + e.message); btn.disabled = false; btn.textContent = 'Merge and deploy'; delete btn.dataset.armed; }
}

/* prompt sheet */
function promptSheet(o) {
  const back = S.sheet && S.sheet.kind === 'task' ? S.sheet.id : null;
  const field = o.multiline
    ? '<textarea id="pr-in" rows="4" placeholder="' + esc(o.placeholder || '') + '">' + esc(o.value || '') + '</textarea>'
    : '<input id="pr-in" value="' + esc(o.value || '') + '" placeholder="' + esc(o.placeholder || '') + '" autocapitalize="off" autocomplete="off" spellcheck="false">';
  openSheet(sheetHead(esc(o.title)) + '<form id="pr-form" novalidate><div class="sheet-body"><label class="field"><span>' + esc(o.label) + '</span>' + field + (o.optional ? '<small>Optional. You can add it later.</small>' : '') + '</label></div>' +
    sheetFoot('<button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn primary">' + esc(o.okLabel || 'Save') + '</button>') + '</form>', (panel) => {
    const f = panel.querySelector('#pr-form'), inp = panel.querySelector('#pr-in');
    panel.querySelector('[data-cancel]').addEventListener('click', () => { closeSheet(); if (back && task(back)) openTask(back); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = inp.value.trim();
      if (!v && !o.optional) { inp.focus(); toast(o.label + ' is needed.'); return; }
      closeSheet();
      await o.onOk(v);
      if (back && task(back)) openTask(back);
    });
    setTimeout(() => { try { inp.focus(); } catch (_) { /* ignore */ } }, 60);
  });
}

/* task form */
function agentOptions(p, role, selected) {
  const inRole = liveIds(p, role);
  const workers = liveIds(p, 'workers').filter((id) => !inRole.includes(id));
  const rest = sortedAgents().map((a) => a.id).filter((id) => !inRole.includes(id) && !workers.includes(id));
  const opt = (id) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(agentName(id)) + '</option>';
  return '<option value=""' + (!selected ? ' selected' : '') + '>Nobody yet</option>' +
    (inRole.length ? '<optgroup label="' + esc(ROLE[role].name) + '">' + inRole.map(opt).join('') + '</optgroup>' : '') +
    (workers.length ? '<optgroup label="Workers">' + workers.map(opt).join('') + '</optgroup>' : '') +
    (rest.length ? '<optgroup label="Everyone else">' + rest.map(opt).join('') + '</optgroup>' : '');
}
function reviewerOptions(p, selected) {
  const rv = liveIds(p, 'reviewer');
  const rest = sortedAgents().map((a) => a.id).filter((id) => !rv.includes(id));
  const opt = (id) => '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(agentName(id)) + '</option>';
  return '<option value=""' + (!selected ? ' selected' : '') + '>No reviewer</option>' +
    (rv.length ? '<optgroup label="Reviewers">' + rv.map(opt).join('') + '</optgroup>' : '') +
    (rest.length ? '<optgroup label="Everyone else">' + rest.map(opt).join('') + '</optgroup>' : '');
}
function openTaskForm(pid, id) {
  const p = project(pid);
  if (!p) return;
  const t = id ? task(id) : null;
  if (!t && !rolesReady(p)) { toast('Set a developer and a reviewer first.'); openRolesEditor(pid); return; }
  const role = (t && t.role) || 'developer';
  const agentSel = t ? (t.agentId || '') : defaultAgentFor(p, role);
  const revSel = t ? (t.reviewerId || '') : defaultReviewer(p, agentSel);
  const deps = new Set((t && t.dependsOn) || []);
  const cands = S.tasks.filter((x) => (!t || x.id !== t.id) && project(x.projectId) && (x.status !== 'deployed' || deps.has(x.id)));
  const groups = {};
  cands.forEach((x) => { (groups[x.projectId] = groups[x.projectId] || []).push(x); });
  const gids = Object.keys(groups).sort((x, y) => (x === pid ? -1 : y === pid ? 1 : String(project(x).name).localeCompare(String(project(y).name))));
  const depHtml = gids.length ? gids.map((g) => '<h5>' + esc(project(g).name) + '</h5>' + groups[g].sort(byPrio).map((x) =>
    '<label><input type="checkbox" name="dep" value="' + esc(x.id) + '"' + (deps.has(x.id) ? ' checked' : '') + '><span><strong>' + esc(code(x)) + '</strong> ' + esc(x.title) + '</span></label>').join('')).join('')
    : '<p class="muted small">No other open tasks yet.</p>';
  const html = sheetHead(t ? 'Edit ' + esc(code(t)) : 'New task in ' + esc(p.name)) +
    '<form id="task-form" novalidate><div class="sheet-body">' +
      '<label class="field"><span>Task</span><input name="title" maxlength="140" value="' + esc(t ? t.title : '') + '" placeholder="Show pending collections on the salesman home screen"></label>' +
      '<label class="field"><span>What done looks like</span><textarea name="detail" rows="5" placeholder="One point per line. The agent and the reviewer both check against this.">' + esc(t ? t.detail : '') + '</textarea></label>' +
      '<div class="grid2">' +
        '<label class="field"><span>Role</span><select name="role">' + TASK_ROLES.map((k) => '<option value="' + k + '"' + (k === role ? ' selected' : '') + '>' + ROLE[k].name + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Priority</span><select name="priority">' + ['high', 'normal', 'low'].map((k) => '<option value="' + k + '"' + (k === ((t && t.priority) || 'normal') ? ' selected' : '') + '>' + cap1(k) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>Assigned to</span><select name="agentId">' + agentOptions(p, role, agentSel) + '</select></label>' +
        '<label class="field"><span>Reviewer</span><select name="reviewerId">' + reviewerOptions(p, revSel) + '</select></label>' +
      '</div>' +
      '<p class="note warn" id="same-warn"' + (agentSel && agentSel === revSel ? '' : ' hidden') + '>The reviewer is also doing the work. Pick a different reviewer.</p>' +
      '<label class="field"><span>Branch</span><input name="branch" class="mono" value="' + esc(t ? t.branch : '') + '" placeholder="Named automatically from the agent and task" autocapitalize="off" autocomplete="off" spellcheck="false"><small>Leave empty to name it automatically.</small></label>' +
      '<div class="grid2">' +
        '<label class="field"><span>Pull request link</span><input name="prUrl" type="url" value="' + esc(t ? t.prUrl : '') + '" placeholder="https://github.com/…/pull/…" autocapitalize="off"></label>' +
        '<label class="field"><span>Preview link</span><input name="previewUrl" type="url" value="' + esc(t ? t.previewUrl : '') + '" placeholder="https://….vercel.app" autocapitalize="off"></label>' +
      '</div>' +
      (t ? '<label class="field"><span>Status</span><select name="status">' + STATUSES.map((s) => '<option value="' + s.k + '"' + (s.k === (t.status || 'backlog') ? ' selected' : '') + '>' + s.label + '</option>').join('') + '</select></label>' : '') +
      '<fieldset class="field"><legend>Waits for</legend><small>Tasks in any project that must be deployed before this one.</small><div class="picklist">' + depHtml + '</div></fieldset>' +
      (t ? '<div class="danger-zone"><button type="button" class="btn danger sm" data-del>Delete task</button></div>' : '') +
    '</div>' + sheetFoot('<button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">' + (t ? 'Save task' : 'Create task') + '</button>') + '</form>';

  openSheet(html, (panel) => {
    const f = panel.querySelector('#task-form');
    const F = (n) => f.elements.namedItem(n);
    const syncWarn = () => { const w = panel.querySelector('#same-warn'); w.hidden = !(F('agentId').value && F('agentId').value === F('reviewerId').value); };
    F('role').addEventListener('change', () => {
      const r = F('role').value;
      const aid = defaultAgentFor(p, r);
      F('agentId').innerHTML = agentOptions(p, r, aid);
      if (F('reviewerId').value === aid || !F('reviewerId').value) F('reviewerId').innerHTML = reviewerOptions(p, r === 'reviewer' ? '' : defaultReviewer(p, aid));
      syncWarn();
    });
    F('agentId').addEventListener('change', () => {
      const aid = F('agentId').value;
      if (aid && F('reviewerId').value === aid) F('reviewerId').innerHTML = reviewerOptions(p, defaultReviewer(p, aid));
      syncWarn();
    });
    F('reviewerId').addEventListener('change', syncWarn);
    const del = panel.querySelector('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete ' + code(t); return; }
      const c = code(t);
      if (await remove('tasks', t.id)) { closeSheet(); toast(c + ' deleted.'); }
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = F('title').value.trim();
      if (!title) { F('title').focus(); toast('Give the task a name.'); return; }
      const rawPr = F('prUrl').value.trim(), rawPrev = F('previewUrl').value.trim();
      if (rawPr && !safeUrl(rawPr)) { F('prUrl').focus(); toast('The pull request link must start with https://'); return; }
      if (rawPrev && !safeUrl(rawPrev)) { F('previewUrl').focus(); toast('The preview link must start with https://'); return; }
      const data = {
        projectId: pid, title, detail: F('detail').value.replace(/\r/g, '').trim(), role: F('role').value,
        agentId: F('agentId').value, reviewerId: F('reviewerId').value, priority: F('priority').value,
        prUrl: safeUrl(rawPr), previewUrl: safeUrl(rawPrev),
        dependsOn: [...f.querySelectorAll('input[name="dep"]:checked')].map((i) => i.value),
      };
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      if (t) {
        const status = F('status').value;
        const hist = [...(t.history || [])];
        if (status !== t.status) hist.push({ at: now(), text: 'Moved to ' + ST[status].label });
        if (data.agentId !== (t.agentId || '')) hist.push({ at: now(), text: 'Assigned to ' + agentName(data.agentId) });
        const rec = Object.assign({}, t, data, { status, updatedAt: now(), history: hist.slice(-30) });
        rec.branch = F('branch').value.trim() || branchFor(p, rec);
        if (await save('tasks', t.id, rec)) { closeSheet(); toast(code(rec) + ' saved.'); openTask(t.id); } else btn.disabled = false;
      } else {
        const num = nextNum(p);
        const rec = Object.assign({}, data, {
          num, status: data.agentId ? 'assigned' : 'backlog', createdAt: now(), updatedAt: now(), fixes: [],
          history: [{ at: now(), text: data.agentId ? 'Created and assigned to ' + agentName(data.agentId) : 'Created' }],
        });
        rec.branch = F('branch').value.trim() || branchFor(p, rec);
        const nid = uid();
        if (await save('tasks', nid, rec)) {
          await patch('projects', p.id, { nextNum: num + 1 });
          closeSheet();
          toast(p.code + '-' + num + ' created. Copy the brief and hand it over.');
          openTask(nid);
        } else btn.disabled = false;
      }
    });
  });
}

/* project form */
function openProjectForm(id) {
  const p = id ? project(id) : null;
  const cur = p ? pc(p) : COLORS[0][0];
  const colors = COLORS.some((c) => c[0].toLowerCase() === cur.toLowerCase()) ? COLORS : COLORS.concat([[cur, 'Current colour']]);
  const links = ((p && p.links) || []).map((l) => l.label + ' | ' + l.url).join('\n');
  const donors = S.projects.filter((x) => x.id !== id && rolesReady(x));
  const v = (k, d) => esc(p && p[k] != null ? p[k] : (d || ''));
  const html = sheetHead(p ? 'Edit ' + esc(p.name) : 'New project') +
    '<form id="pform" novalidate><div class="sheet-body">' +
      '<h4 class="mini" style="margin-top:0">Basics</h4>' +
      '<div class="grid2"><label class="field"><span>Name</span><input name="name" maxlength="80" value="' + v('name') + '" placeholder="Madhusudan One"></label>' +
      '<label class="field"><span>Short code</span><input name="code" maxlength="6" value="' + v('code') + '" placeholder="MO" autocapitalize="characters" autocomplete="off"><small>2 to 6 letters or digits. Task numbers start with it.</small></label></div>' +
      '<label class="field"><span>What it is</span><input name="description" maxlength="200" value="' + v('description') + '" placeholder="Field force ERP for VPPL"></label>' +
      '<fieldset class="field"><legend>Colour</legend><div class="swatches">' + colors.map(([c, l]) => '<label class="sw" title="' + esc(l) + '"><input type="radio" name="color" value="' + c + '"' + (c.toLowerCase() === cur.toLowerCase() ? ' checked' : '') + '><span class="chipc" style="--c:' + c + '"></span><span class="sr">' + esc(l) + '</span></label>').join('') + '</div></fieldset>' +
      (p ? '<label class="field"><span>Status</span><select name="status">' + Object.entries(PROJECT_STATUS).map(([k, l]) => '<option value="' + k + '"' + (k === (p.status || 'active') ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' : '') +
      '<h4 class="mini">Connections</h4>' +
      '<div class="grid2">' +
        '<label class="field"><span>GitHub repo</span><input name="repo" value="' + v('repo') + '" placeholder="owner/repo or GitHub link" autocapitalize="off" autocomplete="off" spellcheck="false"></label>' +
        '<label class="field"><span>Base branch</span><input name="baseBranch" value="' + v('baseBranch', 'main') + '" autocapitalize="off" autocomplete="off" spellcheck="false"></label>' +
        '<label class="field"><span>Vercel project ID</span><input name="vercelProjectId" value="' + v('vercelProjectId') + '" placeholder="prj_…" autocapitalize="off" autocomplete="off" spellcheck="false"></label>' +
        '<label class="field"><span>Vercel team ID</span><input name="vercelTeamId" value="' + v('vercelTeamId') + '" placeholder="team_…" autocapitalize="off" autocomplete="off" spellcheck="false"></label>' +
        '<label class="field"><span>Supabase project ref</span><input name="supabaseRef" value="' + v('supabaseRef') + '" placeholder="From the dashboard link" autocapitalize="off" autocomplete="off" spellcheck="false"></label>' +
        '<label class="field"><span>Stitch project link</span><input name="stitchUrl" type="url" value="' + v('stitchUrl') + '" placeholder="https://stitch.withgoogle.com/…" autocapitalize="off"></label>' +
      '</div>' +
      '<label class="field"><span>Other links</span><textarea name="links" rows="3" placeholder="Figma | https://figma.com/…&#10;n8n workflow | https://…">' + esc(links) + '</textarea><small>One per line: name | link.</small></label>' +
      '<h4 class="mini">Rules every agent must follow</h4>' +
      '<label class="field"><span class="sr">Rules</span><textarea name="rules" rows="7" placeholder="One rule per line">' + v('rules') + '</textarea><small>One rule per line. Every brief for this project includes them.</small></label>' +
      (!p && donors.length ? '<label class="field"><span>Team</span><select name="copyFrom"><option value="">Set roles from scratch</option>' + donors.map((o) => '<option value="' + esc(o.id) + '">Same roles as ' + esc(o.name) + '</option>').join('') + '</select></label>' : '') +
      (p ? '<div class="danger-zone"><button type="button" class="btn danger sm" data-del>Delete project</button></div>' : '') +
    '</div>' + sheetFoot('<button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">' + (p ? 'Save project' : 'Create project') + '</button>') + '</form>';

  openSheet(html, (panel) => {
    const f = panel.querySelector('#pform');
    const F = (n) => f.elements.namedItem(n);
    const del = panel.querySelector('[data-del]');
    if (del) del.addEventListener('click', async () => {
      const n = projTasks(p.id).length;
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete ' + p.name + (n ? ' and its ' + plural(n, 'task', 'tasks') : ''); return; }
      del.disabled = true;
      for (const t of projTasks(p.id)) await remove('tasks', t.id);
      for (const q of S.projects) {
        if (q.id !== p.id && (q.relations || []).some((r) => r.projectId === p.id)) await patch('projects', q.id, { relations: q.relations.filter((r) => r.projectId !== p.id) });
      }
      await remove('projects', p.id);
      closeSheet();
      go({ tab: 'projects' });
      toast(p.name + ' deleted.');
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = F('name').value.trim();
      const pcode = F('code').value.trim().toUpperCase();
      if (!name) { F('name').focus(); toast('Name the project.'); return; }
      if (!/^[A-Z0-9]{2,6}$/.test(pcode)) { F('code').focus(); toast('Use 2 to 6 letters or digits for the code.'); return; }
      if (S.projects.some((x) => x.id !== id && String(x.code).toUpperCase() === pcode)) { F('code').focus(); toast('Another project already uses ' + pcode + '.'); return; }
      const rawRepo = F('repo').value.trim();
      const repo = normRepo(rawRepo);
      if (rawRepo && !repo) { F('repo').focus(); toast('Write the repo as owner/name.'); return; }
      const rawStitch = F('stitchUrl').value.trim();
      if (rawStitch && !safeUrl(rawStitch)) { F('stitchUrl').focus(); toast('The Stitch link must start with https://'); return; }
      const links = F('links').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const parts = l.split('|');
        const url = safeUrl(parts.length > 1 ? parts.slice(1).join('|').trim() : parts[0]);
        if (!url) return null;
        let label = parts.length > 1 ? parts[0].trim() : '';
        if (!label) { try { label = new URL(url).hostname; } catch (_) { label = 'Link'; } }
        return { label, url };
      }).filter(Boolean);
      const colorEl = f.querySelector('input[name="color"]:checked');
      const data = {
        name, code: pcode, description: F('description').value.trim(), color: colorEl ? colorEl.value : cur,
        repo, baseBranch: F('baseBranch').value.trim() || 'main',
        vercelProjectId: F('vercelProjectId').value.trim(), vercelTeamId: F('vercelTeamId').value.trim(),
        supabaseRef: F('supabaseRef').value.trim(), stitchUrl: safeUrl(rawStitch), links,
        rules: F('rules').value.replace(/\r/g, '').trim(),
      };
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      if (p) {
        data.status = F('status').value;
        const changedConn = data.vercelProjectId !== p.vercelProjectId || data.vercelTeamId !== p.vercelTeamId || data.supabaseRef !== p.supabaseRef;
        if (await save('projects', p.id, Object.assign({}, p, data, { updatedAt: now() }))) {
          if (changedConn) delete S.live[p.id];
          closeSheet(); toast(name + ' saved.');
        } else btn.disabled = false;
      } else {
        let nid = slug(pcode, 20) || uid();
        if (project(nid)) nid = uid();
        const src = F('copyFrom') ? project(F('copyFrom').value) : null;
        const roles = src ? JSON.parse(JSON.stringify(src.roles || {})) : {};
        const ok = await save('projects', nid, Object.assign({}, data, { status: 'active', roles, relations: [], nextNum: 1, createdAt: now() }));
        if (!ok) { btn.disabled = false; return; }
        closeSheet();
        const ready = rolesReady({ roles });
        go({ tab: 'project', projectId: nid, sub: ready ? 'tasks' : 'roles', filter: 'open' });
        toast(ready ? name + ' is ready for tasks.' : name + ' added. Now decide who does what.');
        if (!ready) setTimeout(() => { if (project(nid)) openRolesEditor(nid); }, 300);
      }
    });
  });
}

/* roles editor */
function openRolesEditor(pid) {
  const p = project(pid);
  if (!p) return;
  const team = sortedAgents().filter((a) => !a.isManager);
  if (!team.length) { toast('Add agents to your team first.'); go({ tab: 'team' }); return; }
  const local = {};
  ROLES.forEach((r) => { local[r.k] = liveIds(p, r.k).slice(); });
  const bodyHtml = () => {
    const warns = roleWarnings(Object.assign({}, p, { roles: local })).filter((w) => w.k !== 'repo');
    return warns.map((w) => '<p class="note ' + w.lvl + '">' + esc(w.text) + '</p>').join('') +
      ROLES.map((r) => '<fieldset class="role-edit"><legend>' + r.name + '</legend><p class="hint">' + r.duty + '</p><div class="chips">' +
        team.map((a) => '<button type="button" class="pick" data-role="' + r.k + '" data-agent="' + esc(a.id) + '" aria-pressed="' + local[r.k].includes(a.id) + '">' + avatar(a) + '<span>' + esc(a.name) + '</span></button>').join('') +
        '</div></fieldset>').join('') +
      '<p class="note info" style="margin-top:14px">The manager seat is always yours: checking previews, merging, deploying and approving production SQL.</p>';
  };
  openSheet(sheetHead('Roles for ' + esc(p.name)) + '<div class="sheet-body" id="roles-body">' + bodyHtml() + '</div>' +
    sheetFoot('<button type="button" class="btn" data-act="close">Cancel</button><button type="button" class="btn primary" id="roles-save">Save roles</button>'), (panel) => {
    panel.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-role]');
      if (b) {
        const r = b.dataset.role, a = b.dataset.agent;
        const i = local[r].indexOf(a);
        if (i >= 0) local[r].splice(i, 1); else local[r].push(a);
        const body = panel.querySelector('#roles-body');
        const top = body.scrollTop;
        body.innerHTML = bodyHtml();
        body.scrollTop = top;
        const again = body.querySelector('[data-role="' + r + '"][data-agent="' + cssEsc(a) + '"]');
        if (again) again.focus({ preventScroll: true });
        return;
      }
      if (e.target.closest('#roles-save')) {
        const btn = panel.querySelector('#roles-save');
        btn.disabled = true;
        if (await patch('projects', pid, { roles: JSON.parse(JSON.stringify(local)), updatedAt: now() })) {
          closeSheet();
          toast(rolesReady({ roles: local }) ? 'Roles saved. Tasks can start.' : 'Roles saved. Add a developer and a reviewer before tasks can start.');
        } else btn.disabled = false;
      }
    });
  });
}

/* connected projects editor */
function openRelations(pid) {
  const p = project(pid);
  if (!p) return;
  const others = S.projects.filter((x) => x.id !== pid);
  if (!others.length) { toast('Add a second project first.'); return; }
  const rel = (p.relations || []).filter((r) => project(r.projectId)).map((r) => ({ projectId: r.projectId, type: r.type || 'depends', note: r.note || '' }));
  const listHtml = () => rel.length
    ? '<ul class="rel-list">' + rel.map((r, i) => '<li><span><strong>' + esc(RELATIONS[r.type] || r.type) + '</strong> ' + esc(project(r.projectId).name) + (r.note ? '<br><span class="muted small">' + esc(r.note) + '</span>' : '') + '</span><button type="button" class="btn sm" data-rm="' + i + '">Remove</button></li>').join('') + '</ul>'
    : '<p class="muted">' + esc(p.name) + ' isn’t connected to other projects yet.</p>';
  openSheet(sheetHead('Connected projects') + '<div class="sheet-body"><div id="rel-list">' + listHtml() + '</div>' +
    '<fieldset class="panel" style="margin-top:12px"><legend class="sr">Add a connection</legend>' +
      '<div class="grid2"><label class="field"><span>' + esc(p.name) + '</span><select id="rel-type">' + Object.entries(RELATIONS).map(([k, l]) => '<option value="' + k + '">' + esc(l) + '</option>').join('') + '</select></label>' +
      '<label class="field"><span>Project</span><select id="rel-proj">' + others.map((o) => '<option value="' + esc(o.id) + '">' + esc(o.name) + '</option>').join('') + '</select></label></div>' +
      '<label class="field"><span>Note</span><input id="rel-note" placeholder="Orders sync from here into Tally" autocomplete="off"></label>' +
      '<button type="button" class="btn" id="rel-add">Add connection</button></fieldset></div>' +
    sheetFoot('<button type="button" class="btn" data-act="close">Cancel</button><button type="button" class="btn primary" id="rel-save">Save connections</button>'), (panel) => {
    const redraw = () => { panel.querySelector('#rel-list').innerHTML = listHtml(); };
    panel.addEventListener('click', async (e) => {
      const rm = e.target.closest('[data-rm]');
      if (rm) { rel.splice(Number(rm.dataset.rm), 1); redraw(); return; }
      if (e.target.closest('#rel-add')) {
        const r = { type: panel.querySelector('#rel-type').value, projectId: panel.querySelector('#rel-proj').value, note: panel.querySelector('#rel-note').value.trim() };
        if (rel.some((x) => x.type === r.type && x.projectId === r.projectId)) { toast('That connection is already there.'); return; }
        rel.push(r); panel.querySelector('#rel-note').value = ''; redraw(); return;
      }
      if (e.target.closest('#rel-save')) {
        if (await patch('projects', pid, { relations: rel.slice(), updatedAt: now() })) { closeSheet(); toast('Connections saved.'); }
      }
    });
  });
}

/* agent form */
function openAgentForm(id, preset) {
  const a = id ? agent(id) : null;
  const d = a || preset || { kind: 'coding', caps: ['code', 'pr'] };
  const isMgr = !!d.isManager;
  const caps = new Set(d.caps || []);
  const html = sheetHead(a ? 'Edit ' + esc(a.name) : isMgr ? 'Add yourself as manager' : 'Add an agent') +
    '<form id="aform" novalidate><div class="sheet-body">' +
      (isMgr ? '<p class="note info">The manager checks previews, merges and deploys on every project. Only this seat can approve production changes.</p>' : '') +
      '<label class="field"><span>Name</span><input name="name" maxlength="60" value="' + esc(d.name || '') + '" placeholder="' + (isMgr ? 'Your name' : 'Codex') + '"></label>' +
      (isMgr ? '' : '<label class="field"><span>Type</span><select name="kind">' + Object.entries(KINDS).map(([k, l]) => '<option value="' + k + '"' + (k === d.kind ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select></label>') +
      '<fieldset class="field"><legend>What it can do</legend><div class="checks">' + CAPS.map((c) => '<label><input type="checkbox" name="cap" value="' + c.k + '"' + (caps.has(c.k) ? ' checked' : '') + '>' + c.label + '</label>').join('') + '</div><small>Roles use this to warn you when someone is given work they can’t do. “Opens PRs” means it works directly in the repo.</small></fieldset>' +
      '<div class="grid2"><label class="field"><span>Link to open it</span><input name="openUrl" type="url" value="' + esc(d.openUrl || '') + '" placeholder="https://…" autocapitalize="off"></label>' +
      '<label class="field"><span>Branch prefix</span><input name="branchPrefix" value="' + esc(d.branchPrefix || '') + '" placeholder="codex" autocapitalize="off" autocomplete="off" spellcheck="false"><small>Its branches start with this, like codex/mo-4-…</small></label></div>' +
      '<label class="field"><span>GitHub mention</span><input name="ghMention" value="' + esc(d.ghMention || '') + '" placeholder="@claude" autocapitalize="off" autocomplete="off" spellcheck="false"><small>If this agent runs inside GitHub, tasks sent there start with this so it picks them up. Leave empty otherwise.</small></label>' +
      '<label class="field"><span>Notes</span><textarea name="notes" rows="3" placeholder="Strengths, limits, which account it runs on">' + esc(d.notes || '') + '</textarea></label>' +
      (a && !isMgr ? '<div class="danger-zone"><button type="button" class="btn danger sm" data-del>Remove ' + esc(a.name) + ' from the team</button></div>' : '') +
    '</div>' + sheetFoot('<button type="button" class="btn" data-act="close">Cancel</button><button type="submit" class="btn primary">' + (a ? 'Save' : isMgr ? 'Add me' : 'Add agent') + '</button>') + '</form>';
  openSheet(html, (panel) => {
    const f = panel.querySelector('#aform');
    const F = (n) => f.elements.namedItem(n);
    const del = panel.querySelector('[data-del]');
    if (del) del.addEventListener('click', async () => {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again. ' + a.name + ' leaves every role and its open tasks go back to the backlog.'; return; }
      del.disabled = true;
      for (const p of S.projects) {
        if (ROLES.some((r) => roleIds(p, r.k).includes(a.id))) {
          const roles = {};
          ROLES.forEach((r) => { roles[r.k] = roleIds(p, r.k).filter((x) => x !== a.id); });
          await patch('projects', p.id, { roles });
        }
      }
      for (const t of S.tasks.filter((x) => x.status !== 'deployed' && (x.agentId === a.id || x.reviewerId === a.id))) {
        const upd = {};
        if (t.agentId === a.id) { upd.agentId = ''; if (WITH_AGENTS.includes(t.status)) upd.status = 'backlog'; }
        if (t.reviewerId === a.id) upd.reviewerId = '';
        upd.history = [...(t.history || []), { at: now(), text: a.name + ' left the team' }].slice(-30);
        await patch('tasks', t.id, upd);
      }
      await remove('agents', a.id);
      closeSheet();
      toast(a.name + ' removed.');
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = F('name').value.trim();
      if (!name) { F('name').focus(); toast('Add a name.'); return; }
      const rawUrl = F('openUrl').value.trim();
      if (rawUrl && !safeUrl(rawUrl)) { F('openUrl').focus(); toast('The link must start with https://'); return; }
      const rawMention = F('ghMention').value.trim();
      if (rawMention && !ghMention({ ghMention: rawMention })) { F('ghMention').focus(); toast('Write the mention like @claude'); return; }
      const data = {
        name, kind: isMgr ? 'human' : F('kind').value,
        caps: [...f.querySelectorAll('input[name="cap"]:checked')].map((i) => i.value),
        openUrl: safeUrl(rawUrl), branchPrefix: slug(F('branchPrefix').value, 20), notes: F('notes').value.trim(), isManager: isMgr,
        ghMention: ghMention({ ghMention: F('ghMention').value }),
      };
      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      if (a) {
        if (await save('agents', a.id, Object.assign({}, a, data, { updatedAt: now() }))) { closeSheet(); toast(name + ' saved.'); } else btn.disabled = false;
      } else {
        let nid = isMgr ? 'manager' : (preset && preset.id) || slug(name, 30);
        if (!nid || agent(nid)) nid = uid();
        if (await save('agents', nid, Object.assign({}, data, { order: isMgr ? 0 : 50, createdAt: now() }))) {
          closeSheet();
          toast(isMgr ? 'You’re set as manager.' : name + ' added. Give it roles inside each project.');
        } else btn.disabled = false;
      }
    });
  });
}
async function addPreset(pid) {
  const pr = PRESETS.find((x) => x.id === pid);
  if (!pr) return;
  const nid = agent(pr.id) ? uid() : pr.id;
  const ok = await save('agents', nid, { name: pr.name, kind: pr.kind, caps: pr.caps.slice(), openUrl: pr.openUrl, branchPrefix: pr.branchPrefix, ghMention: pr.ghMention || '', notes: '', isManager: false, order: PRESETS.indexOf(pr) + 1, createdAt: now() });
  if (ok) toast(pr.name + ' added. Give it roles inside each project.');
}

/* planning with Claude */
function planPrompt(p, feature) {
  const team = ROLES.map((r) => { const n = liveIds(p, r.k).map((id) => agent(id).name); return n.length ? '- ' + r.name + ': ' + n.join(', ') : ''; }).filter(Boolean).join('\n');
  return 'You are the CTO of a small AI software team run by one manager. Split the feature below into 2 to 8 tasks. ' +
    'Each task must fit in one pull request and be checkable on a preview build.\n\n' +
    'Project: ' + p.name + ' (' + p.code + ')\nAbout: ' + (p.description || 'n/a') + '\n' +
    'Project rules:\n' + (String(p.rules || '').trim() || '(none written)') + '\n' +
    'Team roles:\n' + team + '\n\n' +
    'Feature from the manager:\n"""\n' + feature + '\n"""\n\n' +
    'Put database migration work in its own task with role "sql". Add a "designer" task only if new screens are needed. ' +
    'Order tasks so earlier ones unblock later ones.\n\n' +
    'Reply with only a JSON array, no prose. Each item: {"title": short imperative task name under 80 characters, ' +
    '"detail": what done looks like as 2 to 5 lines separated by \\n, "role": one of "developer", "sql", "designer", "qa", "advisor", "workers", ' +
    '"priority": "high" or "normal" or "low", "after": array of 0-based indexes of earlier items this waits for}.\n' +
    'Example: [{"title":"Add dispatch_date column to orders","detail":"New append-only migration adds dispatch_date\\nExisting rows keep NULL","role":"sql","priority":"high","after":[]}]';
}
function normalizePlan(data) {
  const arr = Array.isArray(data) ? data : (data && Array.isArray(data.tasks) ? data.tasks : []);
  return arr.slice(0, 12).map((x, i) => ({
    title: String((x && x.title) || '').trim().slice(0, 140),
    detail: String((x && x.detail) || '').replace(/\\n/g, '\n').trim(),
    role: TASK_ROLES.includes(x && x.role) ? x.role : 'developer',
    priority: ['high', 'normal', 'low'].includes(x && x.priority) ? x.priority : 'normal',
    after: Array.isArray(x && x.after) ? x.after.filter((n) => Number.isInteger(n) && n >= 0 && n < i) : [],
  })).filter((x) => x.title);
}
function openPlan(pid) {
  const p = project(pid);
  if (!p || !(S.health && S.health.claude)) return;
  if (!rolesReady(p)) { openRolesEditor(pid); return; }
  let items = [];
  let picked = new Set();
  const html = sheetHead('Plan a feature for ' + esc(p.name)) +
    '<div class="sheet-body"><label class="field"><span>Describe the feature</span><textarea id="plan-in" rows="5" placeholder="Salesmen see their pending collections on the home screen, with a WhatsApp reminder button for each dealer."></textarea>' +
    '<small>Claude splits it into tasks with a role for each, using this project’s rules and team. You choose which ones to add.</small></label>' +
    '<div class="row"><button type="button" class="btn primary" id="plan-go">Split into tasks</button><button type="button" class="btn" id="plan-stop" hidden>Stop</button></div>' +
    '<div id="plan-out" aria-live="polite"></div></div>' +
    sheetFoot('<button type="button" class="btn" data-act="close">Cancel</button><button type="button" class="btn primary" id="plan-add" disabled>Add tasks</button>');
  openSheet(html, (panel) => {
    const out = panel.querySelector('#plan-out'), goBtn = panel.querySelector('#plan-go'), stopBtn = panel.querySelector('#plan-stop'), addBtn = panel.querySelector('#plan-add');
    const syncAdd = () => { addBtn.disabled = !picked.size; addBtn.textContent = picked.size ? 'Add ' + plural(picked.size, 'task', 'tasks') : 'Add tasks'; };
    const drawItems = () => {
      out.innerHTML = '<p class="muted small" style="margin:14px 0 0">Untick anything you don’t want. Tasks land in the backlog for you to hand out.</p><ol class="plan">' + items.map((it, i) =>
        '<li><label><input type="checkbox" data-i="' + i + '"' + (picked.has(i) ? ' checked' : '') + '><span><strong>' + (i + 1) + '. ' + esc(it.title) + '</strong> <span class="tag">' + esc(ROLE[it.role].name) + '</span>' +
        (it.priority === 'high' ? ' <span class="pri">High priority</span>' : '') + '<br><span class="plan-detail">' + esc(it.detail) + '</span>' +
        (it.after.length ? '<br><span class="muted small">After ' + it.after.map((n) => n + 1).join(', ') + '</span>' : '') + '</span></label></li>').join('') + '</ol>';
      syncAdd();
    };
    out.addEventListener('change', (e) => {
      const i = Number(e.target.dataset.i);
      if (!Number.isInteger(i)) return;
      if (e.target.checked) picked.add(i); else picked.delete(i);
      syncAdd();
    });
    goBtn.addEventListener('click', async () => {
      const feature = panel.querySelector('#plan-in').value.trim();
      if (!feature) { toast('Describe the feature first.'); return; }
      const ctl = new AbortController();
      S.planCtl = ctl;
      goBtn.disabled = true; stopBtn.hidden = false; items = []; picked = new Set(); syncAdd();
      out.innerHTML = '<p class="thinking" role="status" style="margin-top:14px">Claude is planning. This can take up to a minute.</p>';
      try {
        const data = await API.send('/api/plan', 'POST', { prompt: planPrompt(p, feature) }, { signal: ctl.signal });
        items = normalizePlan(data.tasks);
        picked = new Set(items.map((_, i) => i));
        if (!items.length) out.innerHTML = '<p class="note warn" style="margin-top:14px">Claude didn’t return any tasks. Add more detail and try again.</p>';
        else drawItems();
      } catch (e) {
        if (panel.isConnected) out.innerHTML = '<p class="note ' + (e && e.name === 'AbortError' ? 'info' : 'warn') + '" style="margin-top:14px">' + esc(e && e.name === 'AbortError' ? 'Stopped.' : 'Planning didn’t work: ' + ((e && e.message) || 'unknown error')) + '</p>';
      } finally {
        if (panel.isConnected) { goBtn.disabled = false; stopBtn.hidden = true; }
        if (S.planCtl === ctl) S.planCtl = null;
      }
    });
    stopBtn.addEventListener('click', () => { if (S.planCtl) S.planCtl.abort(); });
    addBtn.addEventListener('click', async () => {
      addBtn.disabled = true;
      const idx = [...picked].sort((x, y) => x - y);
      const ids = {};
      idx.forEach((i) => { ids[i] = uid(); });
      let num = nextNum(p);
      let made = 0;
      for (const i of idx) {
        const it = items[i];
        const agentId = defaultAgentFor(p, it.role);
        const rec = {
          projectId: p.id, num, title: it.title, detail: it.detail, role: it.role, agentId,
          reviewerId: it.role === 'reviewer' ? '' : defaultReviewer(p, agentId), priority: it.priority, prUrl: '', previewUrl: '',
          dependsOn: it.after.filter((j) => ids[j]).map((j) => ids[j]), status: 'backlog', fixes: [],
          createdAt: now(), updatedAt: now(), history: [{ at: now(), text: 'Planned with Claude' }],
        };
        rec.branch = branchFor(p, rec);
        if (!(await save('tasks', ids[i], rec))) break;
        num++; made++;
      }
      if (made) await patch('projects', p.id, { nextNum: num });
      closeSheet();
      S.view.filter = 'open';
      render();
      if (made) toast(plural(made, 'task', 'tasks') + ' added to the backlog. Hand them out when you’re ready.');
    });
  });
}

/* ---------- task actions ---------- */
async function setStatus(id, to, extra, note) {
  const t = task(id);
  if (!t) return false;
  const hist = [...(t.history || []), { at: now(), text: note || 'Moved to ' + ST[to].label }].slice(-30);
  const ok = await save('tasks', id, Object.assign({}, t, extra || {}, { status: to, updatedAt: now(), history: hist }));
  if (ok) toast(code(t) + ' moved to ' + ST[to].label + '.');
  return ok;
}
async function advance(id) {
  const t = task(id);
  if (!t) return;
  const n = NEXT[t.status || 'backlog'];
  if (!n) return;
  if (n.to === 'assigned' && !t.agentId) { toast('Pick who does this task.'); openTaskForm(t.projectId, t.id); return; }
  if (n.to === 'pr' && !safeUrl(t.prUrl)) {
    promptSheet({
      title: code(t) + ': pull request opened', label: 'Pull request link', placeholder: 'https://github.com/owner/repo/pull/12', okLabel: 'Save and move on', optional: true,
      onOk: (v) => { const u = safeUrl(v); if (v && !u) toast('That link wasn’t saved. It must start with https://'); return setStatus(t.id, 'pr', u ? { prUrl: u } : {}, u ? 'PR opened' : 'PR opened, no link saved'); },
    });
    return;
  }
  const unmet = unmetDeps(t);
  if ((n.to === 'approved' || n.to === 'deployed') && unmet.length) toast('Heads up: ' + unmet.map(code).join(', ') + ' isn’t deployed yet.');
  const extra = {};
  if (t.status === 'blocked') extra.blockedReason = '';
  if (n.to === 'verify' && !safeUrl(t.previewUrl)) { const d = detectPreview(t); if (d && d.state === 'READY') extra.previewUrl = d.url; }
  const ok = await setStatus(t.id, n.to, extra, n.to === 'assigned' ? 'Handed to ' + agentName(t.agentId) : null);
  if (ok && n.to === 'assigned' && !(S.sheet && S.sheet.kind === 'task')) openTask(t.id);
}
function sendBack(id) {
  const t = task(id);
  if (!t) return;
  promptSheet({
    title: code(t) + ': send back', label: 'What needs fixing?', placeholder: 'The total doesn’t include GST. The list jumps when a row is added.', multiline: true, okLabel: 'Send back',
    onOk: (v) => setStatus(id, 'working', { fixes: [...(t.fixes || []), { at: now(), text: v }].slice(-10) }, 'Sent back: ' + v),
  });
}
function blockTask(id) {
  const t = task(id);
  if (!t) return;
  promptSheet({
    title: code(t) + ': mark blocked', label: 'What is blocking it?', placeholder: 'Waiting for the Tally export format from accounts', multiline: true, okLabel: 'Mark blocked',
    onOk: (v) => setStatus(id, 'blocked', { blockedReason: v }, 'Blocked: ' + v),
  });
}
async function copyText(text, ta) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Brief copied. Paste it into the agent.');
  } catch (_) {
    let ok = false;
    if (ta) { ta.focus(); ta.select(); try { ok = document.execCommand('copy'); } catch (__) { ok = false; } }
    toast(ok ? 'Brief copied. Paste it into the agent.' : 'Copy didn’t work here. The brief is selected, so copy it by hand.');
  }
}

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3400);
}

/* ---------- events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  switch (act) {
    case 'nav': closeSheet(); go({ tab: el.dataset.tab }); break;
    case 'project': closeSheet(); go({ tab: 'project', projectId: id, sub: 'tasks', filter: 'open' }); break;
    case 'project-from-task': closeSheet(); if (project(id)) go({ tab: 'project', projectId: id, sub: 'tasks', filter: 'open' }); break;
    case 'sub': go({ sub: el.dataset.sub }); break;
    case 'filter': S.view.filter = el.dataset.f; render(); break;
    case 'close': closeSheet(); break;
    case 'project-new': openProjectForm(); break;
    case 'project-edit': openProjectForm(id); break;
    case 'roles-edit': openRolesEditor(id); break;
    case 'relations-edit': openRelations(id); break;
    case 'task-new': openTaskForm(id); break;
    case 'task': openTask(id); break;
    case 'task-edit': { const t = task(id); if (t) openTaskForm(t.projectId, id); break; }
    case 'task-next': advance(id); break;
    case 'task-back': sendBack(id); break;
    case 'task-block': blockTask(id); break;
    case 'brief-mode': if (S.sheet && S.sheet.kind === 'task') { S.sheet.mode = el.dataset.mode; drawTaskSheet(); } break;
    case 'copy-brief': { const ta = document.getElementById('brief'); copyText(ta ? ta.value : '', ta); break; }
    case 'use-preview': { const u = safeUrl(el.dataset.url); if (u) patch('tasks', id, { previewUrl: u, updatedAt: now() }).then((ok) => { if (ok) toast('Preview link saved.'); }); break; }
    case 'send-gh': sendToGitHub(id); break;
    case 'gh-refresh': syncGitHub(false, id); break;
    case 'gh-review': askReview(id); break;
    case 'gh-fix': sendFixes(id); break;
    case 'gh-verdict': getVerdict(id); break;
    case 'gh-post-ask': postAsk(id); break;
    case 'gh-merge': mergeTask(id, el); break;
    case 'sync': syncGitHub(false); break;
    case 'sent-gh': { const t = task(id); if (t && ['backlog', 'assigned'].includes(t.status || 'backlog')) setStatus(id, 'working', {}, 'Sent to ' + agentName(t.agentId) + ' on GitHub'); break; }
    case 'agent-new': openAgentForm(); break;
    case 'manager-new': openAgentForm(null, { isManager: true, kind: 'human', caps: ['plan', 'review', 'test'], name: '' }); break;
    case 'agent-edit': openAgentForm(id); break;
    case 'preset-add': addPreset(id); break;
    case 'plan': openPlan(id); break;
    case 'live-refresh': fetchLive(project(id), true, 'all'); break;
    default: break;
  }
});
sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl) closeSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sheet) closeSheet(); });

boot();
})();
