import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { getAudioBlobFromIDB, saveAudioBlobToIDB } from './db';

/**
 * Fetches the list of audio files from the shared library.
 * It strictly checks Firebase Firestore for the tracklist (Cloudinary tracks).
 */
export async function fetchSharedLibraryTracks() {
  try {
    const libraryRef = collection(db, 'libraryMetadata');
    const snapshot = await getDocs(libraryRef);
    
    if (!snapshot.empty) {
      const cachedTracks = [];
      snapshot.forEach(doc => {
        cachedTracks.push(doc.data());
      });
      return cachedTracks;
    }
    return [];
  } catch (err) {
    console.error("Failed to load library from Firebase:", err);
    return [];
  }
}

/**
 * Gets a blob URL for a given track, checking Local IDB first for offline playback.
 * If not in IDB, it returns the direct Cloudinary URL.
 * (Note: We removed eager background caching here because it races with the <audio> tag
 * and causes severe playback latency. Users can manually 'Sync Offline' instead).
 */
export async function getStreamUrlForTrack(track, abortSignal = null) {
  if (!track.url) {
    return null;
  }

  // 1. Check Local Native Offline Cache first (Instant, zero-bandwidth Path)
  try {
    const localCache = await getAudioBlobFromIDB(track.id);
    if (localCache && localCache.blob) {
      console.log(`[Stream] LOCAL CACHE HIT for ${track.name || track.title}. Playing offline instantly.`);
      return { blobUrl: URL.createObjectURL(localCache.blob), artworkUrl: null, blob: localCache.blob, isPreview: false };
    }
  } catch (err) {
    console.warn('[Stream] Local cache read failed, falling back:', err);
  }

  // 2. Return the Cloudinary CDN URL directly so the <audio> element can stream it efficiently
  return { blobUrl: track.url, blob: null, isPreview: false };
}
