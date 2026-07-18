import React from 'react';
import { Home, Music, Settings, ListMusic } from 'lucide-react';

export default function MobileBottomNav({ currentTab, setCurrentTab }) {
  return (
    <nav className="mobile-bottom-nav glass">
      <button 
        className={`nav-item ${currentTab === 'home' ? 'active' : ''}`}
        onClick={() => setCurrentTab('home')}
      >
        <Home size={22} />
        <span>Home</span>
      </button>
      
      <button 
        className={`nav-item ${currentTab === 'library' || currentTab === 'playlist' ? 'active' : ''}`}
        onClick={() => setCurrentTab('library')}
      >
        <Music size={22} />
        <span>Library</span>
      </button>

      <button 
        className={`nav-item ${currentTab === 'playlists_hub' ? 'active' : ''}`}
        onClick={() => setCurrentTab('playlists_hub')}
      >
        <ListMusic size={22} />
        <span>Playlists</span>
      </button>
      <button 
        className={`nav-item ${currentTab === 'settings' ? 'active' : ''}`}
        onClick={() => setCurrentTab('settings')}
      >
        <Settings size={22} />
        <span>Settings</span>
      </button>
    </nav>
  );
}
