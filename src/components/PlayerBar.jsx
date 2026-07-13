import React, { useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Shuffle, RotateCcw, Volume2, VolumeX, Disc, Zap, Loader2 } from 'lucide-react';

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
  autoNext,
  setAutoNext,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolumeChange,
  onExpand
}) {
  const timelineRef = useRef(null);
  const volumeRef = useRef(null);

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
        <button className="play-btn" onClick={(e) => { e.stopPropagation(); onPlayPauseToggle(); }} disabled={loadingTrack}>
          {loadingTrack ? (
            <Loader2 size={18} className="spinner" />
          ) : isPlaying ? (
            <Pause size={18} fill="#fff" />
          ) : (
            <Play size={18} fill="#fff" style={{ transform: 'translateX(1px)' }} />
          )}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onNext(); }} title="Next Track">
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
          
          <button className="control-btn" onClick={onPrev} title="Previous Track">
            <SkipBack size={18} />
          </button>
          
          <button className="control-btn play-pause-btn" onClick={onPlayPauseToggle} disabled={loadingTrack}>
            {loadingTrack ? (
              <Loader2 size={20} className="spinner" color="#000" />
            ) : isPlaying ? (
              <Pause size={20} fill="#000" />
            ) : (
              <Play size={20} fill="#000" style={{ transform: 'translateX(1px)' }} />
            )}
          </button>
          
          <button className="control-btn" onClick={onNext} title="Next Track">
            <SkipForward size={18} />
          </button>
          
          <button 
            className={`control-btn ${repeat ? 'active' : ''}`} 
            onClick={() => setRepeat(!repeat)}
            title="Repeat Track"
          >
            <RotateCcw size={16} />
          </button>

          <button 
            className={`control-btn ${autoNext ? 'active' : ''}`} 
            onClick={() => setAutoNext(!autoNext)}
            title="Auto Next"
          >
            <Zap size={16} />
          </button>
        </div>

        <div className="player-timeline">
          <span className="time-stamp">{formatTime(currentTime)}</span>
          <div 
            className="timeline-slider-container" 
            ref={timelineRef}
            onMouseDown={handleTimelineMouseDown}
          >
            <div className="timeline-progress" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="time-stamp">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Extras (Volume, Mute) */}
      <div className="player-extra-controls">
        <div className="volume-container">
          <button 
            className="control-btn" 
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            title={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div 
            className="volume-slider-container" 
            ref={volumeRef}
            onMouseDown={handleVolumeMouseDown}
          >
            <div className="volume-progress" style={{ width: `${volumePercent}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
