/**
 * offlineHelper.js - Utility for offline backup and audiobook features for Reson8 streaming app.
 */

/**
 * Filters recently played/queued tracks to only those available offline (cached).
 * 
 * @param {Array} recentTracks - Array of recently played/queued track objects or track IDs
 * @param {Set|Array} cachedTrackIds - Set or Array of cached track IDs
 * @returns {Array} Filtered array of cached tracks (limit to 50 tracks max)
 */
export function generateOfflineBackup(recentTracks, cachedTrackIds) {
  if (!Array.isArray(recentTracks) || !cachedTrackIds) {
    return [];
  }

  const cacheSet = cachedTrackIds instanceof Set
    ? cachedTrackIds
    : new Set(Array.isArray(cachedTrackIds) ? cachedTrackIds : []);

  const offlineTracks = recentTracks.filter(track => {
    if (!track) return false;
    const trackId = typeof track === 'object' 
      ? (track.id ?? track.trackId ?? track._id) 
      : track;
    
    if (trackId == null) return false;
    return cacheSet.has(trackId) || cacheSet.has(String(trackId));
  });

  return offlineTracks.slice(0, 50);
}

/**
 * Checks whether a track is classified as an audiobook or spoken content.
 * 
 * @param {Object} track - Track object
 * @returns {boolean} True if track duration > 20 mins (1200s) or genre contains audiobook/podcast/spoken
 */
export function isAudiobook(track) {
  if (!track || typeof track !== 'object') {
    return false;
  }

  if (track.isAudiobook === true || track.type === 'audiobook') {
    return true;
  }

  // Duration check: > 20 minutes (1200 seconds)
  const durationSec = track.durationSec ?? track.duration ?? track.duration_sec ?? 0;
  if (typeof durationSec === 'number' && durationSec > 1200) {
    return true;
  }

  // Genre check: case-insensitive check for 'audiobook', 'podcast', 'spoken'
  const genre = track.genre ?? track.genres ?? track.category ?? '';
  let genreStr = '';
  if (Array.isArray(genre)) {
    genreStr = genre.join(' ').toLowerCase();
  } else if (typeof genre === 'string') {
    genreStr = genre.toLowerCase();
  }

  if (genreStr) {
    const keywords = ['audiobook', 'podcast', 'spoken'];
    if (keywords.some(keyword => genreStr.includes(keyword))) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates current month's audiobook listening usage.
 * 
 * @param {Array} playHistory - Array of play history entries ({ trackId, durationSec, completed, playedAt, ... })
 * @returns {{ usedHours: number, limitHours: number, remainingHours: number }}
 */
export function getAudiobookUsage(playHistory) {
  const limitHours = 15;

  if (!Array.isArray(playHistory) || playHistory.length === 0) {
    return {
      usedHours: 0,
      limitHours,
      remainingHours: limitHours
    };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let totalListenedSeconds = 0;

  for (const entry of playHistory) {
    if (!entry || !entry.playedAt) continue;

    // Check if entry is an audiobook
    const entryIsAudiobook = entry.isAudiobook === true || 
      entry.type === 'audiobook' ||
      isAudiobook(entry) || 
      (entry.track && isAudiobook(entry.track));

    if (!entryIsAudiobook) continue;

    // Parse date from playedAt
    let playedDate = null;
    if (entry.playedAt instanceof Date) {
      playedDate = entry.playedAt;
    } else if (typeof entry.playedAt === 'number') {
      playedDate = entry.playedAt < 1e11 ? new Date(entry.playedAt * 1000) : new Date(entry.playedAt);
    } else if (typeof entry.playedAt === 'string') {
      playedDate = new Date(entry.playedAt);
    } else if (entry.playedAt && typeof entry.playedAt.toDate === 'function') {
      playedDate = entry.playedAt.toDate();
    }

    if (!playedDate || isNaN(playedDate.getTime())) continue;

    // Filter to current month
    if (playedDate.getFullYear() === currentYear && playedDate.getMonth() === currentMonth) {
      const seconds = typeof entry.durationSec === 'number' 
        ? entry.durationSec 
        : (typeof entry.duration === 'number' ? entry.duration : 0);
      
      totalListenedSeconds += Math.max(0, seconds);
    }
  }

  const usedHours = Number((totalListenedSeconds / 3600).toFixed(2));
  const remainingHours = Math.max(0, Number((limitHours - usedHours).toFixed(2)));

  return {
    usedHours,
    limitHours,
    remainingHours
  };
}

/**
 * Checks if user has remaining audiobook listening hours for the current month.
 * 
 * @param {Array} playHistory - Array of play history entries
 * @returns {boolean} True if remainingHours > 0
 */
export function canPlayAudiobook(playHistory) {
  const usage = getAudiobookUsage(playHistory);
  return usage.remainingHours > 0;
}
