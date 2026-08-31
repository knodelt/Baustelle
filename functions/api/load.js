import { authenticate, handleError, ok, requireDatabase } from './_utils.js';

export async function onRequestGet(context) {
  try {
    const database = requireDatabase(context.env);
    const player = await authenticate(context.request, context.env);
    const save = await database.prepare(
      'SELECT version, state_json, updated_at FROM saves WHERE player_id = ?'
    ).bind(player.id).first();

    if (!save) return ok({ state: null, version: null, updatedAt: null });

    let state;
    try {
      state = JSON.parse(save.state_json);
    } catch {
      return ok({ state: null, version: save.version, updatedAt: save.updated_at, corrupted: true });
    }
    return ok({ state, version: save.version, updatedAt: save.updated_at });
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

