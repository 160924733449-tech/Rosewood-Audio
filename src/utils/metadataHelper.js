export function parseMetadata(file) {
  return new Promise((resolve) => {
    // Basic fallback metadata from filename
    const filename = file.name || '';
    const cleanName = filename.replace(/\.[^/.]+$/, ""); // Strip extension
    const parts = cleanName.split(' - ');
    let defaultTitle = cleanName;
    let defaultArtist = 'Unknown Artist';

    if (parts.length > 1) {
      defaultArtist = parts[0].trim();
      defaultTitle = parts.slice(1).join(' - ').trim();
    }

    const fallbackMetadata = {
      title: defaultTitle,
      artist: defaultArtist,
      album: 'Unknown Album',
      genre: 'Unknown Genre',
      year: '',
      artwork: null
    };

    const jsmediatags = window.jsmediatags;
    if (!jsmediatags) {
      console.warn('jsmediatags is not loaded on window yet, using fallback.');
      resolve(fallbackMetadata);
      return;
    }

    // If it's not a File or Blob, return fallback
    if (!(file instanceof Blob)) {
      resolve(fallbackMetadata);
      return;
    }

    new jsmediatags.Reader(file)
      .setTagsToRead(['title', 'artist', 'album', 'genre', 'picture', 'year'])
      .read({
        onSuccess: (tag) => {
          const tags = tag.tags;
          let artwork = null;

          if (tags.picture) {
            const { data, format } = tags.picture;
            try {
              let binary = '';
              const bytes = new Uint8Array(data);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              artwork = `data:${format};base64,${btoa(binary)}`;
            } catch (err) {
              console.error('Error parsing artwork:', err);
            }
          }

          resolve({
            title: tags.title || defaultTitle,
            artist: tags.artist || defaultArtist,
            album: tags.album || 'Unknown Album',
            genre: tags.genre || 'Unknown Genre',
            year: tags.year || '',
            artwork
          });
        },
        onError: (error) => {
          console.warn('jsmediatags error reading file, using fallback:', error);
          resolve(fallbackMetadata);
        }
      });
  });
}

export async function fetchITunesMetadata(artist, title) {
  let cleanArtist = artist && artist !== 'Unknown Artist' ? artist : '';
  let cleanTitle = title || '';
  if (!cleanTitle) return null;

  // Sanitize the artist and title: remove track numbers (e.g., "01.", "12 - "), file extensions, and special characters
  cleanArtist = cleanArtist.replace(/^\d+[\s.-]+/, '').trim();
  cleanTitle = cleanTitle.replace(/^\d+[\s.-]+/, ''); // Remove leading numbers like "01." or "12 - "
  cleanTitle = cleanTitle.replace(/\.(mp3|m4a|wav|flac|ogg)$/i, ''); // Remove common extensions
  cleanTitle = cleanTitle.replace(/[\[\(\{].*?[\]\)\}]/g, ''); // Remove anything in brackets (e.g. "(Official Video)")
  cleanTitle = cleanTitle.trim();

  const query = `${cleanArtist} ${cleanTitle}`.trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=3`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Find the first result that strictly matches the artist name, if an artist was provided
      let result = data.results[0];
      
      if (cleanArtist) {
        const matchingResult = data.results.find(r => {
          const apiArtist = (r.artistName || '').toLowerCase();
          const localArtist = cleanArtist.toLowerCase();
          // Strict check: the iTunes artist must contain the local artist or vice versa
          return apiArtist.includes(localArtist) || localArtist.includes(apiArtist);
        });
        
        if (matchingResult) {
          result = matchingResult;
        } else {
          // If no matching artist is found, we reject the iTunes result to prevent false positives
          console.warn(`[iTunes] Rejected false positive for "${cleanTitle}". Expected artist: "${cleanArtist}".`);
          return null;
        }
      }

      const artwork = result.artworkUrl100 ? result.artworkUrl100.replace('100x100bb.jpg', '500x500bb.jpg') : null;
      const duration = result.trackTimeMillis ? result.trackTimeMillis / 1000 : null;
      
      // Auto-categorize the fetched primary genre
      const mappedGenre = normalizeGenre(result.primaryGenreName, result.artistName, result.trackName);

      return {
        artwork,
        duration,
        title: result.trackName || null,
        artist: result.artistName || null,
        album: result.collectionName || null,
        genre: mappedGenre,
        year: result.releaseDate ? result.releaseDate.substring(0, 4) : null
      };
    }
  } catch (error) {
    console.warn("iTunes fetch failed:", error);
  }
  return null;
}

const GENRE_TAXONOMY = {
  'Bollywood': {
    keywords: ['bollywood', 'hindi', 'indian', 'desi', 'filmi'],
    artists: ['arijit', 'shreya', 'rahman', 'pritam', 'sonu nigam', 'kishore', 'lata', 'armaan', 'jubin', 'shankar', 'vishal', 'darshan']
  },
  'Punjabi': {
    keywords: ['punjabi', 'bhangra'],
    artists: ['badshah', 'diljit', 'karan aujla', 'sidhu moose', 'ap dhillon', 'harrdy', 'guru randhawa', 'b praak', 'jassi']
  },
  'Pop': {
    keywords: ['pop', 'top 40', 'synthpop', 'indie pop'],
    artists: ['taylor swift', 'ed sheeran', 'justin bieber', 'dua lipa', 'ariana grande', 'billie eilish', 'harry styles', 'bruno mars', 'maroon 5', 'charlie puth', 'katy perry']
  },
  'Hip-Hop & Rap': {
    keywords: ['hip-hop', 'hip hop', 'rap', 'trap', 'drill'],
    artists: ['drake', 'eminem', 'kanye', 'kendrick', 'travis scott', 'j. cole', 'post malone', 'j-hope', 'mac miller', 'tupac', 'snoop']
  },
  'R&B & Soul': {
    keywords: ['r&b', 'rnb', 'soul', 'funk', 'neo-soul'],
    artists: ['the weeknd', 'sza', 'frank ocean', 'brent faiyaz', 'john legend', 'alicia keys', 'stevie wonder']
  },
  'Electronic & Dance': {
    keywords: ['electronic', 'dance', 'house', 'techno', 'edm', 'dubstep', 'trance', 'synthwave'],
    artists: ['daft punk', 'skrillex', 'deadmau5', 'avicii', 'marshmello', 'kygo', 'tiesto', 'david guetta', 'calvin harris', 'alan walker']
  },
  'Rock & Metal': {
    keywords: ['rock', 'metal', 'alternative', 'punk', 'grunge', 'hard rock', 'heavy metal'],
    artists: ['coldplay', 'imagine dragons', 'queen', 'ac/dc', 'metallica', 'nirvana', 'linkin park', 'red hot chili peppers', 'arctic monkeys', 'pink floyd']
  },
  'K-Pop': {
    keywords: ['k-pop', 'kpop', 'korean'],
    artists: ['bts', 'blackpink', 'twice', 'stray kids', 'newjeans', 'seventeen', 'txt', 'enhypen', 'aespa', 'exo', 'red velvet', 'jung kook', 'jimin']
  },
  'Latin & Reggaeton': {
    keywords: ['latin', 'reggaeton', 'bachata', 'salsa', 'urbano'],
    artists: ['bad bunny', 'j balvin', 'shakira', 'rosalia', 'maluma', 'karol g', 'daddy yankee']
  },
  'Jazz & Blues': {
    keywords: ['jazz', 'blues', 'swing', 'bebop'],
    artists: ['miles davis', 'john coltrane', 'louis armstrong', 'ella fitzgerald', 'bb king', 'muddy waters', 'nina simone']
  },
  'Classical & Instrumental': {
    keywords: ['classical', 'instrumental', 'orchestra', 'symphony', 'piano', 'lo-fi', 'lofi', 'study'],
    artists: ['mozart', 'beethoven', 'bach', 'chopin', 'zimmer', 'ludovico']
  },
  'Country & Folk': {
    keywords: ['country', 'folk', 'bluegrass', 'americana'],
    artists: ['johnny cash', 'dolly parton', 'garth brooks', 'luke combs', 'zach bryan', 'morgan wallen', 'bob dylan', 'lumineers']
  }
};

/**
 * Normalizes messy ID3 genre strings into clean Macro-Categories (Spotify-style) using a taxonomy dictionary
 */
export function normalizeGenre(rawGenre, artist = '', title = '') {
  const g = (rawGenre || '').toLowerCase();
  const a = (artist || '').toLowerCase();
  
  // Iterate through taxonomy to find a match
  for (const [macroCategory, rules] of Object.entries(GENRE_TAXONOMY)) {
    const isKeywordMatch = rules.keywords.some(keyword => g.includes(keyword));
    const isArtistMatch = rules.artists.some(name => a.includes(name));
    
    if (isKeywordMatch || isArtistMatch) {
      return macroCategory;
    }
  }
  
  // If no match found, fallback to cleaning up the raw genre
  if (g.length > 2 && g.length < 15) {
    // Capitalize first letter of each word
    return rawGenre.replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return 'Global';
}
