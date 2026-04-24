import { dbGetAll, dbPut, dbDelete, dbGetByIndex, dbClearByIndex } from './db.js';
import { toast, esc, resizeImage, makeThumb, copyText } from './utils.js';
import { prompts, setPrompts, updateStats, registerMode } from './app.js';

// ============================================================
//  State
// ============================================================
let activeTag = null;
let expandedCards = {};
let editId = null;
let editImages = []; // [{ id, data }]

// ============================================================
//  Tag helpers
// ============================================================
function allTags() {
  const set = new Set();
  prompts.forEach(p => (p.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

// ============================================================
//  Render
// ============================================================
function render() {
  const q = document.getElementById('search').value.toLowerCase();
  const filtered = prompts.filter(p => {
    const matchTag = !activeTag || (p.tags || []).includes(activeTag);
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
    return matchTag && matchQ;
  });

  // Tags
  document.getElementById('tagFilter').innerHTML = allTags().map(t =>
    `<button class="tag-btn ${activeTag === t ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`
  ).join('');

  updateStats();

  // Grid
  const grid = document.getElementById('grid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty">— まだプロンプトがありません —</div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const isExpanded = expandedCards[p.id];
    const tags = (p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    const count = p.imageCount || 0;
    const thumbHtml = count > 0 && p.thumbData
      ? `<div class="card-thumb" data-view="${p.id}">
          <img src="${p.thumbData}" alt="" loading="lazy">
          ${count > 1 ? `<div class="img-count">1 / ${count}</div>` : ''}
         </div>`
      : `<div class="card-thumb" style="cursor:${count > 0 ? 'pointer' : 'default'}" ${count > 0 ? `data-view="${p.id}"` : ''}>
          <div class="no-img">no image</div>
         </div>`;
    return `
      <div class="card">
        ${thumbHtml}
        <div class="card-header">
          <div class="card-title">${esc(p.title)}</div>
          <div class="card-actions">
            <button class="icon-btn" data-edit="${p.id}">✎</button>
            <button class="icon-btn delete" data-del="${p.id}">✕</button>
          </div>
        </div>
        <div class="card-body">
          <div class="card-prompt ${isExpanded ? 'expanded' : ''}">${esc(p.prompt)}</div>
          ${p.prompt.length > 80 ? `<button class="expand-btn" data-expand="${p.id}">${isExpanded ? '▲ 折りたたむ' : '▼ すべて表示'}</button>` : ''}
        </div>
        <div class="card-footer">
          <div class="tags">${tags}</div>
          <button class="copy-btn" data-copy="${p.id}">コピー</button>
        </div>
        ${p.memo ? `<div class="card-memo">${esc(p.memo)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ============================================================
//  Event delegation
// ============================================================
function initEvents() {
  const grid = document.getElementById('grid');
  const tagFilter = document.getElementById('tagFilter');

  // Search
  document.getElementById('search').addEventListener('input', render);

  // Add button
  document.getElementById('btnAdd').addEventListener('click', () => openModal());

  // Tag filter clicks
  tagFilter.addEventListener('click', e => {
    const btn = e.target.closest('.tag-btn');
    if (!btn) return;
    const t = btn.dataset.tag;
    activeTag = activeTag === t ? null : t;
    render();
  });

  // Grid clicks (delegation)
  grid.addEventListener('click', e => {
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) {
      document.dispatchEvent(new CustomEvent('pv:openViewer', { detail: viewBtn.dataset.view }));
      return;
    }
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) { openModal(editBtn.dataset.edit); return; }

    const delBtn = e.target.closest('[data-del]');
    if (delBtn) { del(delBtn.dataset.del); return; }

    const expandBtn = e.target.closest('[data-expand]');
    if (expandBtn) {
      const id = expandBtn.dataset.expand;
      expandedCards[id] = !expandedCards[id];
      render();
      return;
    }

    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) { doCopy(copyBtn.dataset.copy, copyBtn); return; }
  });

  // Edit modal events
  document.getElementById('editClose').addEventListener('click', closeModal);
  document.getElementById('editCancel').addEventListener('click', closeModal);
  document.getElementById('editSave').addEventListener('click', save);
  document.getElementById('editOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('editOverlay')) closeModal();
  });
  document.getElementById('imgInput').addEventListener('change', handleAddImages);
}

// ============================================================
//  Clipboard
// ============================================================
async function doCopy(id, btn) {
  const p = prompts.find(x => x.id === id);
  if (!p) return;
  const ok = await copyText(p.prompt);
  if (ok) {
    btn.textContent = '✓ コピー済';
    btn.classList.add('done');
    setTimeout(() => { btn.textContent = 'コピー'; btn.classList.remove('done'); }, 2000);
  } else {
    btn.textContent = '手動でコピー';
    setTimeout(() => { btn.textContent = 'コピー'; }, 2000);
  }
}

// ============================================================
//  Modal
// ============================================================
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
    document.getElementById('fTitle').value = '';
    document.getElementById('fPrompt').value = '';
    document.getElementById('fTags').value = '';
    document.getElementById('fMemo').value = '';
    editImages = [];
  }
  renderImgPreview();
  document.getElementById('editOverlay').classList.add('show');
  setTimeout(() => document.getElementById('fTitle').focus(), 100);
}

function closeModal() {
  document.getElementById('editOverlay').classList.remove('show');
  editId = null;
  editImages = [];
}

function renderImgPreview() {
  const list = document.getElementById('imgPreviewList');
  list.innerHTML = editImages.map((img, i) => `
    <div class="img-preview-item">
      <img src="${img.data}" alt="">
      <button class="del-img" data-delidx="${i}">✕</button>
    </div>
  `).join('') + `
    <button class="img-add-btn" id="imgAddBtn">
      <span>＋</span>追加
    </button>
  `;
  list.querySelectorAll('[data-delidx]').forEach(btn => {
    btn.addEventListener('click', () => {
      editImages.splice(parseInt(btn.dataset.delidx), 1);
      renderImgPreview();
    });
  });
  document.getElementById('imgAddBtn').addEventListener('click', () => {
    document.getElementById('imgInput').click();
  });
}

async function handleAddImages(event) {
  const files = Array.from(event.target.files);
  for (const file of files) {
    const data = await resizeImage(file, 800, 800, 0.75);
    editImages.push({ data, id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) });
  }
  event.target.value = '';
  renderImgPreview();
}

async function save() {
  const title = document.getElementById('fTitle').value.trim();
  const prompt = document.getElementById('fPrompt').value.trim();
  if (!title || !prompt) { toast('タイトルとプロンプトは必須です'); return; }
  const tags = document.getElementById('fTags').value.split(',').map(t => t.trim()).filter(Boolean);
  const memo = document.getElementById('fMemo').value.trim();

  const promptId = editId || Date.now().toString();

  let thumbData = null;
  if (editImages.length > 0) {
    thumbData = await makeThumb(editImages[0].data, 400);
  }

  const promptData = {
    id: promptId, title, prompt, tags, memo, thumbData,
    imageCount: editImages.length,
    createdAt: editId ? (prompts.find(x => x.id === editId)?.createdAt || Date.now()) : Date.now(),
    updatedAt: Date.now()
  };

  await dbPut('prompts', promptData);

  await dbClearByIndex('images', 'promptId', promptId);
  for (let i = 0; i < editImages.length; i++) {
    await dbPut('images', {
      id: editImages[i].id || 'img_' + Date.now() + '_' + i,
      promptId, data: editImages[i].data, order: i
    });
  }

  const idx = prompts.findIndex(x => x.id === promptId);
  if (idx >= 0) {
    prompts[idx] = promptData;
  } else {
    prompts.unshift(promptData);
  }

  closeModal();
  render();
  toast('保存しました');
}

async function del(id) {
  if (!confirm('削除しますか？')) return;
  await dbDelete('prompts', id);
  await dbClearByIndex('images', 'promptId', id);
  setPrompts(prompts.filter(x => x.id !== id));
  render();
  toast('削除しました');
}

// ============================================================
//  Module interface
// ============================================================
registerMode('prompts', {
  init() { initEvents(); render(); },
  show() { render(); },
  hide() {}
});
