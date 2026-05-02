import { dbGetByIndex } from './db.js';
import { toast } from './utils.js';
import { prompts, getSettings } from './state.js';

let viewerImages = [], viewerIdx = 0, viewerMode = 'slide', viewerPid = null;

function $(id) { return document.getElementById(id); }

export function initViewer() {
  $('btnModeSlide')?.addEventListener('click', () => setMode('slide'));
  $('btnModeCatalog')?.addEventListener('click', () => setMode('catalog'));
  $('slidePrev')?.addEventListener('click', () => move(-1));
  $('slideNext')?.addEventListener('click', () => move(1));
  $('slideDl')?.addEventListener('click', download);
  $('viewerClose')?.addEventListener('click', close);

  // §5: 四象限タップ操作（slideWrapクリック→close を廃止し四象限判定に変更）
  $('slideWrap')?.addEventListener('click', e => {
    const wrap = $('slideWrap');
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const isRight = x >= rect.width / 2, isBottom = y >= rect.height / 2;
    if (!isBottom && !isRight) close();                // 左上: 閉じる
    else if (!isBottom && isRight) setMode('catalog'); // 右上: カタログ切替
    else if (isBottom && !isRight) move(-1);           // 左下: 前の画像
    else move(1);                                      // 右下: 次の画像
  });

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

  // §3: カタログからの横断スライドショー開始
  document.addEventListener('pv:openViewerBatch', e => openBatch(e.detail.images, e.detail.startIndex));
}

// §3: カタログからバッチ（フィルタ・ソート済み全画像）でビューアを開く
async function openBatch(images, startIndex) {
  if (!images?.length) return;
  viewerImages = images;
  viewerIdx = Math.max(0, Math.min(images.length - 1, startIndex));
  viewerPid = images[viewerIdx]?.promptId || null;
  setMode('slide');
  $('viewerOverlay').classList.add('show');
  updateSlide();
  const orient = getSettings().orientation;
  try {
    if (orient === 'viewer-only' || orient === 'free') await screen.orientation.unlock();
  } catch {}
}

async function open(id) {
  const p = prompts.find(x => x.id === id);
  if (!p || !p.imageCount) return;
  viewerPid = id;
  const imgs = await dbGetByIndex('images', 'promptId', id);
  imgs.sort((a, b) => a.order - b.order);
  viewerImages = imgs; viewerIdx = 0;
  setMode('slide');
  $('viewerOverlay').classList.add('show');
  updateSlide();
  // §6: 方向設定に応じた画面制御（portrait-lock時は何もしない）
  const orient = getSettings().orientation;
  try { if (orient !== 'portrait-lock') await screen.orientation.unlock(); } catch {}
}

async function close() {
  $('viewerOverlay').classList.remove('show');
  viewerImages = [];
  // §6: viewer-onlyのみ縦向きに戻す
  const orient = getSettings().orientation;
  try {
    if (orient === 'viewer-only') await screen.orientation.lock('portrait');
  } catch {}
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
  // §3: 現在画像の親プロンプトタイトルを動的に更新
  const pid = viewerImages[viewerIdx]?.promptId;
  const p = pid ? prompts.find(x => x.id === pid) : null;
  $('viewerTitle').textContent = p?.title || '';
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
