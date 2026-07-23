import { db } from '../config/firebase';
import { doc, getDoc, getDocFromCache, setDoc, updateDoc } from 'firebase/firestore';
import { parseMetadata } from './metadataHelper';

const CACHE_COLLECTION = 'audioCache';
const CLOUD_NAME = 'amrqrsph';
const UPLOAD_PRESET = 'ml_default';

/**
 * Checks if a track exists in the cache.
 * Tries local Firestore cache first (instant), then network with 1.5s timeout.
 * @param {string} trackId - The track ID
 * @returns {Promise<Object|null>} The cached URLs, or null if not cached.
 */
export async function getAudioFromCache(trackId) {
  const docRef = doc(db, CACHE_COLLECTION, trackId);

  // 1. Try local Firestore cache first — instant, zero-network
  try {
    const cachedSnap = await getDocFromCache(docRef);
    if (cachedSnap.exists()) {
      const data = cachedSnap.data();
      // Fire-and-forget lastAccessed update — never blocks the return
      updateDoc(docRef, { lastAccessed: Date.now() }).catch(() => {});
      return { url: data.url, artworkUrl: data.artworkUrl || null };
    }
  } catch {
    // Cache miss — fall through to network
  }

  // 2. Network fetch with tight 1.5s timeout
  try {
    const docSnap = await Promise.race([
      getDoc(docRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 1500))
    ]);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Fire-and-forget lastAccessed update
      updateDoc(docRef, { lastAccessed: Date.now() }).catch(() => {});
      return { url: data.url, artworkUrl: data.artworkUrl || null };
    }
  } catch (err) {
    console.warn(`[Storage Cache] Error fetching cache for ${trackId}:`, err);
  }
  return null;
}

/**
 * Uploads a file to Cloudinary.
 */
export async function uploadToCloudinary(fileBlob, resourceType) {
  const formData = new FormData();
  formData.append('file', fileBlob);
  formData.append('upload_preset', UPLOAD_PRESET);
  
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`Cloudinary upload failed: ${errorData}`);
  }
  
  const data = await res.json();
  return data.secure_url;
}

/**
 * Uploads a newly fetched audio Blob to Cloudinary and registers it in Firestore.
 * Audio upload and artwork extraction run in parallel for speed.
 * @param {string} trackId - The track ID
 * @param {Blob} blob - The audio blob
 * @param {string} mimeType - The mime type of the audio
 */
export async function saveAudioToCache(trackId, blob, mimeType) {
  try {
    console.log(`[Storage Cache] Uploading audio ${trackId} (${(blob.size / 1024 / 1024).toFixed(2)} MB) to Cloudinary...`);
    
    // Upload audio AND extract artwork in parallel (saves ~1-3s vs sequential)
    const [downloadUrl, artworkResult] = await Promise.allSettled([
      uploadToCloudinary(blob, 'auto'),
      (async () => {
        try {
          const tags = await parseMetadata(blob);
          if (tags && tags.artwork) {
            const res = await fetch(tags.artwork);
            const artworkBlob = await res.blob();
            console.log(`[Storage Cache] Uploading artwork for ${trackId} to Cloudinary...`);
            return await uploadToCloudinary(artworkBlob, 'image');
          }
        } catch (e) {
          console.warn(`[Storage Cache] Failed to extract/upload artwork for ${trackId}:`, e);
        }
        return null;
      })(),
    ]);

    // Only proceed if audio upload succeeded
    if (downloadUrl.status !== 'fulfilled' || !downloadUrl.value) {
      throw new Error('Audio upload failed');
    }

    const artworkUrl = artworkResult.status === 'fulfilled' ? artworkResult.value : null;

    // Fire-and-forget Firestore write — don't block the caller
    const docRef = doc(db, CACHE_COLLECTION, trackId);
    setDoc(docRef, {
      trackId,
      size: blob.size,
      url: downloadUrl.value,
      artworkUrl,
      lastAccessed: Date.now(),
      mimeType
    }).catch(err => console.warn(`[Storage Cache] Firestore write failed for ${trackId}:`, err));
    
    console.log(`[Storage Cache] Successfully cached ${trackId} to Cloudinary!`);

  } catch (err) {
    console.error(`[Storage Cache] Failed to save cache for ${trackId}:`, err);
  }
}
