import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { usePlayerStore } from '../store/playerStore';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';

function MiniPlayer() {
  const { currentTrack } = usePlayerStore();
  const playbackState = usePlaybackState();

  const isPlaying = playbackState.state === State.Playing;

  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [isPlaying]);

  if (!currentTrack) return null;

  return (
    <View className="absolute bottom-[60px] left-0 right-0 h-16 bg-spotifyDarkGray/95 flex-row items-center px-4 border-b border-spotifyLightGray shadow-lg">
      <View className="w-10 h-10 bg-spotifyLightGray rounded-md overflow-hidden mr-3">
        {/* Placeholder for Album Art */}
      </View>
      
      <View className="flex-1 justify-center">
        <Text className="text-white font-bold text-sm" numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
          {currentTrack.artist}
        </Text>
      </View>
      
      <Pressable 
        onPress={togglePlayback}
        className="w-10 h-10 items-center justify-center"
        android_ripple={{ color: 'rgba(255,255,255,0.15)', borderless: true }}
      >
        <Text className="text-white text-xl">{isPlaying ? '||' : '▶'}</Text>
      </Pressable>
    </View>
  );
}

export default React.memo(MiniPlayer);
