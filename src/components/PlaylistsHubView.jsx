import React, { useState, useEffect } from 'react';
import { Plus, ListMusic, Play, Edit2, Camera, FolderPlus, Sparkles, Music } from 'lucide-react';

export default function PlaylistsHubView({
  playlists = [],
  tracks = [],
  onCreatePlaylist,
  onUpdatePlaylist,
  onSelectPlaylist,
  onPlayTrack,
  expandPlayer
}) {
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [coverRotationTick, setCoverRotationTick] = useState(0);

  // Rotating cover image effect for dynamic playlists
  useEffect(() => {
    const interval = setInterval(() => {
      setCoverRotationTick(prev => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const openPlaylistEdit = (pl) => {
    setEditingPlaylistId(pl.id);
    setEditPlaylistName(pl.name);
  };

  const handleSavePlaylistEdit = (e) => {
    e.preventDefault();
    if (editingPlaylistId && editPlaylistName.trim()) {
      if (onUpdatePlaylist) {
        onUpdatePlaylist(editingPlaylistId, { name: editPlaylistName.trim() });
      }
    }
    setEditingPlaylistId(null);
  };

  const handleDPChange = (e, playlistId) => {
    const file = e.target.files[0];
    if (file && onUpdatePlaylist) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdatePlaylist(playlistId, { dp: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const renderPlaylistCollage = (pl) => {
    if (pl.dp) {
      return <img src={pl.dp} className="playlist-dp-full" alt="Cover" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    if (pl.coverImages && pl.coverImages.length > 0) {
      const idx = coverRotationTick % pl.coverImages.length;
      return (
        <div className="rotating-cover-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: 'inherit' }}>
          {pl.coverImages.map((img, i) => (
            <img 
              key={`${img}-${i}`} 
              src={img} 
              className={`playlist-dp-full rotating-cover ${i === idx ? 'active' : ''}`} 
              alt="Cover" 
              loading="lazy" 
              decoding="async"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: i === idx ? 1 : 0, transition: 'opacity 1s ease' }} 
            />
          ))}
        </div>
      );
    }

    if (!pl.tracks || pl.tracks.length === 0) {
      return (
        <div className="card-placeholder-art playlist-dp-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
          <FolderPlus size={40} />
        </div>
      );
    }
    
    const plTracks = tracks.filter(t => pl.tracks.includes(t.id));
    const artworks = plTracks.filter(t => t.artwork).map(t => t.artwork);
    const top4 = [...new Set(artworks)].slice(0, 4);
    
    if (top4.length === 0) {
      return (
        <div className="card-placeholder-art playlist-dp-placeholder" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
          <ListMusic size={40} />
        </div>
      );
    }
    
    if (top4.length < 4) {
      return <img src={top4[0]} className="playlist-dp-full" alt="Cover" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    
    return (
      <div className="playlist-collage" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', width: '100%', height: '100%', gap: '2px', background: 'var(--bg-deep)' }}>
        {top4.map((art, i) => (
          <img key={i} src={art} className="collage-img" alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ))}
      </div>
    );
  };

  return (
    <div className="playlists-hub-container">
      {/* Header Bar */}
      <div className="section-header glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderRadius: '20px', marginBottom: '32px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ListMusic size={26} className="gradient-text" />
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0 }}>Playlists Hub</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Curate and organize your favorite acoustic sessions</p>
          </div>
        </div>

        <button 
          className="btn-primary hover-scale" 
          onClick={() => {
            const name = window.prompt('Enter Playlist Name:', 'New Playlist');
            if (name && name.trim() && onCreatePlaylist) {
              onCreatePlaylist(name.trim());
            }
          }}
          style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-md)' }}
        >
          <Plus size={18} /> <span>Create Playlist</span>
        </button>
      </div>

      {/* Grid or Empty State */}
      {playlists.length === 0 ? (
        <div className="import-prompt glass" style={{ textAlign: 'center', padding: '80px 20px', borderRadius: '24px', border: '1px solid var(--border-subtle)' }}>
          <ListMusic className="import-icon" size={64} style={{ opacity: 0.3, margin: '0 auto 16px', color: 'var(--accent-coral)' }} />
          <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>No Playlists Yet</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '15px' }}>
            Create a playlist to curate your favorite tracks into one seamless, continuous collection.
          </p>
          <button 
            className="btn-primary hover-scale" 
            onClick={() => {
              const name = window.prompt('Enter Playlist Name:', 'My Favorite Acoustic');
              if (name && name.trim() && onCreatePlaylist) {
                onCreatePlaylist(name.trim());
              }
            }}
            style={{ padding: '12px 28px', borderRadius: '14px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow-lg)' }}
          >
            Create Your First Playlist
          </button>
        </div>
      ) : (
        <div className="playlist-hub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
          {playlists.map(pl => {
            const trackCount = pl.tracks ? pl.tracks.length : 0;
            return (
              <div key={pl.id} className="playlist-card glass hover-scale" style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
                <div 
                  className="playlist-card-art-container" 
                  onClick={() => onSelectPlaylist && onSelectPlaylist(pl.id)}
                  style={{ position: 'relative', width: '100%', aspectRatio: '1/1', cursor: 'pointer', overflow: 'hidden', background: 'var(--bg-deep)' }}
                >
                  {renderPlaylistCollage(pl)}
                  
                  <div 
                    className="card-play-overlay"
                    onClick={(e) => {
                      e.stopPropagation();
                      const plTracks = tracks.filter(t => pl.tracks && pl.tracks.includes(t.id));
                      if (plTracks.length > 0 && onPlayTrack) {
                        onPlayTrack(plTracks[0], plTracks);
                        if (expandPlayer) expandPlayer();
                      } else {
                        alert('This playlist has no tracks yet.');
                      }
                    }}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s ease' }}
                  >
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--accent-coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-lg)' }}>
                      <Play size={26} fill="#fff" color="#fff" style={{ transform: 'translateX(2px)' }} />
                    </div>
                  </div>

                  <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: '600', color: '#fff' }}>
                    <Music size={10} style={{ display: 'inline', marginRight: '4px' }} />
                    {trackCount} {trackCount === 1 ? 'Song' : 'Songs'}
                  </div>
                </div>

                <div className="playlist-card-info" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  {editingPlaylistId === pl.id ? (
                    <form onSubmit={handleSavePlaylistEdit} style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        value={editPlaylistName} 
                        onChange={(e) => setEditPlaylistName(e.target.value)} 
                        autoFocus 
                        style={{ flex: 1, minWidth: 0, padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: '#fff', fontSize: '14px', outline: 'none' }} 
                      />
                      <button type="submit" style={{ background: 'var(--accent-coral)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', padding: '6px 10px', borderRadius: '6px', flexShrink: 0 }}>
                        Save
                      </button>
                    </form>
                  ) : (
                    <>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 
                          onClick={() => onSelectPlaylist && onSelectPlaylist(pl.id)} 
                          style={{ cursor: 'pointer', margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {pl.name || 'Untitled Playlist'}
                        </h4>
                      </div>

                      <div className="playlist-actions" style={{ display: 'flex', gap: '10px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        <button 
                          onClick={() => openPlaylistEdit(pl)} 
                          title="Rename Playlist" 
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', padding: '4px', borderRadius: '4px' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <label style={{ cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} title="Change Cover Image">
                          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleDPChange(e, pl.id)} />
                          <Camera size={16} />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
