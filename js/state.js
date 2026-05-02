// Shared state module — prevents circular dependencies
// All modules import from here, never from each other

export let prompts = [];

export function setPrompts(p) { prompts = p; }

const modeModules = {};

export function registerMode(name, mod) { modeModules[name] = mod; }

export function getModeModules() { return modeModules; }

export function updateStats() {
  const el = document.getElementById('headerStats');
  if (!el) return;
  const totalImgs = prompts.reduce((sum, p) => sum + (p.imageCount || 0), 0);
  el.textContent = `${prompts.length} prompts / ${totalImgs} images`;
}

// §9: 設定永続化 — localStorageキー pv-settings
const DEFAULT_SETTINGS = { orientation: 'viewer-only', imageMaxSize: 800, imageQuality: 0.75 };
let _settings = { ...DEFAULT_SETTINGS };

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('pv-settings') || '{}');
    _settings = { ...DEFAULT_SETTINGS, ...s };
  } catch { _settings = { ...DEFAULT_SETTINGS }; }
}

export function getSettings() { return { ..._settings }; }

export function updateSettings(partial) {
  _settings = { ..._settings, ...partial };
  try { localStorage.setItem('pv-settings', JSON.stringify(_settings)); } catch {}
}
