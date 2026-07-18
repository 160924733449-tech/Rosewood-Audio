import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Play, Pause, SkipForward, SkipBack, Shuffle, RotateCcw, Volume2, VolumeX, Disc, Zap, Loader2 } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import LyricsBoard from './LyricsBoard';
import { fetchLyrics, parseLrc } from '../utils/lyricsApi';
import { extractDominantColor } from '../utils/colorExtractor';
import { triggerHaptic } from '../utils/haptics';

export default function NowPlayingOverlay({
  track,
  loadingTrack,
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
  const [lyrics, setLyrics] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [albumColor, setAlbumColor] = useState('var(--accent-rose)');
  
  const timelineRef = useRef(null);
  const volumeRef = useRef(null);
  const circularProgressRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);

  const handleTouchStart = (e) => {
    // Only track single touch
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchEnd = (e) => {
    if (!touchStart || e.changedTouches.length === 0) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStart.x - touchEndX;
    const deltaY = touchStart.y - touchEndY;

    // Detect if swipe was mostly horizontal or vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe (skip tracks)
      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          triggerHaptic('light');
          onNext();
        } else {
          triggerHaptic('light');
          onPrev();
        }
      }
    } else {
      // Vertical swipe (close overlay)
      if (deltaY < -50) {
        triggerHaptic('light');
        handleClose();
      }
    }
    setTouchStart(null);
  };

  useEffect(() => {
    let active = true;
    if (track && track.artwork) {
      extractDominantColor(track.artwork).then(color => {
        if (active) setAlbumColor(color);
      });
    } else {
      setAlbumColor('var(--accent-rose)');
    }
    return () => { active = false; };
  }, [track?.artwork]);

  useEffect(() => {
    let active = true;
    const getLyrics = async () => {
      if (track && track.title && track.artist) {
        setLyrics(null);
        setIsLoadingLyrics(true);
        const data = await fetchLyrics(track.title, track.artist);
        if (active) {
          if (data && data.syncedLyrics) {
            setLyrics(parseLrc(data.syncedLyrics));
          } else {
            setLyrics([]); // Empty array means no synced lyrics found
          }
          setIsLoadingLyrics(false);
        }
      }
    };
    getLyrics();
    return () => { active = false; };
  }, [track]);

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

  const handleCircularMouseDown = (e) => {
    if (!circularProgressRef.current || !duration) return;
    
    const isTouch = e.type.startsWith('touch');
    const startClientX = isTouch ? e.touches[0].clientX : e.clientX;
    const startClientY = isTouch ? e.touches[0].clientY : e.clientY;

    const updateCircularSeek = (clientX, clientY) => {
      const rect = circularProgressRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const x = clientX - centerX;
      const y = clientY - centerY;
      let angle = Math.atan2(y, x);
      
      angle += Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      
      const percent = angle / (2 * Math.PI);
      onSeek(Math.max(0, Math.min(1, percent)) * duration);
    };

    updateCircularSeek(startClientX, startClientY);

    const handleMouseMove = (moveEvent) => {
      if (moveEvent.cancelable) moveEvent.preventDefault();
      const clientX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      updateCircularSeek(clientX, clientY);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
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
    <div 
      className={`now-playing-overlay ${isClosing ? 'closing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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

      {/* Main Layout */}
      <div className="overlay-main-layout">
        
        {/* Left Column: Artwork */}
        <div className="overlay-left-col">
          <div 
            className="overlay-art-container"
            style={{ position: 'relative' }}
          >
            <div className="vinyl-progress-container" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              <svg 
                ref={circularProgressRef}
                width="310" 
                height="310" 
                viewBox="0 0 310 310"
                className="vinyl-progress-ring"
                style={{ cursor: 'pointer', transform: 'rotate(-90deg)' }}
                onMouseDown={handleCircularMouseDown}
                onTouchStart={handleCircularMouseDown}
              >
                <circle cx="155" cy="155" r="148" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                <circle cx="155" cy="155" r="148" fill="none" stroke="var(--accent-rose)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 148}
                  strokeDashoffset={2 * Math.PI * 148 * (1 - (progressPercent || 0) / 100)}
                  style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                />
              </svg>
            </div>

            {loadingTrack ? (
              <div className="overlay-placeholder-art">
                <Loader2 size={96} className="spin" style={{ color: 'var(--text-secondary)' }} />
              </div>
            ) : track.artwork ? (
              <img 
                src={track.artwork} 
                alt="Artwork" 
                className={`overlay-art water-drop-anim vinyl-art ${isPlaying ? 'spin' : ''}`} 
                decoding="async"
              />
            ) : (
              <div className="overlay-placeholder-art">
                <Disc size={96} className={isPlaying ? "spin" : ""} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Meta + Controls */}
        <div className="overlay-right-col">
          <div className="overlay-track-meta">
            <div className="overlay-track-title">{track.title}</div>
            <div className="overlay-track-artist" style={{ color: albumColor, transition: 'color 0.5s ease' }}>{track.artist}</div>
            {track.album && <div className="overlay-track-album">{track.album}</div>}
          </div>

          <LyricsBoard lyrics={lyrics} currentTime={currentTime} />

          <div className="overlay-footer-panel">
            <div className={lyrics && lyrics.length > 0 ? "desktop-hide-visualizer" : ""}>
              <AudioVisualizer isPlaying={isPlaying} />
            </div>
            
            {/* Progress Slider */}
            <div className="player-timeline">
              <span className="time-stamp">{formatTime(currentTime)}</span>
              <div 
                className="timeline-slider-container" 
                ref={timelineRef}
                onMouseDown={handleTimelineMouseDown}
                style={{ background: 'rgba(255, 255, 255, 0.08)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
              >
                <div className="timeline-progress" style={{ width: `${progressPercent}%`, background: albumColor, transition: 'width 0.1s linear, background 0.5s ease' }}></div>
                <div className="player-timeline-thumb" style={{ left: `${progressPercent}%` }}></div>
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
              
              <button 
                className="control-btn" 
                onClick={() => { triggerHaptic('light'); onPrev(); }} 
                title="Previous"
              >
                <SkipBack size={24} />
              </button>
              
              <button 
                className="control-btn play-pause-btn" 
                onClick={() => { triggerHaptic('medium'); onPlayPauseToggle(); }}
                style={{ width: '56px', height: '56px' }}
                title={isPlaying ? "Pause" : "Play"}
                disabled={loadingTrack}
              >
                {loadingTrack ? (
                  <Loader2 size={24} className="spin" style={{ color: 'var(--bg-deep)' }} />
                ) : isPlaying ? (
                  <Pause size={24} fill="#000" />
                ) : (
                  <Play size={24} fill="#000" style={{ transform: 'translateX(1px)' }} />
                )}
              </button>
              
              <button 
                className="control-btn" 
                onClick={() => { triggerHaptic('light'); onNext(); }} 
                title="Next"
              >
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
                <div className="volume-progress" style={{ width: `${volumePercent}%`, background: albumColor, transition: 'width 0.1s linear, background 0.5s ease' }}></div>
                <div className="volume-thumb" style={{ left: `${volumePercent}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
