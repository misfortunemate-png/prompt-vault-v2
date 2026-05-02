import { dbGetByIndex, dbPut, dbClearByIndex, dbGetAll } from './db.js';
import { toast, makeThumb } from './utils.js';
import { prompts, setPrompts, updateStats, getSettings, updateSettings } from './state.js';

export function initSettings() {
  // Theme
  const saved = localStorage.getItem('pv-theme') || 'classic';
  applyTheme(saved);
  document.getElementById('themeOptions')?.addEventListener('click', e => {
    const btn = e.target.closest('.theme-opt'); if (btn) applyTheme(btn.dataset.theme);
  });

  // §6: 画面方向セクション描画
  renderOrientationSection();
  // §7: 画像品質セクション描画
  renderQualitySection();

  // Settings modal
  const ov = document.getElementById('settingsOverlay');
  document.getElementById('btnSettings')?.addEventListener('click', () => {
    ov.classList.add('show');
    // §8: モーダルを開くたびにストレージ使用量を更新
    updateStorageDisplay();
  });
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

// §6: 画面方向セクション描画
function renderOrientationSection() {
  const el = document.getElementById('orientationSection');
  if (!el) return;
  const cur = getSettings().orientation;
  const opts = [
    { val: 'portrait-lock', label: '常時縦固定' },
    { val: 'viewer-only',   label: 'ビューア時のみ横許可' },
    { val: 'free',          label: '常時自由回転' }
  ];
  el.innerHTML = `<h3>画面方向</h3><div class="theme-options" id="orientationOptions">
    ${opts.map(o => `<button class="theme-opt${o.val === cur ? ' active' : ''}" data-orient="${o.val}">${o.label}</button>`).join('')}
  </div>`;
  el.querySelector('#orientationOptions')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-orient]');
    if (!btn) return;
    updateSettings({ orientation: btn.dataset.orient });
    el.querySelectorAll('[data-orient]').forEach(b => b.classList.toggle('active', b === btn));
  });
}

// §7: 画像品質セクション描画
function renderQualitySection() {
  const el = document.getElementById('qualitySection');
  if (!el) return;
  const s = getSettings();
  const sizes = [{ v: 800, l: '800px' }, { v: 1200, l: '1200px' }, { v: 99999, l: '元サイズ' }];
  const quals = [{ v: 0.75, l: '75%' }, { v: 0.85, l: '85%' }, { v: 0.95, l: '95%' }];
  el.innerHTML = `<h3>画像品質（新規追加時）</h3>
    <div style="margin-bottom:8px">
      <div style="font-size:11px;color:var(--text-sub);letter-spacing:1px;margin-bottom:6px">リサイズ上限</div>
      <div class="theme-options" id="sizeOptions">
        ${sizes.map(o => `<button class="theme-opt${o.v === s.imageMaxSize ? ' active' : ''}" data-size="${o.v}">${o.l}</button>`).join('')}
      </div>
    </div>
    <div>
      <div style="font-size:11px;color:var(--text-sub);letter-spacing:1px;margin-bottom:6px">JPEG品質</div>
      <div class="theme-options" id="qualOptions">
        ${quals.map(o => `<button class="theme-opt${o.v === s.imageQuality ? ' active' : ''}" data-qual="${o.v}">${o.l}</button>`).join('')}
      </div>
    </div>`;
  el.querySelector('#sizeOptions')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-size]');
    if (!btn) return;
    const v = Number(btn.dataset.size);
    updateSettings({ imageMaxSize: v });
    el.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('active', b === btn));
    if (v === 99999) toast('元サイズ維持はストレージを大量消費します', 3000);
  });
  el.querySelector('#qualOptions')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-qual]');
    if (!btn) return;
    const v = Number(btn.dataset.qual);
    updateSettings({ imageQuality: v });
    el.querySelectorAll('[data-qual]').forEach(b => b.classList.toggle('active', b === btn));
    if (v === 0.95 && getSettings().imageMaxSize === 99999) toast('元サイズ維持 + 品質95%はストレージを急速に消費します', 3500);
  });
}

// §8: ブラウザストレージ使用量表示
async function updateStorageDisplay() {
  const el = document.getElementById('storageSection');
  if (!el) return;
  el.innerHTML = '<h3>ブラウザストレージ使用量</h3><div id="storageInfo" style="font-size:13px;color:var(--text-sub)">計測中…</div>';
  try {
    if (!navigator.storage?.estimate) { document.getElementById('storageInfo').textContent = '計測不可'; return; }
    const { usage, quota } = await navigator.storage.estimate();
    const useMB = (usage / 1024 / 1024).toFixed(1);
    const quotaMB = (quota / 1024 / 1024).toFixed(0);
    const pct = quota > 0 ? Math.round(usage / quota * 100) : 0;
    document.getElementById('storageInfo').textContent = `使用中: ${useMB} MB / ${quotaMB} MB (${pct}%)`;
  } catch { document.getElementById('storageInfo').textContent = '計測不可'; }
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
