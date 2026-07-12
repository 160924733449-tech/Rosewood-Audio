function getCachedToken() {
  return null; // Google Auth has been removed
}

/**
 * Searches for a folder by name in the user's Drive.
 */
export async function findLibraryFolder(folderName) {
  const token = getCachedToken();
  if (!token) throw new Error('No access token found');

  const query = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Failed to find folder: ' + res.statusText);
  }

  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

/**
 * Lists all audio files inside a Google Drive folder recursively.
 */
export async function listAudioFilesFromFolder(folderId) {
  const token = getCachedToken();
  if (!token) throw new Error('No access token found');

  let allFiles = [];
  let pageToken = '';

  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.flac' or name contains '.wav' or name contains '.m4a')`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,createdTime)&pageSize=1000&pageToken=${pageToken}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error('Failed to list files: ' + res.statusText);
    }

    const data = await res.json();
    if (data.files) {
      allFiles = allFiles.concat(data.files);
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return allFiles.map(file => {
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    const parts = cleanName.split(' - ');
    let artist = 'Unknown Artist';
    let title = cleanName;

    if (parts.length > 1) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    return {
      id: file.id,
      name: file.name,
      title,
      artist,
      album: 'Google Drive Album',
      genre: 'Cloud Music',
      year: file.createdTime ? file.createdTime.substring(0, 4) : '',
      size: parseInt(file.size || '0'),
      source: 'gdrive',
      url: getStreamUrl(file.id)
    };
  });
}

/**
 * Generates the direct streaming link for an audio file.
 */
export function getStreamUrl(fileId) {
  const token = getCachedToken();
  if (!token) return '';
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${token}`;
}
