import { updateMarket } from './js/economy.js';
import { completeDueJobs, refreshAvailableJobs, startJob } from './js/jobs.js';
import { maintainMachine, purchaseAsset, purchaseMaterial, upgradeYard } from './js/inventory.js';
import { ensureCloudSession, loadCloudState, saveCloudState } from './js/api.js';
import { clearAllLocalData, loadLocalState, saveLocalState } from './js/storage.js';
import { createInitialState, migrateSave, touchState } from './js/state.js';
import { startGameClock } from './js/timers.js';
import {
  applyTheme, closeSheet, markBootComplete, renderAll, renderJobs, renderScene,
  renderShop, setConnectionStatus, setView, showJobDetail, showLevelUp, showToast
} from './js/ui.js';

let state;
let jobFilter = 'all';
let shopCategory = 'machines';
let installPrompt = null;
let cloudTimer = null;
let cloudSyncInFlight = false;
let cloudDirty = false;
let audioContext = null;

const validViews = new Set(['site', 'jobs', 'company', 'shop', 'more']);

function playFeedback(type = 'tap') {
  if (!state.settings.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const notes = { tap: 270, buy: 470, complete: 660, level: 820, error: 150 };
    oscillator.type = type === 'complete' || type === 'level' ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(notes[type] || notes.tap, now);
    if (type === 'complete') oscillator.frequency.exponentialRampToValueAtTime(880, now + .16);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.055, now + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (type === 'tap' ? .07 : .25));
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + (type === 'tap' ? .08 : .27));
  } catch {
    // Sound ist optional; fehlende Web-Audio-Unterstützung blockiert das Spiel nicht.
  }
}

function vibrate(pattern = 18) {
  if (state.settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
}

function persistAndRender({ sync = true } = {}) {
  touchState(state);
  saveLocalState(state);
  renderAll(state, { jobFilter, shopCategory });
  if (sync) scheduleCloudSync();
}

function scheduleCloudSync(delay = 1100) {
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => syncCloud(), delay);
}

async function syncCloud(manual = false) {
  if (!navigator.onLine) {
    setConnectionStatus('local');
    if (manual) showToast('Offline – dein Spielstand bleibt sicher auf diesem Gerät.', 'info');
    return;
  }
  if (cloudSyncInFlight) {
    cloudDirty = true;
    return;
  }

  cloudSyncInFlight = true;
  cloudDirty = false;
  setConnectionStatus('syncing');
  const pendingIds = [...state.sync.pendingEventIds];
  try {
    const result = await saveCloudState(structuredClone(state));
    if (!state.player.id) state.player.id = result.session.playerId;
    state.sync.pendingEventIds = state.sync.pendingEventIds.filter((id) => !pendingIds.includes(id));
    state.sync.lastCloudSaveAt = Date.now();
    state.sync.lastCloudError = null;
    await saveLocalState(state);
    setConnectionStatus('online');
    if (manual) showToast('Spielstand mit der Cloud synchronisiert.', 'success');
  } catch (error) {
    state.sync.lastCloudError = error.message;
    setConnectionStatus('local');
    if (manual) showToast('Cloud gerade nicht erreichbar – lokal wurde gespeichert.', 'error');
  } finally {
    cloudSyncInFlight = false;
    if (cloudDirty) scheduleCloudSync(120);
  }
}

async function bootstrapCloud() {
  if (!navigator.onLine) return;
  setConnectionStatus('syncing');
  try {
    const session = await ensureCloudSession();
    const remote = await loadCloudState();
    if (remote?.state && Number(remote.updatedAt) > Number(state.meta.updatedAt)) {
      state = migrateSave(remote.state);
      state.player.id = session.playerId;
      const completions = completeDueJobs(state);
      refreshAvailableJobs(state);
      await saveLocalState(state);
      renderAll(state, { jobFilter, shopCategory });
      if (completions.length) announceCompletions(completions);
      setConnectionStatus('online');
    } else {
      state.player.id = session.playerId;
      await syncCloud();
    }
  } catch {
    setConnectionStatus('local');
  }
}

function announceCompletions(completions) {
  for (const result of completions) {
    showToast(`${result.job.name} fertig: + ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(result.job.payout)}`, 'success', 4300);
    if (result.levelResult.leveledUp) showLevelUp(result.levelResult.newLevel, result.unlocks);
  }
  playFeedback(completions.some((item) => item.levelResult.leveledUp) ? 'level' : 'complete');
  vibrate([28, 45, 28]);
  maybeShowInstall();
}

function maybeShowInstall() {
  if (installPrompt && state.stats.completedJobs > 0 && !state.meta.installHintDismissed) {
    document.querySelector('#install-banner').hidden = false;
  }
}

function markUnlocksSeen(type = null) {
  let changed = false;
  state.unlocks.forEach((unlock) => {
    if (!unlock.seen && (!type || unlock.type === type)) {
      unlock.seen = true;
      changed = true;
    }
  });
  if (changed) persistAndRender();
}

async function handleAction(button) {
  const nav = button.closest('[data-nav]')?.dataset.nav;
  if (nav) {
    setView(nav);
    if (nav === 'shop') markUnlocksSeen();
    playFeedback();
    return;
  }

  const jobDetail = button.closest('[data-job-detail]')?.dataset.jobDetail;
  if (jobDetail) {
    showJobDetail(state, jobDetail);
    playFeedback();
    return;
  }

  if (button.closest('[data-close-sheet]')) {
    closeSheet();
    return;
  }

  const startButton = button.closest('[data-start-job]');
  if (startButton) {
    startButton.disabled = true;
    const result = startJob(state, startButton.dataset.startJob);
    if (!result.ok) {
      showToast(result.error, 'error');
      playFeedback('error');
      showJobDetail(state, startButton.dataset.startJob);
      return;
    }
    refreshAvailableJobs(state, true);
    closeSheet();
    persistAndRender();
    setView('site');
    showToast('Baustelle gestartet. Maschinen sind unterwegs.', 'success');
    playFeedback('buy');
    vibrate(24);
    return;
  }

  if (button.closest('[data-open-procurement]')) {
    closeSheet();
    shopCategory = 'materials';
    document.querySelectorAll('[data-shop]').forEach((item) => item.classList.toggle('is-active', item.dataset.shop === shopCategory));
    renderShop(state, shopCategory);
    setView('shop');
    return;
  }

  const buyButton = button.closest('[data-buy-kind]');
  if (buyButton) {
    buyButton.disabled = true;
    const { buyKind, buyId } = buyButton.dataset;
    const result = buyKind === 'material'
      ? purchaseMaterial(state, buyId, Number(buyButton.dataset.buyAmount))
      : purchaseAsset(state, buyKind, buyId);
    if (!result.ok) {
      showToast(result.error, 'error');
      playFeedback('error');
      renderShop(state, shopCategory);
      return;
    }
    persistAndRender();
    showToast(buyKind === 'material' ? `${result.amount} ${result.item.unit} ${result.item.name} geliefert.` : `${result.item.name} gehört jetzt zu deiner Firma.`, 'success');
    playFeedback('buy');
    vibrate(20);
    return;
  }

  const maintenanceButton = button.closest('[data-maintain]');
  if (maintenanceButton) {
    maintenanceButton.disabled = true;
    const result = maintainMachine(state, maintenanceButton.dataset.maintain);
    if (!result.ok) {
      showToast(result.error, 'error');
      renderAll(state, { jobFilter, shopCategory });
      return;
    }
    persistAndRender();
    showToast(`${result.item.name} wurde vollständig gewartet.`, 'success');
    playFeedback('buy');
    return;
  }

  if (button.closest('[data-upgrade-yard]')) {
    const result = upgradeYard(state);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    persistAndRender();
    showToast(`${result.upgrade.name} eröffnet.`, 'success');
    showLevelUp(state.player.level, [{ name: `${result.upgrade.maxConcurrentJobs} Baustellenplätze` }]);
    playFeedback('level');
    vibrate([25, 40, 25]);
    return;
  }
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) handleAction(button);
  });

  document.querySelector('#refresh-jobs').addEventListener('click', () => {
    refreshAvailableJobs(state, true);
    persistAndRender();
    showToast('Vier neue Angebote wurden eingeholt.', 'success');
  });

  document.querySelector('#job-filter').addEventListener('click', (event) => {
    const filter = event.target.closest('[data-filter]');
    if (!filter) return;
    jobFilter = filter.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('is-active', button === filter));
    renderJobs(state, jobFilter);
  });

  document.querySelector('#shop-tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('[data-shop]');
    if (!tab) return;
    shopCategory = tab.dataset.shop;
    document.querySelectorAll('[data-shop]').forEach((button) => button.classList.toggle('is-active', button === tab));
    renderShop(state, shopCategory);
    markUnlocksSeen(shopCategory === 'machines' ? 'machine' : shopCategory === 'vehicles' ? 'vehicle' : 'material');
  });

  for (const id of ['sound', 'vibration', 'events']) {
    document.querySelector(`#setting-${id}`).addEventListener('change', (event) => {
      state.settings[id] = event.target.checked;
      persistAndRender();
      showToast('Einstellung gespeichert.', 'success', 1800);
    });
  }

  document.querySelector('#setting-theme').addEventListener('change', (event) => {
    state.settings.theme = event.target.value;
    applyTheme(state.settings.theme);
    persistAndRender();
  });

  document.querySelector('#sync-now').addEventListener('click', () => syncCloud(true));
  document.querySelector('#reset-game').addEventListener('click', () => document.querySelector('#confirm-dialog').showModal());
  document.querySelector('[data-cancel-reset]').addEventListener('click', () => document.querySelector('#confirm-dialog').close());
  document.querySelector('[data-confirm-reset]').addEventListener('click', async () => {
    await clearAllLocalData();
    location.reload();
  });
  document.querySelector('#level-overlay-close').addEventListener('click', () => {
    document.querySelector('#level-overlay').hidden = true;
  });
  document.querySelector('#dismiss-install').addEventListener('click', () => {
    state.meta.installHintDismissed = true;
    document.querySelector('#install-banner').hidden = true;
    persistAndRender();
  });
  document.querySelector('#install-app').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    document.querySelector('#install-banner').hidden = true;
  });
  document.querySelector('#detail-sheet').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeSheet();
  });
  window.addEventListener('online', () => syncCloud());
  window.addEventListener('offline', () => setConnectionStatus('local'));
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (state.settings.theme === 'system') applyTheme('system');
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  if (state) maybeShowInstall();
});

async function init() {
  const local = await loadLocalState();
  state = migrateSave(local || createInitialState());
  updateMarket(state);
  refreshAvailableJobs(state);
  const completions = completeDueJobs(state);
  await saveLocalState(state);
  renderAll(state, { jobFilter, shopCategory });
  bindEvents();

  const requestedView = new URL(location.href).searchParams.get('view');
  setView(validViews.has(requestedView) ? requestedView : 'site');
  markBootComplete();
  if (completions.length) announceCompletions(completions);

  startGameClock({
    getState: () => state,
    onTick: (now) => renderScene(state, now),
    onJobsDue: (now) => {
      const done = completeDueJobs(state, now);
      if (!done.length) return;
      persistAndRender();
      announceCompletions(done);
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  bootstrapCloud();
}

init().catch((error) => {
  console.error(error);
  document.querySelector('#boot-screen small').textContent = 'Start fehlgeschlagen – bitte Seite neu laden.';
});
