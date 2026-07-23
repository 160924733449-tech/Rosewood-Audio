import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { enableScreens } from 'react-native-screens';

import ForYouScreen from '../screens/ForYouScreen';
import MiniPlayer from '../components/MiniPlayer';

// Enable native screen optimization — detaches inactive screens from the native view hierarchy
enableScreens(true);

const Tab = createBottomTabNavigator();

// Lazy placeholder screens — only mount when the user actually navigates to them
const LibraryScreen = React.lazy(() => Promise.resolve({ default: () => <View className="flex-1 bg-spotifyBlack" /> }));
const SettingsScreen = React.lazy(() => Promise.resolve({ default: () => <View className="flex-1 bg-spotifyBlack" /> }));

const LazyLibrary = () => (
  <React.Suspense fallback={<View className="flex-1 bg-spotifyBlack" />}>
    <LibraryScreen />
  </React.Suspense>
);

const LazySettings = () => (
  <React.Suspense fallback={<View className="flex-1 bg-spotifyBlack" />}>
    <SettingsScreen />
  </React.Suspense>
);

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <View className="flex-1">
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: '#121212',
              borderTopWidth: 0,
              elevation: 0,
            },
            tabBarActiveTintColor: '#1DB954',
            tabBarInactiveTintColor: '#B3B3B3',
            // Detach inactive tab screens from the native view hierarchy
            // Reduces memory and GPU usage for tabs the user isn't viewing
            detachInactiveScreens: true,
          }}
        >
          <Tab.Screen name="For You" component={ForYouScreen} />
          <Tab.Screen name="Library" component={LazyLibrary} />
          <Tab.Screen name="Settings" component={LazySettings} />
        </Tab.Navigator>
        
        {/* The persistent MiniPlayer sits above the Bottom Tabs */}
        <MiniPlayer />
      </View>
    </NavigationContainer>
  );
}
