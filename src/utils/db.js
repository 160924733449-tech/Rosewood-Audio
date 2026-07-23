const DB_NAME = 'AuraPlayerDB';
const DB_VERSION = 2;

// Singleton DB connection — avoids ~5-15ms indexedDB.open() overhead on every call
let dbInstance = null;
let dbPromise = null;

export function openDB() {
  // Return cached connection if still valid
  if (dbInstance) return Promise.resolve(dbInstance);
  // Deduplicate concurrent open requests
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      dbPromise = null;
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      // If the connection closes unexpectedly, clear the singleton
      dbInstance.onclose = () => { dbInstance = null; dbPromise = null; };
      dbInstance.onversionchange = () => { dbInstance.close(); dbInstance = null; dbPromise = null; };
      dbPromise = null;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Store cached tracks (both local file handles and cached cloud file metadata)
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }

      // Store play history logs
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        historyStore.createIndex('trackId', 'trackId', { unique: false });
        historyStore.createIndex('playedAt', 'playedAt', { unique: false });
      }

      // Store user playlists
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }

      // Store local taste affinity ratings
      if (!db.objectStoreNames.contains('affinity')) {
        db.createObjectStore('affinity', { keyPath: 'key' });
      }

      // Store raw offline audio blobs for native playback
      if (!db.objectStoreNames.contains('audioBlobs')) {
        const audioStore = db.createObjectStore('audioBlobs', { keyPath: 'id' });
        audioStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });

  return dbPromise;
}

// Audio Blob operations (Offline Cache)
export async function saveAudioBlobToIDB(id, blob, mimeType) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('audioBlobs', 'readwrite');
    const store = tx.objectStore('audioBlobs');
    const request = store.put({
      id,
      blob,
      mimeType,
      size: blob.size,
      timestamp: Date.now()
    });
    
    request.onsuccess = () => {
      resolve();
      // Trigger cache limit enforcement in the background after write completes
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => enforceCacheLimit().catch(() => {}));
      } else {
        setTimeout(() => enforceCacheLimit().catch(() => {}), 0);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAudioBlobFromIDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    // CRITICAL: Use 'readonly' for the read path — readonly transactions never block
    // behind pending readwrite transactions, making blob reads instant.
    const tx = db.transaction('audioBlobs', 'readonly');
    const store = tx.objectStore('audioBlobs');
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
        // Deferred LRU timestamp update — fire-and-forget, never blocks the caller.
        // This runs in a separate transaction so the blob is already returned to the player.
        try {
          const writeTx = db.transaction('audioBlobs', 'readwrite');
          const writeStore = writeTx.objectStore('audioBlobs');
          writeStore.put({ ...request.result, timestamp: Date.now() });
        } catch {}
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedAudioIds() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('audioBlobs', 'readonly');
    const store = tx.objectStore('audioBlobs');
    const request = store.getAllKeys();
    
    request.onsuccess = () => {
      resolve(new Set(request.result || []));
    };
    request.onerror = () => reject(request.error);
  });
}

// Enforce cache limit (250MB default)
// Uses cursor-based eviction to avoid loading all audio blobs into memory.
// Walks the timestamp index (oldest first) and deletes until under budget.
export async function enforceCacheLimit(maxBytes = 250 * 1024 * 1024) {
  const db = await openDB();

  // Step 1: Compute total size and collect metadata (without loading blobs)
  const metadata = await new Promise((resolve, reject) => {
    const tx = db.transaction('audioBlobs', 'readonly');
    const store = tx.objectStore('audioBlobs');
    const index = store.index('timestamp');
    const items = [];
    const cursorReq = index.openCursor();

    cursorReq.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        // Only read id, size, timestamp — NOT the blob itself
        items.push({ id: cursor.value.id, size: cursor.value.size || 0, timestamp: cursor.value.timestamp || 0 });
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });

  let totalSize = metadata.reduce((sum, r) => sum + r.size, 0);
  if (totalSize <= maxBytes) return { totalSize, deletedCount: 0 };

  // Step 2: Delete oldest entries in a single readwrite transaction
  // metadata is already sorted by timestamp (walked via index)
  let deletedCount = 0;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('audioBlobs', 'readwrite');
    const store = tx.objectStore('audioBlobs');

    for (const item of metadata) {
      if (totalSize <= maxBytes) break;
      store.delete(item.id);
      totalSize -= item.size;
      deletedCount++;
    }

    tx.oncomplete = () => resolve({ totalSize, deletedCount });
    tx.onerror = () => reject(tx.error);
  });
}

// Track operations
export async function saveTrack(track) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const request = store.put(track);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveTracks(tracks) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    tracks.forEach(track => store.put(track));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readonly');
    const store = tx.objectStore('tracks');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Playlist operations
export async function getAllPlaylists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readonly');
    const store = tx.objectStore('playlists');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePlaylist(playlist) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const request = store.put(playlist);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deletePlaylist(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// History operations
export async function logPlay(trackId, completed = false) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite');
    const store = tx.objectStore('history');
    const log = {
      trackId,
      playedAt: Date.now(),
      completed
    };
    const request = store.add(log);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPlayHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readonly');
    const store = tx.objectStore('history');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Affinity operations
export async function getAffinity(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('affinity', 'readonly');
    const store = tx.objectStore('affinity');
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || { key, score: 0 });
    request.onerror = () => reject(request.error);
  });
}

export async function saveAffinity(key, score) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('affinity', 'readwrite');
    const store = tx.objectStore('affinity');
    const request = store.put({ key, score });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getAllAffinities() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('affinity', 'readonly');
    const store = tx.objectStore('affinity');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
