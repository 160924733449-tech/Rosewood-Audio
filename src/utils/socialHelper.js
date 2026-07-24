import { db } from '../config/firebase';
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export const broadcastNowPlaying = async (username, track, isPlaying) => {
  if (!username) return;
  try {
    const presenceRef = doc(db, 'presence', username);
    await setDoc(presenceRef, {
      username,
      trackId: track?.id || null,
      trackTitle: track?.title || 'Unknown Track',
      trackArtist: track?.artist || 'Unknown Artist',
      trackArtwork: track?.artwork || null,
      isPlaying: isPlaying || false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error broadcasting playback:', error);
  }
};

export const stopBroadcasting = async (username) => {
  if (!username) return;
  try {
    const presenceRef = doc(db, 'presence', username);
    await deleteDoc(presenceRef);
  } catch (error) {
    console.error('Error stopping broadcast:', error);
  }
};

export const subscribeFriendActivity = (callback) => {
  try {
    const presenceRef = collection(db, 'presence');
    const unsubscribe = onSnapshot(presenceRef, (snapshot) => {
      const friendsList = snapshot.docs.map(doc => doc.data());
      callback(friendsList);
    });
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to friend activity:', error);
    return () => {};
  }
};

const generateSessionId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const createJamSession = async (hostUsername) => {
  if (!hostUsername) return null;
  try {
    const sessionId = generateSessionId();
    const sessionRef = doc(db, 'jam_sessions', sessionId);
    await setDoc(sessionRef, {
      hostUsername,
      participants: [hostUsername],
      currentTrackId: null,
      isPlaying: false,
      currentTime: 0,
      createdAt: new Date().toISOString()
    });
    return sessionId;
  } catch (error) {
    console.error('Error creating jam session:', error);
    return null;
  }
};

export const joinJamSession = async (sessionId, username) => {
  if (!sessionId || !username) return false;
  try {
    const sessionRef = doc(db, 'jam_sessions', sessionId);
    await updateDoc(sessionRef, {
      participants: arrayUnion(username)
    });
    return true;
  } catch (error) {
    console.error('Error joining jam session:', error);
    return false;
  }
};

export const syncJamSession = async (sessionId, trackId, isPlaying, currentTime) => {
  if (!sessionId) return;
  try {
    const sessionRef = doc(db, 'jam_sessions', sessionId);
    await updateDoc(sessionRef, {
      currentTrackId: trackId || null,
      isPlaying: isPlaying || false,
      currentTime: currentTime || 0,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing jam session:', error);
  }
};

export const subscribeJamSession = (sessionId, callback) => {
  if (!sessionId) return () => {};
  try {
    const sessionRef = doc(db, 'jam_sessions', sessionId);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null); // Session ended or doesn't exist
      }
    });
    return unsubscribe;
  } catch (error) {
    console.error('Error subscribing to jam session:', error);
    return () => {};
  }
};

export const leaveJamSession = async (sessionId, username) => {
  if (!sessionId || !username) return;
  try {
    const sessionRef = doc(db, 'jam_sessions', sessionId);
    await updateDoc(sessionRef, {
      participants: arrayRemove(username)
    });
  } catch (error) {
    console.error('Error leaving jam session:', error);
  }
};
