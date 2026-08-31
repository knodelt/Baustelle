import { ECONOMY, MACHINES, MATERIALS, VEHICLES } from './config.js';
import { addHistory } from './state.js';
import { applyXp, calculateJobCosts } from './economy.js';

const JOB_TEMPLATES = [
  {
    id: 'garden-dig', name: 'Garten ausheben', type: 'Erdarbeiten', minLevel: 1,
    clients: ['Familie Schneider', 'Gartenbau Krämer', 'Privatkunde Meinerzhagen'],
    difficulty: 1, duration: [35, 58], payout: [5_400, 7_800], xp: [55, 85],
    machine: 'miniExcavator', vehicle: 'van', materials: { gravel: [2, 4] }, scene: 'earth'
  },
  {
    id: 'driveway', name: 'Hofeinfahrt vorbereiten', type: 'Tiefbau', minLevel: 1,
    clients: ['Bauherr Weber', 'Hausverwaltung Dorn', 'Familie Hartmann'],
    difficulty: 1, duration: [48, 78], payout: [7_900, 10_800], xp: [65, 95],
    machine: 'miniExcavator', vehicle: 'van', materials: { gravel: [5, 8] }, scene: 'groundwork'
  },
  {
    id: 'container-base', name: 'Containerfundament', type: 'Fundament', minLevel: 1,
    clients: ['Logistik Mertens', 'Bergland Service', 'Hoffmann Gewerbebau'],
    difficulty: 2, duration: [62, 90], payout: [10_800, 14_500], xp: [80, 110],
    machine: 'miniExcavator', vehicle: 'van', materials: { gravel: [4, 7], concrete: [4, 6] }, scene: 'concrete'
  },
  {
    id: 'clear-lot', name: 'Grundstück räumen', type: 'Räumung', minLevel: 2,
    clients: ['Baugrund NRW', 'Projektbau Lenne', 'Gemeinde Südhang'],
    difficulty: 2, duration: [65, 95], payout: [11_500, 15_800], xp: [85, 120],
    machine: 'miniExcavator', vehicle: 'van', materials: {}, scene: 'earth'
  },
  {
    id: 'garage-pit', name: 'Garagen-Baugrube', type: 'Erdarbeiten', minLevel: 3,
    clients: ['Architekturbüro Klee', 'Bauherr Petersen', 'Wohnbau Volmetal'],
    difficulty: 2, duration: [75, 110], payout: [14_000, 18_500], xp: [95, 135],
    machine: 'miniExcavator', vehicle: 'serviceVan', materials: { gravel: [7, 11] }, scene: 'earth'
  },
  {
    id: 'parking-lot', name: 'Parkplatz bauen', type: 'Flächenbau', minLevel: 5,
    clients: ['Schulzentrum Nord', 'Märkische Gewerbeparks', 'Supermarkt Lenne'],
    difficulty: 3, duration: [130, 210], payout: [29_000, 39_000], xp: [180, 280],
    machine: 'roller', vehicle: 'truck', materials: { gravel: [18, 28], asphalt: [12, 20] }, scene: 'asphalt'
  },
  {
    id: 'hall-base', name: 'Hallenfundament', type: 'Fundament', minLevel: 6,
    clients: ['Westfalen Hallenbau', 'Metalltechnik Otto', 'Industriebau Sauerland'],
    difficulty: 3, duration: [160, 260], payout: [42_000, 57_000], xp: [240, 340],
    machine: 'excavator', vehicle: 'truck', materials: { gravel: [20, 32], concrete: [24, 38], steel: [2, 4] }, scene: 'concrete'
  },
  {
    id: 'road-repair', name: 'Straßenabschnitt sanieren', type: 'Straßenbau', minLevel: 7,
    clients: ['Straßen.NRW', 'Stadtwerke Volme', 'Gemeinde Kierspe'],
    difficulty: 4, duration: [210, 300], payout: [52_000, 69_000], xp: [290, 390],
    machine: 'roller', vehicle: 'tipper', materials: { gravel: [18, 26], asphalt: [24, 36] }, scene: 'asphalt'
  },
  {
    id: 'industrial-pit', name: 'Große Industriebaugrube', type: 'Großprojekt', minLevel: 10,
    clients: ['Industriepark Süd', 'Märkische Komponenten AG', 'Baugruppe West'],
    difficulty: 5, duration: [340, 520], payout: [118_000, 165_000], xp: [650, 900],
    machine: 'largeExcavator', vehicle: 'lowLoader', materials: { gravel: [35, 55], concrete: [30, 46] }, scene: 'earth'
  },
  {
    id: 'logistics-center', name: 'Logistikzentrum erschließen', type: 'Infrastruktur', minLevel: 12,
    clients: ['TransWest Logistik', 'CargoHub NRW', 'Gewerbepark A45'],
    difficulty: 5, duration: [480, 700], payout: [185_000, 248_000], xp: [850, 1200],
    machine: 'crane', vehicle: 'lowLoader', materials: { gravel: [60, 85], concrete: [55, 80], steel: [8, 14] }, scene: 'crane'
  }
];

const randomInt = (min, max) => Math.round(min + Math.random() * (max - min));
const pick = (values) => values[Math.floor(Math.random() * values.length)];
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

function materialAmounts(materialRanges) {
  return Object.fromEntries(Object.entries(materialRanges).map(([id, range]) => [id, randomInt(...range)]));
}

function createJob(state, template, index = 0) {
  const levelFactor = 1 + Math.max(0, state.player.level - template.minLevel) * 0.025;
  const payout = Math.round(randomInt(...template.payout) * levelFactor / 100) * 100;
  const materials = materialAmounts(template.materials);
  const duration = Math.round(randomInt(...template.duration) * ECONOMY.JOB_DURATION_MULTIPLIER);
  const costs = calculateJobCosts(state, payout, materials, template.difficulty);

  return {
    id: `job-${uid()}-${index}`,
    templateId: template.id,
    name: template.name,
    client: pick(template.clients),
    type: template.type,
    difficulty: template.difficulty,
    duration,
    payout,
    profit: payout - costs.total,
    xp: randomInt(...template.xp),
    requirements: { machine: template.machine, vehicle: template.vehicle, materials },
    costs,
    scene: template.scene,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000
  };
}

export function refreshAvailableJobs(state, force = false) {
  const now = Date.now();
  const valid = state.jobs.available.filter((job) => job.expiresAt > now);
  if (!force && valid.length >= 4) {
    state.jobs.available = valid;
    return false;
  }

  const eligible = JOB_TEMPLATES.filter((job) => job.minLevel <= state.player.level);
  const selected = [];
  if (state.stats.completedJobs === 0) selected.push(JOB_TEMPLATES[0]);

  while (selected.length < Math.min(4, eligible.length)) {
    const template = pick(eligible);
    if (!selected.includes(template)) selected.push(template);
  }

  while (selected.length < 4) selected.push(pick(eligible));
  state.jobs.available = selected.map((template, index) => createJob(state, template, index));
  return true;
}

export function getJobReadiness(state, job) {
  const machine = state.inventory.machines.find((asset) => asset.typeId === job.requirements.machine && !asset.busyBy);
  const vehicle = state.inventory.vehicles.find((asset) => asset.typeId === job.requirements.vehicle && !asset.busyBy);
  const missingMaterials = Object.entries(job.requirements.materials)
    .filter(([id, amount]) => (state.inventory.materials[id] || 0) < amount)
    .map(([id, amount]) => ({
      id,
      missing: amount - (state.inventory.materials[id] || 0),
      required: amount,
      name: MATERIALS[id].name,
      unit: MATERIALS[id].unit
    }));

  const reasons = [];
  if (!machine) reasons.push(`${MACHINES[job.requirements.machine]?.name || 'Maschine'} fehlt oder ist im Einsatz`);
  if (!vehicle) reasons.push(`${VEHICLES[job.requirements.vehicle]?.name || 'Fahrzeug'} fehlt oder ist im Einsatz`);
  for (const item of missingMaterials) reasons.push(`${item.missing} ${item.unit} ${item.name} fehlen`);
  if (state.jobs.active.length >= state.company.maxConcurrentJobs) reasons.push('Alle Baustellenplätze sind belegt');
  if (state.player.balance < job.costs.direct) reasons.push('Kontostand reicht nicht für die Startkosten');

  return { ready: reasons.length === 0, machine, vehicle, missingMaterials, reasons };
}

export function startJob(state, jobId) {
  const job = state.jobs.available.find((item) => item.id === jobId);
  if (!job) return { ok: false, error: 'Dieser Auftrag ist nicht mehr verfügbar.' };

  const readiness = getJobReadiness(state, job);
  if (!readiness.ready) return { ok: false, error: readiness.reasons[0], readiness };

  const startedAt = Date.now();
  const activeJob = {
    ...job,
    status: 'active',
    startedAt,
    finishAt: startedAt + job.duration * 1000,
    assigned: { machineId: readiness.machine.id, vehicleId: readiness.vehicle.id },
    paidOut: false
  };

  state.player.balance -= job.costs.direct;
  for (const [id, amount] of Object.entries(job.requirements.materials)) {
    state.inventory.materials[id] = Math.max(0, (state.inventory.materials[id] || 0) - amount);
  }
  readiness.machine.busyBy = job.id;
  readiness.vehicle.busyBy = job.id;
  state.jobs.active.push(activeJob);
  state.jobs.available = state.jobs.available.filter((item) => item.id !== job.id);
  addHistory(state, 'job_started', `${job.name} gestartet`, { jobId: job.id, payout: job.payout });
  return { ok: true, job: activeJob };
}

function unlocksForLevel(state, oldLevel, newLevel) {
  const catalogs = [
    ['machine', MACHINES],
    ['vehicle', VEHICLES],
    ['material', MATERIALS]
  ];
  const added = [];

  for (const [type, catalog] of catalogs) {
    for (const item of Object.values(catalog)) {
      const level = item.level || 1;
      const unlockId = `${type}-${item.id}`;
      if (level > oldLevel && level <= newLevel && !state.unlocks.some((entry) => entry.id === unlockId)) {
        const unlock = { id: unlockId, type, name: item.name, level, seen: false };
        state.unlocks.push(unlock);
        added.push(unlock);
      }
    }
  }
  return added;
}

export function completeDueJobs(state, now = Date.now()) {
  const completed = [];
  const remaining = [];

  for (const job of state.jobs.active) {
    if (job.finishAt > now || job.status === 'completed' || job.paidOut) {
      remaining.push(job);
      continue;
    }

    job.status = 'completed';
    job.paidOut = true;
    job.completedAt = now;
    state.player.balance += job.payout;
    state.stats.revenue += job.payout;
    state.stats.profit += job.profit;
    state.stats.completedJobs += 1;
    state.player.reputation = Math.min(100, state.player.reputation + Math.max(1, Math.round(job.difficulty * 0.7)));

    const machine = state.inventory.machines.find((asset) => asset.id === job.assigned.machineId);
    const vehicle = state.inventory.vehicles.find((asset) => asset.id === job.assigned.vehicleId);
    const wear = ECONOMY.MAINTENANCE_RATE + job.difficulty * 1.2;
    if (machine) {
      machine.busyBy = null;
      machine.uses += 1;
      machine.condition = Math.max(20, Math.round((machine.condition - wear) * 10) / 10);
    }
    if (vehicle) {
      vehicle.busyBy = null;
      vehicle.uses += 1;
      vehicle.condition = Math.max(25, Math.round((vehicle.condition - wear * 0.55) * 10) / 10);
    }

    const levelResult = applyXp(state, job.xp);
    const unlocks = levelResult.leveledUp
      ? unlocksForLevel(state, levelResult.oldLevel, levelResult.newLevel)
      : [];

    addHistory(state, 'job_completed', `${job.name} abgeschlossen`, {
      jobId: job.id,
      revenue: job.payout,
      profit: job.profit,
      xp: job.xp
    });
    if (levelResult.leveledUp) {
      addHistory(state, 'level_up', `Level ${levelResult.newLevel} erreicht`, { unlocks });
    }

    state.jobs.completed.unshift(job);
    state.jobs.completed = state.jobs.completed.slice(0, 40);
    completed.push({ job, levelResult, unlocks });
  }

  state.jobs.active = remaining;
  if (completed.length) refreshAvailableJobs(state, true);
  return completed;
}

export function jobProgress(job, now = Date.now()) {
  if (!job?.startedAt || !job?.finishAt) return 0;
  return Math.max(0, Math.min(1, (now - job.startedAt) / (job.finishAt - job.startedAt)));
}

export function jobRemaining(job, now = Date.now()) {
  return Math.max(0, Math.ceil((job.finishAt - now) / 1000));
}

export function getJobTemplateCatalog() {
  return JOB_TEMPLATES;
}

