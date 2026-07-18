import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export async function extractMetadata(file) {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: function(tag) {
        resolve(tag.tags);
      },
      onError: function(error) {
        resolve(null);
      }
    });
  });
}

export async function scanDirectory(dirHandle) {
  const files = [];
  
  async function scan(handle, currentPath = '') {
    try {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          const ext = entry.name.split('.').pop().toLowerCase();
          const supported = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'webm'];
          if (supported.includes(ext)) {
            files.push({
              id: `local:${currentPath ? `${currentPath}/${entry.name}` : entry.name}`,
              name: entry.name,
              path: currentPath ? `${currentPath}/${entry.name}` : entry.name,
              fileHandle: entry,
              source: 'local'
            });
          }
        } else if (entry.kind === 'directory') {
          await scan(entry, currentPath ? `${currentPath}/${entry.name}` : entry.name);
        }
      }
    } catch (err) {
      console.error('Error scanning folder entry:', err);
    }
  }

  await scan(dirHandle);
  return files;
}

export async function triggerFileSelect() {
  const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
  if (isCapacitor) {
    try {
      const { FilePicker } = await import('@capawesome/capacitor-file-picker');
      const result = await FilePicker.pickFiles({
        types: ['audio/*'],
        multiple: true,
      });

      return result.files.map(f => {
        const cleanName = f.name.replace(/\.[^/.]+$/, "");
        const parts = cleanName.split(' - ');
        let artist = 'Unknown Artist';
        let title = cleanName;
        if (parts.length > 1) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        return {
          id: `local:${f.name}`,
          name: f.name,
          title,
          artist,
          album: 'Unknown Album',
          genre: 'Local Music',
          year: '',
          artwork: null,
          duration: null,
          source: 'local',
          devicePath: f.path,
          url: ''
        };
      });
    } catch (e) {
      console.error('Native FilePicker error:', e);
      return [];
    }
  } else {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const fileHandles = await scanDirectory(dirHandle);
      
      const tracks = await Promise.all(fileHandles.map(async fileInfo => {
        const file = await fileInfo.fileHandle.getFile();
        const tags = await extractMetadata(file);
        
        const cleanName = fileInfo.name.replace(/\.[^/.]+$/, "");
        const parts = cleanName.split(' - ');
        let artist = 'Unknown Artist';
        let title = cleanName;
        
        if (parts.length > 1) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        // Override with metadata if available
        if (tags) {
          if (tags.title) title = tags.title;
          if (tags.artist) artist = tags.artist;
        }

        let album = tags?.album || 'Unknown Album';
        let genre = tags?.genre || 'Uncategorized';
        
        // Clean up genre (sometimes they come in formats like "(17)Rock")
        if (genre.includes(')')) {
          genre = genre.split(')').pop().trim() || 'Uncategorized';
        }

        return {
          id: fileInfo.id,
          name: fileInfo.name,
          title,
          artist,
          album,
          genre,
          year: tags?.year || '',
          artwork: null, // Artwork extraction is handled async when playing to save memory
          duration: null,
          source: 'local',
          fileHandle: fileInfo.fileHandle,
          url: ''
        };
      }));
      
      return tracks;
    } catch (err) {
      console.error('Directory Picker error:', err);
      return [];
    }
  }
}
