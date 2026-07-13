import React, { useState } from 'react';
import { Home, Music, Plus, LogOut, FolderPlus, Disc, Sparkles, RefreshCw, ListMusic } from 'lucide-react';
import { scanDirectory } from '../utils/fileSystemHelper';

export default function Sidebar({
  currentTab,
  setCurrentTab,
  playlists,
  onCreatePlaylist,
  activePlaylistId,
  setActivePlaylistId,
  userMode,
  userProfile,
  onLogout,
  onTracksImported,
  onRefreshLibrary
}) {
  const [loading, setLoading] = useState(false);

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      const dirHandle = await window.showDirectoryPicker();
      const files = await scanDirectory(dirHandle);

      // Instantly map files to track list states using filename defaults.
      // Under 5ms load time! Avoid heavy tag extraction and duration loading on scan.
      const tracks = files.map(file => {
        const cleanName = file.name.replace(/\.[^/.]+$/, ""); // Strip extension
        const parts = cleanName.split(' - ');
        let artist = 'Unknown Artist';
        let title = cleanName;

        if (parts.length > 1) {
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        }

        return {
          id: `local:${file.name}`,
          name: file.name,
          title,
          artist,
          album: 'Unknown Album',
          genre: 'Local Music',
          year: '',
          artwork: null,
          duration: null,
          source: 'local',
          fileHandle: file.fileHandle,
          url: '' // Will be generated dynamically on playback to prevent browser session expires
        };
      });

      onTracksImported(tracks);
    } catch (err) {
      console.error('Error importing folder:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (tab) => {
    setCurrentTab(tab);
    setActivePlaylistId(null);
  };

  const handlePlaylistClick = (id) => {
    setActivePlaylistId(id);
    setCurrentTab('playlist');
  };

  const [showPlaylistPrompt, setShowPlaylistPrompt] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const triggerAddPlaylist = () => {
    setPlaylistName('');
    setShowPlaylistPrompt(true);
  };

  const submitPlaylist = (e) => {
    e.preventDefault();
    if (playlistName && playlistName.trim()) {
      onCreatePlaylist(playlistName.trim());
    }
    setShowPlaylistPrompt(false);
  };

  const closePlaylistPrompt = () => {
    setShowPlaylistPrompt(false);
  };

  const avatarChar = userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '?';

  return (
    <>
    <aside className="sidebar glass">
      <div className="sidebar-logo">
        <Disc className="logo-icon spin" size={28} />
        <h2>ROSEWOOD</h2>
      </div>

      <nav className="sidebar-menu">
        <button
          className={`menu-item ${currentTab === 'home' ? 'active' : ''}`}
          onClick={() => handleMenuClick('home')}
        >
          <Home size={18} />
          <span>Home</span>
        </button>

        <button
          className={`menu-item ${currentTab === 'library' ? 'active' : ''}`}
          onClick={() => handleMenuClick('library')}
        >
          <Music size={18} />
          <span>Library</span>
        </button>

        <button
          className={`menu-item ${currentTab === 'foryou' ? 'active' : ''}`}
          onClick={() => handleMenuClick('foryou')}
        >
          <Sparkles size={18} />
          <span>For You</span>
        </button>

        <button
          className={`menu-item ${currentTab === 'playlists_hub' ? 'active' : ''}`}
          onClick={() => handleMenuClick('playlists_hub')}
        >
          <ListMusic size={18} />
          <span>Playlists Hub</span>
        </button>
      </nav>

      {userMode === 'local' && (
        <div className="local-import-section" style={{ marginBottom: '24px' }}>
          <button className="menu-item" onClick={handleSelectFolder} disabled={loading} style={{ background: 'rgba(213, 28, 57, 0.05)', color: 'var(--accent-deep)', border: '1px dashed var(--accent-rose)' }}>
            <FolderPlus size={18} />
            <span>{loading ? 'Importing...' : 'Select Music Folder'}</span>
          </button>
        </div>
      )}

      {userMode === 'shared' && (
        <div className="local-import-section" style={{ marginBottom: '24px' }}>
          <button className="menu-item" onClick={async () => {
            try {
              setLoading(true);
              await onRefreshLibrary();
            } finally {
              setLoading(false);
            }
          }} disabled={loading} style={{ background: 'rgba(213, 28, 57, 0.05)', color: 'var(--accent-deep)', border: '1px dashed var(--accent-rose)' }}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh Shared Library'}</span>
          </button>
        </div>
      )}

      <div className="sidebar-divider"></div>

      <div className="sidebar-playlists">
        <div className="playlists-header">
          <h4>Playlists</h4>
          <button className="playlist-add-btn" onClick={triggerAddPlaylist}>
            <Plus size={16} />
          </button>
        </div>
        <div className="playlist-list">
          {playlists.map(pl => (
            <button
              key={pl.id}
              className={`playlist-item ${activePlaylistId === pl.id ? 'active' : ''}`}
              onClick={() => handlePlaylistClick(pl.id)}
            >
              {pl.name}
            </button>
          ))}
        </div>
      </div>

      <div className="user-profile-badge">
        <div className="profile-avatar">{avatarChar}</div>
        <div className="profile-info">
          <div className="profile-name">{userProfile?.displayName || 'User'}</div>
          <div className="profile-mode">{userMode} Mode</div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>

      {showPlaylistPrompt && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3>Create Playlist</h3>
            <form onSubmit={submitPlaylist}>
              <input
                type="text"
                autoFocus
                placeholder="Enter playlist name..."
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="modal-input"
              />
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closePlaylistPrompt}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!playlistName.trim()}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
