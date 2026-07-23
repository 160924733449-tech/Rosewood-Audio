import React, { useState, useEffect, useRef } from 'react';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import MainView from './components/MainView';
import PlayerBar from './components/PlayerBar';
import NowPlayingOverlay from './components/NowPlayingOverlay';
import MobileBottomNav from './components/MobileBottomNav';

import { getAllTracks, saveTracks, saveTrack, getAllPlaylists, savePlaylist, getAllCachedAudioIds, saveAudioBlobToIDB } from './utils/db';
import { recordPlayEvent, decayFatigue, getNextTrackAutoplayWithState } from './utils/recommendationEngine';
import { saveUserStateInSheet, getUserStateFromSheet, savePlaylistToSheet, appendHistoryToSheet, getAllPlaylistsFromSheet, getAllAffinitiesFromSheet, getGlobalPlaylists, saveGlobalPlaylist, deleteGlobalPlaylist } from './utils/googleSheetsHelper';
import { saveAffinity, getPlayHistory, getAllAffinities } from './utils/db';
import { fetchSharedLibraryTracks, getStreamUrlForTrack, warmStreamCache, deleteSharedTrack } from './utils/sharedLibraryHelper';
import { tweenVolume } from './utils/audioTween';
import { FastAverageColor } from 'fast-average-color';
import { MediaSession } from '@capgo/capacitor-media-session';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getQualityTransformedUrl } from './utils/audioQuality';
import { parseMetadata, normalizeGenre, fetchITunesMetadata } from './utils/metadataHelper';

import { trackEvent } from './utils/tracker';

const IS_NATIVE = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
const APP_VERSION = "1.0.0";


export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userMode, setUserMode] = useState(null); // 'local', 'shared'
  const [userProfile, setUserProfile] = useState(null);
  const [loadingTrack, setLoadingTrack] = useState(false);

  const [tracks, setTracks] = useState([]);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [cachedTrackIds, setCachedTrackIds] = useState(new Set());
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
  const [audioQuality, setAudioQualityState] = useState(localStorage.getItem('aura_audio_quality') || 'auto');
  const [isFetchingLibrary, setIsFetchingLibrary] = useState(false);
  const [isBooting, setIsBooting] = useState(IS_NATIVE);
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const audioQualityRef = useRef(audioQuality);

  const setAudioQuality = (q) => {
    setAudioQualityState(q);
    audioQualityRef.current = q;
    localStorage.setItem('aura_audio_quality', q);
  };
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
  const hasSmartCachedRef = useRef(false);
  // Initialize Native Plugins on Mount
  useEffect(() => {
    const initNative = async () => {
      const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
      if (!isCapacitor) return;
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { SplashScreen } = await import('@capacitor/splash-screen');
        
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#090a0f' });
        await SplashScreen.hide();
      } catch (e) {
        console.warn('Native plugin init failed:', e);
      }
    };
    initNative();
  }, []);

  // Check for OTA Updates
  useEffect(() => {
    const checkUpdates = async () => {
      if (!IS_NATIVE) return;
      try {
        // Add cache busting to ensure we get the latest version file
        const response = await fetch(`https://rosewood-audio.vercel.app/version.json?t=${new Date().getTime()}`);
        if (response.ok) {
          const data = await response.json();
          // Extremely simple version string comparison (e.g. "1.0.1" > "1.0.0")
          if (data.version && data.version.localeCompare(APP_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
            setUpdateAvailable(data);
          }
        }
      } catch (err) {
        console.warn("Failed to check for OTA update:", err);
      }
    };
    checkUpdates();
  }, []);

  // Keep currentTrackRef in sync
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

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

  const smartCacheTrack = (track) => {
    if (!track || !track.url || track.source === 'local') return;
    
    // We only want to cache Cloudinary URLs, not blob URLs or local device paths
    if (!track.url.startsWith('http')) return;

    console.log(`[SmartCache] Silently caching track for offline playback: ${track.name || track.title}`);
    // Use low-priority fetch so it never competes with active playback streaming
    fetch(track.url, { priority: 'low' })
      .then(res => res.blob())
      .then(blob => {
        // Use requestIdleCallback (or setTimeout fallback) to write to IDB off the critical path
        const saveToIDB = () => {
          saveAudioBlobToIDB(track.id, blob, blob.type).then(() => {
            getAllCachedAudioIds().then(ids => setCachedTrackIds(ids)).catch(()=>{});
          }).catch(e => console.warn('[SmartCache] Failed to save blob:', e));
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(saveToIDB);
        } else {
          setTimeout(saveToIDB, 0);
        }
      })
      .catch(err => console.warn('[SmartCache] Fetch failed:', err));
  };

  const preloadTrack = async (track) => {
    if (!track || audioElementsRef.current.length < 2) return;

    // Use the inactive audio element to buffer the next track
    const inactiveAudio = audioElementsRef.current[1 - activeIndexRef.current];

    // Already buffering this exact track — skip
    if (inactiveAudio.getAttribute('data-track-id') === track.id) {
      return;
    }

    try {
      console.log(`[Preloader] Preloading next track: ${track.title} (${track.source})`);
      let preloadUrl = '';

      let finalTrack = track;

      if (finalTrack.source === 'cloudinary') {
        if (preloadedUrlsRef.current[finalTrack.id]) {
          preloadUrl = preloadedUrlsRef.current[finalTrack.id];
        } else {
          if (abortControllersRef.current.has(finalTrack.id)) {
            abortControllersRef.current.get(finalTrack.id).abort();
          }
          const abortController = new AbortController();
          abortControllersRef.current.set(finalTrack.id, abortController);

          const streamResult = await getStreamUrlForTrack(finalTrack, abortController.signal);
          abortControllersRef.current.delete(finalTrack.id);
          if (streamResult && streamResult.blobUrl) {
            preloadedUrlsRef.current[finalTrack.id] = streamResult.blobUrl;
            preloadUrl = streamResult.blobUrl;
          }
        }
      } else if (finalTrack.source === 'local') {
        if (preloadedUrlsRef.current[finalTrack.id]) {
          preloadUrl = preloadedUrlsRef.current[finalTrack.id];
        } else if (finalTrack.devicePath) {
          const convertSrc = typeof window !== 'undefined' && window.Capacitor ? window.Capacitor.convertFileSrc : (p) => p;
          preloadUrl = convertSrc(finalTrack.devicePath);
        } else if (finalTrack.fileHandle) {
          const hasPermission = await finalTrack.fileHandle.queryPermission({ mode: 'read' }) === 'granted';
          if (hasPermission) {
            const fileObj = await finalTrack.fileHandle.getFile();
            const freshUrl = URL.createObjectURL(fileObj);
            preloadedUrlsRef.current[finalTrack.id] = freshUrl;
            preloadUrl = freshUrl;
          }
        }
      } else {
        preloadUrl = finalTrack.url;
      }

      if (preloadUrl) {
        // Aggressively buffer into the inactive element — replace any stale preload
        // (Old code gated on `!inactiveAudio.src` which prevented re-preloading when the upcoming queue changed)
        if (inactiveAudio.getAttribute('data-track-id') !== finalTrack.id) {
          inactiveAudio.setAttribute('data-track-id', finalTrack.id);
          inactiveAudio.src = getQualityTransformedUrl(preloadUrl, audioQualityRef.current);
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
      // Short delay to let the current track's initial buffer fill, then start preloading aggressively
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (!isSubscribed) return;

      // Preload 2 tracks ahead for near-instant skip transitions
      const preloadCount = 2;

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
  }, [currentTrack, shuffle, activeQueue, tracks, audioQuality]);

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
        
        let updatedTrack = { ...track, localChecked: true };

        try {
          if (track.source === 'local' && track.fileHandle) {
             const hasPermission = await track.fileHandle.queryPermission({ mode: 'read' }) === 'granted';
             if (hasPermission) {
               const fileObj = await track.fileHandle.getFile();
               const tags = await parseMetadata(fileObj);
               if (tags) {
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
        if (IS_NATIVE && e.target.duration) {
          MediaSession.setPositionState({
            duration: e.target.duration,
            position: e.target.currentTime,
            playbackRate: e.target.playbackRate
          }).catch(()=>{});
        } else if ('mediaSession' in navigator && e.target.duration) {
          try {
            navigator.mediaSession.setPositionState({
              duration: e.target.duration,
              playbackRate: e.target.playbackRate,
              position: e.target.currentTime
            });
          } catch(err) {}
        }
        
        // Smart Caching: Once we cross 15 seconds, trigger a background cache download for offline use.
        // By waiting 15s, we ensure the initial network buffer is saturated and the user is actually listening (not skipping).
        if (e.target.currentTime > 15 && !hasSmartCachedRef.current && currentTrackRef.current) {
          hasSmartCachedRef.current = true;
          smartCacheTrack(currentTrackRef.current);
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (IS_NATIVE) {
      MediaSession.setPlaybackState({ playbackState: isPlaying ? 'playing' : 'paused' }).catch(()=>{});
    } else if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  const toggleShuffle = () => {
    setShuffle(!shuffle);
    if (IS_NATIVE) Haptics.impact({ style: ImpactStyle.Light }).catch(()=>{});
  };
  const toggleRepeat = () => {
    setRepeat(!repeat);
    if (IS_NATIVE) Haptics.impact({ style: ImpactStyle.Light }).catch(()=>{});
  };

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      // Fetch cached IDs so we know what's playable offline
      getAllCachedAudioIds().then(ids => setCachedTrackIds(ids)).catch(console.warn);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
    } else {
      // Even if online, load cached IDs so we can show instant-play badges if we wanted to
      getAllCachedAudioIds().then(ids => setCachedTrackIds(ids)).catch(console.warn);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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

  // Hot-swap audio quality
  useEffect(() => {
    if (!audioRef.current) return;
    const currentSrc = audioRef.current.src;
    if (currentSrc && currentSrc.includes('res.cloudinary.com')) {
      const newUrl = getQualityTransformedUrl(currentSrc, audioQuality);
      if (newUrl !== currentSrc) {
        console.log(`[Playback] Hot-swapping quality to ${audioQuality}...`);
        const wasPlaying = isPlaying;
        const currentTime = audioRef.current.currentTime;
        audioRef.current.src = newUrl;
        audioRef.current.currentTime = currentTime;
        if (wasPlaying) {
          audioRef.current.play().catch(e => console.error('Hot-swap play failed', e));
        }
      }
    }
  }, [audioQuality]); // eslint-disable-line react-hooks/exhaustive-deps


  // Load local data if in Local Mode
// Load local data if in Local Mode
  useEffect(() => {
    if (loggedIn && userMode === 'local') {
      loadLocalData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (IS_NATIVE) {
      setTimeout(() => setIsBooting(false), 2000);
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
      setIsFetchingLibrary(true);

      // 1. Fetch Cloudinary tracklist + local IDB tracks in parallel (saves ~200-400ms)
      const [sharedTracks, existingTracks] = await Promise.all([
        fetchSharedLibraryTracks(),
        getAllTracks(),
      ]);
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

      // 2. Fetch all cloud user data in parallel (saves ~500-1500ms vs sequential)
      const [state, cloudPlaylists, globalPlaylists, cloudAffinities] = await Promise.all([
        getUserStateFromSheet(username),
        getAllPlaylistsFromSheet(username),
        getGlobalPlaylists(),
        getAllAffinitiesFromSheet(username),
      ]);

      // Restore last played track
      if (state && state.trackId && mergedTracks.length > 0) {
        const track = mergedTracks.find(t => t.id === state.trackId);
        if (track) {
          setTrackSilent(track, state.positionSec);
        }
      }
      
      // Combine local and global playlists
      const combinedPlaylists = [];
      const globalIds = new Set();
      if (globalPlaylists && globalPlaylists.length > 0) {
        globalPlaylists.forEach(gp => {
          combinedPlaylists.push(gp);
          globalIds.add(gp.id);
        });
      }
      if (cloudPlaylists && cloudPlaylists.length > 0) {
        cloudPlaylists.forEach(lp => {
          if (!globalIds.has(lp.id)) combinedPlaylists.push(lp);
        });
      }

      if (combinedPlaylists.length > 0) {
        setPlaylists(combinedPlaylists);
        // Fire-and-forget batch save — don't block login on IDB writes
        Promise.all(combinedPlaylists.map(p => savePlaylist(p))).catch(() => {});
      }

      // Restore affinities — batch all writes in parallel instead of sequential loop
      if (cloudAffinities && cloudAffinities.length > 0) {
        Promise.all(cloudAffinities.map(aff => saveAffinity(aff.key, aff.score))).catch(() => {});
      }

      setIsFetchingLibrary(false);

      // 3. Pre-warm the in-memory stream cache so first play of any cached track is instant
      warmStreamCache().catch(() => {});

      if (IS_NATIVE) {
        setTimeout(() => setIsBooting(false), 300);
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
      } catch(e) {
        if (IS_NATIVE) setIsBooting(false);
      }
    } else {
      if (IS_NATIVE) setIsBooting(false);
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
    // Instead of just setting metadata, fully preload the track silently
    handlePlayTrack(track, [], startPosition, false);
  };

  const handlePlayTrack = async (track, queue = [], startPosition = 0, autoPlay = true) => {
    if (!audioRef.current) return;
    if (loadingTrack && loadingTrackIdRef.current === track.id) return; // Prevent spam clicking the same track

    upcomingTracksRef.current = []; // Clear cached upcoming tracks
    hasSmartCachedRef.current = false; // Reset smart cache flag for the new track

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
    if (startPosition > 0) setCurrentTime(startPosition);
    loadingTrackIdRef.current = track.id;

    trackEvent('play', track);

    // [LAZY FETCH] iTunes metadata for missing local artwork/genre
    if (track.source === 'local' && (!track.artwork || !track.genre || track.genre === 'Uncategorized')) {
      setTimeout(async () => {
        try {
          const itunesData = await fetchITunesMetadata(track.artist, track.title);
          if (itunesData && itunesData.artwork) {
            console.log(`[iTunes Hydrator] Hydrated ${track.title} with Apple Music data`);
            const updatedTrack = {
              ...track,
              artwork: itunesData.artwork,
              genre: normalizeGenre(itunesData.genre, track.artist, track.title),
              album: itunesData.album || track.album,
              year: itunesData.year || track.year,
            };
            
            // Only update current track state if this track is still the one playing
            setCurrentTrack(prev => prev?.id === track.id ? { ...prev, ...updatedTrack } : prev);
            setTracks(prev => prev.map(t => t.id === track.id ? updatedTrack : t));
            await saveTrack(updatedTrack);
          }
        } catch (e) {
          console.warn('[iTunes Hydrator] Error:', e);
        }
      }, 100);
    }

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
        if (track.source === 'cloudinary') {
          const streamResult = await getStreamUrlForTrack(track);
          if (loadingTrackIdRef.current !== track.id) return; // user cancelled!
          if (!streamResult || !streamResult.blobUrl) {
            console.error('[Playback] Could not load stream for track:', track.name, '— auto-skipping.');
            setLoadingTrack(false);
            
            // CLEAR THE OLD SOURCE SO IT DOESN'T PLAY THE PREVIOUS SONG
            audioElementsRef.current[activeIndexRef.current].removeAttribute('src');
            
            consecutiveSkipsRef.current += 1;
            console.warn('[Playback Error] Stream failed to load. Audio playback stopped.');
            
            // Auto skip if under limit
            if (consecutiveSkipsRef.current < 5) {
               setTimeout(() => handleNextTrack(), 500);
            }
            return;
          }
          
          preloadedUrlsRef.current[track.id] = streamResult.blobUrl;
          playUrl = streamResult.blobUrl;
          
        } else if (track.source === 'local') {
          if (track.devicePath) {
            const convertSrc = typeof window !== 'undefined' && window.Capacitor ? window.Capacitor.convertFileSrc : (p) => p;
            playUrl = convertSrc(track.devicePath);
          } else if (track.fileHandle) {
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

    const doCleanup = (audioEl, oldUrl) => {
      if (oldUrl && oldUrl.startsWith('blob:') && oldUrl !== playUrl) {
        const isCached = Object.values(preloadedUrlsRef.current).includes(oldUrl);
        if (!isCached && newActiveAudio.src !== oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
      }
      audioEl.removeAttribute('src');
      audioEl.removeAttribute('data-track-id');
      audioEl.load();
    };

    if (isPlaying && oldActiveAudio.src) {
      const oldUrl = oldActiveAudio.src;
      // Snappy 400ms crossfade — long enough to prevent pops, short enough to feel instant
      tweenVolume(oldActiveAudio, 0, 400).then(() => {
        oldActiveAudio.pause();
        doCleanup(oldActiveAudio, oldUrl);
      });
    } else {
      oldActiveAudio.pause();
      doCleanup(oldActiveAudio, oldActiveAudio.src);
    }

    if (!isPreloaded) {
      // Set new source directly — avoid the pause+removeAttribute+load cycle which adds ~100-200ms latency
      newActiveAudio.src = getQualityTransformedUrl(playUrl, audioQualityRef.current);
      newActiveAudio.setAttribute('data-track-id', track.id);
    }
    
    // Crossfade in new active audio — start at 0 and ramp up for pop-free transition
    newActiveAudio.volume = 0;
    
    if (startPosition > 0) {
      newActiveAudio.currentTime = startPosition;
      setCurrentTime(startPosition);
    } else if (isPreloaded) {
      // For gapless, make sure it starts perfectly at 0 if we didn't seek
      newActiveAudio.currentTime = 0;
      setCurrentTime(0);
    }

    if (autoPlay) {
      // Fire play() immediately — the browser will start decoding as soon as data arrives
      newActiveAudio.play()
        .then(() => {
          if (loadingTrackIdRef.current === track.id) {
            setIsPlaying(true);
            // Quick 400ms fade-in to avoid pops while keeping it snappy
            tweenVolume(newActiveAudio, volume, 400);
            // Reset consecutive skip counter — this track loaded successfully
            consecutiveSkipsRef.current = 0;
          }
        })
        .catch(err => {
          console.error('[Playback] play() rejected:', err);
          // Don't auto-skip here — the error handler on the audio element will do it
        });
    } else {
      // Finished loading silently — still set volume so it's ready to unmute instantly
      newActiveAudio.volume = volume;
      if (loadingTrackIdRef.current === track.id) {
        setLoadingTrack(false);
        setIsPlaying(false);
      }
    }

    saveStatePersistence(track.id, 0);
  };

  const handlePlayPauseToggle = async () => {
    if (!currentTrack) return;
    if (loadingTrack) return; // Prevent playing old track while fetching new one
    
    if (IS_NATIVE) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(()=>{});
    }
    if (isPlaying) {
      setIsPlaying(false);
      await tweenVolume(audioRef.current, 0, 300);
      audioRef.current.pause();
      saveStatePersistence(currentTrack.id, audioRef.current.currentTime);
    } else {
      // If the audio source was never loaded (e.g., restored from silent state on login)
      if (!audioRef.current.src || audioRef.current.src === window.location.href) {
        handlePlayTrack(currentTrack, activeQueue, currentTime);
        return;
      }

      audioRef.current.volume = 0;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          tweenVolume(audioRef.current, volume, 300);
        })
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
    if (tracks.length === 0) return;
    if (loadingTrack) return; // Prevent skipping multiple times while loading
    if (IS_NATIVE) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(()=>{});
    }

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
      const nextTracks = await determineNextTracks(currentTrack, 1);
      nextTrack = nextTracks[0];
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
      handlePlayPauseToggle,
      loadingTrack
    };
  });

  // Media Session API for hardware media keys
  useEffect(() => {
    if (IS_NATIVE) {
      MediaSession.setActionHandler({ action: 'play' }, () => {
        if (handlersRef.current.handlePlayPauseToggle) handlersRef.current.handlePlayPauseToggle();
      });
      MediaSession.setActionHandler({ action: 'pause' }, () => {
        if (handlersRef.current.handlePlayPauseToggle) handlersRef.current.handlePlayPauseToggle();
      });
      MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
        if (handlersRef.current.handlePrevTrack) handlersRef.current.handlePrevTrack();
      });
      MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
        if (handlersRef.current.handleNextTrack) handlersRef.current.handleNextTrack();
      });
      MediaSession.setActionHandler({ action: 'seekbackward' }, (details) => {
        if (handlersRef.current.loadingTrack) return;
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
           audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skipTime);
           setCurrentTime(audioRef.current.currentTime);
        }
      });
      MediaSession.setActionHandler({ action: 'seekforward' }, (details) => {
        if (handlersRef.current.loadingTrack) return;
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
           audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + skipTime);
           setCurrentTime(audioRef.current.currentTime);
        }
      });
      MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
        if (handlersRef.current.loadingTrack) return;
        if (audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      });
    } else if ('mediaSession' in navigator) {
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
        if (handlersRef.current.loadingTrack) return;
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
           audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - skipTime);
           setCurrentTime(audioRef.current.currentTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        if (handlersRef.current.loadingTrack) return;
        const skipTime = details.seekOffset || 10;
        if (audioRef.current) {
           audioRef.current.currentTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + skipTime);
           setCurrentTime(audioRef.current.currentTime);
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (handlersRef.current.loadingTrack) return;
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

  const facRef = useRef(new FastAverageColor());

  // Set the MediaSession API metadata when track changes
  useEffect(() => {
    if (currentTrack) {
      document.title = `▶ ${currentTrack.title || 'Unknown'} - ${currentTrack.artist || 'Unknown'}`;
      if (IS_NATIVE) {
        const updateNativeMetadata = async () => {
          let finalArtwork = currentTrack.artwork || '';
          if (finalArtwork.startsWith('blob:')) {
            try {
              const res = await fetch(finalArtwork);
              const blob = await res.blob();
              const reader = new FileReader();
              finalArtwork = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            } catch (e) {
              console.warn('Failed to convert blob to base64 for media session', e);
            }
          }
          MediaSession.setMetadata({
            title: currentTrack.title || currentTrack.name || 'Unknown Track',
            artist: currentTrack.artist || 'Unknown Artist',
            album: currentTrack.album || 'Unknown Album',
            artwork: finalArtwork
          }).catch(()=>{});
        };
        updateNativeMetadata();
      } else if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title || currentTrack.name || 'Unknown Track',
          artist: currentTrack.artist || 'Unknown Artist',
          album: currentTrack.album || 'Unknown Album',
          artwork: currentTrack.artwork ? [
            { src: currentTrack.artwork, sizes: '512x512' }
          ] : []
        });
      }
    } else {
      document.title = 'Reson8';
    }

    // Dynamic theming
    if (currentTrack && currentTrack.artwork) {
      facRef.current.getColorAsync(currentTrack.artwork)
        .then(color => {
          const isDark = color.isDark;
          const adjustedHex = isDark ? color.hex : '#D24A61'; // Fallback if too bright
          document.documentElement.style.setProperty('--accent-rose', adjustedHex);
          document.documentElement.style.setProperty('--bg-gradient-top', `rgba(${color.value[0]}, ${color.value[1]}, ${color.value[2]}, 0.15)`);
        })
        .catch(e => {
          console.warn('Failed to extract dominant color', e);
          document.documentElement.style.setProperty('--accent-rose', '#D24A61');
          document.documentElement.style.setProperty('--bg-gradient-top', 'rgba(25, 25, 25, 1)');
        });
    } else {
      document.documentElement.style.setProperty('--accent-rose', '#D24A61');
      document.documentElement.style.setProperty('--bg-gradient-top', 'rgba(25, 25, 25, 1)');
    }

  }, [currentTrack]);

  const handlePrevTrack = () => {
    if (loadingTrack) return;
    if (!audioRef.current) return;
    if (IS_NATIVE) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(()=>{});
    }

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
    if (loadingTrack) return;
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleCreatePlaylist = async (name, isGlobal = false, coverImages = []) => {
    const finalName = name && name.trim() ? name.trim() : `Playlist-${playlists.length + 1}`;
    const newPlaylist = {
      id: `pl:${Date.now()}`,
      name: finalName,
      dp: null,
      tracks: [],
      isGlobal,
      coverImages,
      createdBy: userProfile?.displayName || 'admin'
    };
    const updated = [...playlists, newPlaylist];
    setPlaylists(updated);
    
    if (isGlobal) {
      saveGlobalPlaylist(newPlaylist.id, newPlaylist.name, newPlaylist.tracks, newPlaylist.coverImages, newPlaylist.createdBy);
    } else if (userMode === 'local' || userMode === 'shared') {
      await savePlaylist(newPlaylist);
      if (userMode === 'shared' && userProfile) {
        savePlaylistToSheet(userProfile.displayName, newPlaylist.id, newPlaylist.name, newPlaylist.tracks);
      }
    }
  };

  const handleUpdatePlaylist = async (playlistId, updates) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId) {
        const up = { ...pl, ...updates };
        if (up.isGlobal) {
          saveGlobalPlaylist(up.id, up.name, up.tracks, up.coverImages, up.createdBy);
        } else if (userMode === 'local' || userMode === 'shared') {
          savePlaylist(up);
          if (userMode === 'shared' && userProfile) {
            savePlaylistToSheet(userProfile.displayName, up.id, up.name, up.tracks);
          }
        }
        return up;
      }
      return pl;
    });
    setPlaylists(updated);
  };

  const handleAddToPlaylist = async (playlistId, trackId) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId && !pl.tracks.includes(trackId)) {
        const up = { ...pl, tracks: [...pl.tracks, trackId] };
        if (up.isGlobal) {
          saveGlobalPlaylist(up.id, up.name, up.tracks, up.coverImages, up.createdBy);
        } else if (userMode === 'local' || userMode === 'shared') {
          savePlaylist(up);
          if (userMode === 'shared' && userProfile) {
            savePlaylistToSheet(userProfile.displayName, up.id, up.name, up.tracks);
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

  const handleClearLibrary = async () => {
        if (window.confirm("Are you sure you want to clear your entire library? This cannot be undone.")) {
      setTracks([]);
      if (userMode === 'local' || userMode === 'shared') {
        await saveTracks([]);
      }
    }
  };

  const handleUpdateTrack = async (trackId, updates) => {
    const updatedTracks = tracks.map(t => t.id === trackId ? { ...t, ...updates } : t);
    setTracks(updatedTracks);
    const updatedTrack = updatedTracks.find(t => t.id === trackId);
    if (updatedTrack) {
      await saveTrack(updatedTrack);
    }
  };

  const handleDeleteTrack = async (trackId) => {
    if (!isAdmin) return;
    if (!window.confirm("Are you sure you want to delete this track?")) return;

    const success = await deleteSharedTrack(trackId);
    if (success) {
      setTracks(prev => prev.filter(t => t.id !== trackId));
      if (currentTrack?.id === trackId) {
        audioRef.current.pause();
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    } else {
      alert("Failed to delete track. Please try again.");
    }
  };

  const handleBulkAddToPlaylist = async (playlistId, trackIdsToAdd) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId) {
        const newTrackIds = trackIdsToAdd.filter(id => !pl.tracks.includes(id));
        if (newTrackIds.length === 0) return pl;

        const up = { ...pl, tracks: [...pl.tracks, ...newTrackIds] };
        if (up.isGlobal) {
          saveGlobalPlaylist(up.id, up.name, up.tracks, up.coverImages, up.createdBy);
        } else if (userMode === 'local' || userMode === 'shared') {
          savePlaylist(up);
          if (userMode === 'shared' && userProfile) {
            savePlaylistToSheet(userProfile.displayName, up.id, up.name, up.tracks);
          }
        }
        return up;
      }
      return pl;
    });
    setPlaylists(updated);
  };

  const handleBulkDeleteTracks = async (trackIdsToDelete) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to completely DELETE ${trackIdsToDelete.length} tracks?`)) return;

    const successfulDeletes = new Set();
    for (const id of trackIdsToDelete) {
      if (await deleteSharedTrack(id)) successfulDeletes.add(id);
    }
    
    if (successfulDeletes.size > 0) {
      setTracks(prev => prev.filter(t => !successfulDeletes.has(t.id)));
      if (currentTrack && successfulDeletes.has(currentTrack.id)) {
        audioRef.current.pause();
        setCurrentTrack(null);
        setIsPlaying(false);
      }
    }
  };

  if ((isBooting || isFetchingLibrary) && IS_NATIVE) {
    return <SplashScreen />;
  }

  if (!loggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const adminUsernames = (import.meta.env.VITE_ADMIN_USERNAMES || '').split(',').map(u => u.trim().toLowerCase());
  const isAdmin = userProfile?.displayName && adminUsernames.includes(userProfile.displayName.toLowerCase());

  // Pre-process tracks to inject macroGenre for fast filtering
  const tracksWithMacro = tracks.map(t => ({
    ...t,
    macroGenre: normalizeGenre(t.genre, t.artist, t.title)
  }));

  // Strict Mode Filtering:
  // 1. If Local Mode, BLOCK all Shared Mode (Cloud) tracks.
  // 2. If Shared Mode & Offline, ONLY show Shared tracks that are in the IDB offline cache.
  const displayTracks = tracksWithMacro.filter(t => {
    if (userMode === 'local' && t.source === 'cloudinary') return false;
    if (userMode === 'shared' && isOffline && t.source === 'cloudinary' && !cachedTrackIds.has(t.id)) return false;
    return true;
  });

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
          isAdmin={isAdmin}
        />
        <MainView 
          currentTab={currentTab}
          tracks={displayTracks}
          isLoadingTracks={isFetchingLibrary}
          playlists={playlists}
          activePlaylistId={activePlaylistId}
          onPlayTrack={handlePlayTrack}
          onAddToPlaylist={handleAddToPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
          onUpdatePlaylist={handleUpdatePlaylist}
          currentTrack={currentTrack}
          userProfile={userProfile}
          userMode={userMode}
          onLogout={handleLogout}
          onTracksImported={handleTracksImported}
          onRefreshLibrary={handleRefreshLibrary}
          onClearLibrary={handleClearLibrary}
          onUpdateTrack={handleUpdateTrack}
          audioQuality={audioQuality}
          setAudioQuality={setAudioQuality}
          setCurrentTab={setCurrentTab}
          setActivePlaylistId={setActivePlaylistId}
          isOffline={isOffline}
          isAdmin={isAdmin}
          onDeleteTrack={handleDeleteTrack}
          onBulkAddToPlaylist={handleBulkAddToPlaylist}
          onBulkDeleteTracks={handleBulkDeleteTracks}
        />
      </div>
      {(!isAdmin || currentTrack) && (
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
        audioQuality={audioQuality}
        setAudioQuality={setAudioQuality}
        onExpand={() => setIsNowPlayingExpanded(true)}
      />
      )}

      {isNowPlayingExpanded && currentTrack && (
        <NowPlayingOverlay
          track={currentTrack}
          loadingTrack={loadingTrack}
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
          setShuffle={toggleShuffle}
          setRepeat={toggleRepeat}
          setAutoNext={setAutoNext}
        />
      )}
      <MobileBottomNav currentTab={currentTab} setCurrentTab={setCurrentTab} />

      {updateAvailable && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: 'var(--shadow-xl)'
          }}>
            <h2 style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>Update Available</h2>
            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Version {updateAvailable.version} is ready to download!
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.05)', 
              padding: '16px', 
              borderRadius: '12px',
              marginBottom: '32px',
              textAlign: 'left',
              fontSize: '14px',
              color: 'var(--text-primary)'
            }}>
              <strong>What's new:</strong><br />
              {updateAvailable.notes || 'Bug fixes and performance improvements.'}
            </div>
            
            <button 
              onClick={() => {
                window.open('https://rosewood-audio.vercel.app/reson8.apk', '_system');
                setUpdateAvailable(null);
              }}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--accent-rose)',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '12px'
              }}
            >
              Download Update
            </button>
            <button 
              onClick={() => setUpdateAvailable(null)}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>

  );
}
