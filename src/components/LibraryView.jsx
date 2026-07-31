import React, { useState, useEffect, useMemo } from 'react';
import { 
  Music, Play, Clock, Disc, Download, Trash2, RefreshCw, 
  Shuffle, Image, FolderPlus, Settings, CheckSquare, Square, 
  X, Search, Filter, HardDrive, Sparkles 
} from 'lucide-react';
import { TableVirtuoso, Virtuoso } from 'react-virtuoso';
import { useContextMenu } from './ContextMenu';
import { getStreamUrlForTrack, isStreamCached, isStreamCachedUrl } from '../utils/sharedLibraryHelper';
import { enforceCacheLimit } from '../utils/db';
import { SkeletonTrackList } from './SkeletonTrack';

// Helper to format duration
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export default function LibraryView({
  tracks = [],
  isLoadingTracks = false,
  currentTrack = null,
  onPlayTrack,
  onDeleteTrack,
  onUpdateTrack,
  userMode = 'local',
  isOffline = false,
  isAdmin = false,
  onBulkAddToPlaylist,
  onBulkDeleteTracks,
  playlists = [],
  scrollContainerRef = null,
  onRefreshLibrary,
  onClearLibrary
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'offline', 'local', 'shared'
  const [genreFilter, setGenreFilter] = useState('all'); // 'all', 'Punjabi', 'Pop', etc.
  const [sortOption, setSortOption] = useState('default');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());
  const [showBulkPlaylistPicker, setShowBulkPlaylistPicker] = useState(false);
  const [previewImageId, setPreviewImageId] = useState(null);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // Responsive state for mobile vs desktop layout
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { openMenu } = useContextMenu();

  // Offline Syncing Logic
  const handleOfflineSync = async () => {
    if (syncingOffline || isOffline) return;
    const cloudTracks = tracks.filter(t => t.source === 'cloudinary');
    if (cloudTracks.length === 0) return;

    setSyncingOffline(true);
    setSyncProgress(0);

    // Sync top 50 tracks to ensure generous offline buffer
    const tracksToSync = cloudTracks.slice(0, 50);
    let completed = 0;

    for (const track of tracksToSync) {
      try {
        await getStreamUrlForTrack(track, 1);
      } catch (e) {
        console.warn('Sync failed for', track.name || track.title, e);
      }
      completed++;
      setSyncProgress(Math.round((completed / tracksToSync.length) * 100));
    }

    try { await enforceCacheLimit(250 * 1024 * 1024); } catch (e) {}

    setTimeout(() => {
      setSyncingOffline(false);
      setSyncProgress(0);
    }, 2000);
  };

  // Mass Selection Handlers
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedTrackIds(new Set());
    setShowBulkPlaylistPicker(false);
  };

  const handleBulkDelete = async () => {
    if (selectedTrackIds.size === 0) return;
    if (onBulkDeleteTracks) {
      await onBulkDeleteTracks(Array.from(selectedTrackIds));
    }
    setSelectedTrackIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkAdd = async (playlistId) => {
    if (selectedTrackIds.size === 0) return;
    if (onBulkAddToPlaylist) {
      await onBulkAddToPlaylist(playlistId, Array.from(selectedTrackIds));
    }
    setSelectedTrackIds(new Set());
    setIsSelectionMode(false);
    setShowBulkPlaylistPicker(false);
    alert('Tracks added to playlist successfully!');
  };

  // Filter and Sort tracks
  const processedTracks = useMemo(() => {
    let list = [...tracks];

    // Filter by type
    if (filterType === 'offline') {
      list = list.filter(t => t.source === 'local' || isStreamCached(t.id) || (t.url && isStreamCachedUrl(t.url)));
    } else if (filterType === 'local') {
      list = list.filter(t => t.source === 'local' || !t.source);
    } else if (filterType === 'shared') {
      list = list.filter(t => t.source === 'cloudinary' || t.source === 'shared');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) || 
        (t.artist && t.artist.toLowerCase().includes(q)) || 
        (t.album && t.album.toLowerCase().includes(q)) ||
        (t.genre && t.genre.toLowerCase().includes(q))
      );
    }

    // Filter by Genre Classification
    if (genreFilter !== 'all') {
      list = list.filter(t => (t.macroGenre || t.genre || 'Global') === genreFilter);
    }

    // Sort tracks
    if (sortOption === 'recent') {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else if (sortOption === 'title-asc') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortOption === 'title-desc') {
      list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (sortOption === 'artist-asc') {
      list.sort((a, b) => (a.artist || '').localeCompare(b.artist || ''));
    } else if (sortOption === 'duration-desc') {
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    }

    return list;
  }, [tracks, filterType, searchQuery, sortOption, genreFilter]);

  // Unique Genres for Classification Dropdown
  const uniqueGenres = useMemo(() => {
    const genres = new Set();
    tracks.forEach(t => {
      const g = t.macroGenre || t.genre;
      if (g && g !== 'Global') genres.add(g);
    });
    return Array.from(genres).sort();
  }, [tracks]);

  // Collection Stats
  const totalDurationSec = useMemo(() => {
    return processedTracks.reduce((acc, t) => acc + (Number(t.duration) || 0), 0);
  }, [processedTracks]);

  const formattedTotalTime = useMemo(() => {
    const hrs = Math.floor(totalDurationSec / 3600);
    const mins = Math.floor((totalDurationSec % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  }, [totalDurationSec]);

  // Context Menu builder
  const getContextMenuOptions = (track) => [
    { label: 'Play Now', icon: <Play size={14} />, action: (t) => onPlayTrack(t, processedTracks) },
    { label: 'Add to Playlist...', icon: <FolderPlus size={14} />, action: () => alert('Please use Selection Mode or Playlist tab to add tracks.') },
    { label: 'Assign Genre / Space...', icon: <Settings size={14} />, action: (t) => {
      const newSpace = window.prompt('Assign this track to a Space (e.g., Bollywood, Chill, Pop):', t.genre || '');
      if (newSpace !== null && onUpdateTrack) onUpdateTrack(t.id, { genre: newSpace });
    }},
    ...(isAdmin || t.source === 'local' ? [{ label: 'Delete Track', icon: <Trash2 size={14} color="var(--accent-coral)" />, action: (t) => onDeleteTrack(t.id) }] : [])
  ];

  return (
    <div className="library-view-container">
      {/* Hero Header & Collection Stats */}
      <div className="library-hero glass">
        <div className="library-hero-top">
          <div className="library-title-section">
            <h1 className="library-main-title">
              <Sparkles className="gradient-text" size={28} />
              Your Collection
            </h1>
            <div className="library-stats-pills">
              <span className="stat-pill">
                <Music size={14} /> {processedTracks.length} {processedTracks.length === 1 ? 'Song' : 'Songs'}
              </span>
              {totalDurationSec > 0 && (
                <span className="stat-pill">
                  <Clock size={14} /> {formattedTotalTime}
                </span>
              )}
            </div>
          </div>

          <div className="library-hero-actions">
            {tracks.length > 0 && (
              <button
                onClick={toggleSelectionMode}
                className={`library-btn ${isSelectionMode ? 'active-select-btn' : ''}`}
                style={{
                  background: isSelectionMode ? 'var(--gradient-accent)' : 'var(--bg-surface)',
                  color: isSelectionMode ? '#fff' : 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  padding: '8px 16px',
                  borderRadius: '100px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSelectionMode ? <CheckSquare size={16} /> : <Square size={16} />}
                {isSelectionMode ? 'Cancel Selection' : 'Mass Select'}
              </button>
            )}

            {userMode === 'shared' && !isOffline && tracks.length > 0 && (
              <button 
                onClick={handleOfflineSync}
                disabled={syncingOffline}
                className="library-btn hover-scale"
                style={{
                  background: syncingOffline ? 'var(--bg-surface)' : 'var(--gradient-accent)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '100px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: syncingOffline ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.3s ease',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                <Download size={16} className={syncingOffline && syncProgress < 100 ? 'spin' : ''} />
                {syncingOffline ? (syncProgress === 100 ? 'Synced!' : `Syncing... ${syncProgress}%`) : 'Sync Offline'}
              </button>
            )}
          </div>
        </div>

        {/* Quick Shuffle Button */}
        {tracks.length > 0 && (
          <button 
            onClick={() => {
              const shuffled = [...processedTracks].sort(() => Math.random() - 0.5);
              if (shuffled.length > 0) onPlayTrack(shuffled[0], shuffled);
            }}
            className="quick-shuffle-bar hover-scale"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'var(--gradient-accent)',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              boxShadow: 'var(--shadow-lg)',
              marginTop: '16px',
              transition: 'all 0.2s ease'
            }}
          >
            <Shuffle size={18} /> QUICK SHUFFLE ALL ({processedTracks.length})
          </button>
        )}

        {/* Search, Filter Pills & Sort Bar */}
        <div className="library-controls-bar">
          <div className="search-input-wrapper" style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} className="search-icon" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by title, artist, album, or genre..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 36px 12px 40px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-deep)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="library-filter-sort-group" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter Pills */}
            <div className="filter-pills-container" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
              {[
                { id: 'all', label: 'All', icon: <Music size={12} /> },
                { id: 'offline', label: 'Cached / Offline', icon: <HardDrive size={12} /> },
                { id: 'local', label: 'Local Files', icon: <FolderPlus size={12} /> },
                { id: 'shared', label: 'Cloud Library', icon: <Disc size={12} /> },
              ].map(pill => (
                <button
                  key={pill.id}
                  onClick={() => setFilterType(pill.id)}
                  className={`filter-pill ${filterType === pill.id ? 'active' : ''}`}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '100px',
                    background: filterType === pill.id ? 'var(--accent-coral)' : 'var(--bg-surface)',
                    color: filterType === pill.id ? '#fff' : 'var(--text-secondary)',
                    border: filterType === pill.id ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {pill.icon} {pill.label}
                </button>
              ))}
            </div>

            {/* Classification & Sort Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '500',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Classify: All Genres</option>
                {uniqueGenres.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} color="var(--text-muted)" />
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '500',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="default">Sort: Default</option>
                  <option value="recent">Sort: Recently Added</option>
                <option value="title-asc">Sort: Title (A-Z)</option>
                <option value="title-desc">Sort: Title (Z-A)</option>
                <option value="artist-asc">Sort: Artist (A-Z)</option>
                <option value="duration-desc">Sort: Duration (Longest)</option>
              </select>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Selection Bar */}
      {isSelectionMode && (
        <div className="floating-selection-bar glass">
          <div className="selection-info">
            <CheckSquare size={18} className="gradient-text" />
            <span style={{ fontWeight: '700', fontSize: '14px' }}>SELECTED: {selectedTrackIds.size}</span>
          </div>
          <div className="selection-actions">
            <button 
              onClick={() => setSelectedTrackIds(new Set(processedTracks.map(t => t.id)))} 
              className="selection-action-btn"
            >
              Select All
            </button>
            <button 
              onClick={() => setSelectedTrackIds(new Set())} 
              className="selection-action-btn"
            >
              Deselect
            </button>
            
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowBulkPlaylistPicker(!showBulkPlaylistPicker)} 
                className="selection-add-btn"
                style={{ background: 'var(--gradient-accent)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Add to Playlist
              </button>
              {showBulkPlaylistPicker && (
                <div className="bulk-playlist-dropdown glass">
                  {playlists.length === 0 ? (
                    <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>No playlists available</div>
                  ) : (
                    playlists.map(pl => (
                      <div 
                        key={pl.id} 
                        onClick={() => handleBulkAdd(pl.id)} 
                        className="bulk-playlist-item"
                      >
                        {pl.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {(isAdmin || userMode === 'local') && (
              <button 
                onClick={handleBulkDelete} 
                className="selection-delete-btn"
                style={{ background: 'var(--accent-coral)', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Track List Rendering */}
      <div className="library-content-area" style={{ marginTop: '24px', flex: '1', minHeight: '400px' }}>
        {isLoadingTracks && processedTracks.length === 0 ? (
          <SkeletonTrackList count={8} />
        ) : processedTracks.length === 0 ? (
          <div className="empty-library-state glass" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: '20px' }}>
            <Music size={56} style={{ opacity: 0.3, margin: '0 auto 16px', color: 'var(--accent-coral)' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>No Tracks Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto 20px' }}>
              {searchQuery || filterType !== 'all' 
                ? `No tracks matched your filter "${searchQuery || filterType}". Try resetting your filters.`
                : 'Your library is empty. Import local music or switch to a shared cloud library to get started.'}
            </p>
            {(searchQuery || filterType !== 'all') ? (
              <button 
                onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                className="btn-primary"
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
              >
                Reset Filters
              </button>
            ) : null}
          </div>
        ) : isMobile ? (
          /* MOBILE VIEW: Dedicated Touch-Friendly Card Rows */
          <Virtuoso
            data={processedTracks}
            customScrollParent={scrollContainerRef?.current || undefined}
            useWindowScroll={!scrollContainerRef?.current}
            className="mobile-track-list-virtuoso"
            itemContent={(index, t) => {
              const isActive = currentTrack && currentTrack.id === t.id;
              const isSelected = selectedTrackIds.has(t.id);

              return (
                <div 
                  key={t.id}
                  className={`mobile-track-card ${isActive ? 'active-playing' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (isSelectionMode) {
                      const newSet = new Set(selectedTrackIds);
                      if (newSet.has(t.id)) newSet.delete(t.id);
                      else newSet.add(t.id);
                      setSelectedTrackIds(newSet);
                    } else {
                      onPlayTrack(t, processedTracks);
                    }
                  }}
                  onContextMenu={(e) => openMenu(e, getContextMenuOptions(t), t)}
                >
                  {isSelectionMode && (
                    <div className="mobile-select-checkbox" style={{ marginRight: '12px' }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        readOnly
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent-coral)', pointerEvents: 'none' }}
                      />
                    </div>
                  )}

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
                      {t.artist || 'Unknown Artist'} {t.genre ? `• ${t.genre}` : ''}
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
          /* DESKTOP / TABLET VIEW: Premium Styled Table with Artwork */
          <TableVirtuoso
            data={processedTracks}
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
                const isSelected = selectedTrackIds.has(t.id);
                return (
                  <tr 
                    {...props}
                    className={`track-row ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                    style={{ cursor: 'pointer', transition: 'background 0.2s ease' }}
                    onClick={() => {
                      if (isSelectionMode) {
                        const newSet = new Set(selectedTrackIds);
                        if (newSet.has(t.id)) newSet.delete(t.id);
                        else newSet.add(t.id);
                        setSelectedTrackIds(newSet);
                      } else {
                        onPlayTrack(t, processedTracks);
                      }
                    }}
                    onContextMenu={(e) => openMenu(e, getContextMenuOptions(t), t)}
                  />
                );
              }
            }}
            fixedHeaderContent={() => (
              <tr className="table-header-row" style={{ color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', width: '40px' }}>
                  {isSelectionMode ? (
                    <input 
                      type="checkbox" 
                      checked={selectedTrackIds.size === processedTracks.length && processedTracks.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTrackIds(new Set(processedTracks.map(tr => tr.id)));
                        else setSelectedTrackIds(new Set());
                      }}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)' }}
                    />
                  ) : '#'}
                </th>
                <th style={{ padding: '12px 16px' }}>Title & Artist</th>
                <th style={{ padding: '12px 16px' }}>Genre / Source</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}><Clock size={14} style={{ verticalAlign: 'middle' }} /></th>
                <th style={{ padding: '12px 16px', width: '48px' }}></th>
              </tr>
            )}
            itemContent={(index, t) => {
              const isActive = currentTrack && currentTrack.id === t.id;
              const isSelected = selectedTrackIds.has(t.id);
              return (
                <>
                  <td style={{ padding: '10px 16px', borderRadius: '12px 0 0 12px', width: '40px' }}>
                    {isSelectionMode ? (
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        readOnly
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-coral)', pointerEvents: 'none' }}
                      />
                    ) : isActive ? (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {t.genre && (
                        <span style={{ padding: '2px 8px', borderRadius: '100px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-primary)' }}>
                          {t.genre}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {t.source || 'local'}
                      </span>
                    </div>
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
