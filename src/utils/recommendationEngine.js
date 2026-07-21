import { getAffinity, saveAffinity, getAllAffinities, logPlay, getPlayHistory } from './db';
import { saveAffinityToSheet } from './googleSheetsHelper';

// Logging constants
const COMPLETE_PLAY_BONUS = 2;
const SKIP_PENALTY = -3;
const FATIGUE_DECAY_RATE = 0.8; // Fatigue decays to 80% on each track play

/**
 * Record a play or skip event and adjust tastes.
 */
export async function recordPlayEvent(track, completed, syncConfig = null) {
  if (!track) return;
  
  // Log play history
  await logPlay(track.id, completed);

  // Update Artist & Genre Affinities
  const artistKey = `artist:${track.artist}`;
  const genreKey = `genre:${track.genre}`;

  const currentArtistAff = await getAffinity(artistKey);
  const currentGenreAff = await getAffinity(genreKey);

  const delta = completed ? COMPLETE_PLAY_BONUS : SKIP_PENALTY;

  const newArtistScore = Math.max(-20, (currentArtistAff.score || 0) + delta);
  const newGenreScore = Math.max(-20, (currentGenreAff.score || 0) + delta);
  const newFatigueScore = completed ? 10 : 0;

  await saveAffinity(artistKey, newArtistScore);
  await saveAffinity(genreKey, newGenreScore);

  // Log fatigue / recency state for this song
  const songFatigueKey = `fatigue:${track.id}`;
  await saveAffinity(songFatigueKey, newFatigueScore);

  if (syncConfig && syncConfig.mode === 'shared' && syncConfig.userId) {
    saveAffinityToSheet(syncConfig.userId, 'artist', track.artist, newArtistScore);
    saveAffinityToSheet(syncConfig.userId, 'genre', track.genre, newGenreScore);
    saveAffinityToSheet(syncConfig.userId, 'fatigue', track.id, newFatigueScore);
  }
}

/**
 * Decays the fatigue scores of all tracks. Call this when a new song starts playing.
 */
export async function decayFatigue(syncConfig = null) {
  const affinities = await getAllAffinities();
  for (const aff of affinities) {
    if (aff.key.startsWith('fatigue:')) {
      const newScore = aff.score * FATIGUE_DECAY_RATE;
      let finalScore = newScore;
      if (newScore < 0.1) {
        // Remove tiny fatigue values
        finalScore = 0;
      }
      await saveAffinity(aff.key, finalScore);
      if (syncConfig && syncConfig.mode === 'shared' && syncConfig.userId) {
        const trackId = aff.key.replace('fatigue:', '');
        saveAffinityToSheet(syncConfig.userId, 'fatigue', trackId, finalScore);
      }
    }
  }
}

/**
 * Generates recommendation lists for the "For You" dashboard.
 */
export async function getRecommendations(allTracks) {
  if (!allTracks || allTracks.length === 0) return { dailyMix: [], similarTracks: [], forgottenGems: [] };

  const history = await getPlayHistory();
  const affinities = await getAllAffinities();

  const artistAffinities = {};
  const genreAffinities = {};
  const fatigueMap = {};

  affinities.forEach(aff => {
    if (aff.key.startsWith('artist:')) {
      artistAffinities[aff.key.replace('artist:', '')] = aff.score;
    } else if (aff.key.startsWith('genre:')) {
      genreAffinities[aff.key.replace('genre:', '')] = aff.score;
    } else if (aff.key.startsWith('fatigue:')) {
      fatigueMap[aff.key.replace('fatigue:', '')] = aff.score;
    }
  });

  // Keep a set of recently played song IDs to strictly exclude (last 30% of total tracks up to 10)
  const recentHistoryLimit = Math.max(1, Math.min(10, Math.floor(allTracks.length * 0.3)));
  const recentPlayedIds = new Set(
    history.slice(-recentHistoryLimit).map(h => h.trackId)
  );

  const scoredTracks = allTracks.map(track => {
    let score = 0;

    // 1. Tag matching
    score += artistAffinities[track.artist] || 0;
    score += genreAffinities[track.genre] || 0;

    // 2. Base score for unplayed tracks (gentle boost to encourage discovery)
    const playCount = history.filter(h => h.trackId === track.id).length;
    if (playCount === 0) score += 1;

    // 3. Apply fatigue penalty
    const fatigue = fatigueMap[track.id] || 0;
    score -= fatigue;

    // 4. Heavy penalty for recently played songs
    if (recentPlayedIds.has(track.id)) {
      score -= 50;
    }

    return { track, score, playCount };
  });

  // Sort by score descending
  scoredTracks.sort((a, b) => b.score - a.score);

  // 1. Daily Mix: Top matching tracks (introducing some randomness using top 15)
  const dailyMixPool = scoredTracks.slice(0, 15).map(st => st.track);
  const dailyMix = shuffleArray(dailyMixPool).slice(0, 6);

  // 2. Similar Tracks: Matches current favorite genre
  let favoriteGenre = '';
  let maxGenreScore = -Infinity;
  Object.keys(genreAffinities).forEach(g => {
    if (genreAffinities[g] > maxGenreScore && g !== 'Unknown Genre') {
      maxGenreScore = genreAffinities[g];
      favoriteGenre = g;
    }
  });
  const similarTracks = scoredTracks
    .filter(st => st.track.genre === favoriteGenre && !recentPlayedIds.has(st.track.id))
    .slice(0, 6)
    .map(st => st.track);

  // 3. Forgotten Gems: Good songs that haven't been played in a while
  const forgottenGems = scoredTracks
    .filter(st => st.playCount > 0 && !recentPlayedIds.has(st.track.id))
    .sort((a, b) => a.playCount - b.playCount) // lower playcount first
    .slice(0, 6)
    .map(st => st.track);

  return {
    dailyMix: dailyMix.length ? dailyMix : allTracks.slice(0, 6),
    similarTracks: similarTracks.length ? similarTracks : allTracks.slice(6, 12),
    forgottenGems: forgottenGems.length ? forgottenGems : allTracks.slice(0, 6)
  };
}

/**
 * Gets the next track to autoplay using temperature sampling (probabilistic).
 */
export async function getNextTrackAutoplay(allTracks, currentTrack) {
  const history = await getPlayHistory();
  const affinities = await getAllAffinities();
  return getNextTrackAutoplayWithState(allTracks, currentTrack, history, affinities);
}

export function getNextTrackAutoplayWithState(allTracks, currentTrack, history, affinities) {
  if (!allTracks || allTracks.length === 0) return null;

  const artistAffinities = {};
  const genreAffinities = {};
  const fatigueMap = {};

  affinities.forEach(aff => {
    if (aff.key.startsWith('artist:')) {
      artistAffinities[aff.key.replace('artist:', '')] = aff.score;
    } else if (aff.key.startsWith('genre:')) {
      genreAffinities[aff.key.replace('genre:', '')] = aff.score;
    } else if (aff.key.startsWith('fatigue:')) {
      fatigueMap[aff.key.replace('fatigue:', '')] = aff.score;
    }
  });

  const recentHistoryLimit = Math.max(1, Math.min(10, Math.floor(allTracks.length * 0.3)));
  const recentPlayedIds = new Set(
    history.slice(-recentHistoryLimit).map(h => h.trackId)
  );
  if (currentTrack) {
    recentPlayedIds.add(currentTrack.id);
  }

  // Sample up to 200 random tracks to score, drastically reducing CPU load for large libraries
  const MAX_SAMPLE_SIZE = 200;
  const filteredTracks = allTracks.filter(t => !recentPlayedIds.has(t.id));
  const sampleSize = Math.min(filteredTracks.length, MAX_SAMPLE_SIZE);
  
  // Quick Fisher-Yates partial shuffle to get a random sample
  const sample = [];
  const tracksCopy = [...filteredTracks];
  for (let i = 0; i < sampleSize; i++) {
    const randomIndex = Math.floor(Math.random() * tracksCopy.length);
    sample.push(tracksCopy[randomIndex]);
    tracksCopy[randomIndex] = tracksCopy[tracksCopy.length - 1];
    tracksCopy.pop();
  }

  // Score only the sampled candidate tracks
  const candidates = sample.map(track => {
    let score = 5; // Base minimum score

    score += artistAffinities[track.artist] || 0;
    score += genreAffinities[track.genre] || 0;

    // Apply fatigue
    const fatigue = fatigueMap[track.id] || 0;
    score = Math.max(1, score - fatigue);

    return { track, score };
  });

  if (candidates.length === 0) {
    // If everything is in history, fallback to standard random excluding current track
    const fallback = allTracks.filter(t => currentTrack ? t.id !== currentTrack.id : true);
    return fallback[Math.floor(Math.random() * fallback.length)] || allTracks[0];
  }

  // Probabilistic Selection (Roulette Wheel selection based on scores)
  const totalScore = candidates.reduce((sum, c) => sum + c.score, 0);
  let randomVal = Math.random() * totalScore;
  
  for (const candidate of candidates) {
    randomVal -= candidate.score;
    if (randomVal <= 0) {
      return candidate.track;
    }
  }

  return candidates[0].track;
}

export async function getTopMatches(allTracks, limit = 100) {
  if (!allTracks || allTracks.length === 0) return [];
  
  const history = await getPlayHistory();
  
  // If first-time user (no history), return a random sample to encourage discovery
  if (history.length === 0) {
    return shuffleArray(allTracks).slice(0, limit);
  }

  const affinities = await getAllAffinities();
  const artistAffinities = {};
  const genreAffinities = {};
  const fatigueMap = {};

  affinities.forEach(aff => {
    if (aff.key.startsWith('artist:')) artistAffinities[aff.key.replace('artist:', '')] = aff.score;
    else if (aff.key.startsWith('genre:')) genreAffinities[aff.key.replace('genre:', '')] = aff.score;
    else if (aff.key.startsWith('fatigue:')) fatigueMap[aff.key.replace('fatigue:', '')] = aff.score;
  });

  const scoredTracks = allTracks.map(track => {
    let score = 0;
    score += artistAffinities[track.artist] || 0;
    score += genreAffinities[track.genre] || 0;
    const playCount = history.filter(h => h.trackId === track.id).length;
    if (playCount === 0) score += 1; // Slight boost to unplayed tracks
    score -= (fatigueMap[track.id] || 0);
    return { track, score };
  });

  scoredTracks.sort((a, b) => b.score - a.score);
  
  return scoredTracks.slice(0, limit).map(st => st.track);
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
