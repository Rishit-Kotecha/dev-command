import { json, env, dataRepo } from '../lib/http.js';
export default async function handler(req, res) {
  json(res, 200, {
    github: !!env('GITHUB_TOKEN'),
    dataRepo: dataRepo() || null,
    vercel: !!env('VERCEL_TOKEN'),
    vercelTeam: env('VERCEL_TEAM_ID') || null,
    claude: !!env('ANTHROPIC_API_KEY'),
    supabase: !!env('SUPABASE_ACCESS_TOKEN'),
  });
}
