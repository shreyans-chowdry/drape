// Local-first storage. Every profile gets its own IndexedDB database,
// so each person's wardrobe lives only on their own device.

const LS_PROFILES = 'drape.profiles';
const LS_ACTIVE = 'drape.activeProfile';
const STORES = ['items', 'outfits', 'wears', 'prefs'];

function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function listProfiles() {
  const list = lsGet(LS_PROFILES, null);
  if (list && list.length) return list;
  const def = [{ id: 'me', name: 'Me' }];
  lsSet(LS_PROFILES, def);
  return def;
}
export function activeProfile() {
  const list = listProfiles();
  const id = lsGet(LS_ACTIVE, list[0].id);
  return list.find(p => p.id === id) || list[0];
}
export function setActiveProfile(id) { lsSet(LS_ACTIVE, id); }
export function addProfile(name) {
  const list = listProfiles();
  const p = { id: uid().slice(0, 8), name };
  list.push(p);
  lsSet(LS_PROFILES, list);
  return p;
}
export function renameProfile(id, name) {
  lsSet(LS_PROFILES, listProfiles().map(p => (p.id === id ? { ...p, name } : p)));
}
export async function deleteProfile(id) {
  const list = listProfiles().filter(p => p.id !== id);
  lsSet(LS_PROFILES, list.length ? list : [{ id: 'me', name: 'Me' }]);
  if (_db && _dbName === dbName(id)) { _db.close(); _db = null; }
  await new Promise(res => {
    const r = indexedDB.deleteDatabase(dbName(id));
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

const dbName = id => `drape-${id}`;
let _db = null, _dbName = null;

export function open() {
  const name = dbName(activeProfile().id);
  if (_db && _dbName === name) return Promise.resolve(_db);
  if (_db) _db.close();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; _dbName = name; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
  });
}

export const all = store => tx(store, 'readonly', s => s.getAll());
export const get = (store, id) => tx(store, 'readonly', s => s.get(id));
export const put = (store, value) => tx(store, 'readwrite', s => s.put(value));
export const del = (store, id) => tx(store, 'readwrite', s => s.delete(id));
export const clear = store => tx(store, 'readwrite', s => s.clear());

export async function getPref(key, fallback) {
  const row = await get('prefs', key);
  return row ? row.value : fallback;
}
export const setPref = (key, value) => put('prefs', { id: key, value });

// ---- Backup: JSON with images inlined as data URLs ----
const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();

export async function exportAll() {
  const out = { app: 'drape', version: 1, exportedAt: new Date().toISOString(), profile: activeProfile().name };
  for (const s of STORES) {
    const rows = await all(s);
    if (s === 'items') {
      for (const r of rows) {
        if (r.photo instanceof Blob) r.photo = await blobToDataURL(r.photo);
        if (r.thumb instanceof Blob) r.thumb = await blobToDataURL(r.thumb);
      }
    }
    out[s] = rows;
  }
  return out;
}

export async function importAll(data, { replace = false } = {}) {
  if (!data || data.app !== 'drape') throw new Error('That file is not a Drape backup.');
  for (const s of STORES) {
    if (replace) await clear(s);
    for (const r of data[s] || []) {
      if (s === 'items') {
        if (typeof r.photo === 'string') r.photo = await dataURLToBlob(r.photo);
        if (typeof r.thumb === 'string') r.thumb = await dataURLToBlob(r.thumb);
      }
      await put(s, r);
    }
  }
}
