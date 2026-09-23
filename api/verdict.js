// Builds a merge verdict for one task: PR diff + reviews + checks + preview, judged against what done looks like and the project rules.
import { json, readBody, fail, env } from '../lib/http.js';
import { readState, writeState } from '../lib/state.js';
import { thread, listPRFiles } from '../lib/gh.js';
import { askJson } from '../lib/claude.js';
import { summarizeChecks } from '../lib/derive.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return json(res, 405, { error: 'Use POST' });
    if (!env('GITHUB_TOKEN')) return json(res, 503, { error: 'GITHUB_TOKEN is not set' });
    const b = await readBody(req);
    const { state } = await readState();
    const t = state.tasks.find((x) => x.id === b.taskId);
    const p = t && state.projects.find((x) => x.id === t.projectId);
    if (!t || !p) return json(res, 404, { error: 'Task not found' });
    if (!t.issueNumber || !p.repo) return json(res, 400, { error: 'This task has no GitHub issue yet' });
    const code = p.code + '-' + t.num;
    const th = await thread(p.repo, t.issueNumber, code);
    if (!th.pr) return json(res, 400, { error: 'No pull request found for ' + code + ' yet' });
    const files = await listPRFiles(p.repo, th.pr.number).catch(() => []);
    let budget = 70000;
    const diff = files.map((f) => {
      const head = `--- ${f.filename} (${f.status}, +${f.additions} -${f.deletions})`;
      let patch = f.patch || '(binary or too large to show)';
      if (patch.length > budget) patch = patch.slice(0, Math.max(0, budget)) + '\n… (truncated)';
      budget -= patch.length;
      return head + '\n' + patch;
    }).join('\n\n');
    const agents = Object.fromEntries(state.agents.map((a) => [a.id, a.name]));
    const prompt = `You are the manager's second pair of eyes on a small AI software team. Decide whether this pull request is ready for the manager to merge to production.

Project: ${p.name} (${p.code}). ${p.description || ''}
Project rules (every one must hold):
${p.rules || '(none written)'}

Task ${code}: ${t.title}
What done looks like:
${t.detail || '(not written)'}
Author: ${agents[t.agentId] || 'unknown'}. Reviewer: ${agents[t.reviewerId] || 'none'}.

Pull request #${th.pr.number}: ${th.pr.title}
Changed files: ${th.pr.changedFiles}, +${th.pr.additions} -${th.pr.deletions}. Mergeable: ${th.pr.mergeable} (${th.pr.mergeableState}).
Automated checks: ${summarizeChecks(th.pr.checks)} ${JSON.stringify(th.pr.checks.map((c) => ({ name: c.name, result: c.conclusion || c.status })))}
Preview build: ${t.previewUrl || (t.gh && t.gh.preview && t.gh.preview.state) || 'not seen'}

Reviews posted on the PR:
${th.pr.reviews.map((r) => `- ${r.user} [${r.state}]: ${r.body || '(no text)'}`).join('\n') || '(none yet)'}
Review comments:
${th.pr.reviewComments.map((c) => `- ${c.user} on ${c.path}: ${c.body}`).join('\n') || '(none)'}
Latest issue comments:
${th.comments.slice(-4).map((c) => `- ${c.user}: ${c.body.slice(0, 600)}`).join('\n') || '(none)'}

Diff:
${diff || '(empty)'}

Reply with only this JSON object:
{"ready": true or false, "summary": "two sentences the manager can read on a phone", "checks": [{"label": "short name", "ok": true or false, "note": "one line"}], "risks": ["specific things to test on the preview or watch after deploy"], "askAgent": "if not ready, the exact comment to post for the author, starting with the author's GitHub mention if known, otherwise empty string"}
Cover at least: each point of what done looks like, each project rule that the diff touches, migrations (append-only, safe), secrets in client code, and whether reviews raised anything unresolved. Be strict: unresolved reviewer objections or failing checks mean not ready.`;
    const v = await askJson(prompt, { maxTokens: 2500 });
    const verdict = {
      at: Date.now(), ready: !!v.ready, summary: String(v.summary || ''),
      checks: Array.isArray(v.checks) ? v.checks.slice(0, 20).map((c) => ({ label: String(c.label || ''), ok: !!c.ok, note: String(c.note || '') })) : [],
      risks: Array.isArray(v.risks) ? v.risks.slice(0, 10).map(String) : [],
      askAgent: String(v.askAgent || ''), pr: th.pr.number, sha: th.pr.sha,
    };
    t.verdict = verdict;
    t.updatedAt = Date.now();
    await writeState(state, 'Dev Command: verdict for ' + code);
    json(res, 200, { verdict, task: t });
  } catch (e) { fail(res, e); }
}
