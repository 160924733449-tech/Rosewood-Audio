const DB_NAME = 'AuraPlayerDB';
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
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
    };
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
