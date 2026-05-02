import { openDB, dbGetAll, dbPut } from './db.js';
import { toast, makeThumb, showError } from './utils.js';
import { prompts, setPrompts, updateStats, getModeModules, loadSettings, getSettings } from './state.js';
import { initViewer } from './viewer.js';
import { initSettings } from './settings.js';

// ============================================================
//  Mode switching
// ============================================================
let currentMode = 'prompts';

function switchMode(mode) {
  const modules = getModeModules();
  if (modules[currentMode]?.hide) modules[currentMode].hide();
  document.querySelector('.view.active')?.classList.remove('active');
  document.querySelector('.mode-tab.active')?.classList.remove('active');
  currentMode = mode;
  const viewId = { prompts: 'viewPrompts', catalog: 'viewCatalog', dict: 'viewDict' }[mode];
  document.getElementById(viewId)?.classList.add('active');
  document.querySelector(`.mode-tab[data-mode="${mode}"]`)?.classList.add('active');
  if (modules[mode]?.show) modules[mode].show();
}

// ============================================================
//  Migration
// ============================================================
async function migrate() {
  const raw = localStorage.getItem('prompt-vault');
  if (!raw) return 0;
  let old; try { old = JSON.parse(raw); } catch { return 0; }
  if (!Array.isArray(old) || !old.length) return 0;
  let count = 0;
  for (const p of old) {
    const imgs = p.images || [];
    let thumbData = null;
    if (imgs[0]?.data) { try { thumbData = await makeThumb(imgs[0].data, 400); } catch {} }
    await dbPut('prompts', { id: p.id, title: p.title || '', prompt: p.prompt || '', tags: p.tags || [], memo: p.memo || '',
      thumbData, imageCount: imgs.length, createdAt: parseInt(p.id) || Date.now(), updatedAt: Date.now() });
    for (let i = 0; i < imgs.length; i++) {
      if (imgs[i].data) await dbPut('images', { id: 'mig_' + p.id + '_' + i, promptId: p.id, data: imgs[i].data, order: i });
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
  // §9: 設定を最初に読み込む（他モジュールがgetSettings()を使えるように）
  loadSettings();

  // §6: 常時自由回転モードは起動時に一度unlock
  if (getSettings().orientation === 'free') {
    try { await screen.orientation.unlock(); } catch {}
  }

  // Theme (sync, before anything else)
  const saved = localStorage.getItem('pv-theme') || 'classic';
  document.body.setAttribute('data-theme', saved);

  // Mode nav
  document.getElementById('modeNav')?.addEventListener('click', e => {
    const btn = e.target.closest('.mode-tab'); if (btn) switchMode(btn.dataset.mode);
  });

  // Settings & Viewer (no circular deps — these import from state.js)
  try { initSettings(); } catch (e) { showError('設定の初期化に失敗: ' + e.message); }
  try { initViewer(); } catch (e) { showError('ビューアの初期化に失敗: ' + e.message); }

  // DB
  try {
    await openDB();
  } catch (e) {
    showError('データベースの初期化に失敗: ' + e.message);
    return;
  }

  // Migration
  try {
    const n = await migrate();
    if (n > 0) toast(`${n}件のプロンプトを移行しました`, 3000);
  } catch (e) { console.warn('Migration error:', e); }

  // Persistent storage
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}

  // Load data
  const all = await dbGetAll('prompts');
  all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  setPrompts(all);
  updateStats();

  // Load feature modules with error reporting
  const modules = [
    ['prompts', './prompts.js'],
    ['catalog', './catalog.js'],
    ['dict', './dict.js']
  ];
  for (const [name, path] of modules) {
    try {
      await import(path);
    } catch (e) {
      showError(`モジュール "${name}" の読み込みに失敗: ${e.message}`);
    }
  }

  // Init all registered modules
  const mods = getModeModules();
  for (const [name, mod] of Object.entries(mods)) {
    try {
      if (mod.init) await mod.init();
    } catch (e) {
      showError(`モジュール "${name}" の初期化に失敗: ${e.message}`);
    }
  }

  // Re-render listener (for import)
  document.addEventListener('pv:rerender', () => {
    const mods = getModeModules();
    if (mods[currentMode]?.show) mods[currentMode].show();
  });

  toast('Prompt Vault 準備完了', 1500);
}

// Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init().catch(e => showError('初期化エラー: ' + e.message));
