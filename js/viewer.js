import { dbGetByIndex } from './db.js';
import { toast } from './utils.js';
import { prompts } from './state.js';

let viewerImages = [], viewerIdx = 0, viewerMode = 'slide', viewerPid = null;

function $(id) { return document.getElementById(id); }

export function initViewer() {
  $('btnModeSlide')?.addEventListener('click', () => setMode('slide'));
  $('btnModeCatalog')?.addEventListener('click', () => setMode('catalog'));
  $('slidePrev')?.addEventListener('click', () => move(-1));
  $('slideNext')?.addEventListener('click', () => move(1));
  $('slideDl')?.addEventListener('click', download);
  $('viewerClose')?.addEventListener('click', close);
  $('slideWrap')?.addEventListener('click', close);
  $('slideImg')?.addEventListener('click', e => e.stopPropagation());

  // Swipe（slideViewは廃止→slideWrapに変更）
  let sx = 0;
  $('slideWrap')?.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  $('slideWrap')?.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) move(dx > 0 ? -1 : 1); }, { passive: true });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!$('viewerOverlay')?.classList.contains('show')) return;
    if (e.key === 'ArrowLeft') move(-1);
    if (e.key === 'ArrowRight') move(1);
    if (e.key === 'Escape') close();
  });

  // Listen for open requests from any module
  document.addEventListener('pv:openViewer', e => open(e.detail));
}

async function open(id) {
  const p = prompts.find(x => x.id === id);
  if (!p || !p.imageCount) return;
  viewerPid = id;
  $('viewerTitle').textContent = p.title;
  const imgs = await dbGetByIndex('images', 'promptId', id);
  imgs.sort((a, b) => a.order - b.order);
  viewerImages = imgs; viewerIdx = 0;
  setMode('slide');
  $('viewerOverlay').classList.add('show');
  updateSlide();
  // ビューアを開く際に横向きを許可
  try { await screen.orientation.unlock(); } catch {}
}

async function close() {
  $('viewerOverlay').classList.remove('show');
  viewerImages = [];
  // ビューアを閉じたら縦向きに戻す
  try { await screen.orientation.lock('portrait'); } catch {}
}

function setMode(m) {
  viewerMode = m;
  $('slideWrap').classList.toggle('hidden', m !== 'slide');
  $('viewerCatalogView').classList.toggle('hidden', m !== 'catalog');
  $('btnModeSlide').classList.toggle('active', m === 'slide');
  $('btnModeCatalog').classList.toggle('active', m === 'catalog');
  if (m === 'slide') updateSlide(); else renderCat();
}

function updateSlide() {
  if (!viewerImages.length) return;
  const img = $('slideImg');
  img.style.opacity = 0;
  setTimeout(() => { img.src = viewerImages[viewerIdx].data; img.style.opacity = 1; }, 80);
  $('slideInfo').textContent = `${viewerIdx + 1} / ${viewerImages.length}`;
  $('slidePrev').disabled = viewerIdx === 0;
  $('slideNext').disabled = viewerIdx === viewerImages.length - 1;
}

function move(dir) { viewerIdx = Math.max(0, Math.min(viewerImages.length - 1, viewerIdx + dir)); updateSlide(); }

function renderCat() {
  $('viewerCatalogGrid').innerHTML = viewerImages.map((img, i) =>
    `<div class="catalog-cell" data-catidx="${i}"><img src="${img.data}" alt="" loading="lazy"><span class="cat-idx">${i + 1}</span></div>`
  ).join('');
  $('viewerCatalogGrid').onclick = e => {
    const cell = e.target.closest('[data-catidx]');
    if (cell) { viewerIdx = +cell.dataset.catidx; setMode('slide'); }
  };
}

function download() {
  if (!viewerImages.length) return;
  const a = document.createElement('a');
  a.href = viewerImages[viewerIdx].data;
  a.download = `pv-${viewerPid}-${viewerIdx + 1}.jpg`;
  a.click(); toast('保存しました');
}
