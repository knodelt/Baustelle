export const GAME_VERSION = 1;
export const APP_VERSION = '1.1.0';

export const ECONOMY = Object.freeze({
  // Flüssiges Startkapital; die Startfahrzeuge sind bereits bezahlt.
  START_BALANCE: 100_000,
  // Globale Laufzeit-Skalierung für spätere Balancing-Runden.
  JOB_DURATION_MULTIPLIER: 1,
  // Grundwert und Wachstum der benötigten XP bis zum nächsten Level.
  XP_BASE: 250,
  XP_GROWTH: 1.19,
  // Zustandsverlust pro normalem Auftrag, durch Schwierigkeit ergänzt.
  MAINTENANCE_RATE: 4,
  // Anteil der Auszahlung für Betrieb/Treibstoff.
  FUEL_RATE: 0.055,
  // Anteil der Auszahlung für Personalaufwand.
  LABOR_RATE: 0.085,
  // Maximale Materialpreisbewegung pro Marktaktualisierung.
  MATERIAL_INFLATION: 0.035,
  // Anteil direkter Kosten, der bei Auftragsabbruch verloren bleibt.
  JOB_CANCEL_PENALTY: 0.5,
  // Offline-Fortschritt ist für maximal 24 Stunden begrenzt.
  OFFLINE_MAX_HOURS: 24,
  // Anzahl gleichzeitig laufender Baustellen in Ausbaustufe 1.
  START_CONCURRENT_JOBS: 1,
  // Mindestreputation für den Start; 100 entspricht Branchen-Spitze.
  START_REPUTATION: 8
});

export const MATERIALS = Object.freeze({
  gravel: { id: 'gravel', name: 'Kies', unit: 't', price: 35, color: '#9ea3a8' },
  concrete: { id: 'concrete', name: 'Beton', unit: 'm³', price: 120, color: '#c6c8ca' },
  soil: { id: 'soil', name: 'Erde', unit: 'm³', price: 10, color: '#72523a' },
  asphalt: { id: 'asphalt', name: 'Asphalt', unit: 't', price: 90, color: '#3c4146', level: 5 },
  steel: { id: 'steel', name: 'Stahl', unit: 't', price: 820, color: '#7a858e', level: 7 },
  timber: { id: 'timber', name: 'Holz', unit: 'm³', price: 310, color: '#ad7d49', level: 3 }
});

export const VEHICLES = Object.freeze({
  van: {
    id: 'van', name: 'Transporter', price: 35_000, operatingCost: 110,
    level: 1, description: 'Bringt Werkzeug und Mannschaft zuverlässig zur Baustelle.'
  },
  serviceVan: {
    id: 'serviceVan', name: 'Montagewagen', price: 50_000, operatingCost: 150,
    level: 3, description: 'Mobile Werkstatt für anspruchsvollere Einsätze.'
  },
  truck: {
    id: 'truck', name: 'LKW', price: 120_000, operatingCost: 390,
    level: 5, description: 'Bewegt größere Materialmengen zwischen Hof und Baustelle.'
  },
  tipper: {
    id: 'tipper', name: 'Kipper', price: 150_000, operatingCost: 470,
    level: 7, description: 'Schneller Abtransport von Erde, Kies und Bauschutt.'
  },
  lowLoader: {
    id: 'lowLoader', name: 'Tieflader', price: 250_000, operatingCost: 690,
    level: 10, description: 'Transportiert schwere Großmaschinen sicher zum Einsatzort.'
  }
});

export const MACHINES = Object.freeze({
  miniExcavator: {
    id: 'miniExcavator', name: 'Minibagger', price: 45_000, maintenanceCost: 1_800,
    level: 1, description: 'Wendig, günstig und ideal für kleine Erdarbeiten.'
  },
  excavator: {
    id: 'excavator', name: 'Kettenbagger', price: 150_000, maintenanceCost: 5_800,
    level: 5, description: 'Kraftpaket für Baugruben und größere Erdbewegungen.'
  },
  roller: {
    id: 'roller', name: 'Walze', price: 95_000, maintenanceCost: 3_600,
    level: 5, description: 'Verdichtet Untergrund und Asphalt in gleichmäßigen Bahnen.'
  },
  wheelLoader: {
    id: 'wheelLoader', name: 'Radlader', price: 110_000, maintenanceCost: 4_100,
    level: 5, description: 'Verlädt Schüttgut schnell und hält die Baustelle in Bewegung.'
  },
  largeExcavator: {
    id: 'largeExcavator', name: 'Großbagger', price: 280_000, maintenanceCost: 9_600,
    level: 10, description: 'Für tiefe Baugruben und schwere Infrastrukturprojekte.'
  },
  crane: {
    id: 'crane', name: 'Mobilkran', price: 450_000, maintenanceCost: 14_500,
    level: 12, description: 'Hebt Bauteile, Stahl und Fertigelemente präzise ein.'
  }
});

export const YARD_UPGRADES = Object.freeze([
  { level: 1, name: 'Kleiner Bauhof', price: 0, maxConcurrentJobs: 1, storageMultiplier: 1 },
  { level: 2, name: 'Eigene Werkstatt', price: 95_000, maxConcurrentJobs: 2, storageMultiplier: 1.5 },
  { level: 3, name: 'Maschinenhalle', price: 260_000, maxConcurrentJobs: 2, storageMultiplier: 2 },
  { level: 4, name: 'Großes Betriebsgelände', price: 620_000, maxConcurrentJobs: 3, storageMultiplier: 3 },
  { level: 5, name: 'Baukonzern-Zentrale', price: 1_500_000, maxConcurrentJobs: 4, storageMultiplier: 5 }
]);

export const NAV_ITEMS = Object.freeze([
  { id: 'site', label: 'Baustelle', icon: 'site' },
  { id: 'jobs', label: 'Aufträge', icon: 'jobs' },
  { id: 'company', label: 'Firma', icon: 'company' },
  { id: 'shop', label: 'Beschaffung', shortLabel: 'Shop', icon: 'shop' },
  { id: 'more', label: 'Mehr', icon: 'more' }
]);

export const formatMoney = (value) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
}).format(Math.round(value));

export const formatNumber = (value, digits = 0) => new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: digits
}).format(value);

export function xpNeeded(level) {
  return Math.round(ECONOMY.XP_BASE * Math.pow(level, ECONOMY.XP_GROWTH));
}
