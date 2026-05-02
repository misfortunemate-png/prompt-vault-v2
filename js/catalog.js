import { dbGetAll } from './db.js';
import { prompts, registerMode } from './state.js';

// §1§2§4: カタログ全画像フラット表示・ソート・タグフィルタ
let allImages = [];
let filteredImages = [];
let activeTags = new Set();
let sortKey = 'createdAt';
let sortAsc = false;
let observer = null;

// カタログモード表示時に全画像を取得してレンダリング
async function show() {
  const grid = document.getElementById('globalCatalogGrid');
  if (grid) grid.innerHTML = '<div class="empty">読み込み中…</div>';
  allImages = await dbGetAll('images');
  renderTagFilter();
  applyFilterAndSort();
}

// §4: タグフィルタ + §2: ソートを適用して描画
function applyFilterAndSort() {
  // §4: タグフィルタ（AND条件）
  let imgs = allImages;
  if (activeTags.size > 0) {
    imgs = allImages.filter(img => {
      const p = prompts.find(x => x.id === img.promptId);
      return p && [...activeTags].every(t => (p.tags || []).includes(t));
    });
  }

  // §2: プロンプト単位でグループソート。グループ内はorder順を維持
  const promptOrder = buildPromptOrder();
  imgs = [...imgs].sort((a, b) => {
    const ai = promptOrder.get(a.promptId) ?? 0;
    const bi = promptOrder.get(b.promptId) ?? 0;
    if (ai !== bi) return ai - bi;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  filteredImages = imgs;
  renderGrid();
}

// ソートキー・昇降に基づいてpromptId→表示順インデックスのMapを生成
function buildPromptOrder() {
  const seen = new Set();
  const promptsWithImages = [];
  allImages.forEach(img => {
    if (!seen.has(img.promptId)) {
      seen.add(img.promptId);
      promptsWithImages.push(img.promptId);
    }
  });

  const sorted = [...promptsWithImages].sort((a, b) => {
    const pa = prompts.find(x => x.id === a);
    const pb = prompts.find(x => x.id === b);
    let va, vb;
    if (sortKey === 'title') {
      va = pa?.title?.toLowerCase() || '';
      vb = pb?.title?.toLowerCase() || '';
    } else {
      va = pa?.[sortKey] || 0;
      vb = pb?.[sortKey] || 0;
    }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const map = new Map();
  sorted.forEach((id, i) => map.set(id, i));
  return map;
}

// §1: グリッド描画（Intersection Observerで遅延読み込み）
function renderGrid() {
  const grid = document.getElementById('globalCatalogGrid');
  if (!grid) return;

  if (observer) { observer.disconnect(); observer = null; }

  if (!filteredImages.length) {
    grid.innerHTML = '<div class="empty">— 画像のあるプロンプトがありません —</div>';
    return;
  }

  // data-src属性に巨大なdata URLを埋め込まず、インデックスで filteredImages を参照する
  grid.innerHTML = filteredImages.map((_, i) =>
    `<div class="global-catalog-cell" data-gcidx="${i}">
      <img alt="" style="opacity:0;transition:opacity 0.2s">
    </div>`
  ).join('');

  // §1: Intersection Observerで画面内セルのみ画像を設定
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const cell = entry.target;
      const imgEl = cell.querySelector('img');
      const idx = +cell.dataset.gcidx;
      if (imgEl && !imgEl.src && filteredImages[idx]) {
        imgEl.src = filteredImages[idx].data;
        imgEl.onload = () => { imgEl.style.opacity = 1; };
      }
      observer.unobserve(cell);
    });
  }, { rootMargin: '200px' });

  grid.querySelectorAll('.global-catalog-cell').forEach(cell => observer.observe(cell));
}

// §4: タグフィルタUI描画
function renderTagFilter() {
  const container = document.getElementById('catalogTagFilter');
  if (!container) return;
  const tagSet = new Set();
  prompts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));
  const tags = [...tagSet].sort();
  if (!tags.length) { container.innerHTML = ''; return; }
  container.innerHTML = tags.map(t =>
    `<button class="tag-btn${activeTags.has(t) ? ' active' : ''}" data-ctag="${t}">${t}</button>`
  ).join('');
}

// §3: カタログセルクリック→横断スライドショーイベント発行
function initEvents() {
  document.getElementById('globalCatalogGrid')?.addEventListener('click', e => {
    const cell = e.target.closest('[data-gcidx]');
    if (!cell) return;
    document.dispatchEvent(new CustomEvent('pv:openViewerBatch', {
      detail: { images: filteredImages, startIndex: +cell.dataset.gcidx }
    }));
  });

  // §4: タグフィルタクリック
  document.getElementById('catalogTagFilter')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-ctag]');
    if (!btn) return;
    const t = btn.dataset.ctag;
    if (activeTags.has(t)) activeTags.delete(t); else activeTags.add(t);
    btn.classList.toggle('active', activeTags.has(t));
    applyFilterAndSort();
  });

  // §2: ソートキー変更
  document.getElementById('catalogSortKey')?.addEventListener('change', e => {
    sortKey = e.target.value;
    applyFilterAndSort();
  });

  // §2: 昇降ボタン
  document.getElementById('catalogSortDir')?.addEventListener('click', () => {
    sortAsc = !sortAsc;
    const btn = document.getElementById('catalogSortDir');
    btn.dataset.asc = String(sortAsc);
    btn.textContent = sortAsc ? '↑' : '↓';
    applyFilterAndSort();
  });
}

registerMode('catalog', {
  init() { initEvents(); },
  show() { show(); },
  hide() {}
});
