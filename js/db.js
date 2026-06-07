/* DugongID — Local-first data layer (IndexedDB)
 * Everything is stored on this device. No server, no cloud.
 * Stores:
 *   individuals  - one record per identified dugong (ID profile)
 *   sightings    - photo-based encounters (linked to an individual or unmatched)
 *   media        - blobs (photos, videos, pdfs) keyed by id
 *   meta         - app metadata (schema version, etc.)
 */
const DB = (() => {
  const DB_NAME = 'dugongid';
  const DB_VERSION = 1;
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('individuals')) {
          const s = db.createObjectStore('individuals', { keyPath: 'id' });
          s.createIndex('code', 'code', { unique: false });
          s.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('sightings')) {
          const s = db.createObjectStore('sightings', { keyPath: 'id' });
          s.createIndex('individualId', 'individualId', { unique: false });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode = 'readonly') {
    return open().then((db) => db.transaction(store, mode).objectStore(store));
  }

  function put(store, value) {
    return tx(store, 'readwrite').then((os) => new Promise((res, rej) => {
      const r = os.put(value); r.onsuccess = () => res(value); r.onerror = () => rej(r.error);
    }));
  }
  function get(store, key) {
    return tx(store).then((os) => new Promise((res, rej) => {
      const r = os.get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    }));
  }
  function getAll(store) {
    return tx(store).then((os) => new Promise((res, rej) => {
      const r = os.getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    }));
  }
  function del(store, key) {
    return tx(store, 'readwrite').then((os) => new Promise((res, rej) => {
      const r = os.delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    }));
  }
  function getByIndex(store, index, value) {
    return tx(store).then((os) => new Promise((res, rej) => {
      const r = os.index(index).getAll(value); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error);
    }));
  }

  // ---- Media helpers (blobs) ----
  async function saveMedia(blob, kind) {
    const id = crypto.randomUUID();
    try {
      await put('media', { id, blob, kind, size: blob.size, type: blob.type, createdAt: Date.now() });
    } catch (err) {
      if (err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''))) {
        throw new Error('Out of device storage. Export a backup and remove old media, then try again.');
      }
      throw err;
    }
    return id;
  }
  // Cache object URLs so repeated renders don't leak a new blob URL each time.
  const _urlCache = new Map();
  async function getMediaURL(id) {
    if (!id) return null;
    if (_urlCache.has(id)) return _urlCache.get(id);
    const rec = await get('media', id);
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
    _urlCache.set(id, url);
    return url;
  }

  // ---- Export / Import (full backup) ----
  async function exportAll() {
    const [individuals, sightings, mediaRecs] = await Promise.all([
      getAll('individuals'), getAll('sightings'), getAll('media')
    ]);
    // Convert media blobs to base64 for a portable single JSON file
    const media = [];
    for (const m of mediaRecs) {
      const b64 = await blobToBase64(m.blob);
      media.push({ id: m.id, kind: m.kind, type: m.type, size: m.size, createdAt: m.createdAt, data: b64 });
    }
    return {
      app: 'DugongID', schemaVersion: DB_VERSION, exportedAt: new Date().toISOString(),
      individuals, sightings, media
    };
  }

  async function importAll(payload, { merge = true } = {}) {
    if (!payload || payload.app !== 'DugongID') throw new Error('Not a DugongID backup file.');
    if (!merge) {
      await Promise.all(['individuals', 'sightings', 'media'].map(clearStore));
    }
    for (const m of (payload.media || [])) {
      const blob = base64ToBlob(m.data, m.type);
      await put('media', { id: m.id, blob, kind: m.kind, type: m.type, size: m.size, createdAt: m.createdAt });
    }
    for (const i of (payload.individuals || [])) await put('individuals', i);
    for (const s of (payload.sightings || [])) await put('sightings', s);
  }

  function clearStore(store) {
    return tx(store, 'readwrite').then((os) => new Promise((res, rej) => {
      const r = os.clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error);
    }));
  }

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result.split(',')[1]);
      fr.onerror = rej; fr.readAsDataURL(blob);
    });
  }
  function base64ToBlob(b64, type) {
    const bin = atob(b64); const len = bin.length; const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'application/octet-stream' });
  }

  return {
    open, put, get, getAll, del, getByIndex,
    saveMedia, getMediaURL, exportAll, importAll, clearStore, blobToBase64
  };
})();
