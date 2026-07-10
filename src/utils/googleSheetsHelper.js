import { getCachedToken } from './googleAuth';

/**
 * Creates required sheets (Users, Playlists, Affinity, History) in the spreadsheet if they don't exist.
 */
export async function initDatabaseSheet(spreadsheetId) {
  const token = getCachedToken();
  if (!token) return;

  try {
    // 1. Get spreadsheet metadata to see existing sheets
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) throw new Error('Failed to get sheet metadata: ' + metaRes.statusText);
    const metaData = await metaRes.json();
    const existingTitles = metaData.sheets.map(s => s.properties.title);

    const requiredSheets = ['Users', 'Playlists', 'AcousticAffinity', 'History'];
    const sheetsToAdd = requiredSheets.filter(title => !existingTitles.includes(title));

    if (sheetsToAdd.length > 0) {
      // Create new sheets
      const requests = sheetsToAdd.map(title => ({
        addSheet: { properties: { title } }
      }));

      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const updateRes = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });

      if (!updateRes.ok) throw new Error('Failed to create tabs: ' + updateRes.statusText);

      // Now add headers for the new sheets
      for (const title of sheetsToAdd) {
        let headers = [];
        if (title === 'Users') headers = [['user_id', 'email', 'display_name', 'last_played_track_id', 'last_played_position_sec', 'last_saved_at']];
        if (title === 'Playlists') headers = [['user_id', 'playlist_id', 'playlist_name', 'track_ids', 'updated_at']];
        if (title === 'AcousticAffinity') headers = [['user_id', 'category', 'tag_name', 'affinity_score']];
        if (title === 'History') headers = [['user_id', 'track_id', 'track_name', 'played_at', 'duration_seconds', 'completed']];

        await updateSheetValues(spreadsheetId, `${title}!A1`, headers);
      }
    }
  } catch (err) {
    console.error('Failed to initialize database spreadsheet:', err);
  }
}

/**
 * Helper to update values in a specific range.
 */
async function updateSheetValues(spreadsheetId, range, values) {
  const token = getCachedToken();
  if (!token) return;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });
}

/**
 * Saves/Updates the user state in the Users sheet.
 */
export async function saveUserStateInSheet(spreadsheetId, userId, email, displayName, trackId, positionSec) {
  const token = getCachedToken();
  if (!token || !spreadsheetId) return;

  try {
    const range = 'Users!A:F';
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;
    const data = await res.json();
    const rows = data.values || [];

    let userRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === userId) {
        userRowIndex = i + 1; // 1-indexed row number
        break;
      }
    }

    const rowData = [userId, email, displayName, trackId || '', positionSec || 0, Date.now()];

    if (userRowIndex !== -1) {
      // Update existing row
      await updateSheetValues(spreadsheetId, `Users!A${userRowIndex}:F${userRowIndex}`, [rowData]);
    } else {
      // Append new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A:F:append?valueInputOption=USER_ENTERED`;
      await fetch(appendUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [rowData] })
      });
    }
  } catch (err) {
    console.error('Error saving user state in Google Sheet:', err);
  }
}

/**
 * Loads the user profile state from the Users sheet.
 */
export async function getUserStateFromSheet(spreadsheetId, userId) {
  const token = getCachedToken();
  if (!token || !spreadsheetId) return null;

  try {
    const range = 'Users!A:F';
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rows = data.values || [];

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === userId) {
        return {
          userId: rows[i][0],
          email: rows[i][1],
          displayName: rows[i][2],
          lastPlayedTrackId: rows[i][3],
          lastPlayedPositionSec: parseFloat(rows[i][4] || '0'),
          lastSavedAt: rows[i][5]
        };
      }
    }
  } catch (err) {
    console.error('Error getting user state from Google Sheet:', err);
  }
  return null;
}
