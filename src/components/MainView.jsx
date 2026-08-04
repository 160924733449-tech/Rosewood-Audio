import React, { useEffect, useState, useRef } from 'react';
import { getRecommendations, getTopMatches } from '../utils/recommendationEngine';
import { triggerFileSelect } from '../utils/fileSystemHelper';
import HomeView from './HomeView';
import LibraryView from './LibraryView';
import ExploreView from './ExploreView';
import PlaylistsHubView from './PlaylistsHubView';
import PlaylistDetailView from './PlaylistDetailView';
import SettingsView from './SettingsView';

export default function MainView({
  currentTab,
  tracks = [],
  isLoadingTracks = false,
  playlists = [],
  activePlaylistId,
  onPlayTrack,
  onAddToPlaylist,
  currentTrack,
  userProfile,
  setCurrentTab,
  onCreatePlaylist,
  onUpdatePlaylist,
  setActivePlaylistId,
  userMode = 'local',
  onLogout,
  onTracksImported,
  onRefreshLibrary,
  onClearLibrary,
  onUpdateTrack,
  audioQuality = 'auto',
  setAudioQuality,
  isOffline = false,
  isAdmin = false,
  onDeleteTrack,
  onBulkAddToPlaylist,
  onBulkDeleteTracks,
  expandPlayer,
  onToggleFriendActivity,
  onToggleJamSession,
  isPrivateListening = false,
  setIsPrivateListening
}) {
  const [recommendations, setRecommendations] = useState({ dailyMix: [], similarTracks: [], forgottenGems: [] });
  const [topMatches, setTopMatches] = useState([]);
  const mainViewRef = useRef(null);

  useEffect(() => {
    if (tracks && tracks.length > 0) {
      getRecommendations(tracks).then(res => {
        if (res) setRecommendations(res);
      }).catch(e => console.warn('Recommendation calculation error', e));

      getTopMatches(tracks).then(res => {
        if (res) setTopMatches(res);
      }).catch(e => console.warn('Top matches calculation error', e));
    }
  }, [tracks.length]);

  const handleImportMusic = async () => {
    try {
      const newTracks = await triggerFileSelect();
      if (newTracks && newTracks.length > 0) {
        if (onTracksImported) onTracksImported(newTracks);
      }
    } catch (e) {
      console.error('Import error:', e);
    }
  };

  return (
    <main className="main-view" ref={mainViewRef}>
      {currentTab === 'home' && (
        <HomeView
          userProfile={userProfile}
          tracks={tracks}
          isOffline={isOffline}
          userMode={userMode}
          onImportMusic={handleImportMusic}
          onRefreshLibrary={onRefreshLibrary}
          onPlayTrack={onPlayTrack}
          isPrivateListening={isPrivateListening}
          isAdmin={isAdmin}
          onNavigateToTab={setCurrentTab}
        />
      )}

      {currentTab === 'library' && (
        <LibraryView
          tracks={tracks}
          isLoadingTracks={isLoadingTracks}
          currentTrack={currentTrack}
          onPlayTrack={onPlayTrack}
          onDeleteTrack={onDeleteTrack}
          onUpdateTrack={onUpdateTrack}
          userMode={userMode}
          isOffline={isOffline}
          isAdmin={isAdmin}
          onBulkAddToPlaylist={onBulkAddToPlaylist}
          onBulkDeleteTracks={onBulkDeleteTracks}
          playlists={playlists}
          scrollContainerRef={mainViewRef}
          onRefreshLibrary={onRefreshLibrary}
          onClearLibrary={onClearLibrary}
        />
      )}

      {(currentTab === 'foryou' || currentTab === 'explore') && (
        <ExploreView
          recommendations={recommendations}
          tracks={tracks}
          isOffline={isOffline}
          onPlayTrack={onPlayTrack}
        />
      )}

      {currentTab === 'playlists_hub' && (
        <PlaylistsHubView
          playlists={playlists}
          tracks={tracks}
          onCreatePlaylist={onCreatePlaylist}
          onUpdatePlaylist={onUpdatePlaylist}
          onSelectPlaylist={(plId) => {
            if (setActivePlaylistId) setActivePlaylistId(plId);
            if (setCurrentTab) setCurrentTab('playlist');
          }}
          onPlayTrack={onPlayTrack}
          expandPlayer={expandPlayer}
        />
      )}

      {currentTab === 'playlist' && (
        <PlaylistDetailView
          playlist={playlists.find(p => p.id === activePlaylistId)}
          tracks={tracks}
          currentTrack={currentTrack}
          onPlayTrack={onPlayTrack}
          onUpdatePlaylist={onUpdatePlaylist}
          onNavigateToHub={() => setCurrentTab && setCurrentTab('playlists_hub')}
          onNavigateToLibrary={() => setCurrentTab && setCurrentTab('library')}
          scrollContainerRef={mainViewRef}
          isAdmin={isAdmin}
          onDeleteTrack={onDeleteTrack}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView
          userProfile={userProfile}
          userMode={userMode}
          audioQuality={audioQuality}
          setAudioQuality={setAudioQuality}
          onToggleFriendActivity={onToggleFriendActivity}
          onToggleJamSession={onToggleJamSession}
          isPrivateListening={isPrivateListening}
          setIsPrivateListening={setIsPrivateListening}
          onRefreshLibrary={onRefreshLibrary}
          onImportMusic={handleImportMusic}
          onLogout={onLogout}
          onClearLibrary={onClearLibrary}
        />
      )}
    </main>
  );
}
