import { jobRemaining } from './jobs.js';

export function formatRemaining(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function startGameClock({ getState, onTick, onJobsDue }) {
  let timer = null;

  const tick = () => {
    const state = getState();
    const now = Date.now();
    const due = state.jobs.active.some((job) => jobRemaining(job, now) <= 0);
    if (due) onJobsDue(now);
    onTick(now);
  };

  timer = setInterval(tick, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('focus', tick);
  tick();

  return () => clearInterval(timer);
}

