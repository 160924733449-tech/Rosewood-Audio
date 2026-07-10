import React, { useState } from 'react';
import { HardDrive, Users, ArrowRight, AlertCircle, Music } from 'lucide-react';

export default function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState('select');
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLocalMode = () => {
    onLoginSuccess({ mode: 'local', user: { displayName: 'Local Listener' } });
  };

  const handleSharedSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    // Retrieve registered users database from localStorage
    const localUsers = JSON.parse(localStorage.getItem('rosewood_users') || '{}');

    if (isSignUp) {
      // Sign Up Flow
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        setLoading(false);
        return;
      }
      if (localUsers[username.toLowerCase()]) {
        setError('Username is already taken.');
        setLoading(false);
        return;
      }

      // Register new user
      localUsers[username.toLowerCase()] = {
        username,
        password, // In a real app, this would be hashed on a server
        createdAt: Date.now()
      };
      localStorage.setItem('rosewood_users', JSON.stringify(localUsers));

      // Auto login after registration
      setTimeout(() => {
        onLoginSuccess({
          mode: 'shared',
          user: { displayName: username, email: `${username}@rosewoodaudio.local` },
          username,
          password
        });
        setLoading(false);
      }, 1000);

    } else {
      // Sign In Flow
      const matchedUser = localUsers[username.toLowerCase()];
      
      // Seed a default admin user if database is empty for testing
      if (!matchedUser && username.toLowerCase() === 'admin' && password === 'admin123') {
        localUsers['admin'] = { username: 'Admin', password: 'admin123' };
        localStorage.setItem('rosewood_users', JSON.stringify(localUsers));
        
        setTimeout(() => {
          onLoginSuccess({
            mode: 'shared',
            user: { displayName: 'Admin', email: 'admin@rosewoodaudio.local' },
            username: 'Admin',
            password: 'admin123'
          });
          setLoading(false);
        }, 1000);
        return;
      }

      if (!matchedUser || matchedUser.password !== password) {
        setError('Incorrect username or password.');
        setLoading(false);
        return;
      }

      // Success login
      setTimeout(() => {
        onLoginSuccess({
          mode: 'shared',
          user: { displayName: matchedUser.username, email: `${matchedUser.username}@rosewoodaudio.local` },
          username: matchedUser.username,
          password
        });
        setLoading(false);
      }, 1000);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-page">

      {/* Left — Brand Panel */}
      <div className="login-brand-panel">
        <div className="brand-panel-inner">
          <div className="brand-lockup">
            <div className="brand-icon-wrap">
              <Music size={22} strokeWidth={1.5} />
            </div>
            <span className="brand-wordmark">Rosewood Audio</span>
          </div>

          <div className="brand-hero-text">
            <h1>Your music.<br />Exactly as it<br />was recorded.</h1>
            <p>
              No algorithms. No ads. No compression.<br />
              Just your collection — in full resolution,<br />
              exactly the way the artist intended.
            </p>
          </div>

          <div className="brand-qualities">
            <div className="quality-item">
              <span className="quality-dot"></span>
              <span>Lossless local playback</span>
            </div>
            <div className="quality-item">
              <span className="quality-dot"></span>
              <span>Learns your taste over time</span>
            </div>
            <div className="quality-item">
              <span className="quality-dot"></span>
              <span>Zero data sent to external servers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right — Auth Panel */}
      <div className="login-auth-panel">
        <div className="auth-panel-inner">

          {error && (
            <div className="error-box">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'select' && (
            <>
              <div className="auth-heading">
                <h2>How would you like to listen?</h2>
                <p>Choose how Rosewood Audio connects to your music.</p>
              </div>

              <div className="options-grid">
                <button className="option-btn hover-scale" onClick={handleLocalMode}>
                  <div className="option-icon-wrap">
                    <HardDrive size={20} strokeWidth={1.5} />
                  </div>
                  <div className="option-info">
                    <h3>My Hard Drive</h3>
                    <p>Play directly from your machine. Fully offline. Completely private.</p>
                  </div>
                  <ArrowRight className="arrow" size={16} />
                </button>

                <button className="option-btn hover-scale" onClick={() => { setMode('shared'); setIsSignUp(false); }}>
                  <div className="option-icon-wrap">
                    <Users size={20} strokeWidth={1.5} />
                  </div>
                  <div className="option-info">
                    <h3>Shared Library</h3>
                    <p>Listen to the shared 5TB music vault. View-only access (restricted uploads).</p>
                  </div>
                  <ArrowRight className="arrow" size={16} />
                </button>
              </div>

              <p className="auth-footnote">
                Rosewood Audio does not collect, sell, or process any of your personal data.
              </p>
            </>
          )}

          {mode === 'shared' && (
            <>
              <div className="auth-heading">
                <button className="back-link" onClick={() => setMode('select')}>← Back</button>
                <h2>{isSignUp ? 'Create an Account' : 'Sign in to Library'}</h2>
                <p>
                  {isSignUp 
                    ? 'Register your profile to track your listening history and playlists.' 
                    : 'Access the shared 5TB music library. Write and upload rights are restricted to the owner.'}
                </p>
              </div>

              <form onSubmit={handleSharedSubmit}>
                <div className="input-group">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {isSignUp && (
                  <div className="input-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      placeholder="••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading 
                    ? (isSignUp ? 'Creating Profile…' : 'Verifying…') 
                    : (isSignUp ? 'Sign Up' : 'Access Library')}
                </button>
              </form>

              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <button 
                  onClick={toggleAuthMode}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-coral)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {isSignUp ? 'Already have an account? Sign In' : 'First time? Create an Account'}
                </button>
              </div>

              <p className="auth-footnote" style={{ marginTop: '20px' }}>
                Only the library owner can add or modify files in the 5TB storage.
              </p>
            </>
          )}

        </div>
      </div>

    </div>
  );
}
