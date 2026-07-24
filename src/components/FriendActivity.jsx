import React, { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { subscribeFriendActivity } from '../utils/socialHelper';

const FriendActivity = ({ isVisible, onClose }) => {
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    let unsubscribe;
    if (isVisible) {
      unsubscribe = subscribeFriendActivity((friendsList) => {
        setFriends(friendsList);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const sidebarStyle = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '300px',
    height: '100vh',
    background: 'var(--bg-surface)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderLeft: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-xl)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    color: 'var(--text-primary)',
    transition: 'transform 0.3s ease-in-out',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    borderBottom: '1px solid var(--border-subtle)'
  };

  const listStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  };

  const friendItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };

  const avatarStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--bg-elevated)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'var(--accent-teal)'
  };

  const infoStyle = {
    flex: 1,
    overflow: 'hidden'
  };

  const usernameStyle = {
    fontSize: '0.9rem',
    fontWeight: '600',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const dotStyle = (isPlaying) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: isPlaying ? 'var(--accent-teal, #10b981)' : 'var(--text-secondary)',
    animation: isPlaying ? 'pulse 2s infinite' : 'none',
  });

  const trackStyle = {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  return (
    <div style={sidebarStyle}>
      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
        `}
      </style>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <Users size={20} />
          Friend Activity
        </div>
        <button 
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
      </div>

      <div style={listStyle}>
        {friends.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
            No friends online
          </div>
        ) : (
          friends.map((friend) => (
            <div key={friend.username} style={friendItemStyle}>
              <div style={avatarStyle}>
                {friend.username ? friend.username.charAt(0).toUpperCase() : '?'}
              </div>
              <div style={infoStyle}>
                <div style={usernameStyle}>
                  {friend.username}
                  <div style={dotStyle(friend.isPlaying)} />
                </div>
                <div style={trackStyle}>
                  {friend.trackTitle} • {friend.trackArtist}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FriendActivity;
