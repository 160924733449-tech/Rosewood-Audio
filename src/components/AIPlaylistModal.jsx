import React, { useState } from 'react';
import { Sparkles, X, Music, Loader2, Save } from 'lucide-react';
import { generateAIPlaylist } from '../utils/aiFeatures';

const AIPlaylistModal = ({ isVisible, onClose, allTracks, onCreatePlaylist }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTracks, setGeneratedTracks] = useState([]);

  if (!isVisible) return null;

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setGeneratedTracks([]);
    
    // Simulate AI loading delay for better UX
    setTimeout(() => {
      const tracks = generateAIPlaylist(prompt, allTracks);
      setGeneratedTracks(tracks);
      setIsGenerating(false);
    }, 1500);
  };

  const handleSave = () => {
    if (generatedTracks.length > 0) {
      const trackIds = generatedTracks.map(t => t.id || t.trackId);
      const playlistName = prompt.trim() || 'AI Generated Playlist';
      onCreatePlaylist(playlistName, trackIds);
      onClose();
      setPrompt('');
      setGeneratedTracks([]);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(5px)',
      animation: 'fadeIn 0.3s ease'
    }}>
      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}
      </style>
      
      <div style={{
        backgroundColor: 'var(--bg-elevated, #1e1e1e)',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.5))',
        border: '1px solid var(--border-subtle, #333)',
        animation: 'slideUp 0.3s ease',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-subtle, #333)'
        }}>
          <h2 style={{
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-primary, #fff)',
            fontSize: '1.25rem'
          }}>
            <Sparkles color="var(--accent-teal, #2dd4bf)" size={24} />
            AI Playlist Maker
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: 'var(--text-secondary, #a1a1aa)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Describe your perfect playlist..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #333)',
                backgroundColor: 'var(--bg-deep, #121212)',
                color: 'var(--text-primary, #fff)',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              style={{
                backgroundColor: 'var(--accent-teal, #2dd4bf)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '0 20px',
                fontWeight: 'bold',
                cursor: (isGenerating || !prompt.trim()) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: (isGenerating || !prompt.trim()) ? 0.7 : 1
              }}
            >
              {isGenerating ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={18} />}
              Generate
            </button>
          </div>

          {/* Results Area */}
          <div style={{ minHeight: '200px' }}>
            {isGenerating ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--text-secondary, #a1a1aa)',
                gap: '12px'
              }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-teal, #2dd4bf)' }} />
                <span>Crafting the perfect vibe...</span>
              </div>
            ) : generatedTracks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: '0 0 10px 0', color: 'var(--text-secondary, #a1a1aa)', fontSize: '0.9rem' }}>
                  Found {generatedTracks.length} tracks for you:
                </p>
                {generatedTracks.map((track, idx) => (
                  <div key={track.id || track.trackId || idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-surface, #27272a)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle, #3f3f46)'
                  }}>
                    <div style={{ 
                      width: '32px', height: '32px', 
                      borderRadius: '4px', 
                      backgroundColor: 'var(--bg-deep, #121212)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Music size={16} color="var(--text-secondary, #a1a1aa)" />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ 
                        color: 'var(--text-primary, #fff)', 
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{track.title || 'Unknown Title'}</div>
                      <div style={{ 
                        color: 'var(--text-secondary, #a1a1aa)', 
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{track.artist || 'Unknown Artist'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: 'var(--text-secondary, #a1a1aa)',
                textAlign: 'center'
              }}>
                Enter a mood, activity, or genre above<br/>to let AI build your playlist.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {generatedTracks.length > 0 && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid var(--border-subtle, #333)',
            backgroundColor: 'var(--bg-surface, #27272a)'
          }}>
            <button
              onClick={handleSave}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'var(--accent-coral, #fb923c)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '1rem'
              }}
            >
              <Save size={20} />
              Save as Playlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPlaylistModal;
