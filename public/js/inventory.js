import { MACHINES, MATERIALS, VEHICLES, YARD_UPGRADES } from './config.js';
import { getMaterialPrice, maintenancePrice } from './economy.js';
import { addHistory, createAsset } from './state.js';

export function purchaseAsset(state, kind, typeId) {
  const catalog = kind === 'machine' ? MACHINES : VEHICLES;
  const item = catalog[typeId];
  if (!item) return { ok: false, error: 'Dieser Artikel existiert nicht.' };
  if (state.player.level < item.level) return { ok: false, error: `Ab Level ${item.level} verfügbar.` };
  if (state.player.balance < item.price) return { ok: false, error: 'Dein Kontostand reicht für diesen Kauf nicht.' };

  state.player.balance -= item.price;
  const asset = createAsset(typeId, kind);
  state.inventory[kind === 'machine' ? 'machines' : 'vehicles'].push(asset);
  state.stats.purchasedAssets += 1;
  addHistory(state, `${kind}_purchased`, `${item.name} gekauft`, { typeId, price: item.price });
  return { ok: true, item, asset };
}

export function purchaseMaterial(state, materialId, amount) {
  const item = MATERIALS[materialId];
  if (!item || amount <= 0) return { ok: false, error: 'Ungültige Baustoffmenge.' };
  if (state.player.level < (item.level || 1)) return { ok: false, error: `Ab Level ${item.level} verfügbar.` };
  const price = getMaterialPrice(state, materialId) * amount;
  if (state.player.balance < price) return { ok: false, error: 'Dein Kontostand reicht für diesen Einkauf nicht.' };

  state.player.balance -= price;
  state.inventory.materials[materialId] = (state.inventory.materials[materialId] || 0) + amount;
  addHistory(state, 'material_purchased', `${amount} ${item.unit} ${item.name} geliefert`, {
    materialId, amount, price
  });
  return { ok: true, item, amount, price };
}

export function maintainMachine(state, assetId) {
  const machine = state.inventory.machines.find((asset) => asset.id === assetId);
  if (!machine) return { ok: false, error: 'Maschine nicht gefunden.' };
  if (machine.busyBy) return { ok: false, error: 'Diese Maschine ist gerade im Einsatz.' };
  const item = MACHINES[machine.typeId];
  const price = maintenancePrice(machine, item);
  if (price === 0) return { ok: false, error: 'Die Maschine ist bereits in Bestzustand.' };
  if (state.player.balance < price) return { ok: false, error: 'Dein Kontostand reicht für die Wartung nicht.' };

  state.player.balance -= price;
  machine.condition = 100;
  state.stats.maintenanceCount += 1;
  addHistory(state, 'maintenance', `${item.name} gewartet`, { assetId, price });
  return { ok: true, item, price };
}

export function upgradeYard(state) {
  const next = YARD_UPGRADES.find((upgrade) => upgrade.level === state.company.yardLevel + 1);
  if (!next) return { ok: false, error: 'Dein Firmengelände ist vollständig ausgebaut.' };
  if (state.player.level < next.level * 2) return { ok: false, error: `Ab Unternehmer-Level ${next.level * 2} verfügbar.` };
  if (state.player.balance < next.price) return { ok: false, error: 'Dein Kontostand reicht für diesen Ausbau nicht.' };

  state.player.balance -= next.price;
  state.company.yardLevel = next.level;
  state.company.maxConcurrentJobs = next.maxConcurrentJobs;
  addHistory(state, 'yard_upgrade', `${next.name} eröffnet`, { level: next.level, price: next.price });
  return { ok: true, upgrade: next };
}

