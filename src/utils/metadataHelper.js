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
    console.error('Failed to fetch iTunes metadata:', error);
  }
  return null;
}

