import { db } from '../config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { parseMetadata } from './metadataHelper';

const CACHE_COLLECTION = 'audioCache';
const CLOUD_NAME = 'amrqrsph';
const UPLOAD_PRESET = 'ml_default';

/**
 * Checks if a track exists in the cache.
 * @param {string} trackId - The track ID
 * @returns {Promise<Object|null>} The cached URLs, or null if not cached.
 */
export async function getAudioFromCache(trackId) {
  try {
    const docRef = doc(db, CACHE_COLLECTION, trackId);
    const docSnap = await Promise.race([
      getDoc(docRef),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 3000))
    ]);

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Update last accessed time
      await updateDoc(docRef, { lastAccessed: Date.now() });
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
async function uploadToCloudinary(fileBlob, resourceType) {
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
 * @param {string} trackId - The track ID
 * @param {Blob} blob - The audio blob
 * @param {string} mimeType - The mime type of the audio
 */
export async function saveAudioToCache(trackId, blob, mimeType) {
  try {
    console.log(`[Storage Cache] Uploading audio ${trackId} (${(blob.size / 1024 / 1024).toFixed(2)} MB) to Cloudinary...`);
    
    // Upload the audio Blob to Cloudinary (audio goes to 'video' endpoint)
    const downloadUrl = await uploadToCloudinary(blob, 'video');
    
    let artworkUrl = null;
    try {
      const tags = await parseMetadata(blob);
      if (tags && tags.artwork) {
        // Convert base64 artwork to blob
        const res = await fetch(tags.artwork);
        const artworkBlob = await res.blob();
        
        console.log(`[Storage Cache] Uploading artwork for ${trackId} to Cloudinary...`);
        artworkUrl = await uploadToCloudinary(artworkBlob, 'image');
      }
    } catch (e) {
      console.warn(`[Storage Cache] Failed to extract/upload artwork for ${trackId}:`, e);
    }

    // Save metadata to Firestore
    const docRef = doc(db, CACHE_COLLECTION, trackId);
    await setDoc(docRef, {
      trackId,
      size: blob.size,
      url: downloadUrl,
      artworkUrl,
      lastAccessed: Date.now(),
      mimeType
    });
    
    console.log(`[Storage Cache] Successfully cached ${trackId} to Cloudinary!`);

  } catch (err) {
    console.error(`[Storage Cache] Failed to save cache for ${trackId}:`, err);
  }
}
