import { db } from '../config/firebase';
import { collection, getDocs, getDocsFromCache, deleteDoc, doc } from 'firebase/firestore';
import { getAudioBlobFromIDB, saveAudioBlobToIDB, getAllCachedAudioIds } from './db';

// In-memory URL cache — eliminates repeated IDB reads for the same track.
// Once a blob URL is created, subsequent calls resolve in microseconds.
const streamUrlCache = new Map();

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

    // Pre-load blobs in parallel (capped at 5 concurrent to avoid memory pressure)
    const ids = [...cachedIds];
    const BATCH_SIZE = 5;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (id) => {
          if (streamUrlCache.has(id)) return;
          try {
            const localCache = await getAudioBlobFromIDB(id);
            if (localCache && localCache.blob) {
              streamUrlCache.set(id, {
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
    console.log(`[StreamCache] Warmed ${streamUrlCache.size} tracks into memory.`);
  } catch (err) {
    console.warn('[StreamCache] Warm cache failed (non-critical):', err);
  }
}

/**
 * Fetches the list of audio files from the shared library.
 * Tries Firestore cache first for instant offline-first load,
 * then silently refreshes from server.
 */
export async function fetchSharedLibraryTracks() {
  const parseDocs = (snapshot) => {
    const tracks = [];
    snapshot.forEach(d => {
      const data = d.data();
      // Only keep Cloudinary tracks
      if (data.source === 'cloudinary' && data.url) {
        tracks.push(data);
      }
    });
    return tracks;
  };

  try {
    const libraryRef = collection(db, 'libraryMetadata');

    // 1. Try local Firestore cache first
    try {
      const cachedSnapshot = await getDocsFromCache(libraryRef);
      if (!cachedSnapshot.empty) {
        const cachedTracks = parseDocs(cachedSnapshot);
        console.log(`[Library] Loaded ${cachedTracks.length} tracks from Firestore cache.`);

        // 2. Silently refresh from server in the background and clean up old drive tracks
        getDocs(libraryRef).then(snapshot => {
          snapshot.forEach(d => {
            const data = d.data();
            if (data.source === 'shared' || !data.url) {
              deleteDoc(doc(db, 'libraryMetadata', d.id)).catch(() => {});
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
      // Actively clean up dead Google Drive links from the database
      snapshot.forEach(d => {
        const data = d.data();
        if (data.source === 'shared' || !data.url) {
          deleteDoc(doc(db, 'libraryMetadata', d.id)).catch(() => {});
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
    console.log(`[Library] Deleted track ${trackId}`);
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
    console.log(`[Stream] MEMORY CACHE HIT for ${track.name || track.title}. Instant playback.`);
    return streamUrlCache.get(track.id);
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
      console.log(`[Stream] LOCAL CACHE HIT for ${track.name || track.title}. Playing offline instantly.`);
      const result = {
        blobUrl: URL.createObjectURL(idbResult.blob),
        artworkUrl: null,
        blob: idbResult.blob,
        isPreview: false,
      };
      // Store in memory so next access is instant
      streamUrlCache.set(track.id, result);
      return result;
    }
  } catch (err) {
    console.warn('[Stream] Local cache read failed, falling back:', err);
  }

  // 2. Return the Cloudinary CDN URL directly so the <audio> element can stream it efficiently
  return { blobUrl: track.url, blob: null, isPreview: false };
}
