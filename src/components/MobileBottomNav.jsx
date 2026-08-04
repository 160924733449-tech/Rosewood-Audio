import React from 'react';
import { Home, Music, Settings, ListMusic } from 'lucide-react';

export default function MobileBottomNav({ currentTab, setCurrentTab }) {
  return (
    <nav className="mobile-bottom-nav glass" aria-label="Main navigation">
      <button 
        className={`nav-item ${currentTab === 'home' ? 'active' : ''}`}
        onClick={() => setCurrentTab('home')}
      >
        <Home size={22} />
        <span>Home</span>
      </button>
      
      <button 
        className={`nav-item ${currentTab === 'library' || currentTab === 'playlist' ? 'active' : ''}`}
        onClick={() => setCurrentTab?.('library')}
        aria-current={currentTab === 'library' || currentTab === 'playlist' ? 'page' : undefined}
      >
        <Music size={22} />
        <span>Library</span>
      </button>

      <button 
        className={`nav-item ${currentTab === 'playlists_hub' ? 'active' : ''}`}
        onClick={() => setCurrentTab?.('playlists_hub')}
        aria-current={currentTab === 'playlists_hub' ? 'page' : undefined}
      >
        <ListMusic size={22} />
        <span>Playlists</span>
      </button>
      <button 
        className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
        onClick={() => setCurrentTab?.('settings')}
        aria-current={currentTab === 'settings' ? 'page' : undefined}
      >
        <Settings size={22} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
