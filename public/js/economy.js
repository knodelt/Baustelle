import { ECONOMY, MATERIALS, xpNeeded } from './config.js';

export function getMaterialPrice(state, materialId) {
  const base = MATERIALS[materialId]?.price || 0;
  const modifier = state.market?.modifiers?.[materialId] ?? 1;
  return Math.max(1, Math.round(base * modifier));
}

export function calculateMaterialCosts(state, requirements = {}) {
  return Object.entries(requirements).reduce((sum, [materialId, amount]) => {
    return sum + getMaterialPrice(state, materialId) * amount;
  }, 0);
}

export function calculateJobCosts(state, payout, materialRequirements, difficulty = 1) {
  const material = calculateMaterialCosts(state, materialRequirements);
  const operating = Math.round(payout * ECONOMY.FUEL_RATE * (0.9 + difficulty * 0.08));
  const labor = Math.round(payout * ECONOMY.LABOR_RATE * (0.92 + difficulty * 0.06));
  const total = material + operating + labor;

  return { material, operating, labor, direct: operating + labor, total };
}

export function applyXp(state, amount) {
  const oldLevel = state.player.level;
  state.player.xp += amount;

  while (state.player.xp >= xpNeeded(state.player.level)) {
    state.player.xp -= xpNeeded(state.player.level);
    state.player.level += 1;
  }

  return {
    leveledUp: state.player.level > oldLevel,
    oldLevel,
    newLevel: state.player.level
  };
}

export function updateMarket(state, force = false) {
  const now = Date.now();
  const elapsed = now - (state.meta.lastMarketUpdate || 0);
  if (!force && elapsed < 30 * 60 * 1000) return false;

  for (const materialId of Object.keys(MATERIALS)) {
    const current = state.market.modifiers[materialId] ?? 1;
    const movement = (Math.random() * 2 - 1) * ECONOMY.MATERIAL_INFLATION;
    state.market.modifiers[materialId] = Math.min(1.16, Math.max(0.88, current + movement));
  }
  state.meta.lastMarketUpdate = now;
  return true;
}

export function maintenancePrice(machine, catalogItem) {
  const missingCondition = Math.max(0, 100 - machine.condition);
  if (missingCondition <= 0) return 0;
  return Math.max(250, Math.round(catalogItem.maintenanceCost * (missingCondition / 100)));
}

