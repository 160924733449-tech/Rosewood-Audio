import React, { useState, useEffect } from 'react';
import { Radio, Users, Copy, X, Headphones } from 'lucide-react';
import { createJamSession, joinJamSession, subscribeJamSession, syncJamSession, leaveJamSession } from '../utils/socialHelper';

const JamSession = ({ isVisible, onClose, currentTrack, isPlaying, currentTime, onPlayTrack, username }) => {
  const [mode, setMode] = useState('idle'); // 'idle' or 'active'
  const [sessionId, setSessionId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    let unsubscribe;
    if (mode === 'active' && sessionId) {
      unsubscribe = subscribeJamSession(sessionId, (data) => {
        if (data) {
          setSessionData(data);
          // If not host and session has a track playing, sync local playback
          if (!isHost && data.currentTrackId && data.isPlaying && onPlayTrack) {
             // Pass info up to parent. In a real app we'd pass the full track object if possible.
             onPlayTrack(data.currentTrackId, data.isPlaying, data.currentTime);
          }
        } else {
          // Session ended
          handleLeave();
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [mode, sessionId, isHost]);

  useEffect(() => {
    // Sync host playback state
    if (mode === 'active' && isHost && sessionId) {
      const interval = setInterval(() => {
        syncJamSession(sessionId, currentTrack?.id, isPlaying, currentTime);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [mode, isHost, sessionId, currentTrack, isPlaying, currentTime]);

  const handleCreate = async () => {
    if (!username) return;
    const newSessionId = await createJamSession(username);
    if (newSessionId) {
      setSessionId(newSessionId);
      setIsHost(true);
      setMode('active');
    }
  };

  const handleJoin = async () => {
    if (!username || !joinCode) return;
    const success = await joinJamSession(joinCode.toUpperCase(), username);
    if (success) {
      setSessionId(joinCode.toUpperCase());
      setIsHost(false);
      setMode('active');
    }
  };

  const handleLeave = async () => {
    if (sessionId && username) {
      await leaveJamSession(sessionId, username);
    }
    setMode('idle');
    setSessionId('');
    setSessionData(null);
    setIsHost(false);
    setJoinCode('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sessionId);
  };

  if (!isVisible) return null;

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100
  };

  const modalStyle = {
    background: 'var(--bg-surface)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-xl)',
    width: '400px',
    maxWidth: '90%',
    color: 'var(--text-primary)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold'
  };

  const buttonStyle = {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    transition: 'opacity 0.2s'
  };

  const primaryBtn = { ...buttonStyle, background: 'var(--accent-coral)', color: '#fff' };
  const secondaryBtn = { ...buttonStyle, background: 'var(--bg-elevated)', color: 'var(--text-primary)' };

  const inputStyle = {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    color: 'var(--text-primary)',
    width: '100%',
    marginBottom: '12px',
    fontSize: '1rem',
    textTransform: 'uppercase',
    textAlign: 'center'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Headphones size={24} color="var(--accent-teal)" />
            Jam Session
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {mode === 'idle' ? (
          <>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
              Listen together with friends in real-time.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <button style={primaryBtn} onClick={handleCreate}>
                <Radio size={18} /> Start a Session
              </button>
              
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>OR</div>
              
              <div>
                <input 
                  type="text" 
                  placeholder="Enter 6-char code" 
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  style={inputStyle}
                />
                <button style={secondaryBtn} onClick={handleJoin} disabled={joinCode.length !== 6}>
                  Join Session
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', padding: '20px', background: 'var(--bg-elevated)', borderRadius: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Session Code</p>
              <div style={{ fontSize: '2rem', letterSpacing: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                {sessionId}
                <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} title="Copy Code">
                  <Copy size={20} />
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                <Users size={18} /> Participants ({sessionData?.participants?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {sessionData?.participants?.map(p => (
                  <span key={p} style={{ padding: '4px 12px', background: 'var(--bg-deep)', borderRadius: '16px', fontSize: '0.9rem' }}>
                    {p} {p === sessionData.hostUsername && '(Host)'}
                  </span>
                ))}
              </div>
            </div>

            <button style={{ ...secondaryBtn, color: 'var(--accent-rose)' }} onClick={handleLeave}>
              Leave Session
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default JamSession;
