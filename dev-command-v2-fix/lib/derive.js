// Status derivation shared by sync and verdict.
export const ORDER = ['backlog', 'assigned', 'working', 'pr', 'review', 'verify', 'approved', 'deployed'];
export const LABEL = { backlog: 'Backlog', assigned: 'Assigned', working: 'In progress', pr: 'PR open', review: 'In review', verify: 'Check preview', approved: 'Ready to merge', deployed: 'Deployed', blocked: 'Blocked' };

export function summarizeChecks(checks) {
  if (!checks || !checks.length) return 'none';
  if (checks.some((c) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(c.conclusion))) return 'fail';
  if (checks.some((c) => c.status !== 'completed')) return 'pending';
  return 'pass';
}

export function derive(task, th, preview) {
  const cur = task.status || 'backlog';
  const pr = th && th.pr;
  const facts = {
    syncedAt: Date.now(),
    issueState: th && th.issue ? th.issue.state : null,
    prNumber: pr ? pr.number : null, prUrl: pr ? pr.url : null, prState: pr ? pr.state : null, prHead: pr ? pr.head : null, prSha: pr ? pr.sha : null,
    checks: pr ? summarizeChecks(pr.checks) : 'none',
    checkList: pr ? pr.checks.map((c) => ({ name: c.name, conclusion: c.conclusion || c.status })) : [],
    reviews: pr ? pr.reviews.map((r) => ({ user: r.user, state: r.state, at: r.at })) : [],
    reviewCount: pr ? pr.reviews.length : 0,
    comments: th ? th.comments.length : 0,
    lastComment: th && th.comments.length ? { user: th.comments[th.comments.length - 1].user, at: th.comments[th.comments.length - 1].at, body: String(th.comments[th.comments.length - 1].body).slice(0, 400), url: th.comments[th.comments.length - 1].url } : null,
    preview: preview || null,
  };
  let to = cur;
  if (pr && pr.merged) to = 'deployed';
  else if (pr && pr.state === 'open') {
    const hasReview = pr.reviews.length > 0;
    const ok = facts.checks === 'pass' || facts.checks === 'none';
    const ready = preview && preview.state === 'READY';
    to = hasReview && ok && ready ? 'verify' : hasReview ? 'review' : 'pr';
  } else if (th && th.comments.some((c) => c.bot)) to = 'working';
  // Never move backwards, never touch what the manager decided by hand.
  const manual = ['blocked', 'verify', 'approved'];
  if (manual.includes(cur) && to !== 'deployed') to = cur;
  if (ORDER.indexOf(to) < ORDER.indexOf(cur)) to = cur;
  if (cur === 'blocked' && to !== 'deployed') to = cur;
  return { to, facts };
}

