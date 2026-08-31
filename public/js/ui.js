import {
  APP_VERSION, MACHINES, MATERIALS, VEHICLES, YARD_UPGRADES,
  formatMoney, formatNumber, xpNeeded
} from './config.js';
import { getMaterialPrice, maintenancePrice } from './economy.js';
import { getJobReadiness, jobProgress, jobRemaining } from './jobs.js';
import { formatRemaining } from './timers.js';
import { updateConstructionScene } from './scene.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function durationLabel(seconds) {
  if (seconds < 60) return `${seconds} Sek.`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}:${String(rest).padStart(2, '0')} Min.` : `${minutes} Min.`;
}

function difficultyMarkup(level) {
  return `<span class="difficulty" title="Schwierigkeit ${level} von 5" aria-label="Schwierigkeit ${level} von 5">${[1,2,3,4,5]
    .map((value) => `<i class="${value <= level ? 'is-on' : ''}"></i>`).join('')}</span>`;
}

function conditionClass(condition) {
  if (condition < 55) return 'is-critical';
  if (condition < 80) return 'is-worn';
  return '';
}

function assetName(asset, kind) {
  return (kind === 'machine' ? MACHINES : VEHICLES)[asset.typeId]?.name || asset.typeId;
}

export function applyTheme(preference) {
  const resolved = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : preference;
  document.documentElement.dataset.theme = resolved || 'dark';
}

export function setView(viewId) {
  $$('.view').forEach((view) => view.classList.toggle('is-active', view.dataset.view === viewId));
  $$('[data-nav]').forEach((button) => button.classList.toggle('is-active', button.dataset.nav === viewId));
  const view = $(`[data-view="${viewId}"]`);
  view?.querySelector('h1')?.focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const url = new URL(location.href);
  if (viewId === 'site') url.searchParams.delete('view');
  else url.searchParams.set('view', viewId);
  history.replaceState(null, '', url);
}

export function renderHeader(state) {
  $('#header-balance').textContent = formatMoney(state.player.balance);
  $('#header-level').textContent = state.player.level;
  const needed = xpNeeded(state.player.level);
  $('#header-xp').textContent = `${formatNumber(state.player.xp)} / ${formatNumber(needed)} XP`;
  $('#header-xp-bar').style.width = `${Math.min(100, state.player.xp / needed * 100)}%`;
  $('#side-company-name').textContent = state.player.companyName;
  $('#side-yard-name').textContent = YARD_UPGRADES[state.company.yardLevel - 1]?.name || 'Bauhof';
  const count = state.jobs.available.length;
  $('#desktop-job-count').textContent = count;
  $('#mobile-job-count').textContent = count;
  document.title = state.jobs.active.length
    ? `${state.jobs.active.length} aktiv · Baustellen Tycoon`
    : 'Baustellen Tycoon';
}

export function renderScene(state, now = Date.now()) {
  const stage = $('#construction-stage');
  const job = state.jobs.active[0];
  const idle = $('#stage-idle-copy');
  const active = $('#active-job-panel');

  if (!job) {
    stage.dataset.status = 'idle';
    stage.dataset.progressStep = '0';
    idle.hidden = false;
    active.hidden = true;
    updateConstructionScene(null, 0);
  } else {
    const progress = jobProgress(job, now);
    stage.dataset.status = 'active';
    stage.dataset.scene = job.scene || 'earth';
    stage.dataset.progressStep = String(Math.max(1, Math.min(3, Math.ceil(progress * 3))));
    idle.hidden = true;
    active.hidden = false;
    $('#active-job-name').textContent = job.name;
    $('#active-job-client').textContent = job.client;
    $('#active-job-type').textContent = job.type.toUpperCase();
    $('#active-job-bar').style.width = `${progress * 100}%`;
    $('#active-job-progress').textContent = `${Math.floor(progress * 100)} %`;
    $('#active-job-time').textContent = formatRemaining(jobRemaining(job, now));
    updateConstructionScene(job, progress);
  }

  $('#stage-location').textContent = job ? `BAUFELD 01 · ${job.type.toUpperCase()}` : 'BAUFELD 01 · SÜDHANG';
  const slots = Array.from({ length: state.company.maxConcurrentJobs }, (_, index) => `<span class="${index < state.jobs.active.length ? 'is-used' : ''}"></span>`).join('');
  $('#capacity-slots').innerHTML = slots;
  $('#capacity-label').textContent = `${state.jobs.active.length} / ${state.company.maxConcurrentJobs}`;
  $('#rail-reputation').textContent = `${state.player.reputation} / 100`;
  $('#rail-completed').textContent = formatNumber(state.stats.completedJobs);
  $('#rail-profit').textContent = formatMoney(state.stats.profit);

  const quickJob = state.jobs.available[0];
  $('#quick-job').innerHTML = quickJob ? `
    <div class="quick-job">
      <h3>${escapeHtml(quickJob.name)}</h3>
      <p>${escapeHtml(quickJob.client)} · ${durationLabel(quickJob.duration)}</p>
      <div class="quick-job-meta"><strong>+ ${formatMoney(quickJob.profit)}</strong><button type="button" data-job-detail="${escapeHtml(quickJob.id)}" aria-label="Auftragsdetails öffnen">${icon('arrow')}</button></div>
    </div>` : '<div class="quick-job"><h3>Markt wird aktualisiert</h3><p>Neue Angebote folgen in Kürze.</p></div>';
}

function jobCard(state, job) {
  const readiness = getJobReadiness(state, job);
  const reason = readiness.ready ? 'Maschinen und Material vorhanden' : readiness.reasons[0];
  return `
    <article class="job-card ${readiness.ready ? 'is-ready' : ''}">
      <div class="job-card-top">
        <div><p class="job-kind">${escapeHtml(job.type)}</p><h2>${escapeHtml(job.name)}</h2><p class="client">${escapeHtml(job.client)}</p></div>
        ${difficultyMarkup(job.difficulty)}
      </div>
      <div class="job-card-numbers">
        <span>Dauer<b>${durationLabel(job.duration)}</b></span>
        <span>Umsatz<b>${formatMoney(job.payout)}</b></span>
        <span class="profit">Gewinn<b>+ ${formatMoney(job.profit)}</b></span>
      </div>
      <div class="readiness">${icon(readiness.ready ? 'check' : 'lock')}<span>${escapeHtml(reason)}</span></div>
      <button class="${readiness.ready ? 'primary-action' : 'secondary-action'}" type="button" data-job-detail="${escapeHtml(job.id)}">Auftrag ansehen ${icon('arrow')}</button>
    </article>`;
}

export function renderJobs(state, filter = 'all') {
  const jobs = state.jobs.available.filter((job) => {
    const ready = getJobReadiness(state, job).ready;
    return filter === 'all' || (filter === 'ready' ? ready : !ready);
  });
  $('#job-grid').innerHTML = jobs.length
    ? jobs.map((job) => jobCard(state, job)).join('')
    : '<div class="job-card"><p class="job-kind">KEIN TREFFER</p><h2>Hier ist gerade nichts dabei.</h2><p class="client">Wähle einen anderen Filter oder aktualisiere die Angebote.</p></div>';
}

export function renderCompany(state) {
  const yard = YARD_UPGRADES[state.company.yardLevel - 1];
  const next = YARD_UPGRADES[state.company.yardLevel];
  const nextAllowed = next && state.player.level >= next.level * 2;
  const yardButton = next ? `
    <button class="primary-action" type="button" data-upgrade-yard ${nextAllowed && state.player.balance >= next.price ? '' : 'disabled'}>
      ${next.name} · ${formatMoney(next.price)}
    </button>
    <small class="upgrade-note">${nextAllowed ? `Erweitert deine Firma auf ${next.maxConcurrentJobs} parallele Baustellen.` : `Freischaltung ab Unternehmer-Level ${next.level * 2}.`}</small>`
    : '<span class="upgrade-note">Maximale Ausbaustufe erreicht.</span>';

  $('#company-summary').innerHTML = `
    <article class="yard-card">
      <span class="yard-level">FIRMENGELÄNDE · STUFE ${yard.level}</span>
      <h2>${escapeHtml(yard.name)}</h2>
      <p>Deine Basis für Maschinen, Material und laufende Baustellen. Jeder Ausbau schafft neue Kapazitäten.</p>
      ${yardButton}
    </article>
    <div class="company-kpis">
      <article class="kpi-card"><span>Maschinen</span><strong>${state.inventory.machines.length}</strong><small>${state.inventory.machines.filter((item) => !item.busyBy).length} einsatzbereit</small></article>
      <article class="kpi-card"><span>Fahrzeuge</span><strong>${state.inventory.vehicles.length}</strong><small>${state.inventory.vehicles.filter((item) => !item.busyBy).length} verfügbar</small></article>
      <article class="kpi-card"><span>Kapazität</span><strong>${state.company.maxConcurrentJobs}</strong><small>parallele Baustellen</small></article>
      <article class="kpi-card"><span>Umsatz gesamt</span><strong>${formatMoney(state.stats.revenue)}</strong><small>${state.stats.completedJobs} Aufträge</small></article>
    </div>`;

  const machines = state.inventory.machines.map((asset) => assetRow(asset, 'machine')).join('');
  const vehicles = state.inventory.vehicles.map((asset) => assetRow(asset, 'vehicle')).join('');
  $('#asset-list').innerHTML = machines + vehicles;
}

function assetRow(asset, kind) {
  const catalogItem = (kind === 'machine' ? MACHINES : VEHICLES)[asset.typeId];
  const isMachine = kind === 'machine';
  const price = isMachine ? maintenancePrice(asset, catalogItem) : 0;
  const status = asset.busyBy ? 'Im Einsatz' : asset.condition < 70 ? 'Wartung empfohlen' : 'Einsatzbereit';
  return `
    <article class="asset-row">
      <div class="asset-visual"><span class="asset-${kind}"></span></div>
      <div class="asset-copy"><h3>${escapeHtml(assetName(asset, kind))}</h3><p>${status} · ${asset.uses} Einsätze</p></div>
      <div class="asset-status"><div class="condition-track"><i class="${conditionClass(asset.condition)}" style="width:${asset.condition}%"></i></div><span>${formatNumber(asset.condition, 1)} %</span></div>
      ${isMachine && asset.condition < 100 ? `<button class="asset-maintain" type="button" data-maintain="${escapeHtml(asset.id)}" ${asset.busyBy ? 'disabled' : ''}>${icon('wrench')} Warten · ${formatMoney(price)}</button>` : ''}
    </article>`;
}

function productCard(state, item, kind) {
  const locked = state.player.level < (item.level || 1);
  const owned = kind === 'machine'
    ? state.inventory.machines.filter((asset) => asset.typeId === item.id).length
    : state.inventory.vehicles.filter((asset) => asset.typeId === item.id).length;
  const art = kind === 'machine' ? 'product-machine-art' : 'product-vehicle-art';
  return `
    <article class="product-card ${locked ? 'is-locked' : ''}">
      <div class="product-art"><span class="${art}"></span></div>
      <span class="product-badge">${locked ? `LEVEL ${item.level}` : owned ? `${owned} IM FUHRPARK` : 'VERFÜGBAR'}</span>
      <h2>${escapeHtml(item.name)}</h2>
      <p>${escapeHtml(item.description)}</p>
      <div class="product-footer">
        <div class="product-price"><small>KAUFPREIS</small><strong>${formatMoney(item.price)}</strong></div>
        <button class="${locked ? 'secondary-action' : 'primary-action'}" type="button" data-buy-kind="${kind}" data-buy-id="${item.id}" ${locked ? 'disabled' : ''}>${locked ? icon('lock') : 'Kaufen'}</button>
      </div>
    </article>`;
}

function materialCard(state, item) {
  const locked = state.player.level < (item.level || 1);
  const amount = item.id === 'concrete' || item.id === 'timber' ? 5 : item.id === 'steel' ? 2 : 10;
  const unitPrice = getMaterialPrice(state, item.id);
  const stock = state.inventory.materials[item.id] || 0;
  return `
    <article class="product-card ${locked ? 'is-locked' : ''}">
      <div class="product-art"><span class="material-art" style="--material-color:${item.color}"></span></div>
      <span class="product-badge">${locked ? `LEVEL ${item.level}` : `${formatNumber(stock)} ${item.unit} AUF LAGER`}</span>
      <h2>${escapeHtml(item.name)}</h2>
      <p>Lieferpaket mit ${amount} ${item.unit}. Aktueller Marktpreis: ${formatMoney(unitPrice)} je ${item.unit}.</p>
      <div class="product-footer">
        <div class="product-price"><small>${amount} ${item.unit} LIEFERUNG</small><strong>${formatMoney(unitPrice * amount)}</strong></div>
        <button class="${locked ? 'secondary-action' : 'primary-action'}" type="button" data-buy-kind="material" data-buy-id="${item.id}" data-buy-amount="${amount}" ${locked ? 'disabled' : ''}>${locked ? icon('lock') : 'Bestellen'}</button>
      </div>
    </article>`;
}

export function renderShop(state, category = 'machines') {
  let markup = '';
  if (category === 'machines') markup = Object.values(MACHINES).map((item) => productCard(state, item, 'machine')).join('');
  if (category === 'vehicles') markup = Object.values(VEHICLES).map((item) => productCard(state, item, 'vehicle')).join('');
  if (category === 'materials') markup = Object.values(MATERIALS).map((item) => materialCard(state, item)).join('');
  $('#shop-grid').innerHTML = markup;
}

export function renderMore(state) {
  $('#setting-sound').checked = state.settings.sound;
  $('#setting-vibration').checked = state.settings.vibration;
  $('#setting-events').checked = state.settings.events;
  $('#setting-theme').value = state.settings.theme || 'dark';
  $('#history-list').innerHTML = state.history.length
    ? state.history.slice(0, 25).map((event) => `
      <article class="history-item"><h3>${escapeHtml(event.message)}</h3><p>${new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(event.createdAt)}</p></article>`).join('')
    : '<p>Dein Bautagebuch ist noch leer.</p>';
}

export function renderAll(state, options = {}) {
  renderHeader(state);
  renderScene(state);
  renderJobs(state, options.jobFilter || 'all');
  renderCompany(state);
  renderShop(state, options.shopCategory || 'machines');
  renderMore(state);
  applyTheme(state.settings.theme);
}

export function showJobDetail(state, jobId) {
  const job = state.jobs.available.find((item) => item.id === jobId);
  if (!job) return false;
  const readiness = getJobReadiness(state, job);
  const machineName = MACHINES[job.requirements.machine]?.name || job.requirements.machine;
  const vehicleName = VEHICLES[job.requirements.vehicle]?.name || job.requirements.vehicle;
  const machineReady = Boolean(readiness.machine);
  const vehicleReady = Boolean(readiness.vehicle);
  const materials = Object.entries(job.requirements.materials).map(([id, required]) => {
    const item = MATERIALS[id];
    const available = state.inventory.materials[id] || 0;
    return `<div class="requirement ${available >= required ? 'is-met' : 'is-missing'}">${icon(available >= required ? 'check' : 'close')}<span>${escapeHtml(item.name)}</span><b>${formatNumber(available)} / ${formatNumber(required)} ${item.unit}</b></div>`;
  }).join('');

  $('#sheet-content').innerHTML = `
    <span class="sheet-eyebrow">${escapeHtml(job.type.toUpperCase())} · SCHWIERIGKEIT ${job.difficulty}</span>
    <h2 id="sheet-title">${escapeHtml(job.name)}</h2>
    <p class="sheet-client">${escapeHtml(job.client)} · ${durationLabel(job.duration)} · ${job.xp} XP</p>
    <div class="finance-panel">
      <div class="finance-main"><div><span>Umsatz</span><strong>${formatMoney(job.payout)}</strong></div><div><span>Erwarteter Gewinn</span><strong>${formatMoney(job.profit)}</strong></div></div>
      <div class="cost-breakdown"><div><span>Material</span><b>${formatMoney(job.costs.material)}</b></div><div><span>Betrieb</span><b>${formatMoney(job.costs.operating)}</b></div><div><span>Lohn</span><b>${formatMoney(job.costs.labor)}</b></div></div>
    </div>
    <div class="section-head"><div><span>ANFORDERUNGEN</span><h2>Alles startklar?</h2></div></div>
    <div class="requirement-list">
      <div class="requirement ${machineReady ? 'is-met' : 'is-missing'}">${icon(machineReady ? 'check' : 'close')}<span>${escapeHtml(machineName)}</span><b>${machineReady ? 'BEREIT' : 'FEHLT'}</b></div>
      <div class="requirement ${vehicleReady ? 'is-met' : 'is-missing'}">${icon(vehicleReady ? 'check' : 'close')}<span>${escapeHtml(vehicleName)}</span><b>${vehicleReady ? 'BEREIT' : 'FEHLT'}</b></div>
      ${materials || '<div class="requirement is-met">' + icon('check') + '<span>Kein zusätzliches Material</span><b>BEREIT</b></div>'}
    </div>
    <div class="sheet-actions">
      <button class="primary-action" type="button" data-start-job="${escapeHtml(job.id)}" ${readiness.ready ? '' : 'disabled'}>${readiness.ready ? `Baustelle starten · ${formatMoney(job.costs.direct)} Startkosten` : 'Noch nicht startklar'}</button>
      ${readiness.ready ? '' : '<button class="secondary-action" type="button" data-open-procurement>Fehlendes Material oder Gerät beschaffen</button><p class="missing-help">' + escapeHtml(readiness.reasons[0]) + '</p>'}
    </div>`;

  const dialog = $('#detail-sheet');
  if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
  else if (!dialog.open) dialog.setAttribute('open', '');
  return true;
}

export function closeSheet() {
  const dialog = $('#detail-sheet');
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

export function showToast(message, type = 'info', duration = 3200) {
  const toast = document.createElement('div');
  toast.className = `toast is-${type}`;
  toast.textContent = message;
  $('#toast-region').append(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 240);
  }, duration);
}

export function showLevelUp(level, unlocks = []) {
  $('#level-overlay-number').textContent = `LEVEL ${level}`;
  $('#level-overlay-unlock').textContent = unlocks.length
    ? `${unlocks.map((item) => item.name).slice(0, 2).join(' und ')} freigeschaltet`
    : 'Neue Aufträge freigeschaltet';
  $('#level-overlay').hidden = false;
}

export function setConnectionStatus(status) {
  const element = $('#connection-status');
  element.classList.toggle('is-online', status === 'online');
  element.classList.toggle('is-syncing', status === 'syncing');
  element.querySelector('b').textContent = status === 'online' ? 'CLOUD OK' : status === 'syncing' ? 'SYNC' : 'LOKAL';
}

export function markBootComplete() {
  const boot = $('#boot-screen');
  $('#app').hidden = false;
  requestAnimationFrame(() => boot.classList.add('is-leaving'));
  setTimeout(() => boot.remove(), 420);
}

export const uiVersion = APP_VERSION;
