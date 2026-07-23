import React, { useState } from 'react';
import { Home, Music, Plus, LogOut, FolderPlus, Disc, Sparkles, RefreshCw, ListMusic, Download, Settings } from 'lucide-react';
import { scanDirectory, triggerFileSelect } from '../utils/fileSystemHelper';
import CloudinaryUpload from './CloudinaryUpload';
import { uploadToCloudinary } from '../utils/storageCacheHelper';

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
  onRefreshLibrary,
  isAdmin
}) {
  const [loading, setLoading] = useState(false);

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      const tracks = await triggerFileSelect();
      if (tracks && tracks.length > 0) {
        onTracksImported(tracks);
      }
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
  const [playlistImages, setPlaylistImages] = useState('');
  const [playlistImageFiles, setPlaylistImageFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const triggerAddPlaylist = () => {
    setPlaylistName('');
    setPlaylistImages('');
    setPlaylistImageFiles([]);
    setShowPlaylistPrompt(true);
  };

  const submitPlaylist = async (e) => {
    e.preventDefault();
    if (playlistName && playlistName.trim()) {
      setIsUploading(true);
      
      let coverImages = playlistImages
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      // Upload local files to Cloudinary if any
      if (playlistImageFiles.length > 0) {
        for (let i = 0; i < playlistImageFiles.length; i++) {
          try {
            const url = await uploadToCloudinary(playlistImageFiles[i], 'image');
            coverImages.push(url);
          } catch (err) {
            console.error('Failed to upload playlist image:', err);
          }
        }
      }
      
      // If admin creates a playlist, make it global
      onCreatePlaylist(playlistName.trim(), isAdmin, coverImages);
      setIsUploading(false);
      setShowPlaylistPrompt(false);
    }
  };

  const closePlaylistPrompt = () => {
    setShowPlaylistPrompt(false);
  };

  const avatarChar = userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '?';

  const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

  const adminUsernames = (import.meta.env.VITE_ADMIN_USERNAMES || '').split(',').map(u => u.trim().toLowerCase());
  return (
    <>
    <aside className="sidebar glass">
      <div className="sidebar-logo">
        <img src="/icon.png" alt="Reson8 Logo" className="logo-icon" style={{ width: '48px', height: '48px', objectFit: 'contain', transform: 'scale(1.5)' }} />
        <h2>RESON8</h2>
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

        <button
          className={`menu-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => handleMenuClick('settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        {!isNative && (
          <a
            href="/reson8.apk"
            download
            className="menu-item"
            style={{ textDecoration: 'none', color: 'var(--accent-coral)' }}
          >
            <Download size={18} />
            <span>Download App</span>
          </a>
        )}
      </nav>

      {userMode === 'local' && (
        <div className="local-import-section" style={{ marginBottom: '24px' }}>
          <button className="menu-item" onClick={handleSelectFolder} disabled={loading} style={{ background: 'rgba(213, 28, 57, 0.05)', color: 'var(--accent-deep)', border: '1px dashed var(--accent-rose)' }}>
            <FolderPlus size={18} />
            <span>{loading ? 'Importing...' : isNative ? 'Scan Device for Music' : 'Select Music Folder'}</span>
          </button>
        </div>
      )}

      {userMode === 'shared' && (
        <div className="local-import-section" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isAdmin && <CloudinaryUpload onUploadComplete={onRefreshLibrary} />}
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
            <form onSubmit={submitPlaylist} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Playlist Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter playlist name..."
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="modal-input"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              
              {isAdmin && (
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Cover Images</label>
                  
                  {/* File Upload */}
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={(e) => setPlaylistImageFiles(Array.from(e.target.files))}
                    style={{ marginBottom: '8px', display: 'block', width: '100%', padding: '8px', background: 'var(--bg-deep)', borderRadius: '8px', color: 'var(--text-secondary)' }}
                  />

                  {/* Fallback Textarea for URLs */}
                  <textarea
                    placeholder="Or paste URLs here (comma-separated)..."
                    value={playlistImages}
                    onChange={(e) => setPlaylistImages(e.target.value)}
                    className="modal-input"
                    rows="2"
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>If multiple images are provided, they will slowly rotate over time.</p>
                </div>
              )}

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={closePlaylistPrompt} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }} disabled={isUploading}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={!playlistName.trim() || isUploading} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                  {isUploading ? 'Uploading...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
