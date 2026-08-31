import { getCloudSession, setCloudSession } from './storage.js';

const REQUEST_TIMEOUT = 8_000;

async function apiFetch(path, options = {}, auth = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const session = getCloudSession();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (auth && session?.token) headers.Authorization = `Bearer ${session.token}`;

  try {
    const response = await fetch(path, { ...options, headers, signal: controller.signal });
    const payload = await response.json().catch(() => ({ ok: false, error: 'Ungültige Serverantwort.' }));
    if (!response.ok || !payload.ok) throw new Error(payload.error || `Serverfehler ${response.status}`);
    return payload.data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function ensureCloudSession() {
  const existing = getCloudSession();
  if (existing?.playerId && existing?.token) return existing;
  const session = await apiFetch('/api/session', { method: 'POST' }, false);
  setCloudSession(session);
  return session;
}

export async function loadCloudState() {
  await ensureCloudSession();
  return apiFetch('/api/load');
}

export async function saveCloudState(state) {
  const session = await ensureCloudSession();
  const pending = new Set(state.sync?.pendingEventIds || []);
  const events = (state.history || [])
    .filter((event) => pending.has(event.id))
    .map(({ id, type, message, payload, createdAt }) => ({ id, type, message, payload, createdAt }));
  const data = await apiFetch('/api/save', {
    method: 'POST',
    body: JSON.stringify({ state, events })
  });
  return { ...data, session };
}

export async function loadCloudHistory(limit = 30) {
  await ensureCloudSession();
  return apiFetch(`/api/history?limit=${Math.min(100, Math.max(1, limit))}`);
}

