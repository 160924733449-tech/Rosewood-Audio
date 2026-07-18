import React from 'react';

export default function SkeletonTrack() {
  return (
    <div className="track-item skeleton-track">
      <div className="track-art-container skeleton-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="track-info">
        <div className="track-title skeleton-pulse" style={{ width: '60%', height: '14px', marginBottom: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
        <div className="track-artist skeleton-pulse" style={{ width: '40%', height: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }} />
      </div>
      <div className="track-duration skeleton-pulse" style={{ width: '40px', height: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }} />
    </div>
  );
}

export function SkeletonTrackList({ count = 5 }) {
  return (
    <div className="track-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTrack key={i} />
      ))}
    </div>
  );
}
