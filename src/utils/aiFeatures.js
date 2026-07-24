export const generateAIPlaylist = (prompt, allTracks) => {
  if (!prompt || !allTracks || allTracks.length === 0) return [];
  
  const lowerPrompt = prompt.toLowerCase();
  const words = lowerPrompt.split(/\s+/).filter(w => w.length > 2);
  
  const moodToGenres = {
    chill: ['ambient', 'lofi', 'jazz', 'chill'],
    upbeat: ['pop', 'dance', 'electronic', 'upbeat'],
    sad: ['indie', 'acoustic', 'blues', 'sad'],
    party: ['dance', 'hip-hop', 'edm', 'party'],
    romantic: ['r&b', 'soul', 'jazz', 'romantic'],
    workout: ['hip-hop', 'electronic', 'rock', 'workout'],
    focus: ['classical', 'ambient', 'lofi', 'focus'],
    morning: ['pop', 'acoustic', 'upbeat'],
    evening: ['r&b', 'jazz', 'indie', 'chill'],
    night: ['ambient', 'lofi', 'electronic']
  };
  
  let targetGenres = [];
  words.forEach(word => {
    Object.keys(moodToGenres).forEach(mood => {
      if (word.includes(mood) || mood.includes(word)) {
        targetGenres = [...targetGenres, ...moodToGenres[mood]];
      }
    });
  });
  
  const scoredTracks = allTracks.map(track => {
    let score = 0;
    const trackText = `${track.title || ''} ${track.artist || ''} ${track.album || ''} ${track.genre || ''}`.toLowerCase();
    
    words.forEach(word => {
      if (trackText.includes(word)) score += 2;
    });
    
    targetGenres.forEach(genre => {
      if (trackText.includes(genre)) score += 1.5;
    });
    
    // Add small random decimal to resolve ties
    score += Math.random() * 0.1;
    return { track, score };
  });
  
  const matched = scoredTracks.filter(t => t.score > 0.1).sort((a, b) => b.score - a.score);
  return matched.slice(0, 25).map(t => t.track);
};

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const generateDaylist = (allTracks, hour) => {
  if (!allTracks) return [];
  let targetGenres = [];
  
  if (hour >= 5 && hour < 12) {
    targetGenres = ['upbeat', 'pop', 'acoustic'];
  } else if (hour >= 12 && hour < 17) {
    targetGenres = ['pop', 'rock', 'hip-hop'];
  } else if (hour >= 17 && hour < 21) {
    targetGenres = ['r&b', 'jazz', 'indie', 'chill'];
  } else {
    targetGenres = ['ambient', 'lofi', 'electronic', 'chill'];
  }
  
  const matches = allTracks.filter(track => {
    const genre = (track.genre || '').toLowerCase();
    return targetGenres.some(g => genre.includes(g));
  });
  
  return shuffleArray(matches.length > 0 ? matches : allTracks).slice(0, 20);
};

export const generateBlendPlaylist = (userTracks = [], friendTracks = []) => {
  const allMixed = [];
  
  const userMap = new Map(userTracks.map(t => [t.id || t.trackId, t]));
  const friendMap = new Map(friendTracks.map(t => [t.id || t.trackId, t]));
  
  const exactMatches = [];
  userTracks.forEach(t => {
    if (friendMap.has(t.id || t.trackId)) {
      exactMatches.push(t);
    }
  });
  
  const remainingUser = userTracks.filter(t => !friendMap.has(t.id || t.trackId));
  const remainingFriend = friendTracks.filter(t => !userMap.has(t.id || t.trackId));
  
  allMixed.push(...exactMatches);
  
  const maxLength = Math.max(remainingUser.length, remainingFriend.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < remainingUser.length) allMixed.push(remainingUser[i]);
    if (i < remainingFriend.length) allMixed.push(remainingFriend[i]);
  }
  
  return allMixed.slice(0, 30);
};

export const smartShuffle = (currentPlaylist, allTracks) => {
  if (!currentPlaylist || !allTracks) return [];
  const result = [];
  
  const playlistGenres = [...new Set(currentPlaylist.map(t => (t.genre || '').toLowerCase()).filter(Boolean))];
  
  const availableRecommendations = allTracks.filter(t => {
    const isAlreadyInPlaylist = currentPlaylist.some(pt => (pt.id || pt.trackId) === (t.id || t.trackId));
    if (isAlreadyInPlaylist) return false;
    return playlistGenres.some(g => (t.genre || '').toLowerCase().includes(g));
  });
  
  const recs = shuffleArray(availableRecommendations);
  let recIndex = 0;
  
  for (let i = 0; i < currentPlaylist.length; i++) {
    result.push(currentPlaylist[i]);
    if ((i + 1) % 2 === 0 && recIndex < recs.length) {
      result.push(recs[recIndex++]);
    }
  }
  
  return result;
};

export const generateDJCommentary = (track, nextTrack) => {
  if (!track || !nextTrack) return "Up next, some great tunes.";
  
  const templates = [
    `Coming up next, we've got "${nextTrack.title || 'a great track'}" by ${nextTrack.artist || 'a special artist'}...`,
    `That was "${track.title || 'a classic'}". Now let's switch gears with ${nextTrack.artist || 'this next one'}...`,
    `Hope you enjoyed "${track.title}". Keeping the vibes going with "${nextTrack.title}"!`,
    `Next on the deck: ${nextTrack.artist} bringing you "${nextTrack.title}".`,
    `We just heard from ${track.artist}. Now, turn it up for ${nextTrack.artist}!`,
    `Smooth transition incoming! Get ready for "${nextTrack.title}".`,
    `That track always hits the spot. Let's see how you like "${nextTrack.title}" by ${nextTrack.artist}.`,
    `Don't touch that dial! ${nextTrack.artist} is up next with "${nextTrack.title}".`,
    `Vibe check passed! Moving on to "${nextTrack.title}"...`,
    `And we keep it rolling with some fresh sounds from ${nextTrack.artist}.`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
};
