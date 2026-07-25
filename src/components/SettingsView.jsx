import React from 'react';
import { 
  Settings, Users, Eye, EyeOff, Radio, Download, 
  FolderPlus, RefreshCw, LogOut, Trash2, Shield, Volume2, Smartphone, HardDrive 
} from 'lucide-react';

export default function SettingsView({
  userProfile = null,
  userMode = 'local',
  audioQuality = 'auto',
  setAudioQuality,
  onToggleFriendActivity,
  onToggleJamSession,
  isPrivateListening = false,
  setIsPrivateListening,
  onRefreshLibrary,
  onImportMusic,
  onLogout,
  onClearLibrary
}) {
  const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

  const handleClearConfirm = () => {
    if (window.confirm('Are you sure you want to clear all local music data, cached streams, and indexedDB storage? This cannot be undone.')) {
      if (onClearLibrary) onClearLibrary();
    }
  };

  return (
    <div className="settings-view-container" style={{ paddingBottom: '80px', maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div className="section-header" style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '30px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
          <Settings size={28} className="gradient-text" />
          Settings & Preferences
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0' }}>
          Manage your audio fidelity, library connections, and privacy controls
        </p>
      </div>

      <div className="settings-grid" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* User Profile Card */}
        <div className="settings-section-card glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(20,20,25,0.8) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="profile-avatar" style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--gradient-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', color: '#fff', boxShadow: 'var(--shadow-md)' }}>
              {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : (userProfile?.email ? userProfile.email.charAt(0).toUpperCase() : '?')}
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {userProfile?.displayName || userProfile?.email || 'Acoustic Listener'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--accent-coral)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} /> {userMode} Library Mode
              </div>
            </div>
          </div>

          <button 
            onClick={onLogout}
            className="btn-secondary hover-scale"
            style={{ padding: '10px 18px', borderRadius: '12px', border: '1px solid var(--border-subtle)', background: 'var(--bg-deep)', color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <LogOut size={16} /> <span>Switch / Logout</span>
          </button>
        </div>

        {/* Audio Fidelity */}
        <div className="settings-section-card glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Volume2 size={20} className="gradient-text" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Audio Fidelity & Streaming</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
            Control the streaming quality and bit-rate for cloud tracks. Local audio files always play at their original uncompressed studio fidelity.
          </p>
          <select 
            value={audioQuality} 
            onChange={(e) => setAudioQuality && setAudioQuality(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', outline: 'none', cursor: 'pointer' }}
          >
            <option value="auto">Auto (Balanced based on network condition)</option>
            <option value="low">Data Saver (Low bandwidth / mobile cellular)</option>
            <option value="high">High Fidelity (Original Bitrate / Lossless Studio)</option>
          </select>
        </div>

        {/* Features & Privacy */}
        <div className="settings-section-card glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Shield size={20} className="gradient-text" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Social & Privacy Features</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="option-btn hover-scale" 
              onClick={onToggleFriendActivity}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Users size={20} color="var(--accent-coral)" />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>Friend Activity Broadcast</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share your current acoustic session with trusted friends</div>
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-coral)' }}>TOGGLE</span>
            </button>
            
            <button 
              className="option-btn hover-scale" 
              onClick={() => setIsPrivateListening && setIsPrivateListening(!isPrivateListening)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {isPrivateListening ? <EyeOff size={20} color="var(--accent-coral)" /> : <Eye size={20} color="var(--accent-coral)" />}
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>Private Listening Mode</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pause listening history and recommendation weighting</div>
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '100px', background: isPrivateListening ? 'var(--accent-coral)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
                {isPrivateListening ? 'ACTIVE' : 'OFF'}
              </span>
            </button>

            <button 
              className="option-btn hover-scale" 
              onClick={onToggleJamSession}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Radio size={20} color="var(--accent-coral)" />
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>Reson8 Jam Session</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Start a synchronized real-time audio room</div>
                </div>
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-coral)' }}>START</span>
            </button>
          </div>
        </div>

        {/* Mobile App APK Download */}
        {!isNative && (
          <div className="settings-section-card glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)', background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12) 0%, rgba(20,20,25,0.6) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Smartphone size={20} className="gradient-text" />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-serif)' }}>Native Mobile App</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '18px', lineHeight: '1.5' }}>
              Take Kiswah Royal Audio everywhere. Download the official standalone Android APK with background playback, offline caching, and lockscreen media controls.
            </p>
            <a 
              href="https://github.com/160924733449-tech/Rosewood-Audio/raw/main/public/reson8.apk" 
              download="reson8.apk"
              className="option-btn hover-scale" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '14px', background: 'var(--gradient-accent)', borderRadius: '14px', color: '#050505', textDecoration: 'none', fontWeight: '800', fontSize: '15px', boxShadow: 'var(--shadow-md)' }}
            >
              <Download size={18} />
              <span>Download Standalone Android APK (.apk)</span>
            </a>
          </div>
        )}

        {/* Library Management & Data Cleansing */}
        <div className="settings-section-card glass" style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <HardDrive size={20} className="gradient-text" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Library Management & Storage</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {userMode === 'local' && (
              <button 
                className="option-btn hover-scale" 
                onClick={onImportMusic}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px', textAlign: 'left' }}
              >
                <FolderPlus size={18} color="var(--accent-coral)" />
                <span>Import Local Music Folder</span>
              </button>
            )}
            
            {userMode === 'shared' && (
              <button 
                className="option-btn hover-scale" 
                onClick={onRefreshLibrary}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: '14px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px', textAlign: 'left' }}
              >
                <RefreshCw size={18} color="var(--accent-coral)" />
                <span>Refresh Shared Cloud Library</span>
              </button>
            )}

            <button 
              className="option-btn hover-scale" 
              onClick={handleClearConfirm}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(212, 175, 55, 0.1)', border: '1px dashed var(--accent-rose)', borderRadius: '14px', cursor: 'pointer', color: 'var(--accent-rose)', fontWeight: '700', fontSize: '14px', marginTop: '8px', textAlign: 'left' }}
            >
              <Trash2 size={18} />
              <span>Clear Local Data, IndexedDB & Cache</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
