/**
 * Fetches lyrics from LRCLIB for a given track and artist.
 * LRCLIB is a free, open-source lyrics provider.
 * 
 * @param {string} title 
 * @param {string} artist 
 * @returns {Promise<{ syncedLyrics: string, plainLyrics: string } | null>}
 */
export const fetchLyrics = async (title, artist) => {
  try {
    if (!title || !artist) return null;

    // Clean up titles (remove " (feat. ...)" or " - Remastered" etc to improve match rate)
    const cleanTitle = title.replace(/\([^)]+\)|\[[^\]]+\]|- .+/g, '').trim();
    const cleanArtist = artist.split(',')[0].trim(); // take first artist

    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.append('track_name', cleanTitle);
    url.searchParams.append('artist_name', cleanArtist);

    const res = await fetch(url.toString());
    if (!res.ok) {
      if (res.status === 404) {
        // Not found is completely normal, just return null.
        return null;
      }
      throw new Error(`LRCLIB returned status ${res.status}`);
    }

    const data = await res.json();
    return {
      syncedLyrics: data.syncedLyrics,
      plainLyrics: data.plainLyrics
    };
  } catch (error) {
    console.error("Failed to fetch lyrics:", error);
    return null;
  }
};

/**
 * Parses LRC format synced lyrics into an array of lines with timestamps.
 * @param {string} lrc 
 * @returns {Array<{ time: number, text: string }>}
 */
export const parseLrc = (lrc) => {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const parsed = [];
  
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3];
      // depending on 2 or 3 digits
      const ms = parseInt(msStr.length === 2 ? msStr + '0' : msStr, 10);
      
      const timeInSeconds = (min * 60) + sec + (ms / 1000);
      const text = line.replace(timeRegex, '').trim();
      
      if (text) {
        parsed.push({ time: timeInSeconds, text });
      }
    }
  }
  
  return parsed;
};
