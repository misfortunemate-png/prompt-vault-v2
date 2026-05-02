import { dbPut, dbDelete, dbGetByIndex, dbClearByIndex } from './db.js';
import { toast, esc, resizeImage, makeThumb, copyText } from './utils.js';
import { prompts, setPrompts, updateStats, registerMode, getSettings } from './state.js';

let activeTag = null;
let expandedCards = {};
let editId = null;
let editImages = [];

function allTags() {
  const set = new Set();
  prompts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

export function render() {
  const q = (document.getElementById('search')?.value || '').toLowerCase();
  const filtered = prompts.filter(p => {
    const matchTag = !activeTag || (p.tags || []).includes(activeTag);
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
    return matchTag && matchQ;
  });
  document.getElementById('tagFilter').innerHTML = allTags().map(t =>
    `<button class="tag-btn ${activeTag === t ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');
  updateStats();
  const grid = document.getElementById('grid');
  if (!filtered.length) { grid.innerHTML = '<div class="empty">— まだプロンプトがありません —</div>'; return; }
  grid.innerHTML = filtered.map(p => {
    const isExp = expandedCards[p.id];
    const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const cnt = p.imageCount || 0;
    const thumb = cnt > 0 && p.thumbData
      ? `<div class="card-thumb" data-view="${p.id}"><img src="${p.thumbData}" alt="" loading="lazy">${cnt > 1 ? `<div class="img-count">1 / ${cnt}</div>` : ''}</div>`
      : `<div class="card-thumb"><div class="no-img">no image</div></div>`;
    return `<div class="card">${thumb}
      <div class="card-header"><div class="card-title">${esc(p.title)}</div><div class="card-actions"><button class="icon-btn" data-edit="${p.id}">✎</button><button class="icon-btn delete" data-del="${p.id}">✕</button></div></div>
      <div class="card-body"><div class="card-prompt ${isExp ? 'expanded' : ''}">${esc(p.prompt)}</div>${p.prompt.length > 80 ? `<button class="expand-btn" data-expand="${p.id}">${isExp ? '▲ 折りたたむ' : '▼ すべて表示'}</button>` : ''}</div>
      <div class="card-footer"><div class="tags">${tags}</div><button class="copy-btn" data-copy="${p.id}">コピー</button></div>
      ${p.memo ? `<div class="card-memo">${esc(p.memo)}</div>` : ''}</div>`;
  }).join('');
}

function initEvents() {
  document.getElementById('search')?.addEventListener('input', render);
  document.getElementById('btnAdd')?.addEventListener('click', () => openModal());
  document.getElementById('tagFilter')?.addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn'); if (!btn) return;
    activeTag = activeTag === btn.dataset.tag ? null : btn.dataset.tag; render();
  });
  document.getElementById('grid')?.addEventListener('click', e => {
    const v = e.target.closest('[data-view]'); if (v) { document.dispatchEvent(new CustomEvent('pv:openViewer', { detail: v.dataset.view })); return; }
    const ed = e.target.closest('[data-edit]'); if (ed) { openModal(ed.dataset.edit); return; }
    const dl = e.target.closest('[data-del]'); if (dl) { del(dl.dataset.del); return; }
    const ex = e.target.closest('[data-expand]'); if (ex) { expandedCards[ex.dataset.expand] = !expandedCards[ex.dataset.expand]; render(); return; }
    const cp = e.target.closest('[data-copy]'); if (cp) { doCopy(cp.dataset.copy, cp); return; }
  });
  document.getElementById('editClose')?.addEventListener('click', closeModal);
  document.getElementById('editCancel')?.addEventListener('click', closeModal);
  document.getElementById('editSave')?.addEventListener('click', save);
  document.getElementById('editOverlay')?.addEventListener('click', e => { if (e.target.id === 'editOverlay') closeModal(); });
  document.getElementById('imgInput')?.addEventListener('change', handleAddImages);
}

async function doCopy(id, btn) {
  const p = prompts.find(x => x.id === id); if (!p) return;
  const ok = await copyText(p.prompt);
  btn.textContent = ok ? '✓ コピー済' : '手動でコピー'; btn.classList.toggle('done', ok);
  setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('done'); }, 2000);
}

async function openModal(id) {
  editId = id || null;
  document.getElementById('modalTitle').textContent = id ? 'プロンプトを編集' : '新規プロンプト';
  if (id) {
    const p = prompts.find(x => x.id === id);
    document.getElementById('fTitle').value = p.title;
    document.getElementById('fPrompt').value = p.prompt;
    document.getElementById('fTags').value = (p.tags || []).join(', ');
    document.getElementById('fMemo').value = p.memo || '';
    const imgs = await dbGetByIndex('images', 'promptId', id);
    imgs.sort((a, b) => a.order - b.order);
    editImages = imgs.map(img => ({ id: img.id, data: img.data }));
  } else {
    ['fTitle', 'fPrompt', 'fTags', 'fMemo'].forEach(id => document.getElementById(id).value = '');
    editImages = [];
  }
  renderImgPreview();
  document.getElementById('editOverlay').classList.add('show');
}

function closeModal() { document.getElementById('editOverlay').classList.remove('show'); editId = null; editImages = []; }

function renderImgPreview() {
  const list = document.getElementById('imgPreviewList');
  list.innerHTML = editImages.map((img, i) => `<div class="img-preview-item"><img src="${img.data}" alt=""><button class="del-img" data-rmidx="${i}">✕</button></div>`).join('')
    + `<button class="img-add-btn" id="imgAddBtn"><span>＋</span>追加</button>`;
  list.querySelectorAll('[data-rmidx]').forEach(b => b.addEventListener('click', () => { editImages.splice(+b.dataset.rmidx, 1); renderImgPreview(); }));
  document.getElementById('imgAddBtn')?.addEventListener('click', () => document.getElementById('imgInput').click());
}

async function handleAddImages(e) {
  // §7: リサイズ上限・品質を設定値から取得
  const { imageMaxSize, imageQuality } = getSettings();
  for (const f of Array.from(e.target.files)) {
    const data = await resizeImage(f, imageMaxSize, imageMaxSize, imageQuality);
    editImages.push({ data, id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) });
  }
  e.target.value = ''; renderImgPreview();
}

async function save() {
  const title = document.getElementById('fTitle').value.trim();
  const prompt = document.getElementById('fPrompt').value.trim();
  if (!title || !prompt) { toast('タイトルとプロンプトは必須です'); return; }
  const tags = document.getElementById('fTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const memo = document.getElementById('fMemo').value.trim();
  const pid = editId || Date.now().toString();
  let thumbData = null;
  if (editImages.length > 0) { try { thumbData = await makeThumb(editImages[0].data, 400); } catch {} }
  const pd = { id: pid, title, prompt, tags, memo, thumbData, imageCount: editImages.length,
    createdAt: editId ? (prompts.find(x => x.id === editId)?.createdAt || Date.now()) : Date.now(), updatedAt: Date.now() };
  await dbPut('prompts', pd);
  await dbClearByIndex('images', 'promptId', pid);
  for (let i = 0; i < editImages.length; i++) {
    await dbPut('images', { id: editImages[i].id || 'img_' + Date.now() + '_' + i, promptId: pid, data: editImages[i].data, order: i });
  }
  const idx = prompts.findIndex(x => x.id === pid);
  if (idx >= 0) prompts[idx] = pd; else prompts.unshift(pd);
  closeModal(); render(); toast('保存しました');
}

async function del(id) {
  if (!confirm('削除しますか？')) return;
  await dbDelete('prompts', id); await dbClearByIndex('images', 'promptId', id);
  setPrompts(prompts.filter(x => x.id !== id)); render(); toast('削除しました');
}

registerMode('prompts', {
  init() { initEvents(); render(); },
  show() { render(); },
  hide() {}
});
