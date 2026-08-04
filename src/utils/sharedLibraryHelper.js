import { db } from '../config/firebase';
import { collection, getDocs, getDocsFromCache, deleteDoc, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAudioBlobFromIDB, saveAudioBlobToIDB, getAllCachedAudioIds } from './db';
import { enrichQuranTrack, enrichTrackList } from './metadataHelper';

// In-memory URL cache — eliminates repeated IDB reads for the same track.
// Once a blob URL is created, subsequent calls resolve in microseconds.
// Capped at 15 items using LRU eviction to prevent memory bloat over extended listening sessions.
const MAX_STREAM_CACHE_SIZE = 15;
const streamUrlCache = new Map();

function setStreamCache(id, value) {
  if (streamUrlCache.has(id)) {
    streamUrlCache.delete(id);
  }
  streamUrlCache.set(id, value);

  if (streamUrlCache.size > MAX_STREAM_CACHE_SIZE) {
    const oldestKey = streamUrlCache.keys().next().value;
    const oldestVal = streamUrlCache.get(oldestKey);
    if (oldestVal && oldestVal.blobUrl && oldestVal.blobUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(oldestVal.blobUrl);
      } catch (e) {}
    }
    streamUrlCache.delete(oldestKey);

  }
}

export function isStreamCached(trackId) {
  return streamUrlCache.has(trackId);
}

export function isStreamCachedUrl(url) {
  if (!url) return false;
  for (const val of streamUrlCache.values()) {
    if (val.blobUrl === url) return true;
  }
  return false;
}

/**
 * Pre-warms the in-memory cache on app boot.
 * Reads all cached track IDs from IDB and pre-creates blob URLs so
 * the very first play of any cached track is instant (no IDB read at play time).
 * Call this once during app initialization.
 */
export async function warmStreamCache() {
  try {
    const cachedIds = await getAllCachedAudioIds();
    if (!cachedIds || cachedIds.size === 0) return;

    // Pre-load blobs in parallel (capped at MAX_STREAM_CACHE_SIZE to avoid memory pressure)
    const ids = [...cachedIds].slice(0, MAX_STREAM_CACHE_SIZE);
    const BATCH_SIZE = 5;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (id) => {
          if (streamUrlCache.has(id)) return;
          try {
            const localCache = await getAudioBlobFromIDB(id);
            if (localCache && localCache.blob) {
              setStreamCache(id, {
                blobUrl: URL.createObjectURL(localCache.blob),
                artworkUrl: null,
                blob: localCache.blob,
                isPreview: false,
              });
            }
          } catch {}
        })
      );
    }

  } catch (err) {
    console.warn('[StreamCache] Warm cache failed (non-critical):', err);
  }
}

/**
 * User Permissions Management
 */
export async function checkUserPrivateAccess(username) {
  if (!username) return false;
  try {
    const docRef = doc(db, 'userPermissions', username.toLowerCase());
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().hasPrivateAccess) {
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to check user permissions:", err);
    return false;
  }
}

export async function grantPrivateAccess(username) {
  if (!username) return false;
  try {
    const docRef = doc(db, 'userPermissions', username.toLowerCase());
    await setDoc(docRef, { hasPrivateAccess: true, grantedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.error("Failed to grant private access:", err);
    return false;
  }
}

export async function revokePrivateAccess(username) {
  if (!username) return false;
  try {
    const docRef = doc(db, 'userPermissions', username.toLowerCase());
    await setDoc(docRef, { hasPrivateAccess: false, revokedAt: Date.now() }, { merge: true });
    return true;
  } catch (err) {
    console.error("Failed to revoke private access:", err);
    return false;
  }
}

/**
 * Fetches the list of audio files from the shared library.
 * Tries Firestore cache first for instant offline-first load,
 * then silently refreshes from server.
 * Filters by appMode ('public' or 'private').
 */
export async function fetchSharedLibraryTracks(appMode = 'public') {
  const parseDocs = (snapshot) => {
    const tracks = [];
    snapshot.forEach(d => {
      const data = d.data();
      // Only keep Cloudinary tracks that match the requested folder mode
      if (data.source === 'cloudinary' && data.url) {
        const trackFolder = data.folder === 'private' ? 'private' : 'public';
        if (trackFolder === appMode) {
          tracks.push(data);
        }
      }
    });
    return enrichTrackList(tracks);
  };

  try {
    const libraryRef = collection(db, 'libraryMetadata');

    // 1. Try local Firestore cache first
    try {
      const cachedSnapshot = await getDocsFromCache(libraryRef);
      if (!cachedSnapshot.empty) {
        const cachedTracks = parseDocs(cachedSnapshot);


        // 2. Silently refresh from server in the background, clean up old drive tracks, and self-heal Quran metadata
        getDocs(libraryRef).then(snapshot => {
          snapshot.forEach(d => {
            const data = d.data();
            if (data.source === 'shared' || !data.url) {
              deleteDoc(doc(db, 'libraryMetadata', d.id)).catch(() => {});
            } else {
              const enriched = enrichQuranTrack(data);
              if (enriched && (enriched.title !== data.title || enriched.artist !== data.artist)) {
                updateDoc(doc(db, 'libraryMetadata', d.id), {
                  title: enriched.title,
                  artist: enriched.artist,
                  album: enriched.album,
                  genre: enriched.genre
                }).catch(() => {});
              }
            }
          });
        }).catch(() => {});

        return cachedTracks;
      }
    } catch {
      // Cache miss — fall through to network fetch
    }

    // 3. Network fetch (first load or cache miss)
    const snapshot = await getDocs(libraryRef);
    if (!snapshot.empty) {
      // Actively clean up dead Google Drive links and self-heal Quran metadata in the database
      snapshot.forEach(d => {
        const data = d.data();
        if (data.source === 'shared' || !data.url) {
          deleteDoc(doc(db, 'libraryMetadata', d.id)).catch(() => {});
        } else {
          const enriched = enrichQuranTrack(data);
          if (enriched && (enriched.title !== data.title || enriched.artist !== data.artist)) {
            updateDoc(doc(db, 'libraryMetadata', d.id), {
              title: enriched.title,
              artist: enriched.artist,
              album: enriched.album,
              genre: enriched.genre
            }).catch(() => {});
          }
        }
      });
      return parseDocs(snapshot);
    }
    return [];
  } catch (err) {
    console.error("Failed to load library from Firebase:", err);
    return [];
  }
}

/**
 * Deletes a track from the shared library metadata.
 */
export async function deleteSharedTrack(trackId) {
  try {
    await deleteDoc(doc(db, 'libraryMetadata', trackId));

    return true;
  } catch (error) {
    console.error(`Error deleting track ${trackId}:`, error);
    return false;
  }
}

/**
 * Gets a blob URL for a given track, checking Local IDB first for offline playback.
 * If not in IDB, it returns the direct Cloudinary URL.
 *
 * Optimizations:
 * - In-memory cache: second call for any track is instant (no IDB read).
 * - 150ms IDB timeout: if IDB is slow/corrupted, falls through to CDN immediately.
 */
export async function getStreamUrlForTrack(track, abortSignal = null) {
  if (!track.url) {
    return null;
  }

  // 0. Check in-memory cache — resolves in microseconds
  if (streamUrlCache.has(track.id)) {
    const cached = streamUrlCache.get(track.id);
    // Refresh LRU position by deleting and re-setting
    streamUrlCache.delete(track.id);
    streamUrlCache.set(track.id, cached);

    return cached;
  }

  // 1. Check Local IDB Cache with a tight 150ms timeout.
  //    If IDB is slow (e.g. large DB, device under memory pressure), we fall through
  //    to the CDN URL immediately so playback isn't blocked.
  try {
    const idbResult = await Promise.race([
      getAudioBlobFromIDB(track.id),
      new Promise((resolve) => setTimeout(() => resolve(null), 150)),
    ]);

    if (idbResult && idbResult.blob) {

      const result = {
        blobUrl: URL.createObjectURL(idbResult.blob),
        artworkUrl: null,
        blob: idbResult.blob,
        isPreview: false,
      };
      // Store in memory so next access is instant
      setStreamCache(track.id, result);
      return result;
    }
  } catch (err) {
    console.warn('[Stream] Local cache read failed, falling back:', err);
  }

  // 2. Return the Cloudinary CDN URL directly so the <audio> element can stream it efficiently
  return { blobUrl: track.url, blob: null, isPreview: false };
}
