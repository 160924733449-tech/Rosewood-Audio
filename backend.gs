function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload;

    if (!action) {
      return jsonResponse({ error: "No action provided" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    setupSheets(ss);

    let result = {};

    switch (action) {
      case 'signup':
        result = handleSignup(ss, payload);
        break;
      case 'login':
        result = handleLogin(ss, payload);
        break;
      case 'saveUserState':
        result = handleSaveUserState(ss, payload);
        break;
      case 'getUserState':
        result = handleGetUserState(ss, payload);
        break;
      case 'savePlaylist':
        result = handleSavePlaylist(ss, payload);
        break;
      case 'deletePlaylist':
        result = handleDeletePlaylist(ss, payload);
        break;
      case 'getPlaylists':
        result = handleGetPlaylists(ss, payload);
        break;
      case 'saveAffinity':
        result = handleSaveAffinity(ss, payload);
        break;
      case 'getAffinities':
        result = handleGetAffinities(ss, payload);
        break;
      case 'appendHistory':
        result = handleAppendHistory(ss, payload);
        break;
      default:
        return jsonResponse({ error: "Unknown action" });
    }

    return jsonResponse({ success: true, data: result });

  } catch (error) {
    return jsonResponse({ error: error.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheets(ss) {
  const requiredSheets = ['Users', 'Playlists', 'AcousticAffinity', 'History'];
  requiredSheets.forEach(title => {
    let sheet = ss.getSheetByName(title);
    if (!sheet) {
      sheet = ss.insertSheet(title);
      if (title === 'Users') sheet.appendRow(['username', 'password', 'last_played_track_id', 'last_played_position_sec', 'created_at']);
      if (title === 'Playlists') sheet.appendRow(['username', 'playlist_id', 'playlist_name', 'track_ids', 'updated_at']);
      if (title === 'AcousticAffinity') sheet.appendRow(['username', 'category', 'tag_name', 'affinity_score']);
      if (title === 'History') sheet.appendRow(['username', 'track_id', 'track_name', 'played_at', 'duration_seconds', 'completed']);
    }
  });
}

function handleSignup(ss, payload) {
  const { username, password } = payload;
  if (!username || !password) throw new Error("Missing credentials");

  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      throw new Error("Username already taken");
    }
  }

  sheet.appendRow([username, password, '', 0, Date.now()]);
  return { username };
}

function handleLogin(ss, payload) {
  const { username, password } = payload;
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === password) {
      return { username };
    }
  }
  throw new Error("Invalid username or password");
}

function handleSaveUserState(ss, payload) {
  const { username, trackId, positionSec } = payload;
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 3).setValue(trackId);
      sheet.getRange(i + 1, 4).setValue(positionSec);
      return { saved: true };
    }
  }
  return { saved: false };
}

function handleGetUserState(ss, payload) {
  const { username } = payload;
  const sheet = ss.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return {
        trackId: data[i][2],
        positionSec: parseFloat(data[i][3]) || 0
      };
    }
  }
  return null;
}

function handleSavePlaylist(ss, payload) {
  const { username, playlistId, playlistName, trackIds } = payload;
  const sheet = ss.getSheetByName('Playlists');
  const data = sheet.getDataRange().getValues();
  const tracksJson = JSON.stringify(trackIds);

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === playlistId) {
      sheet.getRange(i + 1, 3).setValue(playlistName);
      sheet.getRange(i + 1, 4).setValue(tracksJson);
      sheet.getRange(i + 1, 5).setValue(Date.now());
      return { saved: true };
    }
  }

  sheet.appendRow([username, playlistId, playlistName, tracksJson, Date.now()]);
  return { saved: true };
}

function handleDeletePlaylist(ss, payload) {
  const { username, playlistId } = payload;
  const sheet = ss.getSheetByName('Playlists');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === playlistId) {
      sheet.deleteRow(i + 1);
      return { deleted: true };
    }
  }
  return { deleted: false };
}

function handleGetPlaylists(ss, payload) {
  const { username } = payload;
  const sheet = ss.getSheetByName('Playlists');
  const data = sheet.getDataRange().getValues();
  const playlists = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      try {
        playlists.push({
          id: data[i][1],
          name: data[i][2],
          tracks: JSON.parse(data[i][3] || '[]')
        });
      } catch (e) {}
    }
  }
  return playlists;
}

function handleSaveAffinity(ss, payload) {
  const { username, category, tagName, score } = payload;
  const sheet = ss.getSheetByName('AcousticAffinity');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === category && data[i][2] === tagName) {
      sheet.getRange(i + 1, 4).setValue(score);
      return { saved: true };
    }
  }
  sheet.appendRow([username, category, tagName, score]);
  return { saved: true };
}

function handleGetAffinities(ss, payload) {
  const { username } = payload;
  const sheet = ss.getSheetByName('AcousticAffinity');
  const data = sheet.getDataRange().getValues();
  const affinities = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      affinities.push({
        key: `${data[i][1]}:${data[i][2]}`,
        score: parseFloat(data[i][3]) || 0
      });
    }
  }
  return affinities;
}

function handleAppendHistory(ss, payload) {
  const { username, trackId, trackName, durationSec, completed } = payload;
  const sheet = ss.getSheetByName('History');
  sheet.appendRow([username, trackId, trackName, Date.now(), durationSec, completed]);
  return { saved: true };
}
