import { handleError, ok, randomToken, requireDatabase, sha256 } from './_utils.js';

export async function onRequestPost(context) {
  try {
    const database = requireDatabase(context.env);
    const playerId = crypto.randomUUID();
    const token = randomToken();
    const tokenHash = await sha256(token);
    const now = Date.now();
    await database.prepare(
      'INSERT INTO players (id, token_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(playerId, tokenHash, now, now).run();
    return ok({ playerId, token });
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

