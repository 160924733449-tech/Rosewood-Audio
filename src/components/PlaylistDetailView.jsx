import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Play, Shuffle, Clock, Music, Disc, 
  FolderPlus, Trash2, Settings, Image, ListMusic 
} from 'lucide-react';
import { TableVirtuoso, Virtuoso } from 'react-virtuoso';
import { useContextMenu } from './ContextMenu';

// Helper to format duration
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export default function PlaylistDetailView({
  playlist = null,
  tracks = [],
  currentTrack = null,
  onPlayTrack,
  onUpdatePlaylist,
  onNavigateToHub,
  onNavigateToLibrary,
  scrollContainerRef = null,
  isAdmin = false,
  onDeleteTrack
}) {
  const [previewImageId, setPreviewImageId] = useState(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { openMenu } = useContextMenu();

  // Get tracks belonging to this playlist
  const playlistTracks = useMemo(() => {
    if (!playlist || !playlist.tracks || !tracks) return [];
    return tracks.filter(t => playlist.tracks.includes(t.id));
  }, [playlist, tracks]);

  // Total duration of playlist
  const totalDurationSec = useMemo(() => {
    return playlistTracks.reduce((acc, t) => acc + (Number(t.duration) || 0), 0);
  }, [playlistTracks]);

  const formattedTotalTime = useMemo(() => {
    const hrs = Math.floor(totalDurationSec / 3600);
    const mins = Math.floor((totalDurationSec % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }, [totalDurationSec]);

  // Remove track from playlist
  const handleRemoveFromPlaylist = (trackId) => {
    if (!playlist || !onUpdatePlaylist) return;
    const updated = playlist.tracks.filter(id => id !== trackId);
    onUpdatePlaylist(playlist.id, { tracks: updated });
  };

  // Context Menu options
  const getContextMenuOptions = (track) => [
    { label: 'Play Now', icon: <Play size={14} />, action: (t) => onPlayTrack(t, playlistTracks) },
    { label: 'Remove from Playlist', icon: <Trash2 size={14} color="var(--accent-coral)" />, action: (t) => handleRemoveFromPlaylist(t.id) },
    ...(isAdmin || track.source === 'local' ? [{ label: 'Delete Track from Library', icon: <Trash2 size={14} color="var(--accent-rose)" />, action: (t) => onDeleteTrack && onDeleteTrack(t.id) }] : [])
  ];

  if (!playlist) {
    return (
      <div className="playlist-detail-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p>Playlist not found.</p>
        {onNavigateToHub && (
          <button onClick={onNavigateToHub} className="btn-primary" style={{ marginTop: '16px', padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', cursor: 'pointer' }}>
            Back to Playlists
          </button>
        )}
      </div>
    );
  }

  // Helper to render artwork collage in hero
  const renderHeroArt = () => {
    if (playlist.dp) {
      return <img src={playlist.dp} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    const artworks = playlistTracks.filter(t => t.artwork).map(t => t.artwork);
    const top4 = [...new Set(artworks)].slice(0, 4);
    if (top4.length === 0) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)', color: 'var(--text-muted)' }}>
          <ListMusic size={64} />
        </div>
      );
    }
    if (top4.length < 4) {
      return <img src={top4[0]} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', width: '100%', height: '100%', gap: '2px', background: 'var(--bg-deep)' }}>
        {top4.map((art, i) => (
          <img key={i} src={art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ))}
      </div>
    );
  };

  return (
    <div className="playlist-detail-container">
      {/* Back Button */}
      {onNavigateToHub && (
        <button 
          onClick={onNavigateToHub}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', marginBottom: '24px', transition: 'color 0.2s ease' }}
          className="hover-scale"
        >
          <ArrowLeft size={18} /> <span>Back to Playlists Hub</span>
        </button>
      )}

      {/* Playlist Hero Header */}
      <div className="playlist-hero glass" style={{ display: 'flex', gap: '32px', padding: '32px', borderRadius: '24px', alignItems: 'flex-end', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(15, 14, 12, 0.85) 100%)', flexWrap: 'wrap' }}>
        <div className="playlist-hero-art" style={{ width: '180px', height: '180px', borderRadius: '20px', overflow: 'hidden', flexShrink: 0, boxShadow: 'var(--shadow-xl)', border: '1px solid rgba(255,255,255,0.1)', background: 'var(--bg-deep)' }}>
          {renderHeroArt()}
        </div>

        <div className="playlist-hero-info" style={{ flex: 1, minWidth: '240px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--accent-coral)' }}>Playlist</span>
          <h1 style={{ fontSize: '38px', fontWeight: '900', margin: '8px 0 12px', color: 'var(--text-primary)', lineHeight: '1.1', wordBreak: 'break-word', fontFamily: 'var(--font-serif)' }}>
            {playlist.name || 'Untitled Playlist'}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '14px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Music size={16} /> {playlistTracks.length} {playlistTracks.length === 1 ? 'Song' : 'Songs'}
            </span>
            {totalDurationSec > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> {formattedTotalTime}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
            {playlistTracks.length > 0 && (
              <>
                <button 
                  onClick={() => onPlayTrack(playlistTracks[0], playlistTracks)}
                  className="btn-primary hover-scale"
                  style={{ padding: '12px 28px', borderRadius: '100px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-lg)' }}
                >
                  <Play size={18} fill="#fff" /> <span>Play All</span>
                </button>

                <button 
                  onClick={() => {
                    const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
                    if (shuffled.length > 0) onPlayTrack(shuffled[0], shuffled);
                  }}
                  className="btn-secondary hover-scale"
                  style={{ padding: '12px 24px', borderRadius: '100px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Shuffle size={18} /> <span>Shuffle</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Track List */}
      <div className="playlist-tracks-section" style={{ marginTop: '32px' }}>
        {playlistTracks.length === 0 ? (
          <div className="import-prompt glass" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
            <FolderPlus className="import-icon" size={56} style={{ opacity: 0.3, margin: '0 auto 16px', color: 'var(--accent-coral)' }} />
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>This playlist is currently empty</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 20px', lineHeight: '1.6', fontSize: '14px' }}>
              Find your favorite acoustic tracks in your library and add them here to start building your collection.
            </p>
            {onNavigateToLibrary && (
              <button 
                className="btn-primary hover-scale" 
                style={{ padding: '12px 26px', borderRadius: '14px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
                onClick={onNavigateToLibrary}
              >
                Browse Collection
              </button>
            )}
          </div>
        ) : isMobile ? (
          /* MOBILE VIEW: Dedicated Touch-Friendly Card Rows */
          <Virtuoso
            data={playlistTracks}
            customScrollParent={scrollContainerRef?.current || undefined}
            useWindowScroll={!scrollContainerRef?.current}
            className="mobile-track-list-virtuoso"
            itemContent={(index, t) => {
              const isActive = currentTrack && currentTrack.id === t.id;

              return (
                <div 
                  key={t.id}
                  className={`mobile-track-card ${isActive ? 'active-playing' : ''}`}
                  onClick={() => onPlayTrack(t, playlistTracks)}
                  onContextMenu={(e) => openMenu(e, getContextMenuOptions(t), t)}
                >
                  <div className="mobile-track-art-wrapper" style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-deep)' }}>
                    {t.artwork ? (
                      <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <Music size={20} />
                      </div>
                    )}
                    {isActive && (
                      <div className="mobile-active-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Disc size={22} className="spin" color="var(--accent-coral)" />
                      </div>
                    )}
                  </div>

                  <div className="mobile-track-info-stacked" style={{ flex: 1, minWidth: 0, marginLeft: '12px' }}>
                    <div className="mobile-track-title" style={{ fontSize: '15px', fontWeight: '600', color: isActive ? 'var(--accent-coral)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title || 'Untitled'}
                    </div>
                    <div className="mobile-track-artist" style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                      {t.artist || 'Unknown Artist'}
                    </div>
                  </div>

                  <div className="mobile-track-trailing" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {formatDuration(t.duration)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(e, getContextMenuOptions(t), t);
                      }}
                      className="mobile-menu-btn"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label="Track Options"
                    >
                      <Settings size={18} />
                    </button>
                  </div>
                </div>
              );
            }}
          />
        ) : (
          /* DESKTOP / TABLET VIEW: Premium Styled Table */
          <TableVirtuoso
            data={playlistTracks}
            customScrollParent={scrollContainerRef?.current || undefined}
            useWindowScroll={!scrollContainerRef?.current}
            className="premium-track-table"
            components={{
              Table: (props) => <table className="track-table premium-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }} {...props} />,
              TableHead: React.forwardRef((props, ref) => <thead {...props} ref={ref} />),
              TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref} />),
              TableRow: (props) => {
                const t = props.item;
                const isActive = currentTrack && currentTrack.id === t.id;
                return (
                  <tr 
                    {...props}
                    className={`track-row ${isActive ? 'active' : ''}`}
                    style={{ cursor: 'pointer', transition: 'background 0.2s ease' }}
                    onClick={() => onPlayTrack(t, playlistTracks)}
                    onContextMenu={(e) => openMenu(e, getContextMenuOptions(t), t)}
                  />
                );
              }
            }}
            fixedHeaderContent={() => (
              <tr className="table-header-row" style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>#</th>
                <th style={{ padding: '12px 16px' }}>Title & Artist</th>
                <th style={{ padding: '12px 16px' }}>Genre</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}><Clock size={14} style={{ verticalAlign: 'middle' }} /></th>
                <th style={{ padding: '12px 16px', width: '48px' }}></th>
              </tr>
            )}
            itemContent={(index, t) => {
              const isActive = currentTrack && currentTrack.id === t.id;
              return (
                <>
                  <td style={{ padding: '10px 16px', borderRadius: '12px 0 0 12px', width: '40px' }}>
                    {isActive ? (
                      <Disc size={16} className="spin" color="var(--accent-coral)" />
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{index + 1}</span>
                    )}
                  </td>

                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className="table-art-thumb" style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-deep)', flexShrink: 0 }}>
                        {t.artwork ? (
                          <img src={t.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <Music size={18} />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewImageId(previewImageId === t.id ? null : t.id);
                          }}
                          style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px', padding: '2px', color: '#fff', cursor: 'pointer', display: t.artwork ? 'block' : 'none' }}
                          title="Preview Artwork"
                        >
                          <Image size={10} />
                        </button>
                        {previewImageId === t.id && t.artwork && (
                          <div className="admin-artwork-preview glass" onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', zIndex: 999, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', padding: '12px', borderRadius: '16px', boxShadow: 'var(--shadow-xl)', background: 'var(--bg-surface)' }}>
                            <img src={t.artwork} alt="Preview" style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '12px', display: 'block' }} />
                            <button onClick={() => setPreviewImageId(null)} style={{ marginTop: '10px', width: '100%', background: 'var(--accent-coral)', color: '#fff', border: 'none', padding: '6px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Close</button>
                          </div>
                        )}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: isActive ? '700' : '600', color: isActive ? 'var(--accent-coral)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title || 'Untitled'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                          {t.artist || 'Unknown Artist'}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {t.genre ? (
                      <span style={{ padding: '2px 8px', borderRadius: '100px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-primary)' }}>
                        {t.genre}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>

                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {formatDuration(t.duration)}
                  </td>

                  <td style={{ padding: '10px 16px', borderRadius: '0 12px 12px 0', textAlign: 'center' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openMenu(e, getContextMenuOptions(t), t);
                      }}
                      className="desktop-row-action-btn"
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '6px', cursor: 'pointer', borderRadius: '6px' }}
                      title="More Options"
                    >
                      <Settings size={16} />
                    </button>
                  </td>
                </>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
