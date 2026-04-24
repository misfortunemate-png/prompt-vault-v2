import { prompts, registerMode } from './state.js';

function renderGlobalCatalog() {
  const grid = document.getElementById('globalCatalogGrid');
  if (!grid) return;
  const withImages = prompts.filter(p => p.imageCount > 0 && p.thumbData);
  if (!withImages.length) {
    grid.innerHTML = '<div class="empty">— 画像のあるプロンプトがありません —</div>';
    return;
  }
  grid.innerHTML = withImages.map(p =>
    `<div class="global-catalog-cell" data-gcview="${p.id}">
      <img src="${p.thumbData}" alt="" loading="lazy">
      ${p.imageCount > 1 ? `<span class="gc-count">${p.imageCount}</span>` : ''}
    </div>`
  ).join('');
}

function initEvents() {
  document.getElementById('globalCatalogGrid')?.addEventListener('click', e => {
    const cell = e.target.closest('[data-gcview]');
    if (cell) document.dispatchEvent(new CustomEvent('pv:openViewer', { detail: cell.dataset.gcview }));
  });
}

registerMode('catalog', {
  init() { initEvents(); },
  show() { renderGlobalCatalog(); },
  hide() {}
});
