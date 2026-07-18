import React from 'react';

export default function AudioVisualizer({ isPlaying }) {
  const bars = Array.from({ length: 32 });

  return (
    <div className="audio-visualizer">
      {bars.map((_, i) => (
        <div 
          key={i} 
          className={`visualizer-bar ${isPlaying ? 'playing' : ''}`}
          style={{
            animationDuration: `${0.5 + Math.random() * 0.8}s`,
            animationDelay: `${Math.random() * -1}s`,
            height: isPlaying ? `${20 + Math.random() * 80}%` : '4px'
          }}
        />
      ))}
    </div>
  );
}
