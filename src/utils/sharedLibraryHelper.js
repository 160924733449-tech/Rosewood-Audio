import { APPS_SCRIPT_URL } from '../config';
import { getAudioFromCache, saveAudioToCache } from './storageCacheHelper';
/**
 * Map of file extensions to proper MIME types.
 * This prevents playback failures caused by incorrect MIME types when creating audio Blobs.
 */
const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus',
  '.wma': 'audio/x-ms-wma',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
};

/** Audio file extensions we accept from the library */
const AUDIO_EXTENSIONS_REGEX = /\.(mp3|flac|wav|m4a|ogg|aac|opus|wma|mp4|webm)$/i;

/**
 * Derives the correct MIME type from a filename's extension.
 * Falls back to the server-reported MIME, then to 'audio/mpeg' as a safe default
 * (browsers handle audio/mpeg more gracefully than audio/mp4 for unknown content).
 */
function getMimeType(filename, serverMime) {
  if (filename) {
    const match = filename.match(/(\.[^.]+)$/);
    if (match) {
      const mapped = MIME_MAP[match[1].toLowerCase()];
      if (mapped) return mapped;
    }
  }
  // Only trust server MIME if it's actually an audio type
  if (serverMime && serverMime.startsWith('audio/')) {
    return serverMime;
  }
  return 'audio/mpeg'; // safest default — browsers are very good at decoding mp3
}

import { db } from '../config/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

/**
 * Fetches the list of audio files from the shared library.
 * It first checks Firebase Firestore for a cached tracklist.
 * If empty, it fetches from the Google Apps Script and saves the result to Firestore.
 */
export async function fetchSharedLibraryTracks() {
  try {
    // 1. Try to load from Firebase first (Fast)
    const libraryRef = collection(db, 'libraryMetadata');
    const snapshot = await Promise.race([
      getDocs(libraryRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 3000))
    ]);
    if (!snapshot.empty) {
      const cachedTracks = [];
      snapshot.forEach(doc => {
        cachedTracks.push(doc.data());
      });
      return cachedTracks;
    }
  } catch (err) {
    console.warn("Failed to load library from Firebase, falling back to Apps Script:", err);
  }

  // 2. If Firebase is empty, load from Google Apps Script (Slow)
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('YOUR_APPS_SCRIPT_')) {
    console.warn('Apps Script URL is not configured. Returning empty library.');
    return [];
  }

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=list`);
    if (!res.ok) throw new Error('Failed to fetch from script: ' + res.statusText);

    const files = await res.json();
    if (!Array.isArray(files)) {
      console.warn('Expected array from Apps Script, got:', files);
      return [];
    }

    // Filter out folders, images, or other non-audio files to prevent playlist issues
    const tracks = files
      .filter(file => file && file.id && file.name && (
        (file.mime && file.mime.startsWith('audio/')) ||
        file.name.match(AUDIO_EXTENSIONS_REGEX)
      ))
      .map(file => {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const parts = cleanName.split(' - ');
        let artist = 'Unknown Artist';
        let title = cleanName;

        if (parts.length > 1) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        const resolvedMime = getMimeType(file.name, file.mime);

        return {
          id: `shared:${file.id}`,
          name: file.name,
          title,
          artist,
          album: 'Shared Library',
          genre: 'Cloud Music',
          year: '',
          size: file.size || 0,
          mime: resolvedMime,
          source: 'shared',
          driveFileId: file.id
        };
      });

    // 3. Save the fetched tracks to Firebase so the next load is instant
    try {
      const batch = writeBatch(db);
      tracks.forEach(track => {
        const trackRef = doc(db, 'libraryMetadata', track.id);
        batch.set(trackRef, track);
      });
      batch.commit()
        .then(() => console.log("Successfully cached library in Firebase."))
        .catch(err => console.error("Failed to cache library in Firebase:", err));
    } catch (err) {
      console.error("Failed to cache library in Firebase:", err);
    }

    return tracks;
  } catch (err) {
    console.error('Error loading shared library tracks:', err);
    return [];
  }
}

/**
 * Decodes a base64 string to a Uint8Array in chunks.
 * Using chunked decoding avoids call-stack overflow on large files
 * (the charCodeAt loop can choke on multi-MB strings in some engines).
 */
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  // Process in 8KB chunks to avoid potential perf issues
  const CHUNK = 8192;
  for (let offset = 0; offset < len; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, len);
    for (let i = offset; i < end; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
  }
  return bytes;
}

/**
 * Returns a playable blob: URL for a shared Google Drive audio file.
 * The Apps Script encodes the raw audio bytes as base64 text (via Utilities.base64Encode).
 * We decode the base64 response back to binary, wrap it in a Blob with the correct MIME type,
 * and return a blob: URL the audio element can play.
 *
 * Includes 1 automatic retry for transient network / Apps Script failures.
 * Returns null quickly for files the Apps Script can't serve (e.g., 0-byte / unindexed files)
 * so the caller can auto-skip to the next track without long delays.
 */
export async function getStreamUrlForTrack(track, retries = 1, abortSignal = null) {
  if (!track.driveFileId) {
    return { blobUrl: track.url, blob: null };
  }

  // 1. Check Firebase Storage cache first (Fast Path)
  const cachedData = await getAudioFromCache(track.id);
  if (cachedData && cachedData.url) {
    console.log(`[Stream] Cache hit for ${track.name}. Streaming from Firebase Storage.`);
    return { blobUrl: cachedData.url, artworkUrl: cachedData.artworkUrl, blob: null };
  }

  // 2. Fallback to slow Apps Script Base64 fetch
  const streamUrl = `${APPS_SCRIPT_URL}?action=stream&id=${track.driveFileId}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const fetchOpts = {};
      if (abortSignal) fetchOpts.signal = abortSignal;

      const response = await fetch(streamUrl, fetchOpts);
      if (!response.ok) {
        console.error(`[Stream] Fetch failed (attempt ${attempt + 1}):`, response.status, response.statusText);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        return null;
      }

      const base64Data = await response.text();

      // Validate that the response is actually base64-encoded audio data,
      // not an HTML error page or empty response from Apps Script.
      if (!base64Data || base64Data.length < 100) {
        console.warn(`[Stream] Response too short (${base64Data?.length || 0} chars) — likely empty or error. Track: ${track.name}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        return null;
      }

      // Quick sanity check: base64 should NOT start with '<' (HTML) or '{' (JSON error)
      const firstChar = base64Data.trimStart().charAt(0);
      if (firstChar === '<' || firstChar === '{') {
        console.warn(`[Stream] Response is not base64 (starts with '${firstChar}'). Apps Script may have returned an error page. Track: ${track.name}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        return null;
      }

      // Decode base64 to binary using chunked approach
      const bytes = base64ToUint8Array(base64Data);

      // Additional validation: audio files should have a minimum size (a few KB at least)
      if (bytes.length < 1000) {
        console.warn(`[Stream] Decoded audio is suspiciously small (${bytes.length} bytes). Track: ${track.name}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        return null;
      }

      const mimeType = getMimeType(track.name, track.mime);
      const blob = new Blob([bytes], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);

      console.log(`[Stream] Successfully decoded track: ${track.name} (${(bytes.length / 1024 / 1024).toFixed(1)} MB, MIME: ${mimeType})`);
      
      // Save to Firebase Storage cache in the background
      saveAudioToCache(track.id, blob, mimeType).catch(err => console.warn("Failed to cache audio in background:", err));

      return { blobUrl, blob };

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`[Stream] Fetch aborted for track: ${track.name}`);
        return null;
      }
      console.error(`[Stream] Error on attempt ${attempt + 1} for "${track.name}":`, err);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 800));
        continue;
      }
      return null;
    }
  }

  return null;
}
