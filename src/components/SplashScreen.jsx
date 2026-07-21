import React, { useState, useEffect } from 'react';
import { Music, DownloadCloud } from 'lucide-react';

export default function SplashScreen() {
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      // Non-linear realistic progress
      const increment = Math.random() * 15 + 5; 
      current += increment;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
      }
      setProgress(current);
      // Fluctuate speed between 2.1 and 4.8 MB/s
      setSpeed((Math.random() * 2.7 + 2.1).toFixed(1));
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const totalMB = 12.4;
  const currentMB = ((progress / 100) * totalMB).toFixed(1);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-icon-wrapper">
          <Music size={64} className="splash-icon" />
          <div className="splash-pulse"></div>
        </div>
        <h1 className="splash-title">Rosewood</h1>
        <p className="splash-subtitle">Syncing Library & Metadata...</p>
        
        <div className="splash-download-container">
          <div className="splash-download-stats">
            <span className="splash-download-amount">
              {currentMB} MB / {totalMB} MB
            </span>
            <span className="splash-download-speed">
              <DownloadCloud size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {speed} MB/s
            </span>
          </div>
          <div className="splash-progress-bar-bg">
            <div 
              className="splash-progress-bar-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
