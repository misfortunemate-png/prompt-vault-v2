import { dbGetByIndex, dbPut, dbClearByIndex, dbGetAll } from './db.js';
import { toast, makeThumb } from './utils.js';
import { prompts, setPrompts, updateStats } from './state.js';

export function initSettings() {
  // Theme
  const saved = localStorage.getItem('pv-theme') || 'classic';
  applyTheme(saved);
  document.getElementById('themeOptions')?.addEventListener('click', e => {
    const btn = e.target.closest('.theme-opt'); if (btn) applyTheme(btn.dataset.theme);
  });

  // Settings modal
  const ov = document.getElementById('settingsOverlay');
  document.getElementById('btnSettings')?.addEventListener('click', () => ov.classList.add('show'));
  document.getElementById('settingsClose')?.addEventListener('click', () => ov.classList.remove('show'));
  ov?.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('show'); });

  // I/O buttons
  const ioBtns = document.getElementById('ioBtns');
  if (ioBtns) {
    ioBtns.innerHTML = `
      <button class="io-btn" id="ioExportMeta">プロンプトのみ書き出し<span class="io-hint">軽量</span></button>
      <button class="io-btn" id="ioExportFull">画像込み書き出し<span class="io-hint">完全バックアップ</span></button>
      <button class="io-btn" id="ioImport">JSONファイル読み込み<span class="io-hint">マージ</span></button>`;
    document.getElementById('ioExportMeta')?.addEventListener('click', () => exportJSON(false));
    document.getElementById('ioExportFull')?.addEventListener('click', () => exportJSON(true));
    document.getElementById('ioImport')?.addEventListener('click', () => document.getElementById('importFile')?.click());
  }
  document.getElementById('importFile')?.addEventListener('change', importJSON);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('pv-theme', theme);
  document.querySelectorAll('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
}

async function exportJSON(withImages) {
  document.getElementById('settingsOverlay').classList.remove('show');
  toast('エクスポート準備中…');
  const data = { version: 1, exportedAt: new Date().toISOString(), includesImages: withImages, prompts: [] };
  for (const p of prompts) {
    const entry = { id: p.id, title: p.title, prompt: p.prompt, tags: p.tags || [], memo: p.memo || '', imageCount: p.imageCount || 0, createdAt: p.createdAt, updatedAt: p.updatedAt };
    if (withImages && p.imageCount > 0) {
      const imgs = await dbGetByIndex('images', 'promptId', p.id);
      imgs.sort((a, b) => a.order - b.order);
      entry.images = imgs.map(img => ({ data: img.data, order: img.order }));
    }
    data.prompts.push(entry);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `prompt-vault-${new Date().toISOString().slice(0, 10)}${withImages ? '-full' : ''}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  toast(`${data.prompts.length}件をエクスポートしました`);
}

async function importJSON(event) {
  const file = event.target.files[0]; if (!file) return;
  event.target.value = '';
  document.getElementById('settingsOverlay').classList.remove('show');
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.prompts)) { toast('無効なファイル形式です'); return; }
    let added = 0, updated = 0;
    for (const entry of data.prompts) {
      if (!entry.id || !entry.title || !entry.prompt) continue;
      const existing = prompts.find(x => x.id === entry.id);
      let thumbData = null;
      if (entry.images?.length > 0 && entry.images[0].data) { try { thumbData = await makeThumb(entry.images[0].data, 400); } catch {} }
      else if (existing) thumbData = existing.thumbData;
      const pd = { id: entry.id, title: entry.title, prompt: entry.prompt, tags: entry.tags || [], memo: entry.memo || '', thumbData,
        imageCount: entry.images ? entry.images.length : (existing?.imageCount || 0),
        createdAt: entry.createdAt || Date.now(), updatedAt: entry.updatedAt || Date.now() };
      await dbPut('prompts', pd);
      if (entry.images?.length > 0) {
        await dbClearByIndex('images', 'promptId', entry.id);
        for (let i = 0; i < entry.images.length; i++) {
          if (entry.images[i].data) await dbPut('images', { id: 'imp_' + entry.id + '_' + i, promptId: entry.id, data: entry.images[i].data, order: entry.images[i].order ?? i });
        }
      }
      existing ? updated++ : added++;
    }
    const all = await dbGetAll('prompts');
    all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setPrompts(all); updateStats();
    // Re-render if on prompts view
    document.dispatchEvent(new CustomEvent('pv:rerender'));
    toast(`インポート完了：${added}件追加、${updated}件更新`);
  } catch (e) { console.error(e); toast('インポートに失敗しました'); }
}
