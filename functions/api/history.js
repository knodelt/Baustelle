import { authenticate, handleError, ok, requireDatabase } from './_utils.js';

export async function onRequestGet(context) {
  try {
    const database = requireDatabase(context.env);
    const player = await authenticate(context.request, context.env);
    const url = new URL(context.request.url);
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '30', 10) || 30));
    const result = await database.prepare(`
      SELECT event_id, type, payload_json, created_at
      FROM history
      WHERE player_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(player.id, limit).all();

    const events = (result.results || []).map((row) => {
      let payload = {};
      try { payload = JSON.parse(row.payload_json || '{}'); } catch { payload = {}; }
      return { id: row.event_id, type: row.type, createdAt: row.created_at, ...payload };
    });
    return ok({ events });
  } catch (error) {
    return handleError(error);
  }
}

export function onRequest(context) {
  return context.request.method === 'GET'
    ? onRequestGet(context)
    : new Response(JSON.stringify({ ok: false, error: 'Methode nicht erlaubt.' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', Allow: 'GET' }
    });
}

