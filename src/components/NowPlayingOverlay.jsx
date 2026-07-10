import React, { useState, useRef } from 'react';
import { ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, RotateCcw, Volume2, VolumeX, Disc, Zap } from 'lucide-react';

export default function NowPlayingOverlay({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  repeat,
  shuffle,
  autoNext,
  onClose,
  onPlayPauseToggle,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  setShuffle,
  setRepeat,
  setAutoNext
}) {
  const [isClosing, setIsClosing] = useState(false);
  const timelineRef = useRef(null);
  const volumeRef = useRef(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 450); // Match CSS transition animation time
  };

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
    <div className={`now-playing-overlay ${isClosing ? 'closing' : ''}`}>
      {/* Ambient Bleeding Background */}
      <div 
        className="now-playing-ambient-bg" 
        style={{ backgroundImage: track.artwork ? `url(${track.artwork})` : 'none' }}
      />
      
      {/* Header */}
      <div className="overlay-header">
        <button className="overlay-close-btn" onClick={handleClose}>
          <ChevronDown size={22} />
        </button>
        <span className="overlay-header-title">Now Playing</span>
        <div style={{ width: 44 }}></div> {/* spacer */}
      </div>

      {/* Center Artwork & Metadata */}
      <div className="overlay-center-panel">
        <div className="overlay-art-container" key={track.id}>
          {track.artwork ? (
            <img 
              src={track.artwork} 
              alt="Artwork" 
              className="overlay-art water-drop-anim" 
              key={track.artwork} // Changing key forces element recreation to replay animation
            />
          ) : (
            <div className="overlay-placeholder-art">
              <Disc size={96} className={isPlaying ? "spin" : ""} />
            </div>
          )}
        </div>
        
        <div className="overlay-track-meta" key={`meta-${track.id}`}>
          <div className="overlay-track-title">{track.title}</div>
          <div className="overlay-track-artist">{track.artist}</div>
          {track.album && <div className="overlay-track-album">{track.album}</div>}
        </div>
      </div>

      {/* Footer / Controls */}
      <div className="overlay-footer-panel">
        {/* Progress Slider */}
        <div className="player-timeline">
          <span className="time-stamp">{formatTime(currentTime)}</span>
          <div 
            className="timeline-slider-container" 
            ref={timelineRef}
            onMouseDown={handleTimelineMouseDown}
            style={{ background: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
          >
            <div className="timeline-progress" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="time-stamp">{formatTime(duration)}</span>
        </div>

        {/* Buttons */}
        <div className="player-buttons" style={{ justifyContent: 'center', gap: '36px' }}>
          <button 
            className={`control-btn ${shuffle ? 'active' : ''}`} 
            onClick={() => setShuffle(!shuffle)}
            style={{ color: shuffle ? 'var(--accent-coral)' : 'var(--text-secondary)' }}
            title="Smart Shuffle"
          >
            <Shuffle size={20} />
          </button>
          
          <button className="control-btn" onClick={onPrev} title="Previous">
            <SkipBack size={24} />
          </button>
          
          <button 
            className="control-btn play-pause-btn" 
            onClick={onPlayPauseToggle}
            style={{ width: '56px', height: '56px' }}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={24} fill="#000" /> : <Play size={24} fill="#000" style={{ transform: 'translateX(1px)' }} />}
          </button>
          
          <button className="control-btn" onClick={onNext} title="Next">
            <SkipForward size={24} />
          </button>
          
          <button 
            className={`control-btn ${repeat ? 'active' : ''}`} 
            onClick={() => setRepeat(!repeat)}
            style={{ color: repeat ? 'var(--accent-coral)' : 'var(--text-secondary)' }}
            title="Repeat"
          >
            <RotateCcw size={20} />
          </button>

          <button 
            className={`control-btn ${autoNext ? 'active' : ''}`} 
            onClick={() => setAutoNext(!autoNext)}
            style={{ color: autoNext ? 'var(--accent-coral)' : 'var(--text-secondary)' }}
            title="Auto Next"
          >
            <Zap size={20} />
          </button>
        </div>

        {/* Volume */}
        <div className="volume-container" style={{ width: '100%', justifyContent: 'center', gap: '16px' }}>
          <button 
            className="control-btn" 
            onClick={() => onVolumeChange(volume > 0 ? 0 : 0.8)}
            title={volume === 0 ? "Unmute" : "Mute"}
          >
            {volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div 
            className="volume-slider-container" 
            ref={volumeRef}
            onMouseDown={handleVolumeMouseDown}
            style={{ flexGrow: 1, maxWidth: '280px', background: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
          >
            <div className="volume-progress" style={{ width: `${volumePercent}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
