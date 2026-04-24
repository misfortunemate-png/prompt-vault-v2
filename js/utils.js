let _tid = null;
export function toast(msg, ms = 2000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_tid);
  _tid = setTimeout(() => el.classList.remove('show'), ms);
}

export function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function resizeImage(file, maxW, maxH, quality) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW || h > maxH) { const r = Math.min(maxW / w, maxH / h); w = Math.round(w * r); h = Math.round(h * r); }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function makeThumb(dataUrl, size) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(size / img.width, size / img.height);
      const w = Math.round(img.width * r), h = Math.round(img.height * r);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.6));
    };
    img.src = dataUrl;
  });
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); }
    else {
      const ta = document.createElement('textarea'); ta.value = text;
      ta.style.cssText = 'position:fixed;top:-9999px'; document.body.appendChild(ta);
      ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    return true;
  } catch { return false; }
}

export function showError(msg) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#8b2e2e;color:#fff;padding:12px 16px;font-size:12px;z-index:9999;font-family:monospace;white-space:pre-wrap;cursor:pointer;';
  d.textContent = '⚠ ' + msg;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
}
