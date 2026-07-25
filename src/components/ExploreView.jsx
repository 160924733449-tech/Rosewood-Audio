import React, { useMemo } from 'react';
import { Sparkles, Music, Play, Compass, Sun, Sunrise, Sunset, Moon } from 'lucide-react';
import { generateDaylist } from '../utils/aiFeatures';

export default function ExploreView({
  recommendations = { dailyMix: [], similarTracks: [], forgottenGems: [] },
  tracks = [],
  isOffline = false,
  onPlayTrack
}) {
  // Generate Time-Based Daylist
  const daylistInfo = useMemo(() => {
    if (!tracks || tracks.length === 0) return { tracks: [], label: '', icon: null };
    const hour = new Date().getHours();
    const data = generateDaylist(tracks, hour);
    
    let label = '🌙 Night Mode Acoustic Mix';
    let icon = <Moon size={20} color="#a78bfa" />;
    
    if (hour >= 5 && hour < 12) {
      label = '🌅 Morning Acoustic Sunrise';
      icon = <Sunrise size={20} color="#fbbf24" />;
    } else if (hour >= 12 && hour < 17) {
      label = '☀️ Afternoon High Energy';
      icon = <Sun size={20} color="#f59e0b" />;
    } else if (hour >= 17 && hour < 21) {
      label = '🌆 Evening Sunset Chill';
      icon = <Sunset size={20} color="#f97316" />;
    }

    return {
      tracks: data.slice(0, 12),
      label,
      icon
    };
  }, [tracks]);

  const renderCardGrid = (list, playPool) => {
    if (!list || list.length === 0) return null;
    return (
      <div className="dashboard-grid">
        {list.map(t => (
          <div key={t.id} className="music-card glass hover-scale" onClick={() => onPlayTrack(t, playPool || list)} style={{ cursor: 'pointer' }}>
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
    );
  };

  return (
    <div className="explore-view-container">
      {/* Hero Header */}
      <div className="section-header glass" style={{ padding: '24px 32px', borderRadius: '24px', marginBottom: '32px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, rgba(213, 28, 57, 0.1) 0%, rgba(20, 20, 25, 0.6) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Sparkles size={26} className="gradient-text" style={{ filter: 'drop-shadow(0 0 8px rgba(213, 28, 57, 0.4))' }} />
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
            Picked for You
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, maxWidth: '500px' }}>
          Reson8 listens to your acoustic taste quietly and refines these recommendations in real-time — no manual ratings or algorithmic noise required.
        </p>
      </div>

      {tracks.length === 0 ? (
        <div className="empty-state glass" style={{ textAlign: 'center', padding: '80px 20px', borderRadius: '24px' }}>
          <Compass size={64} style={{ opacity: 0.3, margin: '0 auto 16px', color: 'var(--accent-coral)' }} />
          <h3 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
            {isOffline ? 'You Are Currently Offline' : 'Awaiting Acoustic Data'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto', lineHeight: '1.6', fontSize: '15px' }}>
            {isOffline 
              ? 'Recommendations require active library sync or local audio analysis. Reconnect or import local audio to unlock AI curation.'
              : 'Import music into your library to unlock personalized Daily Mixes, Similar Tracks, and dynamic time-of-day Daylists.'}
          </p>
        </div>
      ) : (
        <div className="explore-sections" style={{ display: 'flex', flexDirection: 'column', gap: '44px' }}>
          {/* Daylist Section */}
          {daylistInfo.tracks && daylistInfo.tracks.length > 0 && (
            <section className="explore-section">
              <div className="section-title-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                {daylistInfo.icon}
                <h2 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>
                  {daylistInfo.label}
                </h2>
              </div>
              {renderCardGrid(daylistInfo.tracks, daylistInfo.tracks)}
            </section>
          )}

          {/* Daily Mix */}
          {recommendations?.dailyMix && recommendations.dailyMix.length > 0 && (
            <section className="explore-section">
              <div className="section-title-bar" style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  Today's Listening
                </h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Curated from your heavy rotation and acoustic preferences</span>
              </div>
              {renderCardGrid(recommendations.dailyMix, tracks)}
            </section>
          )}

          {/* Similar Tracks / In Your Vein */}
          {recommendations?.similarTracks && recommendations.similarTracks.length > 0 && (
            <section className="explore-section">
              <div className="section-title-bar" style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  In Your Vein
                </h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tracks sharing acoustic texture and frequency balance with your favorites</span>
              </div>
              {renderCardGrid(recommendations.similarTracks, tracks)}
            </section>
          )}

          {/* Forgotten Gems */}
          {recommendations?.forgottenGems && recommendations.forgottenGems.length > 0 && (
            <section className="explore-section">
              <div className="section-title-bar" style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  You've Been Missing These
                </h2>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Rediscover gems from deep within your collection</span>
              </div>
              {renderCardGrid(recommendations.forgottenGems, tracks)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
