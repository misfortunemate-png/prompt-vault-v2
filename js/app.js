import { openDB, dbGetAll, dbPut } from './db.js';
import { toast, makeThumb } from './utils.js';

// ============================================================
//  State
// ============================================================
export let prompts = [];
export function setPrompts(p) { prompts = p; }

// ============================================================
//  Theme
// ============================================================
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('pv-theme', theme);
  // Update active button
  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function initTheme() {
  const saved = localStorage.getItem('pv-theme') || 'classic';
  applyTheme(saved);
  document.getElementById('themeOptions').addEventListener('click', e => {
    const btn = e.target.closest('.theme-opt');
    if (btn) applyTheme(btn.dataset.theme);
  });
}

// ============================================================
//  Mode switching
// ============================================================
let currentMode = 'prompts';
const modeModules = {};

export function registerMode(name, module) {
  modeModules[name] = module;
}

function switchMode(mode) {
  if (mode === currentMode) return;
  // Hide current
  if (modeModules[currentMode]?.hide) modeModules[currentMode].hide();
  document.querySelector(`.view.active`)?.classList.remove('active');
  document.querySelector(`.mode-tab.active`)?.classList.remove('active');
  // Show new
  currentMode = mode;
  const viewId = { prompts: 'viewPrompts', catalog: 'viewCatalog', dict: 'viewDict' }[mode];
  document.getElementById(viewId)?.classList.add('active');
  document.querySelector(`.mode-tab[data-mode="${mode}"]`)?.classList.add('active');
  if (modeModules[mode]?.show) modeModules[mode].show();
}

function initModeNav() {
  document.getElementById('modeNav').addEventListener('click', e => {
    const btn = e.target.closest('.mode-tab');
    if (btn) switchMode(btn.dataset.mode);
  });
}

// ============================================================
//  Settings modal
// ============================================================
function initSettingsModal() {
  const overlay = document.getElementById('settingsOverlay');
  document.getElementById('btnSettings').addEventListener('click', () => overlay.classList.add('show'));
  document.getElementById('settingsClose').addEventListener('click', () => overlay.classList.remove('show'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
}

// ============================================================
//  Header stats
// ============================================================
export function updateStats() {
  const totalImgs = prompts.reduce((sum, p) => sum + (p.imageCount || 0), 0);
  document.getElementById('headerStats').textContent = `${prompts.length} prompts / ${totalImgs} images`;
}

// ============================================================
//  Migration (localStorage → IndexedDB)
// ============================================================
async function migrateFromLocalStorage() {
  const raw = localStorage.getItem('prompt-vault');
  if (!raw) return 0;
  let old;
  try { old = JSON.parse(raw); } catch { return 0; }
  if (!Array.isArray(old) || old.length === 0) return 0;

  let count = 0;
  for (const p of old) {
    const imgs = p.images || [];
    let thumbData = null;
    if (imgs.length > 0 && imgs[0].data) {
      try { thumbData = await makeThumb(imgs[0].data, 400); } catch {}
    }
    await dbPut('prompts', {
      id: p.id, title: p.title || '', prompt: p.prompt || '',
      tags: p.tags || [], memo: p.memo || '', thumbData,
      imageCount: imgs.length,
      createdAt: parseInt(p.id) || Date.now(), updatedAt: Date.now()
    });
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].data) {
        await dbPut('images', {
          id: 'mig_' + p.id + '_' + i, promptId: p.id,
          data: imgs[i].data, order: i
        });
      }
    }
    count++;
  }
  localStorage.removeItem('prompt-vault');
  return count;
}

// ============================================================
//  Init
// ============================================================
async function init() {
  // Theme first (sync, before DB)
  initTheme();
  initModeNav();
  initSettingsModal();

  // DB
  try {
    await openDB();
  } catch (e) {
    toast('データベースの初期化に失敗しました');
    console.error('DB init error:', e);
    return;
  }

  // Migration
  const migrated = await migrateFromLocalStorage();
  if (migrated > 0) toast(`${migrated}件のプロンプトを移行しました`, 3000);

  // Persistent storage
  if (navigator.storage?.persist) {
    await navigator.storage.persist();
  }

  // Load prompts
  prompts = await dbGetAll('prompts');
  prompts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  updateStats();

  // Load modules (dynamic import to avoid circular dependency)
  await import('./prompts.js');

  // Init registered modules
  for (const mod of Object.values(modeModules)) {
    if (mod.init) await mod.init();
  }

  toast('Prompt Vault 準備完了', 1500);
}

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
}

init();
