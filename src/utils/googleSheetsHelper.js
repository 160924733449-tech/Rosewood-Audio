import { db } from '../config/firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, addDoc } from 'firebase/firestore';

export async function loginUser(username, password) {
  try {
    const userRef = doc(db, 'users', username);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().password === password) {
      return { username };
    }
    throw new Error("Invalid username or password");
  } catch (err) {
    console.error("Login error:", err);
    return null;
  }
}

export async function signupUser(username, password) {
  try {
    const userRef = doc(db, 'users', username);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      throw new Error("Username already exists");
    }
    await setDoc(userRef, { username, password, createdAt: Date.now() });
    return { username };
  } catch (err) {
    console.error("Signup error:", err);
    return null;
  }
}

export async function saveUserStateInSheet(username, trackId, positionSec) {
  try {
    const stateRef = doc(db, `users/${username}/state/current`);
    await setDoc(stateRef, { trackId, positionSec }, { merge: true });
    return { saved: true };
  } catch (err) {
    console.error("Save state error:", err);
    return null;
  }
}

export async function getUserStateFromSheet(username) {
  try {
    const stateRef = doc(db, `users/${username}/state/current`);
    const snap = await getDoc(stateRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error("Get state error:", err);
    return null;
  }
}

export async function savePlaylistToSheet(username, playlistId, playlistName, trackIds) {
  try {
    const playlistRef = doc(db, `users/${username}/playlists/${playlistId}`);
    await setDoc(playlistRef, {
      playlistId,
      playlistName,
      trackIds,
      updatedAt: Date.now()
    });
    return { saved: true };
  } catch (err) {
    console.error("Save playlist error:", err);
    return null;
  }
}

export async function deletePlaylistFromSheet(username, playlistId) {
  try {
    const playlistRef = doc(db, `users/${username}/playlists/${playlistId}`);
    await deleteDoc(playlistRef);
    return { deleted: true };
  } catch (err) {
    console.error("Delete playlist error:", err);
    return null;
  }
}

export async function getAllPlaylistsFromSheet(username) {
  try {
    const playlistsRef = collection(db, `users/${username}/playlists`);
    const snap = await getDocs(playlistsRef);
    const playlists = [];
    snap.forEach(doc => {
      playlists.push({
        id: doc.data().playlistId,
        name: doc.data().playlistName,
        tracks: doc.data().trackIds || []
      });
    });
    return playlists;
  } catch (err) {
    console.error("Get playlists error:", err);
    return [];
  }
}

export async function saveAffinityToSheet(username, category, tagName, score) {
  try {
    const affinityRef = doc(db, `users/${username}/affinities/${category}_${tagName}`);
    await setDoc(affinityRef, {
      category,
      tagName,
      score
    });
    return { saved: true };
  } catch (err) {
    console.error("Save affinity error:", err);
    return null;
  }
}

export async function getAllAffinitiesFromSheet(username) {
  try {
    const affinitiesRef = collection(db, `users/${username}/affinities`);
    const snap = await getDocs(affinitiesRef);
    const affinities = [];
    snap.forEach(doc => {
      affinities.push({
        key: `${doc.data().category}:${doc.data().tagName}`,
        score: doc.data().score
      });
    });
    return affinities;
  } catch (err) {
    console.error("Get affinities error:", err);
    return [];
  }
}

export async function appendHistoryToSheet(username, trackId, trackName, durationSec, completed) {
  try {
    const historyRef = collection(db, `users/${username}/history`);
    await addDoc(historyRef, {
      trackId,
      trackName,
      durationSec,
      completed,
      playedAt: Date.now()
    });
    return { saved: true };
  } catch (err) {
    console.error("Append history error:", err);
    return null;
  }
}
