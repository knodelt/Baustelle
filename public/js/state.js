import { ECONOMY, GAME_VERSION } from './config.js';

function uid(prefix = 'id') {
  const value = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

export function createAsset(typeId, kind, options = {}) {
  return {
    id: uid(kind),
    typeId,
    condition: options.condition ?? 100,
    uses: options.uses ?? 0,
    busyBy: null,
    purchasedAt: options.purchasedAt ?? Date.now()
  };
}

export function createInitialState() {
  const now = Date.now();

  return {
    version: GAME_VERSION,
    meta: {
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      lastMarketUpdate: now,
      installHintDismissed: false
    },
    player: {
      id: null,
      companyName: 'Knodel Bauunternehmung',
      level: 1,
      xp: 0,
      balance: ECONOMY.START_BALANCE,
      reputation: ECONOMY.START_REPUTATION
    },
    company: {
      yardLevel: 1,
      maxConcurrentJobs: ECONOMY.START_CONCURRENT_JOBS
    },
    inventory: {
      vehicles: [createAsset('van', 'vehicle', { purchasedAt: now })],
      machines: [createAsset('miniExcavator', 'machine', { purchasedAt: now })],
      materials: {
        gravel: 20,
        concrete: 10,
        soil: 0,
        asphalt: 0,
        steel: 0,
        timber: 0
      },
      tools: 1
    },
    jobs: {
      available: [],
      active: [],
      completed: []
    },
    unlocks: [],
    settings: {
      sound: true,
      vibration: true,
      events: true,
      theme: 'dark',
      locale: 'de-DE'
    },
    market: {
      modifiers: {}
    },
    stats: {
      revenue: 0,
      profit: 0,
      completedJobs: 0,
      purchasedAssets: 0,
      maintenanceCount: 0
    },
    history: [createHistoryEvent('company_started', 'Bauunternehmen gegründet', {
      balance: ECONOMY.START_BALANCE
    }, now)],
    sync: {
      pendingEventIds: [],
      lastCloudSaveAt: null,
      lastCloudError: null
    }
  };
}

export function createHistoryEvent(type, message, payload = {}, createdAt = Date.now()) {
  return {
    id: uid('event'),
    type,
    message,
    payload,
    createdAt
  };
}

export function addHistory(state, type, message, payload = {}) {
  const event = createHistoryEvent(type, message, payload);
  state.history.unshift(event);
  state.history = state.history.slice(0, 80);
  state.sync.pendingEventIds.push(event.id);
  return event;
}

export function touchState(state) {
  state.meta.updatedAt = Date.now();
  state.meta.lastSeenAt = Date.now();
  return state;
}

export function migrateSave(input) {
  if (!input || typeof input !== 'object') return createInitialState();

  const fresh = createInitialState();
  const state = {
    ...fresh,
    ...input,
    meta: { ...fresh.meta, ...(input.meta || {}) },
    player: { ...fresh.player, ...(input.player || {}) },
    company: { ...fresh.company, ...(input.company || {}) },
    inventory: {
      ...fresh.inventory,
      ...(input.inventory || {}),
      materials: { ...fresh.inventory.materials, ...(input.inventory?.materials || {}) }
    },
    jobs: { ...fresh.jobs, ...(input.jobs || {}) },
    settings: { ...fresh.settings, ...(input.settings || {}) },
    market: { ...fresh.market, ...(input.market || {}) },
    stats: { ...fresh.stats, ...(input.stats || {}) },
    sync: { ...fresh.sync, ...(input.sync || {}) }
  };

  state.version = GAME_VERSION;
  state.player.balance = Math.max(0, Number(state.player.balance) || 0);
  state.player.level = Math.max(1, Math.floor(Number(state.player.level) || 1));
  state.player.xp = Math.max(0, Number(state.player.xp) || 0);
  state.company.maxConcurrentJobs = Math.max(1, Number(state.company.maxConcurrentJobs) || 1);
  state.jobs.available = Array.isArray(state.jobs.available) ? state.jobs.available : [];
  state.jobs.active = Array.isArray(state.jobs.active) ? state.jobs.active : [];
  state.jobs.completed = Array.isArray(state.jobs.completed) ? state.jobs.completed : [];
  state.inventory.vehicles = Array.isArray(state.inventory.vehicles) ? state.inventory.vehicles : [];
  state.inventory.machines = Array.isArray(state.inventory.machines) ? state.inventory.machines : [];
  state.unlocks = Array.isArray(state.unlocks) ? state.unlocks : [];
  state.history = Array.isArray(state.history) ? state.history : [];
  state.sync.pendingEventIds = Array.isArray(state.sync.pendingEventIds)
    ? state.sync.pendingEventIds
    : [];

  return state;
}

export function cloneState(state) {
  return structuredClone(state);
}

