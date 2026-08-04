import React, { useMemo } from 'react';
import { Music, Play, FolderPlus, RefreshCw, Radio, Compass, Disc, Clock, Moon } from 'lucide-react';

export default function HomeView({
  userProfile = null,
  tracks = [],
  isOffline = false,
  userMode = 'local',
  onImportMusic,
  onRefreshLibrary,
  onPlayTrack,
  isAdmin = false,
  isPrivateListening = false,
  onNavigateToTab
}) {
  const displayName = useMemo(() => {
    if (userProfile?.displayName) return userProfile.displayName;
    if (userProfile?.email) return userProfile.email.split('@')[0];
    return 'Music Lover';
  }, [userProfile]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Display recently added or played tracks on home
  const recentTracks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    // Show up to 12 tracks on desktop for a rich grid feel, 6 on mobile
    return isAdmin ? tracks.slice(0, 18) : tracks.slice(0, 12);
  }, [tracks, isAdmin]);

  return (
    <div className="home-view-container">
      {/* Welcome Banner */}
      <div className="welcome-banner glass">
        <div className="welcome-banner-content">
          <div className="welcome-subheading" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-coral)', fontWeight: '700', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px', fontFamily: 'var(--font-serif)' }}>
            <Moon size={16} />
            <span>{isPrivateListening ? 'Rosewood Private Audio Edition' : 'Rosewood Audio Edition'}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.5px' }}>
            {greeting}, <span className="gradient-text">{displayName}.</span>
          </h1>
          <p style={{ maxWidth: '520px', marginTop: '6px', color: 'var(--text-secondary)' }}>
            {isPrivateListening 
              ? 'Welcome to your serene acoustic sanctuary — styled in beautiful pink glassmorphism aesthetics.'
              : 'Welcome to your premium acoustic sanctuary — styled in beautiful modern aesthetics.'}
          </p>

          <div className="welcome-stats-row" style={{ display: 'flex', gap: '16px', marginTop: '20px', flexWrap: 'wrap' }}>
            <div className="welcome-stat-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '100px', border: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>
              <Disc size={16} color="var(--accent-coral)" />
              <span>{tracks.length} {tracks.length === 1 ? 'Track Available' : 'Tracks in Library'}</span>
            </div>
            <div className="welcome-stat-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '100px', border: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>
              <Radio size={16} color="var(--accent-coral)" />
              <span>{userMode.toUpperCase()} Mode</span>
            </div>
            {isOffline && (
              <div className="welcome-stat-pill" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(212, 175, 55, 0.15)', borderRadius: '100px', border: '1px solid var(--accent-rose)', fontSize: '13px', color: 'var(--accent-rose)', fontWeight: '600' }}>
                <Clock size={16} />
                <span>Offline Listening Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="welcome-banner-glow" style={{ position: 'absolute', top: '-50%', right: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(212, 175, 55, 0.22) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
      </div>

      {/* Empty / Offline Prompts */}
      {tracks.length === 0 ? (
        isOffline ? (
          <div className="import-prompt glass" style={{ textAlign: 'center', padding: '60px 24px', borderRadius: '24px', marginTop: '32px', border: '1px solid var(--border-subtle)' }}>
            <FolderPlus className="import-icon" size={64} style={{ opacity: 0.4, margin: '0 auto 16px', color: 'var(--accent-coral)' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>You are currently Offline</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '15px' }}>
              Cloud music is hidden while offline. Please reconnect to Wi-Fi/data or import local audio files from your device to listen offline.
            </p>
            {userMode === 'local' && (
              <button 
                className="import-btn hover-scale"
                onClick={onImportMusic}
                style={{ padding: '12px 28px', borderRadius: '14px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow-lg)' }}
              >
                Import Local Audio Files
              </button>
            )}
          </div>
        ) : (
          <div className="import-prompt glass" style={{ textAlign: 'center', padding: '60px 24px', borderRadius: '24px', marginTop: '32px', border: '1px solid var(--border-subtle)' }}>
            <FolderPlus className="import-icon" size={64} style={{ opacity: 0.4, margin: '0 auto 16px', color: 'var(--accent-coral)' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Your Library is Empty</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 24px', lineHeight: '1.6', fontSize: '15px' }}>
              Point Reson8 to a folder on your hard drive or cloud repository and every song inside will be scanned, organized, and ready for instant playback.
            </p>
            {userMode === 'local' && (
              <button 
                className="import-btn hover-scale"
                onClick={onImportMusic}
                style={{ padding: '12px 28px', borderRadius: '14px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow-lg)' }}
              >
                Import Music Folder
              </button>
            )}
            {userMode === 'shared' && (
              <button 
                className="import-btn hover-scale"
                onClick={onRefreshLibrary}
                style={{ padding: '12px 28px', borderRadius: '14px', border: 'none', background: 'var(--gradient-accent)', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', boxShadow: 'var(--shadow-lg)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={18} /> Refresh Shared Library
              </button>
            )}
          </div>
        )
      ) : (
        /* Recently Added / Played Section */
        <div className="home-content-section" style={{ marginTop: '40px' }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
              <Music size={22} className="gradient-text" />
              Quick Play & Favorites
            </h2>
            {onNavigateToTab && (
              <button 
                onClick={() => onNavigateToTab('library')}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-coral)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <span>View All Collection</span>
                <Compass size={14} />
              </button>
            )}
          </div>

          <div className="dashboard-grid">
            {recentTracks.map(t => (
              <div 
                key={t.id} 
                className="music-card glass hover-scale" 
                onClick={() => onPlayTrack(t, tracks)}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-art-container" style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: '14px', overflow: 'hidden', background: 'var(--bg-deep)', marginBottom: '12px' }}>
                  {t.artwork ? (
                    <img src={t.artwork} className="card-art" alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="card-placeholder-art" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <Music size={40} />
                    </div>
                  )}
                  <div className="card-play-overlay">
                    <Play size={20} fill="#000" style={{ transform: 'translateX(1px)' }} />
                  </div>
                </div>
                <div className="card-info">
                  <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title || 'Untitled'}
                  </h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.artist || 'Unknown Artist'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
