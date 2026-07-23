import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { usePlayerStore } from '../store/playerStore';

function ForYouScreen() {
  const { playTrack } = usePlayerStore();

  const handlePlayTestTrack = useCallback(() => {
    // A mock track pointing to a sample mp3
    playTrack({
      id: 'mock-1',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'For You Daily Mix',
      artist: 'Aura Recommendations',
      artwork: 'https://picsum.photos/200'
    });
  }, [playTrack]);

  return (
    <ScrollView className="flex-1 bg-spotifyBlack pt-12 px-4">
      <Text className="text-white text-3xl font-extrabold mb-6">Good evening</Text>
      
      <View className="flex-row flex-wrap justify-between">
        {/* Mock Recommendation Card */}
        <Pressable 
          className="bg-spotifyDarkGray w-[48%] rounded-md mb-4 flex-row items-center overflow-hidden"
          onPress={handlePlayTestTrack}
          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
        >
          <View className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-500" />
          <Text className="text-white font-bold text-sm ml-2 flex-1">Daily Mix 1</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default React.memo(ForYouScreen);
