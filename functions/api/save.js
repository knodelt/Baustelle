import { ApiError, authenticate, handleError, ok, requireDatabase } from './_utils.js';

const MAX_SAVE_BYTES = 950_000;
const MAX_EVENTS_PER_SAVE = 40;

function validateState(state) {
  if (!state || typeof state !== 'object') throw new ApiError('Spielstand fehlt.');
  if (!Number.isInteger(state.version) || state.version < 1) throw new ApiError('Spielstand-Version ist ungültig.');
  if (!state.player || typeof state.player !== 'object') throw new ApiError('Spielerdaten fehlen.');
  if (!Number.isFinite(state.player.balance) || state.player.balance < 0) throw new ApiError('Kontostand ist ungültig.');
  if (!state.jobs || !Array.isArray(state.jobs.active)) throw new ApiError('Auftragsdaten sind ungültig.');
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

export async function onRequestPost(context) {
  try {
    const database = requireDatabase(context.env);
    const player = await authenticate(context.request, context.env);
    const contentLength = Number(context.request.headers.get('content-length') || 0);
    if (contentLength > MAX_SAVE_BYTES) throw new ApiError('Spielstand ist zu groß.', 413);

    const raw = await context.request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_SAVE_BYTES) throw new ApiError('Spielstand ist zu groß.', 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError('JSON ist ungültig.');
    }

    validateState(body.state);
    const now = Date.now();
    const stateJson = JSON.stringify(body.state);
    const statements = [
      database.prepare(`
        INSERT INTO saves (player_id, version, state_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(player_id) DO UPDATE SET
          version = excluded.version,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at
      `).bind(player.id, body.state.version, stateJson, now),
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
      `).bind(event.id, player.id, event.type, JSON.stringify({ message: event.message, ...event.payload }), event.createdAt));
    }

    await database.batch(statements);
    return ok({ saved: true, updatedAt: now, eventCount: events.length });
  } catch (error) {
    return handleError(error);
  }
}

export function onRequest(context) {
  return context.request.method === 'POST'
    ? onRequestPost(context)
    : new Response(JSON.stringify({ ok: false, error: 'Methode nicht erlaubt.' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', Allow: 'POST' }
    });
}

