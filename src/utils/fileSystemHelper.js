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
