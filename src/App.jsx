import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import MainView from './components/MainView';
import PlayerBar from './components/PlayerBar';
import NowPlayingOverlay from './components/NowPlayingOverlay';

import { getAllTracks, saveTracks, saveTrack, getAllPlaylists, savePlaylist, deletePlaylist } from './utils/db';
import { recordPlayEvent, decayFatigue, getNextTrackAutoplay } from './utils/recommendationEngine';
import { saveUserStateInSheet, getUserStateFromSheet, initDatabaseSheet } from './utils/googleSheetsHelper';
import { logoutGoogle } from './utils/googleAuth';
import { fetchSharedLibraryTracks, getStreamUrlForTrack } from './utils/sharedLibraryHelper';
import { parseMetadata } from './utils/metadataHelper';
import { getStreamUrl } from './utils/googleDriveHelper';

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(null);
    });
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 2000);
  });
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userMode, setUserMode] = useState(null); // 'local', 'shared', 'google'
  const [userProfile, setUserProfile] = useState(null);
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [loadingTrack, setLoadingTrack] = useState(false);

  const [tracks, setTracks] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [activeQueue, setActiveQueue] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylistId, setActivePlaylistId] = useState(null);

  const [currentTab, setCurrentTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(parseFloat(localStorage.getItem('aura_volume') || '0.8'));
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [playedHistory, setPlayedHistory] = useState([]);
  const [isNowPlayingExpanded, setIsNowPlayingExpanded] = useState(false);


  const audioRef = useRef(null);
  const currentTrackRef = useRef(null);
  const preloadAudioRef = useRef(null);
  const preloadedUrlsRef = useRef({});
  const loadingTrackIdRef = useRef(null);
  const consecutiveSkipsRef = useRef(0); // Track consecutive auto-skips to prevent infinite loops
  const handlersRef = useRef({}); // Store latest handlers for event listeners

  // Keep currentTrackRef in sync
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const determineNextTrack = async (currTrack) => {
    if (tracks.length === 0) return null;
    let nextTrack = null;

    if (shuffle) {
      nextTrack = await getNextTrackAutoplay(tracks, currTrack);
    } else {
      const queue = activeQueue.length > 0 ? activeQueue : tracks;
      const currentIndex = queue.findIndex(t => t.id === (currTrack?.id || ''));
      if (currentIndex !== -1 && currentIndex < queue.length - 1) {
        nextTrack = queue[currentIndex + 1];
      } else {
        nextTrack = queue[0]; // loop back to first
      }
    }
    return nextTrack;
  };

  const determineNextTracks = async (currTrack, count = 3) => {
    if (tracks.length === 0) return [];
    let upcoming = [];
    let current = currTrack;
    
    for (let i = 0; i < count; i++) {
      const next = await determineNextTrack(current);
      if (!next || upcoming.some(t => t.id === next.id)) break;
      upcoming.push(next);
      current = next;
    }
    return upcoming;
  };

  const preloadTrack = async (track) => {
    if (!track || !preloadAudioRef.current) return;

    if (preloadAudioRef.current.getAttribute('data-track-id') === track.id) {
      return;
    }

    try {
      console.log(`[Preloader] Preloading next track: ${track.title} (${track.source})`);
      let preloadUrl = '';

      let finalTrack = track;

      if (finalTrack.source === 'shared' && finalTrack.driveFileId) {
        if (preloadedUrlsRef.current[finalTrack.id]) {
          preloadUrl = preloadedUrlsRef.current[finalTrack.id];
        } else {
          const streamResult = await getStreamUrlForTrack(finalTrack);
          if (streamResult && streamResult.blobUrl) {
            preloadedUrlsRef.current[finalTrack.id] = streamResult.blobUrl;
            preloadUrl = streamResult.blobUrl;
            
            // Extract embedded ID3 tags from the downloaded blob!
            if (streamResult.blob) {
              try {
                const tags = await parseMetadata(streamResult.blob);
                if (tags && (tags.artwork || tags.title !== finalTrack.title)) {
                  finalTrack = {
                    ...finalTrack,
                    artwork: tags.artwork || finalTrack.artwork,
                    title: tags.title || finalTrack.title,
                    artist: tags.artist || finalTrack.artist,
                    album: tags.album || finalTrack.album,
                    genre: tags.genre || finalTrack.genre,
                    year: tags.year || finalTrack.year
                  };
                  setTracks(prev => prev.map(t => t.id === finalTrack.id ? finalTrack : t));
                  await saveTrack(finalTrack);
                }
              } catch (e) {
                console.warn('[Preloader] ID3 extraction error:', e);
              }
            }
          }
        }
      } else if (finalTrack.source === 'local') {
        if (preloadedUrlsRef.current[finalTrack.id]) {
          preloadUrl = preloadedUrlsRef.current[finalTrack.id];
        } else if (finalTrack.fileHandle) {
          const hasPermission = await finalTrack.fileHandle.queryPermission({ mode: 'read' }) === 'granted';
          if (hasPermission) {
            const fileObj = await finalTrack.fileHandle.getFile();
            const freshUrl = URL.createObjectURL(fileObj);
            preloadedUrlsRef.current[finalTrack.id] = freshUrl;
            preloadUrl = freshUrl;
          }
        }
      } else if (finalTrack.source === 'gdrive') {
        preloadUrl = getStreamUrl(finalTrack.id);
      } else {
        preloadUrl = finalTrack.url;
      }

      if (preloadUrl) {
        // Only set the HTMLAudioElement src for the IMMEDIATE next track to ensure gapless buffering
        if (preloadAudioRef.current.getAttribute('data-track-id') !== finalTrack.id && !preloadAudioRef.current.src) {
          preloadAudioRef.current.setAttribute('data-track-id', finalTrack.id);
          preloadAudioRef.current.src = preloadUrl;
          preloadAudioRef.current.preload = 'auto';
          preloadAudioRef.current.load();
          console.log(`[Preloader] Buffering immediate next track: ${finalTrack.title}`);
        } else {
          console.log(`[Preloader] Cached track blob in background: ${finalTrack.title}`);
        }
      }
    } catch (err) {
      console.warn('[Preloader] Preload failed:', err);
    }
  };

  // Background effect to preload the next track
  useEffect(() => {
    if (!currentTrack) return;

    let isSubscribed = true;
    const runPreload = async () => {
      // Delay preload start slightly so it doesn't conflict with current song starting its playback network requests
      await new Promise(resolve => setTimeout(resolve, 3000));
      if (!isSubscribed) return;

      const upcomingTracks = await determineNextTracks(currentTrack, 3);
      if (!isSubscribed) return;
      
      // Clear out preloaded URLs for tracks that are no longer in our upcoming window
      // (This prevents a massive memory leak of Blobs)
      const upcomingIds = new Set(upcomingTracks.map(t => t.id));
      upcomingIds.add(currentTrack.id); // keep current track alive
      
      for (const [id, url] of Object.entries(preloadedUrlsRef.current)) {
        if (!upcomingIds.has(id)) {
          if (url.startsWith('blob:') && audioRef.current?.src !== url) {
            URL.revokeObjectURL(url);
          }
          delete preloadedUrlsRef.current[id];
        }
      }

      // Preload the next 3 tracks sequentially
      for (const nextTrack of upcomingTracks) {
        if (!isSubscribed) break;
        if (!preloadedUrlsRef.current[nextTrack.id]) {
          await preloadTrack(nextTrack);
        }
      }
    };

    // Reset the preload audio ref so the first track in the new upcoming queue takes priority
    if (preloadAudioRef.current) {
       preloadAudioRef.current.src = '';
       preloadAudioRef.current.removeAttribute('data-track-id');
    }

    runPreload();

    return () => {
      isSubscribed = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, shuffle, activeQueue, tracks]);

  // Background ID3 Extraction Runner
  // Silently scans library, downloads chunks, extracts metadata, then safely deletes blob.
  useEffect(() => {
    if (tracks.length === 0 || isPlaying) return;

    let isSubscribed = true;
    const queue = tracks.filter(t => !t.localChecked);

    if (queue.length === 0) return;

    const processQueue = async () => {
      for (const track of queue) {
        if (!isSubscribed || isPlaying) break;
        
        let tagsExtracted = false;
        let updatedTrack = { ...track, localChecked: true };

        try {
          if (track.source === 'shared' && track.driveFileId) {
            const streamResult = await getStreamUrlForTrack(track);
            if (streamResult && streamResult.blob && isSubscribed && !isPlaying) {
              const tags = await parseMetadata(streamResult.blob);
              if (tags && (tags.artwork || tags.title !== track.title)) {
                tagsExtracted = true;
                updatedTrack.artwork = tags.artwork || track.artwork;
                updatedTrack.title = tags.title || track.title;
                updatedTrack.artist = tags.artist || track.artist;
                updatedTrack.album = tags.album || track.album;
                updatedTrack.genre = tags.genre || track.genre;
                updatedTrack.year = tags.year || track.year;
              }
              // CRITICAL: Immediately release the blob to save memory since we aren't caching it for playback yet!
              if (streamResult.blobUrl) {
                URL.revokeObjectURL(streamResult.blobUrl);
              }
            }
          } else if (track.source === 'local' && track.fileHandle) {
             const hasPermission = await track.fileHandle.queryPermission({ mode: 'read' }) === 'granted';
             if (hasPermission) {
               const fileObj = await track.fileHandle.getFile();
               const tags = await parseMetadata(fileObj);
               if (tags) {
                 tagsExtracted = true;
                 updatedTrack.artwork = tags.artwork;
                 updatedTrack.title = tags.title;
                 updatedTrack.artist = tags.artist;
                 updatedTrack.album = tags.album;
                 updatedTrack.genre = tags.genre;
                 updatedTrack.year = tags.year;
               }
             }
          }
        } catch (err) {
          console.warn(`[Background ID3] Failed to parse tags for ${track.name}`, err);
        }

        if (!isSubscribed || isPlaying) break;

        // Save progress (even if failed, we mark as localChecked=true so we don't retry endlessly)
        setTracks(prevTracks => 
          prevTracks.map(t => t.id === track.id ? updatedTrack : t)
        );
        if (currentTrackRef.current && currentTrackRef.current.id === track.id) {
          setCurrentTrack(prev => prev ? { ...prev, ...updatedTrack } : null);
        }
        await saveTrack(updatedTrack);

        // Slow down to protect bandwidth
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    };

    // Wait slightly before kicking off background process
    const timer = setTimeout(() => {
      processQueue();
    }, 4000);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [tracks, isPlaying]);
  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    preloadAudioRef.current = new Audio();
    preloadAudioRef.current.volume = 0; // Preload silently

    const handleTimeUpdate = () => {
      setCurrentTime(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
      const trackDuration = audioRef.current.duration;
      setDuration(trackDuration);

      // Dynamically update the track's duration in the loaded tracks list
      if (currentTrackRef.current) {
        setTracks(prevTracks =>
          prevTracks.map(t => {
            if (t.id === currentTrackRef.current.id && (!t.duration || isNaN(t.duration))) {
              return { ...t, duration: trackDuration };
            }
            return t;
          })
        );
      }
    };

    const handleEnded = () => {
      if (handlersRef.current.handleTrackEnd) {
        handlersRef.current.handleTrackEnd();
      }
    };

    const handleError = (e) => {
      const audio = e.target;
      const err = audio.error;
      // MEDIA_ERR_ABORTED (1) is expected when switching tracks rapidly — don't auto-skip for it
      if (err && err.code === 1) {
        console.warn('[Audio] Playback aborted (user switched tracks)');
        return;
      }
      const codeMap = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };
      const errorName = err ? (codeMap[err.code] || `UNKNOWN(${err.code})`) : 'NO_ERROR_OBJ';
      const trackName = currentTrackRef.current?.title || currentTrackRef.current?.name || 'unknown';
      console.error(`[Audio Error] ${errorName}: ${err?.message || 'unknown'} | Track: ${trackName}`, 'src:', audio.src?.substring(0, 120));
      setIsPlaying(false);
      setLoadingTrack(false);

      // Evict the broken cached URL so a retry doesn't reuse it
      if (currentTrackRef.current) {
        delete preloadedUrlsRef.current[currentTrackRef.current.id];
      }

      // Auto-skip to the next track after a brief delay so the user isn't stuck.
      // Stop after 5 consecutive failures to prevent infinite loops.
      consecutiveSkipsRef.current += 1;
      if (consecutiveSkipsRef.current > 5) {
        console.warn('[Auto-Skip] Stopped after 5 consecutive failures. Some tracks in the library may be unavailable.');
        consecutiveSkipsRef.current = 0;
        return;
      }

      setTimeout(() => {
        if (currentTrackRef.current && handlersRef.current.handleNextTrack) {
          console.log(`[Auto-Skip] Skipping failed track (${consecutiveSkipsRef.current}/5): ${trackName}`);
          handlersRef.current.handleNextTrack();
        }
      }, 300);
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
      }
      if (preloadAudioRef.current) {
        preloadAudioRef.current.pause();
        preloadAudioRef.current.src = '';
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      localStorage.setItem('aura_volume', volume);
    }
  }, [volume]);

  // Load local data if in Local Mode
  useEffect(() => {
    if (loggedIn && userMode === 'local') {
      loadLocalData();
    }
  }, [loggedIn, userMode]);

  const loadLocalData = async () => {
    const cachedTracks = await getAllTracks();
    setTracks(cachedTracks);
    const cachedPlaylists = await getAllPlaylists();
    setPlaylists(cachedPlaylists);

    // Retrieve last played track from localStorage for local mode
    const lastPlayedId = localStorage.getItem('aura_local_last_played');
    const lastPosition = parseFloat(localStorage.getItem('aura_local_last_pos') || '0');
    if (lastPlayedId && cachedTracks.length > 0) {
      const track = cachedTracks.find(t => t.id === lastPlayedId);
      if (track) {
        setTrackSilent(track, lastPosition);
      }
    }
  };

  const handleLoginSuccess = async (authData) => {
    setUserMode(authData.mode);
    setUserProfile(authData.user);
    setLoggedIn(true);

    if (authData.mode === 'shared') {
      const sharedTracks = await fetchSharedLibraryTracks();
      const existingTracks = await getAllTracks();
      const existingMap = new Map(existingTracks.map(t => [t.id, t]));
      
      const mergedTracks = sharedTracks.map(fetched => {
        const existing = existingMap.get(fetched.id);
        if (existing) {
          return { ...fetched, ...existing };
        }
        return fetched;
      });
      setTracks(mergedTracks);
    }

    if (authData.mode === 'google') {
      setGoogleSheetId(authData.sheetId);
      if (authData.sheetId) {
        await initDatabaseSheet(authData.sheetId);
        // Fetch last played state
        const state = await getUserStateFromSheet(authData.sheetId, authData.user.sub || authData.user.email);
        if (state) {
          console.log('Loaded user state from sheet:', state);
        }
      }
    }
  };

  const handleTracksImported = async (importedTracks) => {
    const existingTracks = await getAllTracks();
    const existingMap = new Map(existingTracks.map(t => [t.id, t]));

    const mergedTracks = importedTracks.map(imported => {
      const existing = existingMap.get(imported.id);
      if (existing) {
        return { ...imported, ...existing };
      }
      return imported;
    });

    const importedIds = new Set(importedTracks.map(t => t.id));
    const remainingExisting = existingTracks.filter(t => !importedIds.has(t.id));
    const finalTracks = [...mergedTracks, ...remainingExisting];

    await saveTracks(finalTracks);
    setTracks(finalTracks);
  };

  const handleRefreshLibrary = async () => {
    if (userMode === 'shared') {
      setLoadingTrack(true);
      try {
        const sharedTracks = await fetchSharedLibraryTracks();
        if (sharedTracks && sharedTracks.length > 0) {
          setTracks(prevTracks => {
            const prevMap = new Map(prevTracks.map(t => [t.id, t]));
            return sharedTracks.map(fetched => {
              const existing = prevMap.get(fetched.id);
              if (existing) {
                return { ...fetched, ...existing };
              }
              return fetched;
            });
          });
        }
      } catch (err) {
        console.error('Error refreshing library:', err);
      } finally {
        setLoadingTrack(false);
      }
    }
  };

  const setTrackSilent = (track, startPosition = 0) => {
    if (!audioRef.current) return;
    setCurrentTrack(track);
    if (track.url) {
      audioRef.current.src = track.url;
      audioRef.current.currentTime = startPosition;
    }
    setCurrentTime(startPosition);
    setIsPlaying(false);
  };

  const handlePlayTrack = async (track, queue = []) => {
    if (!audioRef.current) return;

    if (currentTrack) {
      setPlayedHistory(prev => [...prev, currentTrack]);
    }

    // 1. Instantly set track to trigger UI update and glide-up animation
    setCurrentTrack(track);
    setActiveQueue(queue.length > 0 ? queue : tracks);
    setIsPlaying(false);
    loadingTrackIdRef.current = track.id;

    let finalTrack = track;

    // 3. Resolve the audio stream URL in the background
    let playUrl = '';
    if (preloadedUrlsRef.current[track.id]) {
      console.log(`[Playback] Playing preloaded URL instantly: ${track.title}`);
      playUrl = preloadedUrlsRef.current[track.id];
    } else if (preloadAudioRef.current && preloadAudioRef.current.getAttribute('data-track-id') === track.id && preloadAudioRef.current.src) {
      console.log(`[Playback] Playing buffered preload track: ${track.title}`);
      playUrl = preloadAudioRef.current.src;
    }

    if (!playUrl) {
      setLoadingTrack(true);
      try {
        if (track.source === 'shared' && track.driveFileId) {
          const streamResult = await getStreamUrlForTrack(track);
          if (loadingTrackIdRef.current !== track.id) return; // user cancelled!
          if (!streamResult || !streamResult.blobUrl) {
            console.error('[Playback] Could not load stream for track:', track.name, '— auto-skipping.');
            setLoadingTrack(false);
            // Increment consecutive skip counter and check limit
            consecutiveSkipsRef.current += 1;
            if (consecutiveSkipsRef.current > 5) {
              console.warn('[Playback] Stopped auto-skip after 5 consecutive stream failures.');
              consecutiveSkipsRef.current = 0;
              return;
            }
            const skipToTrack = await determineNextTrack(track);
            if (skipToTrack && skipToTrack.id !== track.id) {
              console.log(`[Auto-Skip] Skipping from "${track.name}" → "${skipToTrack.name}" (${consecutiveSkipsRef.current}/5)`);
              handlePlayTrack(skipToTrack, queue.length > 0 ? queue : tracks);
            } else {
              console.warn('[Auto-Skip] No valid next track found to skip to.');
              consecutiveSkipsRef.current = 0;
            }
            return;
          }
          
          preloadedUrlsRef.current[track.id] = streamResult.blobUrl;
          playUrl = streamResult.blobUrl;

          // Extract ID3 tags from blob!
          if (streamResult.blob && !track.localChecked) { // Using localChecked as a general flag that tags were extracted
            try {
              const tags = await parseMetadata(streamResult.blob);
              if (tags && (tags.artwork || tags.title !== track.title)) {
                finalTrack = {
                  ...finalTrack,
                  localChecked: true, // mark as checked
                  artwork: tags.artwork || finalTrack.artwork,
                  title: tags.title || finalTrack.title,
                  artist: tags.artist || finalTrack.artist,
                  album: tags.album || finalTrack.album,
                  genre: tags.genre || finalTrack.genre,
                  year: tags.year || finalTrack.year
                };
                setCurrentTrack(finalTrack);
                setTracks(prev => prev.map(t => t.id === finalTrack.id ? finalTrack : t));
                await saveTrack(finalTrack);
              }
            } catch (e) {
              console.warn('[Playback] ID3 extraction error:', e);
            }
          }
          
        } else if (track.source === 'local') {
          if (track.fileHandle) {
            const opts = { mode: 'read' };
            if ((await track.fileHandle.queryPermission(opts)) !== 'granted') {
              await track.fileHandle.requestPermission(opts);
            }
            if (loadingTrackIdRef.current !== track.id) return; // user cancelled!
            const fileObj = await track.fileHandle.getFile();
            const freshUrl = URL.createObjectURL(fileObj);
            preloadedUrlsRef.current[track.id] = freshUrl;
            playUrl = freshUrl;
          } else {
            playUrl = track.url;
          }
        } else if (track.source === 'gdrive') {
          playUrl = getStreamUrl(track.id);
        } else {
          playUrl = track.url;
        }
      } catch (err) {
        console.error('Playback loading error:', err);
        setLoadingTrack(false);
        // Auto-skip on load failure
        setTimeout(() => handleNextTrack(), 500);
        return;
      }
      setLoadingTrack(false);
    }

    // Safeguard race condition
    if (loadingTrackIdRef.current !== track.id) return;

    // Revoke old object URL safely
    if (audioRef.current.src && audioRef.current.src.startsWith('blob:') && audioRef.current.src !== playUrl) {
      const isCached = Object.values(preloadedUrlsRef.current).includes(audioRef.current.src);
      if (!isCached) {
        URL.revokeObjectURL(audioRef.current.src);
      }
    }

    // Reset the audio element before loading new source.
    // This clears any stale error state from a previously failed track,
    // which is the root cause of "first few songs don't play" — the Audio element
    // can get stuck in an error state that blocks subsequent .play() calls.
    audioRef.current.pause();
    audioRef.current.removeAttribute('src');
    audioRef.current.load();

    // Now set the new source and play
    audioRef.current.src = playUrl;
    audioRef.current.load();

    // Use canplaythrough to ensure the browser has enough buffered data before playing.
    // This avoids premature play() calls that reject with AbortError or NotSupportedError.
    const playWhenReady = () => {
      if (loadingTrackIdRef.current !== track.id) return;
      audioRef.current.removeEventListener('canplaythrough', playWhenReady);
      audioRef.current.play()
        .then(() => {
          if (loadingTrackIdRef.current === track.id) {
            setIsPlaying(true);
            // Reset consecutive skip counter — this track loaded successfully
            consecutiveSkipsRef.current = 0;
          }
        })
        .catch(err => {
          console.error('[Playback] play() rejected:', err);
          // Don't auto-skip here — the error handler on the audio element will do it
        });
    };
    audioRef.current.addEventListener('canplaythrough', playWhenReady, { once: true });

    // Fallback: if canplaythrough doesn't fire within 10s (e.g. for very large files),
    // attempt to play anyway. The error handler will catch genuine failures.
    setTimeout(() => {
      if (loadingTrackIdRef.current === track.id && !isPlaying) {
        audioRef.current.removeEventListener('canplaythrough', playWhenReady);
        audioRef.current.play()
          .then(() => {
            if (loadingTrackIdRef.current === track.id) {
              setIsPlaying(true);
            }
          })
          .catch(() => {}); // error handler will deal with it
      }
    }, 10000);

    saveStatePersistence(track.id, 0);

    // Wait for the iTunes metadata promise to fully apply its updates
    await metadataPromise;
  };

  const handlePlayPauseToggle = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      saveStatePersistence(currentTrack.id, audioRef.current.currentTime);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Playback failed:', err));
    }
  };

  const saveStatePersistence = (trackId, position) => {
    if (userMode === 'local') {
      localStorage.setItem('aura_local_last_played', trackId);
      localStorage.setItem('aura_local_last_pos', position);
    } else if (userMode === 'google' && googleSheetId && userProfile) {
      saveUserStateInSheet(
        googleSheetId,
        userProfile.sub || userProfile.email,
        userProfile.email,
        userProfile.displayName,
        trackId,
        position
      );
    }
  };

  const handleTrackEnd = async () => {
      // NOTE: Uses state variables (currentTrack, repeat, autoNext, etc)
      // Must be called via handlersRef from the audio ended event to avoid stale closures.
    if (currentTrack) {
      await recordPlayEvent(currentTrack, true);
      await decayFatigue();
    }

    if (repeat) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log(e));
    } else if (autoNext) {
      handleNextTrack();
    } else {
      setIsPlaying(false);
    }
  };

  const handleNextTrack = async () => {
      // NOTE: Must be called via handlersRef from audio error event
    if (tracks.length === 0) return;

    if (currentTrack && currentTime < 30 && isPlaying) {
      await recordPlayEvent(currentTrack, false);
    }

    const nextTrack = await determineNextTrack(currentTrack);

    if (nextTrack) {
      handlePlayTrack(nextTrack, activeQueue);
    }
  };

  // Keep latest handlers accessible to audio event listeners
  useEffect(() => {
    handlersRef.current = {
      handleTrackEnd,
      handleNextTrack
    };
  });

  const handlePrevTrack = () => {
    if (!audioRef.current) return;

    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (playedHistory.length > 0) {
      const prev = playedHistory[playedHistory.length - 1];
      setPlayedHistory(prev => prev.slice(0, -1));
      handlePlayTrack(prev, activeQueue);
    } else {
      const queue = activeQueue.length > 0 ? activeQueue : tracks;
      const currentIndex = queue.findIndex(t => t.id === (currentTrack?.id || ''));
      if (currentIndex > 0) {
        handlePlayTrack(queue[currentIndex - 1], queue);
      }
    }
  };

  const handleSeek = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleCreatePlaylist = async (name) => {
    const newPlaylist = {
      id: `pl:${Date.now()}`,
      name,
      tracks: []
    };
    const updated = [...playlists, newPlaylist];
    setPlaylists(updated);
    if (userMode === 'local') {
      await savePlaylist(newPlaylist);
    }
  };

  const handleAddToPlaylist = async (playlistId, trackId) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId && !pl.tracks.includes(trackId)) {
        const up = { ...pl, tracks: [...pl.tracks, trackId] };
        if (userMode === 'local') {
          savePlaylist(up);
        }
        return up;
      }
      return pl;
    });
    setPlaylists(updated);
  };

  const handleLogout = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    logoutGoogle();
    setLoggedIn(false);
    setUserMode(null);
    setUserProfile(null);
    setTracks([]);
    setCurrentTrack(null);
    setPlaylists([]);
  };

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell">
      <div className="main-content">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          playlists={playlists}
          onCreatePlaylist={handleCreatePlaylist}
          activePlaylistId={activePlaylistId}
          setActivePlaylistId={setActivePlaylistId}
          userMode={userMode}
          userProfile={userProfile}
          onLogout={handleLogout}
          onTracksImported={handleTracksImported}
          onRefreshLibrary={handleRefreshLibrary}
        />
        <MainView
          currentTab={currentTab}
          tracks={tracks}
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          onPlayTrack={handlePlayTrack}
          onAddToPlaylist={handleAddToPlaylist}
          currentTrack={currentTrack}
          userProfile={userProfile}
        />
      </div>
      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPauseToggle={handlePlayPauseToggle}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        shuffle={shuffle}
        setShuffle={setShuffle}
        repeat={repeat}
        setRepeat={setRepeat}
        autoNext={autoNext}
        setAutoNext={setAutoNext}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onVolumeChange={setVolume}
        onExpand={() => setIsNowPlayingExpanded(true)}
      />

      {isNowPlayingExpanded && currentTrack && (
        <NowPlayingOverlay
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          repeat={repeat}
          shuffle={shuffle}
          autoNext={autoNext}
          onClose={() => setIsNowPlayingExpanded(false)}
          onPlayPauseToggle={handlePlayPauseToggle}
          onNext={handleNextTrack}
          onPrev={handlePrevTrack}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          setShuffle={setShuffle}
          setRepeat={setRepeat}
          setAutoNext={setAutoNext}
        />
      )}
    </div>

  );
}
