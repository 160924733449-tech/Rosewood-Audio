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
      const files = await scanDirectory(dirHandle);
      
      return files.map(file => {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const parts = cleanName.split(' - ');
        let artist = 'Unknown Artist';
        let title = cleanName;
        if (parts.length > 1) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        return {
          id: `local:${file.name}`,
          name: file.name,
          title,
          artist,
          album: 'Unknown Album',
          genre: 'Local Music',
          year: '',
          artwork: null,
          duration: null,
          source: 'local',
          fileHandle: file.fileHandle,
          url: ''
        };
      });
    } catch (err) {
      console.error('Directory Picker error:', err);
      return [];
    }
  }
}
