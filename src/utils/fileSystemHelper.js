import { normalizeGenre } from './metadataHelper.js';

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
      const MediaStorePlugin = window.Capacitor.Plugins.MediaStorePlugin;
      if (!MediaStorePlugin) {
        console.error("MediaStorePlugin is not available. Please rebuild the native app.");
        return [];
      }
      
      const result = await MediaStorePlugin.getAudioFiles();
      if (!result || !result.files) return [];
      
      return result.files.map(f => {
        // We now get title and artist directly from the MediaStore if available
        let title = f.title && f.title !== 'Unknown Title' ? f.title : f.name.replace(/\.[^/.]+$/, "");
        let artist = f.artist && f.artist !== '<unknown>' ? f.artist : 'Unknown Artist';
        
        // If MediaStore didn't know the artist, try to fallback to filename parsing just in case
        if (artist === 'Unknown Artist' || artist === '<unknown>') {
          const cleanName = f.name.replace(/\.[^/.]+$/, "");
          const parts = cleanName.split(' - ');
          if (parts.length > 1) {
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
          }
        }

        return {
          id: `local:${f.id}`,
          name: f.name,
          title,
          artist,
          album: 'Unknown Album',
          genre: normalizeGenre(null, artist, title),
          year: '',
          artwork: null,
          duration: null,
          source: 'local',
          devicePath: f.path,
          url: ''
        };
      });
    } catch (e) {
      console.error('MediaStore auto-scan error:', e);
      return [];
    }
  } else {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const fileHandles = await scanDirectory(dirHandle);
      
      const tracks = await Promise.all(fileHandles.map(async fileInfo => {
        const cleanName = fileInfo.name.replace(/\.[^/.]+$/, "");
        const parts = cleanName.split(' - ');
        let artist = 'Unknown Artist';
        let title = cleanName;
        
        if (parts.length > 1) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        return {
          id: fileInfo.id,
          name: fileInfo.name,
          title,
          artist,
          album: 'Unknown Album',
          genre: normalizeGenre(null, artist, title),
          year: '',
          artwork: null,
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
