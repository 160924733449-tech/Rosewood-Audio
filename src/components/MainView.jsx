import React, { useEffect, useState } from 'react';
import { Sparkles, Music, Play, Plus, Clock, Disc, FolderPlus, ListMusic, Edit2, Camera, MoreVertical, Download, LogOut, Settings, Trash2, RefreshCw, Shuffle, Image } from 'lucide-react';
import { TableVirtuoso } from 'react-virtuoso';
import { getRecommendations, getTopMatches } from '../utils/recommendationEngine';
import { SkeletonTrackList } from './SkeletonTrack';
import { useContextMenu } from './ContextMenu';
import { triggerFileSelect } from '../utils/fileSystemHelper';
import { getStreamUrlForTrack } from '../utils/sharedLibraryHelper';
import { enforceCacheLimit } from '../utils/db';

export default function MainView({
  currentTab,
  tracks,
  isLoadingTracks,
  playlists,
  activePlaylistId,
  onPlayTrack,
  onAddToPlaylist,
  currentTrack,
  userProfile,
  setCurrentTab,
  onCreatePlaylist,
  onUpdatePlaylist,
  setActivePlaylistId,
  userMode,
  onLogout,
  onTracksImported,
  onRefreshLibrary,
  onClearLibrary,
  onUpdateTrack,
  audioQuality,
  setAudioQuality,
  isOffline,
  isAdmin,
  onDeleteTrack,
  onBulkAddToPlaylist,
  onBulkDeleteTracks,
  expandPlayer
}) {
  const [recommendations, setRecommendations] = useState({ dailyMix: [], similarTracks: [], forgottenGems: [] });
  const [topMatches, setTopMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedTrackId, setAddedTrackId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [previewImageId, setPreviewImageId] = useState(null);

  // Rotating Cover State
  const [coverRotationTick, setCoverRotationTick] = useState(0);

  useEffect(() => {
    // Deliberate, slow rotation for playlist cover images (30 seconds)
    const interval = setInterval(() => {
      setCoverRotationTick(prev => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Admin Mass Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());
  const [showBulkPlaylistPicker, setShowBulkPlaylistPicker] = useState(false);
  const [sortOption, setSortOption] = useState('default');

  const getSortedTracks = (trackList) => {
    if (sortOption === 'default') return trackList;
    if (sortOption === 'recent') {
      return [...trackList].sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return timeB - timeA;
      });
    }
    if (sortOption === 'title-asc') return [...trackList].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortOption === 'title-desc') return [...trackList].sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    if (sortOption === 'artist-asc') return [...trackList].sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
    return trackList;
  };

  const { openMenu } = useContextMenu();

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTrackIds(new Set());
    setShowBulkPlaylistPicker(false);
  };

  const handleBulkDelete = async () => {
    if (selectedTrackIds.size === 0) return;
    await onBulkDeleteTracks(Array.from(selectedTrackIds));
    setSelectedTrackIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkAdd = async (playlistId) => {
    if (selectedTrackIds.size === 0) return;
    await onBulkAddToPlaylist(playlistId, Array.from(selectedTrackIds));
    setSelectedTrackIds(new Set());
    setIsSelectionMode(false);
    setShowBulkPlaylistPicker(false);
    alert('Tracks added successfully!');
  };

  const handleOfflineSync = async () => {
    if (syncingOffline || isOffline) return;
    const cloudTracks = tracks.filter(t => t.source === 'cloudinary');
    if (cloudTracks.length === 0) return;

    setSyncingOffline(true);
    setSyncProgress(0);
    
    // Sync top 20 tracks (roughly 100MB)
    const tracksToSync = cloudTracks.slice(0, 20);
    let completed = 0;

    for (const track of tracksToSync) {
      try {
        // getStreamUrlForTrack natively saves to IDB on success and checks cache first
        await getStreamUrlForTrack(track, 1);
      } catch (e) {
        console.warn('Sync failed for', track.name, e);
      }
      completed++;
      setSyncProgress(Math.round((completed / tracksToSync.length) * 100));
    }
    
    // Enforce 250MB limit
    try { await enforceCacheLimit(250 * 1024 * 1024); } catch (e) {}
    
    setTimeout(() => {
      setSyncingOffline(false);
      setSyncProgress(0);
    }, 2000);
  };

  const openPlaylistEdit = (pl) => {
    setEditingPlaylistId(pl.id);
    setEditPlaylistName(pl.name);
  };

  const handleImportMusic = async () => {
    try {
      const newTracks = await triggerFileSelect();
      if (newTracks && newTracks.length > 0) {
        onTracksImported(newTracks);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSavePlaylistEdit = (e) => {
    e.preventDefault();
    if (editingPlaylistId && editPlaylistName.trim()) {
      onUpdatePlaylist(editingPlaylistId, { name: editPlaylistName.trim() });
    }
    setEditingPlaylistId(null);
  };

  const handleDPChange = (e, playlistId) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onUpdatePlaylist(playlistId, { dp: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const renderPlaylistCollage = (pl) => {
    if (pl.dp) {
      return <img src={pl.dp} className="playlist-dp-full" alt="Cover" loading="lazy" decoding="async" />;
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
            />
          ))}
        </div>
      );
    }

    if (!pl.tracks || pl.tracks.length === 0) {
      return (
        <div className="card-placeholder-art playlist-dp-placeholder">
          <FolderPlus size={32} />
        </div>
      );
    }
    
    const plTracks = tracks.filter(t => pl.tracks.includes(t.id));
    const artworks = plTracks.filter(t => t.artwork).map(t => t.artwork);
    const top4 = [...new Set(artworks)].slice(0, 4);
    
    if (top4.length === 0) {
      return (
        <div className="card-placeholder-art playlist-dp-placeholder">
          <ListMusic size={32} />
        </div>
      );
    }
    
    if (top4.length < 4) {
      return <img src={top4[0]} className="playlist-dp-full" alt="Cover" loading="lazy" decoding="async" />;
    }
    
    return (
      <div className="playlist-collage">
        {top4.map((art, i) => (
          <img key={i} src={art} className="collage-img" alt="" loading="lazy" decoding="async" />
        ))}
      </div>
    );
  };

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
  }, [tracks.length]);


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
    if (isLoadingTracks && (!trackList || trackList.length === 0)) {
      return <SkeletonTrackList count={6} />;
    }

    if (!trackList || trackList.length === 0) {
      return (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
          No tracks found. Add some music to see them here!
        </div>
      );
    }

    if (isAdmin) {
      return (
        <table className="track-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th className="track-number-cell" style={isSelectionMode ? { padding: '0 16px' } : {}}>
                {isSelectionMode ? (
                  <input 
                    type="checkbox" 
                    checked={selectedTrackIds.size === trackList.length && trackList.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedTrackIds(new Set(trackList.map(tr => tr.id)));
                      else setSelectedTrackIds(new Set());
                    }}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)' }}
                  />
                ) : '#'}
              </th>
              <th>Name</th>
              <th>Data</th>
              <th className="track-duration-cell"><Clock size={14} /></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {trackList.map((t, index) => {
              const isActive = currentTrack && currentTrack.id === t.id;
              const isSelected = selectedTrackIds.has(t.id);
              return (
                <tr 
                  key={t.id}
                  className={`track-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                  style={isSelectionMode ? { cursor: 'pointer', background: isSelected ? 'var(--bg-surface-hover)' : 'transparent' } : {}}
                  onClick={() => {
                    if (isSelectionMode) {
                      const newSet = new Set(selectedTrackIds);
                      if (newSet.has(t.id)) newSet.delete(t.id);
                      else newSet.add(t.id);
                      setSelectedTrackIds(newSet);
                    } else {
                      onPlayTrack(t, trackList);
                    }
                  }}
                >
                  <td className="track-number-cell" style={isSelectionMode ? { padding: '0 16px' } : {}}>
                    {isSelectionMode ? (
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        readOnly
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)', pointerEvents: 'none' }}
                      />
                    ) : (isActive ? <Disc size={14} className="spin" /> : index + 1)}
                  </td>
                  <td>
                    <div className="track-title-cell">
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setPreviewImageId(previewImageId === t.id ? null : t.id); }}
                          style={{ background: 'transparent', border: 'none', color: t.artwork ? '#000' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          <Image size={16} />
                        </button>
                        {previewImageId === t.id && t.artwork && (
                          <div className="admin-artwork-preview" onClick={(e) => e.stopPropagation()}>
                            <img src={t.artwork} alt="Preview" />
                            <button onClick={() => setPreviewImageId(null)} style={{ background: '#000', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '10px', padding: '2px', cursor: 'pointer' }}>CLOSE</button>
                          </div>
                        )}
                      </div>
                      <div className="track-title-details">
                        <span className="track-table-title" style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{t.title || 'Untitled'}</span>
                        <span className="track-table-artist" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{t.artist || 'Unknown Artist'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="track-album-cell" style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}>
                    <div style={{ color: t.genre ? '#000' : 'red' }}>GENRE: {t.genre || 'NONE'}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>SRC: {t.source || 'local'}</div>
                  </td>
                  <td className="track-duration-cell" style={{ fontFamily: 'monospace' }}>{formatDuration(t.duration)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className="mobile-context-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteTrack(t.id); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-coral)', padding: '8px', cursor: 'pointer' }}
                      title="Delete Track"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    return (
      <TableVirtuoso
        data={trackList}
        useWindowScroll
        className="track-table"
        components={{
          Table: (props) => <table className="track-table" {...props} />,
          TableHead: React.forwardRef((props, ref) => <thead {...props} ref={ref} />),
          TableBody: React.forwardRef((props, ref) => <tbody {...props} ref={ref} />),
          TableRow: (props) => {
            const t = props.item;
            const index = props['data-index'];
            const isActive = currentTrack && currentTrack.id === t.id;
            const isSelected = selectedTrackIds.has(t.id);
            return (
              <tr 
                {...props}
                className={`track-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                style={isSelectionMode ? { cursor: 'pointer', background: isSelected ? 'var(--bg-surface-hover)' : 'transparent' } : {}}
                onClick={() => {
                  if (isSelectionMode) {
                    const newSet = new Set(selectedTrackIds);
                    if (newSet.has(t.id)) newSet.delete(t.id);
                    else newSet.add(t.id);
                    setSelectedTrackIds(newSet);
                  } else {
                    onPlayTrack(t, trackList);
                  }
                }}
                onContextMenu={(e) => openMenu(e, [
                  { label: 'Play Now', icon: <Play size={14} />, action: (track) => onPlayTrack(track, trackList) },
                  { label: 'Add to Playlist', icon: <FolderPlus size={14} />, action: (track) => setOpenDropdownId(openDropdownId === track.id ? null : track.id) },
                  { label: 'Assign to Space...', icon: <Settings size={14} />, action: (track) => {
                    const newSpace = window.prompt('Assign this track to a Space (e.g., Bollywood, Chill, Pop):', track.genre);
                    if (newSpace) onUpdateTrack(track.id, { genre: newSpace });
                  }},
                  ...(isAdmin ? [{ label: 'Delete Track', icon: <Trash2 size={14} color="var(--accent-coral)" />, action: (track) => onDeleteTrack(track.id) }] : [])
                ], t)}
              />
            );
          }
        }}
        fixedHeaderContent={() => (
          <tr>
            <th className="track-number-cell" style={isSelectionMode ? { padding: '0 16px' } : {}}>
              {isSelectionMode ? (
                <input 
                  type="checkbox" 
                  checked={selectedTrackIds.size === trackList.length && trackList.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedTrackIds(new Set(trackList.map(tr => tr.id)));
                    else setSelectedTrackIds(new Set());
                  }}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)' }}
                />
              ) : '#'}
            </th>
            <th>Title</th>
            <th>{isAdmin ? 'Data' : 'Album'}</th>
            <th className="track-duration-cell"><Clock size={14} /></th>
            <th></th>
          </tr>
        )}
        itemContent={(index, t) => {
          const isActive = currentTrack && currentTrack.id === t.id;
          const isSelected = selectedTrackIds.has(t.id);
          return (
            <>
                <td className="track-number-cell" style={isSelectionMode ? { padding: '0 16px' } : {}}>
                  {isSelectionMode ? (
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      readOnly
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)', pointerEvents: 'none' }}
                    />
                  ) : (isActive ? <Disc size={14} className="spin" /> : index + 1)}
                </td>
                <td>
                  <div className="track-title-cell">
                    {!isAdmin && (
                      t.artwork ? (
                        <img src={t.artwork} alt="" className="track-table-art" loading="lazy" decoding="async" />
                      ) : (
                        <div className="track-table-placeholder-art">
                          <Music size={14} />
                        </div>
                      )
                    )}
                    {isAdmin && (
                      <div style={{ position: 'relative' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setPreviewImageId(previewImageId === t.id ? null : t.id); }}
                          style={{ background: 'transparent', border: 'none', color: t.artwork ? '#000' : 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          <Image size={16} />
                        </button>
                        {previewImageId === t.id && t.artwork && (
                          <div className="admin-artwork-preview" onClick={(e) => e.stopPropagation()}>
                            <img src={t.artwork} alt="Preview" />
                            <button onClick={() => setPreviewImageId(null)} style={{ background: '#000', color: '#fff', border: 'none', fontWeight: 'bold', fontSize: '10px', padding: '2px', cursor: 'pointer' }}>CLOSE</button>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="track-title-details">
                      <span className="track-table-title" style={isAdmin ? { fontFamily: 'monospace', fontWeight: 'bold' } : {}}>{t.title || 'Untitled'}</span>
                      <span className="track-table-artist" style={isAdmin ? { fontFamily: 'monospace', fontSize: '11px' } : {}}>{t.artist || 'Unknown Artist'}</span>
                    </div>
                  </div>
                </td>
                {isAdmin ? (
                  <td className="track-album-cell" style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}>
                    <div style={{ color: t.genre ? '#000' : 'red' }}>GENRE: {t.genre || 'NONE'}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>SRC: {t.source || 'local'}</div>
                  </td>
                ) : (
                  <td className="track-album-cell">{t.album}</td>
                )}
                <td className="track-duration-cell" style={isAdmin ? { fontFamily: 'monospace' } : {}}>{formatDuration(t.duration)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="desktop-only-playlist-btn" style={{ position: 'relative', display: 'inline-block' }}>
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
                  {isAdmin && (
                    <button
                      className="mobile-context-btn"
                      onClick={(e) => { e.stopPropagation(); onDeleteTrack(t.id); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-coral)', padding: '8px', cursor: 'pointer' }}
                      title="Delete Track"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    className="mobile-context-btn"
                    onClick={(e) => openMenu(e, [
                      { label: 'Play Now', icon: <Play size={14} />, action: (track) => onPlayTrack(track, trackList) },
                      { label: 'Add to Playlist', icon: <FolderPlus size={14} />, action: (track) => setOpenDropdownId(openDropdownId === track.id ? null : track.id) },
                      { label: 'Assign to Space...', icon: <Settings size={14} />, action: (track) => {
                        const newSpace = window.prompt('Assign this track to a Space (e.g., Bollywood, Chill, Pop):', track.genre);
                        if (newSpace) onUpdateTrack(track.id, { genre: newSpace });
                      }},
                      ...(isAdmin ? [{ label: 'Delete Track', icon: <Trash2 size={14} color="var(--accent-coral)" />, action: (track) => onDeleteTrack(track.id) }] : [])
                    ], t)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '8px' }}
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>
              </td>
            </>
          );
        }}
      />
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
            isOffline ? (
              <div className="import-prompt">
                <FolderPlus className="import-icon" size={64} style={{ opacity: 0.5 }} />
                <h2>You are offline.</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', marginTop: '10px', lineHeight: '1.65' }}>
                  Cloud music is hidden while offline. Please connect to the internet or point Reson8 to a local folder to play music offline.
                </p>
                {userMode === 'local' && (
                  <button 
                    className="import-btn"
                    onClick={handleImportMusic}
                  >
                    Import Offline Music
                  </button>
                )}
              </div>
            ) : (
              <div className="import-prompt">
                <FolderPlus className="import-icon" size={64} />
                <h2>Your library is empty.</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', marginTop: '10px', lineHeight: '1.65' }}>
                  Point Reson8 to a folder on your hard drive and every song inside will be scanned, organised, and ready to play.
                </p>
                {userMode === 'local' && (
                  <button 
                    className="import-btn"
                    onClick={handleImportMusic}
                  >
                    Import Music
                  </button>
                )}
                {userMode === 'shared' && (
                  <button 
                    className="import-btn"
                    onClick={onRefreshLibrary}
                  >
                    Refresh Library
                  </button>
                )}
              </div>
            )
          ) : (
            <>
              <div className="section-header">
                <h2>Recently Played</h2>
              </div>
              <div className="dashboard-grid">
                {(isAdmin ? tracks : tracks.slice(0, 6)).map(t => (
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
          <div className="section-header library-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h2>Your Collection</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {tracks.length > 0 && (
                  <button
                    onClick={toggleSelectionMode}
                    style={{
                      background: isSelectionMode ? '#000' : '#fff',
                      color: isSelectionMode ? '#fff' : '#000',
                      border: '2px solid #000',
                      padding: '4px 8px',
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: 'pointer',
                      borderRadius: '0'
                    }}
                  >
                    {isSelectionMode ? '[X] CANCEL SELECT' : '[ ] MASS SELECT'}
                  </button>
                )}
                {userMode === 'shared' && !isOffline && tracks.length > 0 && (
                  <button 
                    onClick={handleOfflineSync}
                    disabled={syncingOffline}
                    style={{
                      background: syncingOffline ? 'var(--bg-surface)' : 'var(--gradient-accent)',
                      border: 'none',
                      color: syncingOffline ? 'var(--text-secondary)' : '#fff',
                      padding: '6px 12px',
                      borderRadius: '100px',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: syncingOffline ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <Download size={12} className={syncingOffline && syncProgress < 100 ? 'spin' : ''} />
                    {syncingOffline ? (syncProgress === 100 ? 'Synced!' : `Syncing... ${syncProgress}%`) : 'Sync Offline'}
                  </button>
                )}
                {isAdmin && tracks.length > 0 && (
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="default">Default</option>
                    <option value="recent">Recently Added</option>
                    <option value="title-asc">Title (A-Z)</option>
                    <option value="title-desc">Title (Z-A)</option>
                    <option value="artist-asc">Artist (A-Z)</option>
                  </select>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tracks.length} Songs Loaded</span>
              </div>
            </div>
            {isSelectionMode && (
              <div style={{
                position: 'fixed',
                bottom: currentTrack ? '100px' : '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: '800px',
                background: '#ccc',
                border: '2px solid #000',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'monospace',
                color: '#000',
                zIndex: 100,
                boxShadow: '4px 4px 0 #000'
              }}>
                <div>SELECTED: {selectedTrackIds.size}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setSelectedTrackIds(new Set(tracks.map(t => t.id)))} style={{ border: '2px solid #000', background: '#fff', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>SELECT ALL</button>
                  <button onClick={() => setSelectedTrackIds(new Set())} style={{ border: '2px solid #000', background: '#fff', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>DESELECT</button>
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowBulkPlaylistPicker(!showBulkPlaylistPicker)} style={{ border: '2px solid #000', background: '#000', color: '#fff', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>ADD TO PLAYLIST</button>
                    {showBulkPlaylistPicker && (
                      <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', background: '#fff', border: '2px solid #000', padding: '4px', display: 'flex', flexDirection: 'column', zIndex: 110, maxHeight: '200px', overflowY: 'auto', minWidth: '150px' }}>
                        {playlists.map(pl => (
                          <div key={pl.id} onClick={() => handleBulkAdd(pl.id)} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #ccc' }}>{pl.name}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <button onClick={handleBulkDelete} style={{ border: '2px solid #000', background: 'red', color: '#fff', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}>DELETE</button>
                  )}
                </div>
              </div>
            )}
            {tracks.length > 0 && (
              <button 
                onClick={() => {
                  const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                  onPlayTrack(shuffled[0], shuffled);
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'var(--gradient-accent)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-md)',
                  marginBottom: '16px',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = 'var(--shadow-xl)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
              >
                <Shuffle size={20} /> QUICK SHUFFLE ALL
              </button>
            )}
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
                Showing All Songs
              </span>
            )}
          </div>
          {(() => {
            let listToRender = tracks;
            if (searchQuery.trim()) {
              const query = searchQuery.toLowerCase();
              listToRender = tracks.filter(t => 
                (t.title && t.title.toLowerCase().includes(query)) || 
                (t.artist && t.artist.toLowerCase().includes(query)) || 
                (t.album && t.album.toLowerCase().includes(query))
              );
              if (listToRender.length === 0) {
                return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>No tracks found for "{searchQuery}"</div>;
              }
            }
            return renderTrackTable(getSortedTracks(listToRender));
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
            isOffline ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '80px 0' }}>
                You are offline. Recommendations are based on your local library which is currently empty.
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '80px 0' }}>
                Import a music folder to unlock personalised recommendations.
                Reson8 learns your taste quietly — no ratings, no stars.
              </div>
            )
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
      {currentTab === 'playlists_hub' && (
        <>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Playlists Hub</h2>
            <button className="btn-primary" style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer' }} onClick={() => onCreatePlaylist('')}>
              <Plus size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }}/> Create
            </button>
          </div>

          {playlists.length === 0 ? (
            <div className="import-prompt" style={{ marginTop: '40px' }}>
              <ListMusic className="import-icon" size={64} style={{ opacity: 0.5 }} />
              <h2 style={{ marginTop: '20px' }}>No playlists yet.</h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', marginTop: '10px', lineHeight: '1.65' }}>
                Create a playlist to curate your favorite tracks into one seamless collection.
              </p>
              <button 
                className="btn-primary" 
                style={{ marginTop: '20px', padding: '12px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => onCreatePlaylist('')}
              >
                Create Playlist
              </button>
            </div>
          ) : (
            <div className="playlist-hub-grid">
              {playlists.map(pl => (
                <div key={pl.id} className="playlist-card glass">
                  <div className="playlist-card-art-container" onClick={() => { setActivePlaylistId(pl.id); setCurrentTab('playlist'); }}>
                    {renderPlaylistCollage(pl)}
                    <div 
                      className="card-play-overlay"
                      onClick={(e) => {
                        e.stopPropagation();
                        const plTracks = tracks.filter(t => pl.tracks.includes(t.id));
                        if (plTracks.length > 0) {
                          onPlayTrack(plTracks[0], plTracks);
                          if (expandPlayer) expandPlayer();
                        }
                      }}
                    >
                      <Play size={24} fill="#000" style={{ transform: 'translateX(1px)' }} />
                    </div>
                  </div>
                  <div className="playlist-card-info">
                    {editingPlaylistId === pl.id ? (
                      <form onSubmit={handleSavePlaylistEdit} style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          value={editPlaylistName} 
                          onChange={(e) => setEditPlaylistName(e.target.value)} 
                          autoFocus 
                          style={{ flex: 1, minWidth: 0, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'white' }} 
                        />
                        <button type="submit" style={{ background: 'transparent', border: 'none', color: 'var(--accent-coral)', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>Save</button>
                      </form>
                    ) : (
                      <>
                        <h4 onClick={() => { setActivePlaylistId(pl.id); setCurrentTab('playlist'); }} style={{ cursor: 'pointer', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</h4>
                        <div className="playlist-actions" style={{ display: 'flex', gap: '12px', color: 'var(--text-secondary)' }}>
                          <button onClick={() => openPlaylistEdit(pl)} title="Rename Playlist" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                            <Edit2 size={16} />
                          </button>
                          <label style={{ cursor: 'pointer' }} title="Change Cover Image">
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleDPChange(e, pl.id)} />
                            <Camera size={16} />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {currentTab === 'settings' && (
        <div style={{ paddingBottom: '60px' }}>
          <div className="section-header">
            <h2>Settings</h2>
          </div>
          
          {(() => {
            const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();
            return (
          <div className="settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <div className="user-profile-badge" style={{ display: 'flex', padding: '20px', background: 'var(--bg-surface)', borderRadius: '16px', alignItems: 'center', gap: '16px' }}>
              <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '18px' }}>
                {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : '?'}
              </div>
              <div className="profile-info">
                <div className="profile-name" style={{ fontSize: '18px', fontWeight: 'bold' }}>{userProfile?.displayName || 'User'}</div>
                <div className="profile-mode" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{userMode} Mode</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>Audio Quality</h3>
              <select 
                value={audioQuality} 
                onChange={(e) => setAudioQuality(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="auto">Auto</option>
                <option value="low">Low (Data Saver)</option>
                <option value="high">High (Original)</option>
              </select>
            </div>

            {!isNative && (
              <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>Mobile App</h3>
                <a 
                  href="/reson8.apk" 
                  download
                  className="option-btn hover-scale" 
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--gradient-accent)', borderRadius: '12px', cursor: 'pointer', color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}
                >
                  <Download size={18} />
                  <span>Download Android App (.apk)</span>
                </a>
              </div>
            )}

            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ marginBottom: '4px', fontSize: '16px', color: 'var(--text-primary)' }}>Library Management</h3>
              
              {userMode === 'local' && (
                <button 
                  className="option-btn hover-scale" 
                  onClick={handleImportMusic}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}
                >
                  <FolderPlus size={18} color="var(--accent-coral)" />
                  <span>Import Music Folder</span>
                </button>
              )}
              
              {userMode === 'shared' && (
                <button 
                  className="option-btn hover-scale" 
                  onClick={onRefreshLibrary}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '12px', cursor: 'pointer', color: 'var(--text-primary)' }}
                >
                  <RefreshCw size={18} color="var(--accent-coral)" />
                  <span>Refresh Shared Library</span>
                </button>
              )}

              <button 
                className="option-btn hover-scale" 
                onClick={onLogout}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(213, 28, 57, 0.05)', border: '1px dashed var(--accent-rose)', borderRadius: '12px', cursor: 'pointer', color: 'var(--accent-rose)' }}
              >
                <LogOut size={18} />
                <span>Logout / Switch Library</span>
              </button>

              <button 
                className="option-btn hover-scale" 
                onClick={onClearLibrary}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(213, 28, 57, 0.05)', border: '1px dashed var(--accent-rose)', borderRadius: '12px', cursor: 'pointer', color: 'var(--accent-rose)', marginTop: '8px' }}
              >
                <Trash2 size={18} />
                <span>Clear Local Data & Library</span>
              </button>
            </div>
          </div>
          );
          })()}
        </div>
      )}
    </main>
  );
}
