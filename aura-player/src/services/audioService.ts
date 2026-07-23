import TrackPlayer, {
  AppKilledBehavior,
  Capability,
  RepeatMode,
} from 'react-native-track-player';

export const setupPlayer = async () => {
  let isSetup = false;
  try {
    await TrackPlayer.getActiveTrackIndex();
    isSetup = true;
  } catch {
    await TrackPlayer.setupPlayer({
      // Aggressive instant-start config:
      // - playBuffer 0.5s: start audio after just half a second of data (Spotify-like instant feel)
      // - minBuffer 5s: keep at least 5s buffered ahead to survive brief network hiccups
      // - maxBuffer 120s: once playing, buffer up to 2 minutes ahead so forward seeks within range are instant
      // - backBuffer 30s: retain 30s of already-played audio so backward scrubbing doesn't re-fetch
      // - waitForBuffer false: don't block play() on reaching minBuffer — start as soon as playBuffer is met
      minBuffer: 5,
      maxBuffer: 120,
      playBuffer: 0.5,
      backBuffer: 30,
      waitForBuffer: false,
      autoHandleInterruptions: true,
    });

    await TrackPlayer.updateOptions({
      android: {
        appKilledBehavior: AppKilledBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      // 0.5s progress updates for a smooth, responsive progress bar
      progressUpdateEventInterval: 0.5,
    });

    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    isSetup = true;
  }
  return isSetup;
};
