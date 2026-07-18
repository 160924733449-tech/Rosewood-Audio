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
  const cleanArtist = artist && artist !== 'Unknown Artist' ? artist : '';
  const cleanTitle = title || '';
  if (!cleanTitle) return null;

  const query = `${cleanArtist} ${cleanTitle}`.trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const artwork = result.artworkUrl100 ? result.artworkUrl100.replace('100x100bb.jpg', '500x500bb.jpg') : null;
      const duration = result.trackTimeMillis ? result.trackTimeMillis / 1000 : null;
      return {
        artwork,
        duration,
        title: result.trackName || null,
        artist: result.artistName || null,
        album: result.collectionName || null,
        genre: result.primaryGenreName || null,
        year: result.releaseDate ? result.releaseDate.substring(0, 4) : null
      };

      }
    } catch (error) {
      console.warn("iTunes fetch failed:", error);
    }
    return null;
}

/**
 * Normalizes messy ID3 genre strings into clean Macro-Categories (Spotify-style)
 */
export function normalizeGenre(rawGenre, artist = '', title = '') {
  const g = (rawGenre || '').toLowerCase();
  const a = (artist || '').toLowerCase();
  
  // 1. Bollywood & Desi
  const isDesiGenre = g.includes('bollywood') || g.includes('hindi') || g.includes('indian') || g.includes('desi') || g.includes('punjabi');
  const desiArtists = ['arijit', 'shreya', 'rahman', 'pritam', 'badshah', 'neha kakkar', 'sonu nigam', 'kishore', 'lata', 'armaan', 'jubin', 'shankar', 'vishal', 'darshan'];
  const isDesiArtist = desiArtists.some(name => a.includes(name));
  if (isDesiGenre || isDesiArtist) return 'Bollywood & Desi';
  
  // 2. K-Pop
  const isKpopGenre = g.includes('k-pop') || g.includes('kpop') || g.includes('korean');
  const kpopArtists = ['bts', 'blackpink', 'twice', 'stray kids', 'newjeans', 'seventeen', 'txt', 'enhypen', 'aespa', 'exo', 'red velvet', 'jung kook', 'jimin'];
  const isKpopArtist = kpopArtists.some(name => a.includes(name));
  if (isKpopGenre || isKpopArtist) return 'K-Pop';
  
  // 3. Electronic & Chill
  const isElectronicGenre = g.includes('electronic') || g.includes('dance') || g.includes('house') || g.includes('techno') || g.includes('edm') || g.includes('lo-fi') || g.includes('lofi');
  const electronicArtists = ['daft punk', 'skrillex', 'deadmau5', 'avicii', 'marshmello', 'kygo', 'tiesto', 'david guetta', 'calvin harris', 'alan walker'];
  const isElectronicArtist = electronicArtists.some(name => a.includes(name));
  if (isElectronicGenre || isElectronicArtist) return 'Electronic & Chill';

  // 4. Hip-Hop & R&B
  const isHipHopGenre = g.includes('hip-hop') || g.includes('hip hop') || g.includes('rap') || g.includes('r&b');
  const hiphopArtists = ['drake', 'eminem', 'kanye', 'kendrick', 'travis scott', 'j. cole', 'post malone', 'the weeknd', 'sza', 'frank ocean'];
  const isHipHopArtist = hiphopArtists.some(name => a.includes(name));
  if (isHipHopGenre || isHipHopArtist) return 'Hip-Hop & R&B';
  
  // 5. Hollywood & Pop
  const isWesternGenre = g.includes('pop') || g.includes('rock') || g.includes('english') || g.includes('hollywood') || g.includes('alternative') || g.includes('indie');
  const westernArtists = ['taylor swift', 'ed sheeran', 'justin bieber', 'dua lipa', 'ariana grande', 'billie eilish', 'harry styles', 'bruno mars', 'maroon 5', 'coldplay', 'imagine dragons'];
  const isWesternArtist = westernArtists.some(name => a.includes(name));
  if (isWesternGenre || isWesternArtist) return 'Hollywood & Pop';
  
  // If we can't safely macro-categorize it, just return 'All Songs' or the raw genre if it's short
  if (g.length > 2 && g.length < 15) {
    // Capitalize first letter of each word
    return rawGenre.replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return 'Global';
}
