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
      resolve(enrichQuranTrack({ ...fallbackMetadata, url: filename, name: filename }));
      return;
    }

    // If it's not a File or Blob, return fallback
    if (!(file instanceof Blob)) {
      resolve(enrichQuranTrack({ ...fallbackMetadata, url: filename, name: filename }));
      return;
    }

    new jsmediatags.Reader(file)
      .setTagsToRead(['title', 'artist', 'album', 'genre', 'picture', 'year'])
      .read({
        onSuccess: (tag) => {
          const tags = tag.tags;
          let artwork = null;
          let artworkBlob = null;

          if (tags.picture) {
            const { data, format } = tags.picture;
            try {
              const bytes = new Uint8Array(data);
              const blob = new Blob([bytes], { type: format || 'image/jpeg' });
              artworkBlob = blob;
              artwork = URL.createObjectURL(blob);
            } catch (err) {
              console.error('Error creating artwork blob:', err);
            }
          }

          resolve(enrichQuranTrack({
            title: tags.title || defaultTitle,
            artist: tags.artist || defaultArtist,
            album: tags.album || 'Unknown Album',
            genre: tags.genre || 'Unknown Genre',
            year: tags.year || '',
            artwork,
            artworkBlob,
            url: filename,
            name: filename
          }));
        },
        onError: (error) => {
          console.warn('jsmediatags error reading file, using fallback:', error);
          resolve(enrichQuranTrack({ ...fallbackMetadata, url: filename, name: filename }));
        }
      });
  });
}

export async function fetchITunesMetadata(artist, title) {
  let cleanArtist = artist && artist !== 'Unknown Artist' ? artist : '';
  let cleanTitle = title || '';
  if (!cleanTitle) return null;

  // Sanitize the artist and title: remove track numbers (e.g., "01.", "12 - ", "24_"), file extensions, and special characters
  cleanArtist = cleanArtist.replace(/^\d+[\s.\-_]+/, '').trim();
  
  cleanTitle = cleanTitle.replace(/^\d+[\s.\-_]+/, ''); // Remove leading numbers
  cleanTitle = cleanTitle.replace(/\.(mp3|m4a|wav|flac|ogg)$/i, ''); // Remove common extensions
  cleanTitle = cleanTitle.replace(/[\[\(\{].*?[\]\)\}]/g, ''); // Remove anything in brackets
  cleanTitle = cleanTitle.replace(/\s*(feat\.?|ft\.?)\s+.*$/i, ''); // Remove trailing feat. from title
  cleanTitle = cleanTitle.replace(/[-_]/g, ' '); // Replace hyphens and underscores with spaces
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  // Create a highly optimized query string, stripping punctuation that breaks iTunes tokenization
  const queryArtist = cleanArtist.replace(/[\/&,]/g, ' ').replace(/\s*(feat\.?|ft\.?| x | and )\s+/ig, ' ').replace(/\s+/g, ' ').trim();
  const query = `${queryArtist} ${cleanTitle}`.trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=5`;

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
          const apiTitle = (r.trackName || '').toLowerCase();
          const localTitle = cleanTitle.toLowerCase();
          
          // Strict check: the iTunes artist must contain the local artist or vice versa
          if (apiArtist.includes(localArtist) || localArtist.includes(apiArtist)) return true;
          
          // Smart check: Split by delimiters to find individual primary artists
          const splitRegex = /\s*(?:\/|&|,|feat\.?|ft\.?| x | and )\s*/;
          const localArtists = localArtist.split(splitRegex).filter(Boolean);
          const apiArtists = apiArtist.split(splitRegex).filter(Boolean);
          
          for (const l of localArtists) {
            for (const a of apiArtists) {
              if (l && a && (l.includes(a) || a.includes(l))) return true;
            }
          }
          
          // Lenient fallback: If the title perfectly matches (ignoring API brackets/features), accept it
          const cleanApiTitle = apiTitle.replace(/[\[\(\{].*?[\]\)\}]/g, '').replace(/\s*(feat\.?|ft\.?)\s+.*$/i, '').trim();
          if (cleanApiTitle === localTitle && localTitle.length > 2) return true;
          
          return false;
        });
        
        if (matchingResult) {
          result = matchingResult;
        } else {
          console.warn(`[iTunes] Rejected false positive for "${cleanTitle}". Expected artist: "${cleanArtist}". API gave: "${data.results[0]?.artistName}"`);
          return null;
        }
      }

      let artwork = null;
      if (result.artworkUrl100) {
        const resolutions = ['1000x1000bb.jpg', '600x600bb.jpg', '500x500bb.jpg'];
        for (const res of resolutions) {
          const testUrl = result.artworkUrl100.replace('100x100bb.jpg', res);
          try {
            const check = await fetch(testUrl, { method: 'HEAD' });
            if (check.ok) {
              artwork = testUrl;
              break;
            }
          } catch(e) { /* Ignore CORS or network errors and keep trying */ }
        }
        if (!artwork) artwork = result.artworkUrl100.replace('100x100bb.jpg', '500x500bb.jpg');
      }

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
  'Islamic / Quran': {
    keywords: ['quran', 'qur\'an', 'islamic', 'surah', 'tilawat', 'recitation', 'nasheed', 'naat', 'adhan', 'azaan', 'mishary', 'sudais', 'shuraym', 'abdul basit', 'ghamid', 'husary', 'minshawi', 'alafasy', 'maher'],
    artists: ['mishary', 'sudais', 'shuraym', 'abdul basit', 'ghamid', 'husary', 'minshawi', 'alafasy', 'maher zein', 'sami yusuf', 'native deen', 'ahmed bukhatir', 'zain bhikha', 'holy quran']
  },
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

export const QURAN_SURAHS = {
  1: { name: 'Al-Fatiha', english: 'The Opening' },
  2: { name: 'Al-Baqarah', english: 'The Cow' },
  3: { name: 'Ali \'Imran', english: 'Family of Imran' },
  4: { name: 'An-Nisa', english: 'The Women' },
  5: { name: 'Al-Ma\'idah', english: 'The Table Spread' },
  6: { name: 'Al-An\'am', english: 'The Cattle' },
  7: { name: 'Al-A\'raf', english: 'The Heights' },
  8: { name: 'Al-Anfal', english: 'The Spoils of War' },
  9: { name: 'At-Tawbah', english: 'The Repentance' },
  10: { name: 'Yunus', english: 'Jonah' },
  11: { name: 'Hud', english: 'Hud' },
  12: { name: 'Yusuf', english: 'Joseph' },
  13: { name: 'Ar-Ra\'d', english: 'The Thunder' },
  14: { name: 'Ibrahim', english: 'Abraham' },
  15: { name: 'Al-Hijr', english: 'The Rocky Tract' },
  16: { name: 'An-Nahl', english: 'The Bee' },
  17: { name: 'Al-Isra', english: 'The Night Journey' },
  18: { name: 'Al-Kahf', english: 'The Cave' },
  19: { name: 'Maryam', english: 'Mary' },
  20: { name: 'Taha', english: 'Ta-Ha' },
  21: { name: 'Al-Anbiya', english: 'The Prophets' },
  22: { name: 'Al-Hajj', english: 'The Pilgrimage' },
  23: { name: 'Al-Mu\'minun', english: 'The Believers' },
  24: { name: 'An-Nur', english: 'The Light' },
  25: { name: 'Al-Furqan', english: 'The Criterion' },
  26: { name: 'Ash-Shu\'ara', english: 'The Poets' },
  27: { name: 'An-Naml', english: 'The Ant' },
  28: { name: 'Al-Qasas', english: 'The Stories' },
  29: { name: 'Al-Ankabut', english: 'The Spider' },
  30: { name: 'Ar-Rum', english: 'The Romans' },
  31: { name: 'Luqman', english: 'Luqman' },
  32: { name: 'As-Sajdah', english: 'The Prostration' },
  33: { name: 'Al-Ahzab', english: 'The Combined Forces' },
  34: { name: 'Saba', english: 'Sheba' },
  35: { name: 'Fatir', english: 'Originator' },
  36: { name: 'Ya-Sin', english: 'Ya Sin' },
  37: { name: 'As-Saffat', english: 'Those who set the Ranks' },
  38: { name: 'Sad', english: 'The Letter Sad' },
  39: { name: 'Az-Zumar', english: 'The Troops' },
  40: { name: 'Ghafir', english: 'The Forgiver' },
  41: { name: 'Fussilat', english: 'Explained in Detail' },
  42: { name: 'Ash-Shura', english: 'The Consultation' },
  43: { name: 'Az-Zukhruf', english: 'The Ornaments of Gold' },
  44: { name: 'Ad-Dukhan', english: 'The Smoke' },
  45: { name: 'Al-Jathiyah', english: 'The Crouching' },
  46: { name: 'Al-Ahqaf', english: 'The Wind-Curved Sandhills' },
  47: { name: 'Muhammad', english: 'Muhammad' },
  48: { name: 'Al-Fath', english: 'The Victory' },
  49: { name: 'Al-Hujurat', english: 'The Rooms' },
  50: { name: 'Qaf', english: 'The Letter Qaf' },
  51: { name: 'Ad-Dhariyat', english: 'The Winnowing Winds' },
  52: { name: 'At-Tur', english: 'The Mount' },
  53: { name: 'An-Najm', english: 'The Star' },
  54: { name: 'Al-Qamar', english: 'The Moon' },
  55: { name: 'Ar-Rahman', english: 'The Beneficent' },
  56: { name: 'Al-Waqi\'ah', english: 'The Inevitable' },
  57: { name: 'Al-Hadid', english: 'The Iron' },
  58: { name: 'Al-Mujadila', english: 'The Pleading Woman' },
  59: { name: 'Al-Hashr', english: 'The Exile' },
  60: { name: 'Al-Mumtahanah', english: 'She that is to be examined' },
  61: { name: 'As-Saff', english: 'The Ranks' },
  62: { name: 'Al-Jumu\'ah', english: 'The Congregation' },
  63: { name: 'Al-Munafiqun', english: 'The Hypocrites' },
  64: { name: 'At-Taghabun', english: 'The Mutual Disillusion' },
  65: { name: 'At-Talaq', english: 'The Divorce' },
  66: { name: 'At-Tahrim', english: 'The Prohibition' },
  67: { name: 'Al-Mulk', english: 'The Sovereignty' },
  68: { name: 'Al-Qalam', english: 'The Pen' },
  69: { name: 'Al-Haqqah', english: 'The Reality' },
  70: { name: 'Al-Ma\'arij', english: 'The Ascending Stairways' },
  71: { name: 'Nuh', english: 'Noah' },
  72: { name: 'Al-Jinn', english: 'The Jinn' },
  73: { name: 'Al-Muzzammil', english: 'The Enshrouded One' },
  74: { name: 'Al-Muddaththir', english: 'The Cloaked One' },
  75: { name: 'Al-Qiyamah', english: 'The Resurrection' },
  76: { name: 'Al-Insan', english: 'Man' },
  77: { name: 'Al-Mursalat', english: 'The Emissaries' },
  78: { name: 'An-Naba', english: 'The Tidings' },
  79: { name: 'An-Nazi\'at', english: 'Those who drag forth' },
  80: { name: 'Abasa', english: 'He Frowned' },
  81: { name: 'At-Takwir', english: 'The Overthrowing' },
  82: { name: 'Al-Infitar', english: 'The Cleaving' },
  83: { name: 'Al-Mutaffifin', english: 'The Defrauding' },
  84: { name: 'Al-Inshiqaq', english: 'The Sundering' },
  85: { name: 'Al-Buruj', english: 'The Mansions of the Stars' },
  86: { name: 'At-Tariq', english: 'The Morning Star' },
  87: { name: 'Al-A\'la', english: 'The Most High' },
  88: { name: 'Al-Ghashiyah', english: 'The Overwhelming' },
  89: { name: 'Al-Fajr', english: 'The Dawn' },
  90: { name: 'Al-Balad', english: 'The City' },
  91: { name: 'Ash-Shams', english: 'The Sun' },
  92: { name: 'Al-Layl', english: 'The Night' },
  93: { name: 'Ad-Duha', english: 'The Morning Hours' },
  94: { name: 'Ash-Sharh', english: 'The Relief' },
  95: { name: 'At-Tin', english: 'The Fig' },
  96: { name: 'Al-A\'laq', english: 'The Clot' },
  97: { name: 'Al-Qadr', english: 'The Power' },
  98: { name: 'Al-Bayyinah', english: 'The Clear Proof' },
  99: { name: 'Az-Zalzalah', english: 'The Earthquake' },
  100: { name: 'Al-Adiyat', english: 'The Courser' },
  101: { name: 'Al-Qari\'ah', english: 'The Calamity' },
  102: { name: 'At-Takathur', english: 'The Rivalry in Worldly Increase' },
  103: { name: 'Al-Asr', english: 'The Declining Day' },
  104: { name: 'Al-Humazah', english: 'The Traducer' },
  105: { name: 'Al-Fil', english: 'The Elephant' },
  106: { name: 'Quraysh', english: 'Quraysh' },
  107: { name: 'Al-Ma\'un', english: 'The Small Kindness' },
  108: { name: 'Al-Kawthar', english: 'The Abundance' },
  109: { name: 'Al-Kafirun', english: 'The Disbelievers' },
  110: { name: 'An-Nasr', english: 'The Divine Support' },
  111: { name: 'Al-Masad', english: 'The Palm Fiber' },
  112: { name: 'Al-Ikhlas', english: 'The Sincerity' },
  113: { name: 'Al-Falaq', english: 'The Daybreak' },
  114: { name: 'An-Nas', english: 'Mankind' }
};

export function enrichQuranTrack(track) {
  if (!track || typeof track !== 'object') return track;

  // Gather all possible text clues (title, name, id, url filename)
  let clueText = `${track.title || ''} ${track.name || ''} ${track.id || ''}`.trim();
  if (track.url) {
    try {
      const urlParts = track.url.split('/');
      const lastPart = decodeURIComponent(urlParts[urlParts.length - 1] || '');
      clueText += ` ${lastPart}`;
    } catch {
      // ignore
    }
  }

  const titleTrimmed = String(track.title || '').trim();
  const nameTrimmed = String(track.name || '').trim();
  let surahNum = null;

  // 1. Exact number check on title or name (e.g. "001", "1", "002", "114", "001.mp3", "002.mp3", "114.mp3")
  const exactMatch = (titleTrimmed || nameTrimmed).match(/^0*([1-9]|[1-9]\d|10\d|11[0-4])(?:\.mp3|\.m4a|\.wav|\.flac)?$/i);
  if (exactMatch) {
    surahNum = parseInt(exactMatch[1], 10);
  } else {
    // 2. Check if candidate text matches padded numbers 001..114 followed by .mp3/_/- or boundary
    const paddedMatch = clueText.match(/(?:^|\D)(00[1-9]|0[1-9]\d|10\d|11[0-4])(?:\.mp3|\.m4a|\.wav|\.flac|[_.-]|\s|$)/i);
    if (paddedMatch) {
      surahNum = parseInt(paddedMatch[1], 10);
    } else {
      // 3. Check for explicit keywords like "surah 1", "surah 001", "quran 114"
      const keywordMatch = clueText.match(/(?:surah|sura|quran|qur'an|tilawat)\s*0*([1-9]|[1-9]\d|10\d|11[0-4])\b/i);
      if (keywordMatch) {
        surahNum = parseInt(keywordMatch[1], 10);
      }
    }
  }

  if (surahNum >= 1 && surahNum <= 114 && QURAN_SURAHS[surahNum]) {
    const info = QURAN_SURAHS[surahNum];
    const padded = String(surahNum).padStart(3, '0');
    const expectedPrefix = `${padded}. Surah ${info.name}`;

    // If not already formatted with the Surah prefix
    if (!titleTrimmed.startsWith(expectedPrefix)) {
      let newTitle = `${padded}. Surah ${info.name} (${info.english})`;
      
      // If original title had descriptive text that is not just the number or filename or surah name, preserve it
      if (
        titleTrimmed &&
        !/^0*([1-9]|[1-9]\d|10\d|11[0-4])(?:\.mp3|\.m4a|\.wav|\.flac|[_.-].*)?$/i.test(titleTrimmed) &&
        !titleTrimmed.toLowerCase().includes(info.name.toLowerCase()) &&
        !titleTrimmed.toLowerCase().includes(info.english.toLowerCase())
      ) {
        newTitle = `${padded}. Surah ${info.name} - ${titleTrimmed}`;
      }

      const currentArtist = String(track.artist || '').trim();
      const newArtist = (!currentArtist || currentArtist === 'Unknown Artist' || /^\d+$/.test(currentArtist))
        ? 'Holy Quran Recitation'
        : currentArtist;

      const currentAlbum = String(track.album || '').trim();
      const newAlbum = (!currentAlbum || currentAlbum === 'Unknown Album' || /^\d+$/.test(currentAlbum))
        ? 'Al-Qur\'an Al-Kareem (The Holy Quran)'
        : currentAlbum;

      return {
        ...track,
        title: newTitle,
        artist: newArtist,
        album: newAlbum,
        genre: 'Islamic / Quran',
        artwork: track.artwork || '/assets/kaaba_cover.jpg'
      };
    } else {
      // Title already correct, but ensure artwork is present
      return {
        ...track,
        genre: 'Islamic / Quran',
        artwork: track.artwork || '/assets/kaaba_cover.jpg'
      };
    }
  }

  return track;
}

export function enrichTrackList(tracks) {
  if (!Array.isArray(tracks)) return tracks;
  return tracks.map(track => enrichQuranTrack(track));
}

