import { create } from 'zustand';
import TrackPlayer, { Track } from 'react-native-track-player';
import { getLocalUri, downloadTrack } from '../services/syncEngine';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  playTrack: (track: Track) => Promise<void>;
  prefetchNext: (track: Track) => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  playTrack: async (track: Track) => {
    // 1. Instant UI update — user sees the track change immediately, no waiting for async work
    set({ currentTrack: track, isPlaying: true });

    // 2. Resolve local cache in parallel with player teardown
    const [cachedUri] = await Promise.all([
      getLocalUri(track.id),
      TrackPlayer.reset(),
    ]);

    const audioUrl = cachedUri || track.url;
    const trackToPlay = { ...track, url: audioUrl };

    // 3. Queue and play — reset() already completed above so this is instant
    await TrackPlayer.add(trackToPlay);
    await TrackPlayer.play();

    // 4. Background: if we streamed remotely, silently cache the track for next time
    if (!cachedUri && track.url) {
      downloadTrack(track.id, track.url).catch(() => {});
    }
  },

  // Pre-fetch and queue the next track so skip transitions are instant
  prefetchNext: async (track: Track) => {
    const cachedUri = await getLocalUri(track.id);
    const audioUrl = cachedUri || track.url;
    const trackToQueue = { ...track, url: audioUrl };

    // Add to the end of the queue — TrackPlayer will buffer it in the background
    await TrackPlayer.add(trackToQueue);

    // Also trigger a background download if not cached
    if (!cachedUri && track.url) {
      downloadTrack(track.id, track.url).catch(() => {});
    }
  },
}));
