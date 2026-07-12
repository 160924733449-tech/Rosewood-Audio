import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import MainView from './components/MainView';
import PlayerBar from './components/PlayerBar';
import NowPlayingOverlay from './components/NowPlayingOverlay';

import { getAllTracks, saveTracks, saveTrack, getAllPlaylists, savePlaylist, deletePlaylist } from './utils/db';
import { recordPlayEvent, decayFatigue, getNextTrackAutoplay, getNextTrackAutoplayWithState } from './utils/recommendationEngine';
import { saveUserStateInSheet, getUserStateFromSheet, savePlaylistToSheet, deletePlaylistFromSheet, appendHistoryToSheet, getAllPlaylistsFromSheet, getAllAffinitiesFromSheet } from './utils/googleSheetsHelper';
import { saveAffinity, getPlayHistory, getAllAffinities } from './utils/db';
import { fetchSharedLibraryTracks, getStreamUrlForTrack } from './utils/sharedLibraryHelper';
import { parseMetadata } from './utils/metadataHelper';
import { getStreamUrl } from './utils/googleDriveHelper';
import { trackEvent } from './utils/tracker';

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
  const [userMode, setUserMode] = useState(null); // 'local', 'shared'
  const [userProfile, setUserProfile] = useState(null);
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


  const audioRef = useRef(null); // Keep this for legacy references that still use it for non-playback things
  const audioElementsRef = useRef([]); // [new Audio(), new Audio()]
  const activeIndexRef = useRef(0);
  const currentTrackRef = useRef(null);
  const preloadedUrlsRef = useRef({});
  const loadingTrackIdRef = useRef(null);
  const consecutiveSkipsRef = useRef(0); // Track consecutive auto-skips to prevent infinite loops
  const handlersRef = useRef({}); // Store latest handlers for event listeners
  const upcomingTracksRef = useRef([]); // Store precalculated upcoming tracks
  const abortControllersRef = useRef(new Map()); // Store abort controllers for in-flight requests

  // Keep currentTrackRef in sync
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const determineNextTrack = async (currTrack) => {
    if (tracks.length === 0) return null;
    return await getNextTrackAutoplay(tracks, currTrack);
  };

  const determineNextTracks = async (currTrack, count = 3) => {
    if (tracks.length === 0) return [];
    
    // Batch fetch state once to avoid N+1 queries during preloading
    const history = await getPlayHistory();
    const affinities = await getAllAffinities();
    
    let upcoming = [];
    let current = currTrack;
    
    for (let i = 0; i < count; i++) {
      const next = getNextTrackAutoplayWithState(tracks, current, history, affinities);
      if (!next || upcoming.some(t => t.id === next.id)) break;
      upcoming.push(next);
      current = next;
    }
    return upcoming;
  };

  const preloadTrack = async (track) => {
    if (!track || audioElementsRef.current.length < 2) return;

    // Use the inactive audio element to buffer the next track
    const inactiveAudio = audioElementsRef.current[1 - activeIndexRef.current];

    if (inactiveAudio.getAttribute('data-track-id') === track.id) {
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
          // Cancel any existing fetch for this track
          if (abortControllersRef.current.has(finalTrack.id)) {
            abortControllersRef.current.get(finalTrack.id).abort();
          }
          const abortController = new AbortController();
          abortControllersRef.current.set(finalTrack.id, abortController);

          const streamResult = await getStreamUrlForTrack(finalTrack, 1, abortController.signal);
          abortControllersRef.current.delete(finalTrack.id);
          if (streamResult && streamResult.blobUrl) {
            preloadedUrlsRef.current[finalTrack.id] = streamResult.blobUrl;
            preloadUrl = streamResult.blobUrl;
            
            // Extract embedded ID3 tags from the downloaded blob in the background
            if (streamResult.blob) {
              setTimeout(async () => {
                try {
                  const tags = await parseMetadata(streamResult.blob);
                  if (tags && (tags.artwork || tags.title !== finalTrack.title)) {
                    const updatedTrack = {
                      ...finalTrack,
                      localChecked: true,
                      artwork: tags.artwork || finalTrack.artwork,
                      title: tags.title || finalTrack.title,
                      artist: tags.artist || finalTrack.artist,
                      album: tags.album || finalTrack.album,
                      genre: tags.genre || finalTrack.genre,
                      year: tags.year || finalTrack.year
                    };
                    setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
                    await saveTrack(updatedTrack);
                    
                    // Note: Since this is async, we shouldn't overwrite finalTrack directly here 
                    // because it might have already been processed in the outer scope.
                  }
                } catch (e) {
                  console.warn('[Preloader] ID3 extraction error:', e);
                }
              }, 100);
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
        if (inactiveAudio.getAttribute('data-track-id') !== finalTrack.id && !inactiveAudio.src) {
          inactiveAudio.setAttribute('data-track-id', finalTrack.id);
          inactiveAudio.src = preloadUrl;
          inactiveAudio.preload = 'auto';
          inactiveAudio.load();
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

      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const isSlowNetwork = connection && (connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType));
      const preloadCount = isSlowNetwork ? 1 : 3;

      const upcomingTracks = await determineNextTracks(currentTrack, preloadCount);
      if (!isSubscribed) return;
      
      upcomingTracksRef.current = [...upcomingTracks];

      // GC: Clear out preloaded URLs and pending fetches for tracks that are no longer in our upcoming window
      // (This prevents a massive memory leak of Blobs and network bandwidth)
      const upcomingIds = new Set(upcomingTracks.map(t => t.id));
      upcomingIds.add(currentTrack.id); // keep current track alive
      
      // 1. Cancel stale fetches
      for (const [id, controller] of abortControllersRef.current.entries()) {
        if (!upcomingIds.has(id)) {
          controller.abort();
          abortControllersRef.current.delete(id);
        }
      }

      // 2. Revoke stale blobs
      for (const [id, url] of Object.entries(preloadedUrlsRef.current)) {
        if (!upcomingIds.has(id)) {
          // Check both audio elements before revoking
          const isActiveSrc = audioElementsRef.current.some(el => el && el.src === url);
          // Keep old fallback for audioRef if needed
          const isLegacyActive = audioRef.current?.src === url;
          if (url.startsWith('blob:') && !isActiveSrc && !isLegacyActive) {
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
    if (audioElementsRef.current.length === 2) {
      const inactiveAudio = audioElementsRef.current[1 - activeIndexRef.current];
      if (inactiveAudio) {
         inactiveAudio.src = '';
         inactiveAudio.removeAttribute('data-track-id');
      }
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
    const queue = tracks.filter(t => !t.localChecked && t.source === 'local');

    if (queue.length === 0) return;

    const processQueue = async () => {
      // For local files, we can process them quickly without network constraints, 
      // but we still add a small delay to avoid freezing the UI thread.
      const extractionDelay = 1000;

      for (const track of queue) {
        if (!isSubscribed || isPlaying) break;
        
        let tagsExtracted = false;
        let updatedTrack = { ...track, localChecked: true };

        try {
          if (track.source === 'local' && track.fileHandle) {
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
        await new Promise(resolve => setTimeout(resolve, extractionDelay));
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
    audioElementsRef.current = [new Audio(), new Audio()];
    
    // Set initial volumes
    audioElementsRef.current[0].volume = volume;
    audioElementsRef.current[1].volume = 0; // Inactive one should be silent during preload
    
    // We still keep audioRef pointing to the active one for legacy support in other hooks (like keyboard shortcuts)
    audioRef.current = audioElementsRef.current[0];

    const handleTimeUpdate = (e) => {
      // Only update UI if the event comes from the currently active audio element
      if (e.target === audioElementsRef.current[activeIndexRef.current]) {
        setCurrentTime(e.target.currentTime);
      }
    };

    const handleLoadedMetadata = (e) => {
      // Only process if it's the active element
      if (e.target !== audioElementsRef.current[activeIndexRef.current]) return;

      const trackDuration = e.target.duration;
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

    const handleEnded = (e) => {
      if (e.target !== audioElementsRef.current[activeIndexRef.current]) return;
      if (handlersRef.current.handleTrackEnd) {
        handlersRef.current.handleTrackEnd();
      }
    };

    const handleError = (e) => {
      if (e.target !== audioElementsRef.current[activeIndexRef.current]) return;
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

      console.warn(`[Playback Error] Failed to play track: ${trackName}. Audio playback stopped.`);
    };

    audioElementsRef.current.forEach(audio => {
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
    });

    return () => {
      audioElementsRef.current.forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
          audio.removeEventListener('timeupdate', handleTimeUpdate);
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('error', handleError);
        }
      });
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioElementsRef.current.length === 2) {
      // Only the active player gets full volume
      audioElementsRef.current[activeIndexRef.current].volume = volume;
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

    localStorage.setItem('aura_session', JSON.stringify({
      mode: authData.mode,
      user: authData.user,
      username: authData.username || authData.user?.displayName
    }));

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

      const username = authData.user.displayName;
      
      // Fetch cloud data from our new backend
      const state = await getUserStateFromSheet(username);
      if (state && state.trackId && mergedTracks.length > 0) {
        const track = mergedTracks.find(t => t.id === state.trackId);
        if (track) {
          setTrackSilent(track, state.positionSec);
        }
      }
      
      const cloudPlaylists = await getAllPlaylistsFromSheet(username);
      if (cloudPlaylists && cloudPlaylists.length > 0) {
        setPlaylists(cloudPlaylists);
        for (const p of cloudPlaylists) {
          await savePlaylist(p);
        }
      }

      const cloudAffinities = await getAllAffinitiesFromSheet(username);
      if (cloudAffinities && cloudAffinities.length > 0) {
        for (const aff of cloudAffinities) {
          await saveAffinity(aff.key, aff.score);
        }
      }
    }
  };

  useEffect(() => {
    const savedSession = localStorage.getItem('aura_session');
    if (savedSession) {
      try {
        const authData = JSON.parse(savedSession);
        // We defer handleLoginSuccess execution to not block initial render excessively
        setTimeout(() => handleLoginSuccess(authData), 0);
      } catch(e) {}
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handlePlayTrack = async (track, queue = [], startPosition = 0) => {
    if (!audioRef.current) return;

    upcomingTracksRef.current = []; // Clear cached upcoming tracks

    if (currentTrack) {
      setPlayedHistory(prev => [...prev, currentTrack]);
    }

    // CRITICAL FIX: Immediately pause the current audio so it doesn't keep playing 
    // while we wait for the new track's network fetch to complete.
    if (audioElementsRef.current.length === 2) {
      audioElementsRef.current[activeIndexRef.current].pause();
    }

    // 1. Instantly set track to trigger UI update and glide-up animation
    setCurrentTrack(track);
    setActiveQueue(queue.length > 0 ? queue : tracks);
    setIsPlaying(false);
    loadingTrackIdRef.current = track.id;

    trackEvent('play', track);

    let finalTrack = track;

    // 3. Resolve the audio stream URL in the background
    let playUrl = '';
    let isPreloaded = false;
    
    // Check if the inactive audio element already has this track fully buffered
    const inactiveAudio = audioElementsRef.current[1 - activeIndexRef.current];
    if (inactiveAudio && inactiveAudio.getAttribute('data-track-id') === track.id && inactiveAudio.src) {
      console.log(`[Playback] Gapless transition! Swapping to buffered track: ${track.title}`);
      playUrl = inactiveAudio.src;
      isPreloaded = true;
    } else if (preloadedUrlsRef.current[track.id]) {
      console.log(`[Playback] Playing preloaded URL instantly: ${track.title}`);
      playUrl = preloadedUrlsRef.current[track.id];
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
            // Increment consecutive skip counter and check limit (but don't auto-skip anymore)
            consecutiveSkipsRef.current += 1;
            console.warn('[Playback Error] Stream failed to load. Audio playback stopped.');
            return;
          }
          
          preloadedUrlsRef.current[track.id] = streamResult.blobUrl;
          playUrl = streamResult.blobUrl;

          // Extract ID3 tags from blob in the background so we don't block playback!
          if (streamResult.blob && !track.localChecked) { // Using localChecked as a general flag that tags were extracted
            setTimeout(async () => {
              try {
                const tags = await parseMetadata(streamResult.blob);
                if (tags && (tags.artwork || tags.title !== track.title)) {
                  const updatedTrack = {
                    ...finalTrack, // finalTrack is captured from outer scope
                    localChecked: true, // mark as checked
                    artwork: tags.artwork || finalTrack.artwork,
                    title: tags.title || finalTrack.title,
                    artist: tags.artist || finalTrack.artist,
                    album: tags.album || finalTrack.album,
                    genre: tags.genre || finalTrack.genre,
                    year: tags.year || finalTrack.year
                  };
                  
                  // Only update if we're still playing this track!
                  if (currentTrackRef.current?.id === updatedTrack.id) {
                    setCurrentTrack(updatedTrack);
                  }
                  
                  setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
                  await saveTrack(updatedTrack);
                }
              } catch (e) {
                console.warn('[Playback] ID3 extraction error:', e);
              }
            }, 100);
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

    // We are proceeding with playback. Let's swap the active index.
    const oldActiveAudio = audioElementsRef.current[activeIndexRef.current];
    activeIndexRef.current = 1 - activeIndexRef.current;
    const newActiveAudio = audioElementsRef.current[activeIndexRef.current];
    
    // Update legacy ref
    audioRef.current = newActiveAudio;

    // Clean up old audio element
    oldActiveAudio.pause();
    
    // Revoke old object URL safely if it's not cached
    if (oldActiveAudio.src && oldActiveAudio.src.startsWith('blob:') && oldActiveAudio.src !== playUrl) {
      const isCached = Object.values(preloadedUrlsRef.current).includes(oldActiveAudio.src);
      // We also check if the new element is using it
      if (!isCached && newActiveAudio.src !== oldActiveAudio.src) {
        URL.revokeObjectURL(oldActiveAudio.src);
      }
    }
    
    oldActiveAudio.removeAttribute('src');
    oldActiveAudio.removeAttribute('data-track-id');
    oldActiveAudio.load();

    if (!isPreloaded) {
      // If we didn't gapless-swap, we need to set up the new active element from scratch
      newActiveAudio.pause();
      newActiveAudio.removeAttribute('src');
      newActiveAudio.load();
      newActiveAudio.src = playUrl;
      newActiveAudio.setAttribute('data-track-id', track.id);
    }
    
    // Apply full volume to new active audio
    newActiveAudio.volume = volume;
    
    if (startPosition > 0) {
      newActiveAudio.currentTime = startPosition;
      setCurrentTime(startPosition);
    } else if (isPreloaded) {
      // For gapless, make sure it starts perfectly at 0 if we didn't seek
      newActiveAudio.currentTime = 0;
      setCurrentTime(0);
    }

    // Call play() immediately instead of waiting for canplaythrough.
    newActiveAudio.play()
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

    saveStatePersistence(track.id, 0);
  };

  const handlePlayPauseToggle = () => {
    if (!currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      saveStatePersistence(currentTrack.id, audioRef.current.currentTime);
    } else {
      // If the audio source was never loaded (e.g., restored from silent state on login)
      if (!audioRef.current.src || audioRef.current.src === window.location.href) {
        handlePlayTrack(currentTrack, activeQueue, currentTime);
        return;
      }

      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Playback failed:', err));
    }
  };

  const saveStatePersistence = (trackId, position) => {
    if (userMode === 'local') {
      localStorage.setItem('aura_local_last_played', trackId);
      localStorage.setItem('aura_local_last_pos', position);
    } else if (userMode === 'shared' && userProfile?.displayName) {
      saveUserStateInSheet(userProfile.displayName, trackId, position);
    }
  };

  const handleTrackEnd = async () => {
      // NOTE: Uses state variables (currentTrack, repeat, autoNext, etc)
      // Must be called via handlersRef from the audio ended event to avoid stale closures.
    if (currentTrack) {
      const syncConfig = {
        mode: userMode,
        userId: userProfile?.displayName
      };
      await recordPlayEvent(currentTrack, true, syncConfig);
      if (userMode === 'shared' && userProfile) {
        appendHistoryToSheet(userProfile.displayName, currentTrack.id, currentTrack.title, currentTrack.duration, true);
      }
      await decayFatigue(syncConfig);
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
      const syncConfig = {
        mode: userMode,
        userId: userProfile?.displayName
      };
      await recordPlayEvent(currentTrack, false, syncConfig);
      if (userMode === 'shared' && userProfile) {
        appendHistoryToSheet(userProfile.displayName, currentTrack.id, currentTrack.title, currentTrack.duration, false);
      }
      trackEvent('skip', currentTrack);
    }

    let nextTrack = null;
    if (upcomingTracksRef.current && upcomingTracksRef.current.length > 0) {
      nextTrack = upcomingTracksRef.current.shift();
    } else {
      nextTrack = await determineNextTrack(currentTrack);
    }

    if (nextTrack) {
      handlePlayTrack(nextTrack, activeQueue);
    }
  };

  // Keep latest handlers accessible to audio event listeners
  useEffect(() => {
    handlersRef.current = {
      handleTrackEnd,
      handleNextTrack,
      handlePrevTrack,
      handlePlayPauseToggle
    };
  });

  // Media Session API for hardware media keys
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (handlersRef.current.handlePlayPauseToggle) handlersRef.current.handlePlayPauseToggle();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (handlersRef.current.handlePlayPauseToggle) handlersRef.current.handlePlayPauseToggle();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (handlersRef.current.handlePrevTrack) handlersRef.current.handlePrevTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (handlersRef.current.handleNextTrack) handlersRef.current.handleNextTrack();
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
           audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skipTime);
           setCurrentTime(audioRef.current.currentTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
           audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + skipTime);
           setCurrentTime(audioRef.current.currentTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        return;
      }
      
      switch(e.code) {
        case 'Space':
          e.preventDefault();
          if (handlersRef.current.handlePlayPauseToggle) handlersRef.current.handlePlayPauseToggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (handlersRef.current.handleNextTrack) handlersRef.current.handleNextTrack();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (handlersRef.current.handlePrevTrack) handlersRef.current.handlePrevTrack();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update Media Session metadata when track changes
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || currentTrack.name || 'Unknown Track',
        artist: currentTrack.artist || 'Unknown Artist',
        album: currentTrack.album || 'Unknown Album',
        artwork: currentTrack.artwork ? [
          { src: currentTrack.artwork, sizes: '512x512' }
        ] : []
      });
    }
  }, [currentTrack]);

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
    if (userMode === 'local' || userMode === 'shared') {
      await savePlaylist(newPlaylist);
      if (userMode === 'shared' && userProfile) {
        savePlaylistToSheet(userProfile.displayName, newPlaylist.id, newPlaylist.name, newPlaylist.tracks);
      }
    }
  };

  const handleAddToPlaylist = async (playlistId, trackId) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId && !pl.tracks.includes(trackId)) {
        const up = { ...pl, tracks: [...pl.tracks, trackId] };
        if (userMode === 'local' || userMode === 'google') {
          savePlaylist(up);
          if (userMode === 'google' && googleSheetId && userProfile) {
            savePlaylistToSheet(googleSheetId, userProfile.sub || userProfile.email, up.id, up.name, up.tracks);
          }
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
    localStorage.removeItem('aura_session');
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
          setCurrentTab={setCurrentTab}
        />
      </div>
      <PlayerBar
        currentTrack={currentTrack}
        loadingTrack={loadingTrack}
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
