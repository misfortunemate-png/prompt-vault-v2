const DB_NAME = 'prompt-vault';
const DB_VER = 1;
let db = null;

export async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('prompts')) {
        d.createObjectStore('prompts', { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains('images')) {
        const s = d.createObjectStore('images', { keyPath: 'id' });
        s.createIndex('promptId', 'promptId', { unique: false });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(stores, mode) {
  const t = db.transaction(stores, mode);
  const s = stores.length === 1 ? t.objectStore(stores[0]) : stores.map(n => t.objectStore(n));
  return { t, s };
}

export function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const { s } = tx([storeName], 'readonly');
    const req = s.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function dbPut(storeName, data) {
  return new Promise((resolve, reject) => {
    const { t, s } = tx([storeName], 'readwrite');
    s.put(data);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const { t, s } = tx([storeName], 'readwrite');
    s.delete(key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export function dbGetByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const { s } = tx([storeName], 'readonly');
    const idx = s.index(indexName);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function dbClearByIndex(storeName, indexName, value) {
  return new Promise((resolve, reject) => {
    const { t, s } = tx([storeName], 'readwrite');
    const idx = s.index(indexName);
    const req = idx.openCursor(value);
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
