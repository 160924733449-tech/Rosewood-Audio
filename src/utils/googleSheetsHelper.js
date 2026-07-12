// Centralized API calls to the Google Apps Script Backend

const getEndpoint = () => import.meta.env.VITE_GOOGLE_SHEET_ENDPOINT;

async function apiCall(action, payload) {
  const endpoint = getEndpoint();
  if (!endpoint) {
    console.error("VITE_GOOGLE_SHEET_ENDPOINT is missing from .env");
    return null;
  }
  
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Use text/plain to avoid CORS preflight issues
      },
      body: JSON.stringify({ action, payload })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.data;
  } catch (err) {
    console.error(`Backend API Error [${action}]:`, err);
    return null;
  }
}

export async function loginUser(username, password) {
  return await apiCall('login', { username, password });
}

export async function signupUser(username, password) {
  return await apiCall('signup', { username, password });
}

export async function saveUserStateInSheet(username, trackId, positionSec) {
  return await apiCall('saveUserState', { username, trackId, positionSec });
}

export async function getUserStateFromSheet(username) {
  return await apiCall('getUserState', { username });
}

export async function savePlaylistToSheet(username, playlistId, playlistName, trackIds) {
  return await apiCall('savePlaylist', { username, playlistId, playlistName, trackIds });
}

export async function deletePlaylistFromSheet(username, playlistId) {
  return await apiCall('deletePlaylist', { username, playlistId });
}

export async function getAllPlaylistsFromSheet(username) {
  return await apiCall('getPlaylists', { username });
}

export async function saveAffinityToSheet(username, category, tagName, score) {
  return await apiCall('saveAffinity', { username, category, tagName, score });
}

export async function getAllAffinitiesFromSheet(username) {
  return await apiCall('getAffinities', { username });
}

export async function appendHistoryToSheet(username, trackId, trackName, durationSec, completed) {
  return await apiCall('appendHistory', { username, trackId, trackName, durationSec, completed });
}
