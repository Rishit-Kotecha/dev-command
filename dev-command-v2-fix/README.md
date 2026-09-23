# Dev Command

The control room for an AI development team. You assign roles and tasks, the agents work
inside GitHub (Claude Code through the Claude GitHub App, Codex through Codex code review),
Vercel builds previews, and this app reads everything back and gives you a merge verdict.

Runs on Vercel as static `public/` + Node functions in `api/`. No database: the app's data
lives in `data/state.json` on the `data` branch of this repo, written through the GitHub API.

## One-time setup

1. Create a **private** GitHub repo called `dev-command`, put these files in it, and push to `main`.
2. Create a GitHub fine-grained personal access token (Settings → Developer settings → Fine-grained tokens):
   - Repository access: `dev-command` plus every project repo (DSR-cum-CRM-VPPL, mml-web, …).
   - Permissions: Contents **read and write**, Issues **read and write**, Pull requests **read and write**, Metadata read.
3. Create a Vercel account token (vercel.com → Account settings → Tokens).
4. Copy an Anthropic API key from the Claude Console (used only for verdicts and planning).
5. In the Vercel project for this repo, add environment variables:

   | Name | Value |
   | --- | --- |
   | `GITHUB_TOKEN` | the token from step 2 |
   | `DATA_REPO` | `Rishit-Kotecha/dev-command` (owner/name of this repo) |
   | `VERCEL_TOKEN` | the token from step 3 |
   | `VERCEL_TEAM_ID` | your Vercel team id (`team_…`) |
   | `ANTHROPIC_API_KEY` | the key from step 4 |
   | `SUPABASE_ACCESS_TOKEN` | optional, from supabase.com/dashboard/account/tokens, for database status |
   | `CLAUDE_MODEL` | optional, defaults to `claude-sonnet-5` |

6. Protect the app: Vercel project → Settings → Deployment Protection → Vercel Authentication for **all** deployments.
7. Turn off preview deployments for this project (writes to the `data` branch must not trigger builds).

In each project repo, `@claude` must already work (Claude Code: `/install-github-app`) and Codex code review
must be switched on. Then a task goes: **Send to Claude Code on GitHub → PR → Codex review → preview → verdict → Merge and deploy.**

## Files

- `public/` — the app (single page, no build step)
- `api/state.js` — read/write the saved state
- `api/github.js` — create issues, post comments, read the thread and PR, merge
- `api/sync.js` — check every task on GitHub and Vercel and move statuses forward
- `api/verdict.js` — Claude reads the PR diff, reviews and checks and decides if it is ready
- `api/plan.js` — Claude splits a feature into tasks
- `api/vercel.js`, `api/supabase.js`, `api/health.js`
- `data/state.json` — seed data for a fresh install (live data is on the `data` branch)
