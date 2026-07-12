import React, { useEffect, useState } from 'react';
import { Sparkles, Music, Play, Plus, Clock, Disc, FolderPlus } from 'lucide-react';
import { getRecommendations, getTopMatches } from '../utils/recommendationEngine';

export default function MainView({
  currentTab,
  tracks,
  playlists,
  activePlaylistId,
  onPlayTrack,
  onAddToPlaylist,
  currentTrack,
  userProfile,
  setCurrentTab
}) {
  const [recommendations, setRecommendations] = useState({ dailyMix: [], similarTracks: [], forgottenGems: [] });
  const [topMatches, setTopMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedTrackId, setAddedTrackId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  useEffect(() => {
    const closeDropdown = () => setOpenDropdownId(null);
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, []);

  useEffect(() => {
    if (tracks.length > 0) {
      getRecommendations(tracks).then(res => {
        setRecommendations(res);
      });
      getTopMatches(tracks).then(res => {
        setTopMatches(res);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length, currentTrack]);


  const formatDuration = (time) => {
    if (!time || isNaN(time)) return '--:--';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getActivePlaylist = () => {
    return playlists.find(p => p.id === activePlaylistId);
  };

  const renderTrackTable = (trackList) => {
    if (!trackList || trackList.length === 0) {
      return (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
          No tracks found. Add some music to see them here!
        </div>
      );
    }

    return (
      <table className="track-table">
        <thead>
          <tr>
            <th className="track-number-cell">#</th>
            <th>Title</th>
            <th>Album</th>
            <th className="track-duration-cell"><Clock size={14} /></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {trackList.map((t, index) => {
            const isActive = currentTrack && currentTrack.id === t.id;
            return (
              <tr 
                key={t.id} 
                className={`track-row ${isActive ? 'active' : ''}`}
                onClick={() => onPlayTrack(t, trackList)}
              >
                <td className="track-number-cell">
                  {isActive ? <Disc size={14} className="spin" /> : index + 1}
                </td>
                <td>
                  <div className="track-title-cell">
                    {t.artwork ? (
                      <img src={t.artwork} alt="" className="track-table-art" loading="lazy" decoding="async" />
                    ) : (
                      <div className="track-table-placeholder-art">
                        <Music size={14} />
                      </div>
                    )}
                    <div className="track-title-details">
                      <span className="track-table-title">{t.title}</span>
                      <span className="track-table-artist">{t.artist}</span>
                    </div>
                  </div>
                </td>
                <td className="track-album-cell">{t.album}</td>
                <td className="track-duration-cell">{formatDuration(t.duration)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                      className="playlist-select-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(openDropdownId === t.id ? null : t.id);
                      }}
                      style={{
                        background: addedTrackId === t.id ? 'var(--gradient-accent)' : 'transparent',
                        border: addedTrackId === t.id ? 'none' : '1px solid var(--border-subtle)',
                        color: addedTrackId === t.id ? 'var(--bg-deep)' : 'var(--text-secondary)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: addedTrackId === t.id ? 'bold' : 'normal',
                        transition: 'all 0.3s ease',
                        minWidth: '100px',
                        textAlign: 'left'
                      }}
                    >
                      {addedTrackId === t.id ? 'Added!' : 'Add to Playlist'}
                    </button>
                    {openDropdownId === t.id && (
                      <div
                        className="custom-dropdown-menu glass"
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: '100%',
                          marginTop: '4px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          padding: '6px',
                          minWidth: '140px',
                          zIndex: 99,
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px'
                        }}
                      >
                        {playlists.length === 0 ? (
                          <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>No playlists</div>
                        ) : (
                          playlists.map(p => (
                            <div 
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddToPlaylist(p.id, t.id);
                                setOpenDropdownId(null);
                                setAddedTrackId(t.id);
                                setTimeout(() => setAddedTrackId(null), 1500);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                color: 'var(--text-primary)',
                                borderRadius: '4px',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              {p.name}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const name = userProfile?.displayName || 'Sound Explorer';

  return (
    <main className="main-view">
      {currentTab === 'home' && (
        <>
          <div className="welcome-banner glass">
            <h1>Good to have you back, <span className="gradient-text">{name}.</span></h1>
            <p>Your collection is ready — every track, exactly as it was recorded.</p>
          </div>

          {tracks.length === 0 ? (
            <div className="import-prompt">
              <FolderPlus className="import-icon" size={64} />
              <h2>Your library is empty.</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', marginTop: '10px', lineHeight: '1.65' }}>
                Point Rosewood to a folder on your hard drive and every song inside will be scanned, organised, and ready to play.
              </p>
            </div>
          ) : (
            <>
              <div className="section-header">
                <h2>Recently Played</h2>
              </div>
              <div className="dashboard-grid">
                {tracks.slice(0, 6).map(t => (
                  <div key={t.id} className="music-card glass hover-scale" onClick={() => onPlayTrack(t, tracks)}>
                    <div className="card-art-container">
                      {t.artwork ? (
                        <img src={t.artwork} className="card-art" alt="" loading="lazy" decoding="async" />
                      ) : (
                        <div className="card-placeholder-art">
                          <Music size={32} />
                        </div>
                      )}
                      <div className="card-play-overlay">
                        <Play size={18} fill="#000" style={{ transform: 'translateX(1px)' }} />
                      </div>
                    </div>
                    <div className="card-info">
                      <h4>{t.title}</h4>
                      <p>{t.artist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {currentTab === 'library' && (
        <>
          <div className="section-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h2>Your Collection</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tracks.length} Songs Loaded</span>
            </div>
            <div style={{ width: '100%', position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search by title, artist, or album..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            {!searchQuery && (
              <span style={{ fontSize: '13px', color: 'var(--accent-coral)', fontWeight: '500' }}>
                Showing Top 100 Matches
              </span>
            )}
          </div>
          {(() => {
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              const filtered = tracks.filter(t => 
                (t.title && t.title.toLowerCase().includes(query)) || 
                (t.artist && t.artist.toLowerCase().includes(query)) || 
                (t.album && t.album.toLowerCase().includes(query))
              ).slice(0, 100);
              if (filtered.length === 0) {
                return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>No tracks found for "{searchQuery}"</div>;
              }
              return renderTrackTable(filtered);
            }
            return renderTrackTable(topMatches);
          })()}
        </>
      )}

      {currentTab === 'foryou' && (
        <>
          <div className="section-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} className="gradient-text" style={{ filter: 'drop-shadow(0 0 4px rgba(213, 28, 57, 0.4))' }} />
              Picked for You
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Refines with every session</span>
          </div>

          {tracks.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '80px 0' }}>
              Import a music folder to unlock personalised recommendations.
              Rosewood learns your taste quietly — no ratings, no stars.
            </div>
          ) : (
            <>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '28px 0 16px', color: 'var(--text-primary)' }}>Today's Listening</h3>
              <div className="dashboard-grid">
                {recommendations.dailyMix.map(t => (
                  <div key={t.id} className="music-card glass hover-scale" onClick={() => onPlayTrack(t, tracks)}>
                    <div className="card-art-container">
                      {t.artwork ? (
                        <img src={t.artwork} className="card-art" alt="" loading="lazy" decoding="async" />
                      ) : (
                        <div className="card-placeholder-art">
                          <Music size={32} />
                        </div>
                      )}
                      <div className="card-play-overlay">
                        <Play size={18} fill="#000" style={{ transform: 'translateX(1px)' }} />
                      </div>
                    </div>
                    <div className="card-info">
                      <h4>{t.title}</h4>
                      <p>{t.artist}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '28px 0 16px', color: 'var(--text-primary)' }}>In Your Vein</h3>
              <div className="dashboard-grid">
                {recommendations.similarTracks.map(t => (
                  <div key={t.id} className="music-card glass hover-scale" onClick={() => onPlayTrack(t, tracks)}>
                    <div className="card-art-container">
                      {t.artwork ? (
                        <img src={t.artwork} className="card-art" alt="" loading="lazy" decoding="async" />
                      ) : (
                        <div className="card-placeholder-art">
                          <Music size={32} />
                        </div>
                      )}
                      <div className="card-play-overlay">
                        <Play size={18} fill="#000" style={{ transform: 'translateX(1px)' }} />
                      </div>
                    </div>
                    <div className="card-info">
                      <h4>{t.title}</h4>
                      <p>{t.artist}</p>
                    </div>
                  </div>
                ))}
              </div>

              {recommendations.forgottenGems.length > 0 && (
                <>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '28px 0 16px', color: 'var(--text-primary)' }}>You've Been Missing These</h3>
                  <div className="dashboard-grid">
                    {recommendations.forgottenGems.map(t => (
                      <div key={t.id} className="music-card glass hover-scale" onClick={() => onPlayTrack(t, tracks)}>
                        <div className="card-art-container">
                          {t.artwork ? (
                            <img src={t.artwork} className="card-art" alt="" loading="lazy" decoding="async" />
                          ) : (
                            <div className="card-placeholder-art">
                              <Music size={32} />
                            </div>
                          )}
                          <div className="card-play-overlay">
                            <Play size={18} fill="#000" style={{ transform: 'translateX(1px)' }} />
                          </div>
                        </div>
                        <div className="card-info">
                          <h4>{t.title}</h4>
                          <p>{t.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {currentTab === 'playlist' && (
        <>
          <div className="section-header">
            <h2>{getActivePlaylist()?.name || 'Playlist'}</h2>
          </div>
          {(() => {
            const playlistTracks = tracks.filter(t => getActivePlaylist()?.tracks.includes(t.id));
            if (playlistTracks.length === 0) {
              return (
                <div className="import-prompt" style={{ marginTop: '40px' }}>
                  <FolderPlus className="import-icon" size={64} style={{ opacity: 0.5 }} />
                  <h2 style={{ marginTop: '20px' }}>This playlist is empty.</h2>
                  <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', marginTop: '10px', lineHeight: '1.65' }}>
                    Find your favorite tracks in your library and add them here to start building your collection.
                  </p>
                  <button 
                    className="btn-primary" 
                    style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setCurrentTab('library')}
                  >
                    Browse Library
                  </button>
                </div>
              );
            }
            return renderTrackTable(playlistTracks);
          })()}
        </>
      )}
    </main>
  );
}
