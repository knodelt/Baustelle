const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

const MAX_SAVE_BYTES = 950_000;
const MAX_EVENTS_PER_SAVE = 40;

class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}

function ok(data = {}) {
  return json({ ok: true, data });
}

function fail(error, status = 400, extraHeaders = {}) {
  return json({ ok: false, error }, status, extraHeaders);
}

function requireDatabase(env) {
  if (!env?.DB) {
    throw new ApiError(
      'Cloud-Speicherung ist noch nicht eingerichtet. Der lokale Spielstand bleibt verfügbar.',
      503
    );
  }
  return env.DB;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function authenticate(request, env) {
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

function validateState(state) {
  if (!state || typeof state !== 'object') throw new ApiError('Spielstand fehlt.');
  if (!Number.isInteger(state.version) || state.version < 1) {
    throw new ApiError('Spielstand-Version ist ungültig.');
  }
  if (!state.player || typeof state.player !== 'object') throw new ApiError('Spielerdaten fehlen.');
  if (!Number.isFinite(state.player.balance) || state.player.balance < 0) {
    throw new ApiError('Kontostand ist ungültig.');
  }
  if (!state.jobs || !Array.isArray(state.jobs.active)) {
    throw new ApiError('Auftragsdaten sind ungültig.');
  }
}

function safeEvent(event) {
  if (!event || typeof event !== 'object') return null;
  if (typeof event.id !== 'string' || event.id.length < 8 || event.id.length > 100) return null;
  if (typeof event.type !== 'string' || event.type.length > 64) return null;
  return {
    id: event.id,
    type: event.type,
    message: String(event.message || '').slice(0, 180),
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
    createdAt: Number.isFinite(event.createdAt) ? Math.floor(event.createdAt) : Date.now()
  };
}

function methodNotAllowed(allowed) {
  return fail('Methode nicht erlaubt.', 405, { allow: allowed });
}

async function createSession(request, env) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const database = requireDatabase(env);
  const playerId = crypto.randomUUID();
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = Date.now();
  await database.prepare(
    'INSERT INTO players (id, token_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).bind(playerId, tokenHash, now, now).run();
  return ok({ playerId, token });
}

async function loadSave(request, env) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const database = requireDatabase(env);
  const player = await authenticate(request, env);
  const save = await database.prepare(
    'SELECT version, state_json, updated_at FROM saves WHERE player_id = ?'
  ).bind(player.id).first();

  if (!save) return ok({ state: null, version: null, updatedAt: null });
  try {
    return ok({
      state: JSON.parse(save.state_json),
      version: save.version,
      updatedAt: save.updated_at
    });
  } catch {
    return ok({ state: null, version: save.version, updatedAt: save.updated_at, corrupted: true });
  }
}

async function saveGame(request, env) {
  if (request.method !== 'POST') return methodNotAllowed('POST');
  const database = requireDatabase(env);
  const player = await authenticate(request, env);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_SAVE_BYTES) throw new ApiError('Spielstand ist zu groß.', 413);

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_SAVE_BYTES) {
    throw new ApiError('Spielstand ist zu groß.', 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new ApiError('JSON ist ungültig.');
  }
  validateState(body.state);

  const now = Date.now();
  const statements = [
    database.prepare(`
      INSERT INTO saves (player_id, version, state_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(player_id) DO UPDATE SET
        version = excluded.version,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).bind(player.id, body.state.version, JSON.stringify(body.state), now),
    database.prepare('UPDATE players SET updated_at = ? WHERE id = ?').bind(now, player.id)
  ];

  const events = (Array.isArray(body.events) ? body.events : [])
    .slice(0, MAX_EVENTS_PER_SAVE)
    .map(safeEvent)
    .filter(Boolean);
  for (const event of events) {
    statements.push(database.prepare(`
      INSERT OR IGNORE INTO history (event_id, player_id, type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      event.id,
      player.id,
      event.type,
      JSON.stringify({ ...event.payload, message: event.message }),
      event.createdAt
    ));
  }

  await database.batch(statements);
  return ok({ saved: true, updatedAt: now, eventCount: events.length });
}

async function loadHistory(request, env) {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const database = requireDatabase(env);
  const player = await authenticate(request, env);
  const url = new URL(request.url);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') || '30', 10) || 30)
  );
  const result = await database.prepare(`
    SELECT event_id, type, payload_json, created_at
    FROM history
    WHERE player_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(player.id, limit).all();

  const events = (result.results || []).map((row) => {
    let payload = {};
    try {
      payload = JSON.parse(row.payload_json || '{}');
    } catch {
      payload = {};
    }
    return { id: row.event_id, type: row.type, createdAt: row.created_at, ...payload };
  });
  return ok({ events });
}

async function handleApi(request, env) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'GET, POST, OPTIONS' } });
  }

  switch (pathname) {
    case '/api/session':
      return createSession(request, env);
    case '/api/load':
      return loadSave(request, env);
    case '/api/save':
      return saveGame(request, env);
    case '/api/history':
      return loadHistory(request, env);
    default:
      return fail('API-Endpunkt nicht gefunden.', 404);
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof ApiError) return fail(error.message, error.status);
      console.error('Baustellen Tycoon Worker:', error);
      return fail('Der Cloud-Spielstand ist gerade nicht erreichbar.', 500);
    }
  }
};

