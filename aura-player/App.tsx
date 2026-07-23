import './global.css';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator, InteractionManager } from 'react-native';
import { setupPlayer } from './src/services/audioService';
import { initSyncEngine, enforceCacheLimit } from './src/services/syncEngine';
import './src/services/firebaseApp';
import TrackPlayer, { Event } from 'react-native-track-player';

import RootNavigator from './src/navigation/RootNavigator';

// Register the playback service for background audio events (must be top-level)
TrackPlayer.registerPlaybackService(() => async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => TrackPlayer.seekTo(e.position));
});

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      // Run both in parallel — they are independent, saving ~200-500ms vs sequential
      const [, playerReady] = await Promise.all([
        initSyncEngine(),
        setupPlayer(),
      ]);
      if (playerReady) {
        setIsReady(true);
      }

      // Defer non-critical housekeeping until after the first frame is interactive
      InteractionManager.runAfterInteractions(() => {
        enforceCacheLimit().catch(() => {});
      });
    }
    init();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Initializing Aura Player...</Text>
      </View>
    );
  }

  return (
    <>
      <RootNavigator />
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
