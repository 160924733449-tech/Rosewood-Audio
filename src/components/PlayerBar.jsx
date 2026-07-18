import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Shuffle, RotateCcw, Volume2, VolumeX, Disc, Loader2, Settings } from 'lucide-react';
import { getAutoQualityLevel, QUALITY_LEVELS } from '../utils/audioQuality';
import { useToast } from './Toast';
import { triggerHaptic } from '../utils/haptics';

export default function PlayerBar({
  currentTrack,
  loadingTrack,
  isPlaying,
  onPlayPauseToggle,
  onNext,
  onPrev,
  shuffle,
  setShuffle,
  repeat,
  setRepeat,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  audioQuality,
  setAudioQuality,
  onExpand
}) {
  const timelineRef = useRef(null);
  const volumeRef = useRef(null);
  const settingsRef = useRef(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const { addToast } = useToast();

  // Close quality menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTimelineMouseDown = (e) => {
    if (!timelineRef.current || !duration) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const updateSeek = (clientX) => {
      const percent = (clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(1, percent)) * duration);
    };

    updateSeek(e.clientX);

    const handleMouseMove = (moveEvent) => {
      updateSeek(moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleVolumeMouseDown = (e) => {
    if (!volumeRef.current) return;
    
    const rect = volumeRef.current.getBoundingClientRect();
    const updateVolume = (clientX) => {
      const percent = (clientX - rect.left) / rect.width;
      onVolumeChange(Math.max(0, Math.min(1, percent)));
    };

    updateVolume(e.clientX);

    const handleMouseMove = (moveEvent) => {
      updateVolume(moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const volumePercent = volume * 100;

  return (
    <div className="player-bar glass">
      {/* Current track metadata */}
      <div 
        className="player-track-info" 
        key={currentTrack ? currentTrack.id : 'none'}
        onClick={onExpand}
        style={{ cursor: 'pointer' }}
        title="Open Now Playing Overlay"
      >
        {currentTrack ? (
          <>
            {currentTrack.artwork ? (
              <img src={currentTrack.artwork} alt="Artwork" className="player-art" decoding="async" />
            ) : (
              <div className="player-placeholder-art">
                <Disc size={24} className={isPlaying ? "spin" : ""} />
              </div>
            )}
            <div className="player-track-meta">
              <div className="player-track-title">{currentTrack.title}</div>
              <div className="player-track-artist">{currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <div className="player-track-meta">
            <div className="player-track-title" style={{ color: 'var(--text-muted)' }}>No Track Selected</div>
          </div>
        )}
      </div>
      
      {/* Mobile Mini Controls (Visible only on mobile) */}
      <div className="mobile-mini-controls">
        <button className="play-btn" onClick={(e) => { e.stopPropagation(); triggerHaptic('medium'); onPlayPauseToggle(); }} disabled={loadingTrack}>
          {loadingTrack ? (
            <Loader2 size={18} className="spinner" />
          ) : isPlaying ? (
            <Pause size={18} fill="#fff" />
          ) : (
            <Play size={18} fill="#fff" style={{ transform: 'translateX(1px)' }} />
          )}
        </button>
        <button onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); onNext(); }} title="Next Track">
          <SkipForward size={22} />
        </button>
      </div>

      {/* Control Buttons & Progress Timeline */}
      <div className="player-controls-container">
        <div className="player-buttons">
          <button 
            className={`control-btn ${shuffle ? 'active' : ''}`} 
            onClick={() => setShuffle(!shuffle)}
            title="Smart Shuffle"
          >
            <Shuffle size={16} />
          </button>
          
          <button className="control-btn" onClick={() => { triggerHaptic('light'); onPrev(); }} title="Previous Track">
            <SkipBack size={18} />
          </button>
          
          <button className="control-btn play-pause-btn" onClick={() => { triggerHaptic('medium'); onPlayPauseToggle(); }} disabled={loadingTrack}>
            {loadingTrack ? (
              <Loader2 size={20} className="spinner" color="#000" />
            ) : isPlaying ? (
              <Pause size={20} fill="#000" />
            ) : (
              <Play size={20} fill="#000" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>
          
          <button className="control-btn" onClick={() => { triggerHaptic('light'); onNext(); }} title="Next Track">
            <SkipForward size={18} />
          </button>
          
          <button 
            className={`control-btn ${repeat ? 'active' : ''}`} 
            onClick={() => setRepeat(!repeat)}
            title="Repeat Track"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="player-timeline" style={{ width: '100%', maxWidth: '600px', margin: '0 auto', marginTop: '12px' }}>
          <span className="time-stamp">{formatTime(currentTime)}</span>
          <div className="timeline-slider-container" ref={timelineRef} onMouseDown={handleTimelineMouseDown}>
            <div className="timeline-progress" style={{ width: `${progressPercent}%` }} />
            <div className="player-timeline-thumb" style={{ left: `${progressPercent}%` }} />
          </div>
          <span className="time-stamp">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Controls (Volume + Quality Settings) */}
      <div className="player-extra-controls">
        <div className="quality-settings-container" ref={settingsRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button 
            className={`control-btn ${showQualityMenu ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setShowQualityMenu(!showQualityMenu);
            }}
            title="Audio Quality Settings"
          >
            <Settings size={18} />
          </button>

          {showQualityMenu && (
            <div className="quality-dropdown-menu" style={{
              position: 'absolute',
              bottom: '40px',
              right: '0',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '8px',
              minWidth: '160px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 100
            }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Audio Quality
              </div>
              {[
                { 
                  id: 'auto', 
                  label: `Auto (${getAutoQualityLevel() === QUALITY_LEVELS.high ? '320kbps' : getAutoQualityLevel() === QUALITY_LEVELS.standard ? '128kbps' : '64kbps'})` 
                },
                { id: 'high', label: 'High (320kbps)' },
                { id: 'standard', label: 'Standard (128kbps)' },
                { id: 'low', label: 'Data Saver (64kbps)' }
              ].map(opt => (
                <button
                  key={opt.id}
                  style={{
                    background: audioQuality === opt.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: 'none',
                    color: audioQuality === opt.id ? 'var(--accent-rose)' : '#fff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'all 0.2s'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAudioQuality(opt.id);
                    setShowQualityMenu(false);
                    addToast(`Audio Quality set to: ${opt.label}`);
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.target.style.background = audioQuality === opt.id ? 'rgba(255,255,255,0.1)' : 'transparent'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="volume-container">
          <button className="control-btn volume-icon" onClick={(e) => {
            e.stopPropagation();
            onVolumeChange(volume === 0 ? 0.8 : 0);
          }}
              title={volume === 0 ? "Unmute" : "Mute"}
            >
              {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div 
            className="volume-slider-container" 
            ref={volumeRef}
            onMouseDown={(e) => { e.stopPropagation(); handleVolumeMouseDown(e); }}
          >
            <div className="volume-progress" style={{ width: `${volumePercent}%` }}></div>
            <div className="volume-thumb" style={{ left: `${volumePercent}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
