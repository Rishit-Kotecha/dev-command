// Small helpers shared by every API route.
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
export function env(name) { return (process.env[name] || '').trim(); }
export function missingEnv(names) { return names.filter((n) => !env(n)); }
export function dataRepo() {
  const explicit = env('DATA_REPO');
  if (explicit) return explicit;
  const owner = env('VERCEL_GIT_REPO_OWNER'), slug = env('VERCEL_GIT_REPO_SLUG');
  return owner && slug ? owner + '/' + slug : '';
}
export function query(req) {
  const u = new URL(req.url, 'http://x');
  return Object.fromEntries(u.searchParams.entries());
}
export function fail(res, e) {
  const status = e && e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  json(res, status, { error: (e && e.message) || 'Unexpected error', detail: e && e.detail });
}
