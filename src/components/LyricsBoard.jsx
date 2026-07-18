import React, { useEffect, useRef } from 'react';
import './LyricsBoard.css';

export default function LyricsBoard({ lyrics, currentTime }) {
  const containerRef = useRef(null);
  
  // Find the currently active line index
  let activeIndex = -1;
  if (lyrics && lyrics.length > 0) {
    for (let i = 0; i < lyrics.length; i++) {
      if (currentTime >= lyrics[i].time) {
        activeIndex = i;
      } else {
        break; // since it's sorted, we can break early
      }
    }
  }


  if (!lyrics || lyrics.length === 0) {
    return null; // Don't render if no lyrics
  }

  // If we only show the active line, we just pick the text for the activeIndex
  // If activeIndex is -1, we haven't reached the first lyric yet.
  const activeText = activeIndex !== -1 ? lyrics[activeIndex].text : '...';

  return (
    <div className="lyrics-board single-line-mode">
      <div className="lyric-line active">
        {activeText}
      </div>
    </div>
  );
}
