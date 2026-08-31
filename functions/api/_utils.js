const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

export function ok(data = {}) {
  return json({ ok: true, data });
}

export function fail(error, status = 400) {
  return json({ ok: false, error }, status);
}

export function requireDatabase(env) {
  if (!env?.DB) throw new ApiError('D1-Binding DB ist nicht eingerichtet.', 503);
  return env.DB;
}

export class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function authenticate(request, env) {
  const database = requireDatabase(env);
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw new ApiError('Anmeldung fehlt.', 401);
  const token = authorization.slice(7).trim();
  if (token.length < 32 || token.length > 128) throw new ApiError('Anmeldung ist ungültig.', 401);
  const tokenHash = await sha256(token);
  const player = await database.prepare(
    'SELECT id, created_at, updated_at FROM players WHERE token_hash = ? LIMIT 1'
  ).bind(tokenHash).first();
  if (!player) throw new ApiError('Anmeldung ist ungültig.', 401);
  return player;
}

export function handleError(error) {
  if (error instanceof ApiError) return fail(error.message, error.status);
  console.error('Baustellen Tycoon API:', error);
  return fail('Der Cloud-Spielstand ist gerade nicht erreichbar.', 500);
}

