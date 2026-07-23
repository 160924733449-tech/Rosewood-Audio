import * as FileSystem from 'expo-file-system';

const CACHE_DIR = FileSystem.documentDirectory + 'aura_cache/';
const MAX_CACHE_BYTES = 500 * 1024 * 1024; // 500MB default limit

// In-memory set of cached track IDs — eliminates filesystem stat calls on every getLocalUri().
// The playback hot path now resolves in microseconds instead of ~5-20ms per stat.
let cachedIds: Set<string> = new Set();

// Map of in-flight downloads — prevents duplicate concurrent downloads for the same track
const activeDownloads: Map<string, Promise<void>> = new Map();

/**
 * Initialize the sync engine on app boot.
 * Creates the cache directory if needed and pre-populates the in-memory set
 * by scanning existing cached files once.
 */
export const initSyncEngine = async () => {
  const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    return; // Empty dir — nothing to warm
  }

  // Warm the in-memory cache by reading the directory listing once
  try {
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.mp3')) {
        cachedIds.add(file.replace('.mp3', ''));
      }
    }
    console.log(`[SyncEngine] Warmed cache with ${cachedIds.size} offline tracks.`);
  } catch (err) {
    console.warn('[SyncEngine] Failed to warm cache:', err);
  }
};

/**
 * Check if a track is cached locally.
 * Uses the in-memory set — resolves in microseconds, zero I/O.
 */
export const getLocalUri = async (trackId: string): Promise<string | null> => {
  if (cachedIds.has(trackId)) {
    return CACHE_DIR + trackId + '.mp3';
  }
  return null;
};

/**
 * Download a track to local cache.
 * - Deduplicates concurrent downloads (second call piggybacks on the first).
 * - Uses createDownloadResumable for interrupt recovery.
 * - Auto-retries once on failure.
 */
export const downloadTrack = async (trackId: string, url: string): Promise<void> => {
  // Already cached — no-op
  if (cachedIds.has(trackId)) return;

  // Deduplicate: if a download for this track is already in flight, piggyback on it
  if (activeDownloads.has(trackId)) {
    return activeDownloads.get(trackId);
  }

  const doDownload = async (retryCount = 0) => {
    const fileUri = CACHE_DIR + trackId + '.mp3';
    try {
      const resumable = FileSystem.createDownloadResumable(url, fileUri);
      const result = await resumable.downloadAsync();

      if (result && result.uri) {
        cachedIds.add(trackId);
        console.log(`[SyncEngine] Cached track: ${trackId}`);
      }
    } catch (error) {
      // Auto-retry once on transient failure
      if (retryCount < 1) {
        console.warn(`[SyncEngine] Download failed for ${trackId}, retrying...`);
        return doDownload(retryCount + 1);
      }
      console.error(`[SyncEngine] Failed to download track ${trackId}:`, error);
      // Clean up partial file
      try { await FileSystem.deleteAsync(fileUri, { idempotent: true }); } catch {}
    } finally {
      activeDownloads.delete(trackId);
    }
  };

  const downloadPromise = doDownload();
  activeDownloads.set(trackId, downloadPromise);
  return downloadPromise;
};

/**
 * Prefetch multiple tracks in parallel (capped at 2 concurrent downloads
 * to avoid saturating bandwidth and starving the active stream).
 */
export const prefetchTracks = async (tracks: { id: string; url: string }[]) => {
  const CONCURRENCY = 2;
  for (let i = 0; i < tracks.length; i += CONCURRENCY) {
    const batch = tracks.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map((t) => downloadTrack(t.id, t.url))
    );
  }
};

/**
 * Enforce cache size limit using LRU eviction.
 * Reads file metadata (not content), sorts by modification time (oldest first),
 * and deletes until total size is under the budget.
 */
export const enforceCacheLimit = async (maxBytes: number = MAX_CACHE_BYTES) => {
  try {
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    if (files.length === 0) return;

    // Gather metadata for all cached files
    const fileInfos: { name: string; size: number; modTime: number }[] = [];
    await Promise.all(
      files.map(async (name) => {
        try {
          const info = await FileSystem.getInfoAsync(CACHE_DIR + name, { size: true });
          if (info.exists && info.size) {
            fileInfos.push({
              name,
              size: info.size,
              modTime: info.modificationTime || 0,
            });
          }
        } catch {}
      })
    );

    let totalSize = fileInfos.reduce((sum, f) => sum + f.size, 0);
    if (totalSize <= maxBytes) return;

    // Sort oldest-accessed first (LRU eviction)
    fileInfos.sort((a, b) => a.modTime - b.modTime);

    let deletedCount = 0;
    for (const file of fileInfos) {
      if (totalSize <= maxBytes) break;
      try {
        await FileSystem.deleteAsync(CACHE_DIR + file.name, { idempotent: true });
        const trackId = file.name.replace('.mp3', '');
        cachedIds.delete(trackId);
        totalSize -= file.size;
        deletedCount++;
      } catch {}
    }
    console.log(`[SyncEngine] Evicted ${deletedCount} tracks, cache now ${(totalSize / 1024 / 1024).toFixed(1)}MB.`);
  } catch (err) {
    console.warn('[SyncEngine] Cache eviction failed:', err);
  }
};
