let db = null;

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('prompt-vault', 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('prompts')) d.createObjectStore('prompts', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('images')) {
        const s = d.createObjectStore('images', { keyPath: 'id' });
        s.createIndex('promptId', 'promptId', { unique: false });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  const t = db.transaction([store], mode);
  return { t, s: t.objectStore(store) };
}

export function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const { s } = tx(store, 'readonly');
    const r = s.getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function dbPut(store, data) {
  return new Promise((resolve, reject) => {
    const { t, s } = tx(store, 'readwrite');
    s.put(data);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const { t, s } = tx(store, 'readwrite');
    s.delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function dbGetByIndex(store, idx, val) {
  return new Promise((resolve, reject) => {
    const { s } = tx(store, 'readonly');
    const r = s.index(idx).getAll(val);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function dbClearByIndex(store, idx, val) {
  return new Promise((resolve, reject) => {
    const { t, s } = tx(store, 'readwrite');
    const r = s.index(idx).openCursor(val);
    r.onsuccess = e => { const c = e.target.result; if (c) { c.delete(); c.continue(); } };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
