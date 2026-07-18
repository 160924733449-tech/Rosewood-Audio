import React from 'react';
import { Music } from 'lucide-react';

export default function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-icon-wrapper">
          <Music size={64} className="splash-icon" />
          <div className="splash-pulse"></div>
        </div>
        <h1 className="splash-title">Rosewood</h1>
        <p className="splash-subtitle">Syncing Library & Metadata...</p>
      </div>
    </div>
  );
}
