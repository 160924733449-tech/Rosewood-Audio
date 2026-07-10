import React, { useEffect, useState } from 'react';
import { Sparkles, Music, Play, Plus, Clock, Disc, FolderPlus } from 'lucide-react';
import { getRecommendations } from '../utils/recommendationEngine';

export default function MainView({
  currentTab,
  tracks,
  playlists,
  activePlaylistId,
  onPlayTrack,
  onAddToPlaylist,
  currentTrack,
  userProfile
}) {
  const [recommendations, setRecommendations] = useState({ dailyMix: [], similarTracks: [], forgottenGems: [] });

  useEffect(() => {
    if (tracks.length > 0) {
      getRecommendations(tracks).then(res => {
        setRecommendations(res);
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
                      <img src={t.artwork} alt="" className="track-table-art" />
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
                  <select 
                    className="playlist-select"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onAddToPlaylist(e.target.value, t.id);
                        e.target.value = ""; // Reset
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="" disabled>Add to Playlist</option>
                    {playlists.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
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
                        <img src={t.artwork} className="card-art" alt="" />
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
          <div className="section-header">
            <h2>Your Collection</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tracks.length} Songs Loaded</span>
          </div>
          {renderTrackTable(tracks)}
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
                        <img src={t.artwork} className="card-art" alt="" />
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
                        <img src={t.artwork} className="card-art" alt="" />
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
                            <img src={t.artwork} className="card-art" alt="" />
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
          {renderTrackTable(
            tracks.filter(t => getActivePlaylist()?.tracks.includes(t.id))
          )}
        </>
      )}
    </main>
  );
}
