import React, { useState } from 'react';
import { HardDrive, Users, ArrowRight, AlertCircle, Music } from 'lucide-react';
import { loginUser, signupUser } from '../utils/googleSheetsHelper';

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

    try {
      if (isSignUp) {
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

        const res = await signupUser(username.toLowerCase(), password);
        if (!res) {
          setError('Registration failed or username already taken.');
          setLoading(false);
          return;
        }

        onLoginSuccess({
          mode: 'shared',
          user: { displayName: res.username },
          username: res.username
        });
      } else {
        const res = await loginUser(username.toLowerCase(), password);
        if (!res) {
          setError('Incorrect username or password.');
          setLoading(false);
          return;
        }

        onLoginSuccess({
          mode: 'shared',
          user: { displayName: res.username },
          username: res.username
        });
      }
    } catch (err) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
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
            <div className="brand-icon-wrap" style={{ padding: 0, background: 'transparent' }}>
              <img src="/icon.png" alt="Reson8 Logo" style={{ width: '64px', height: '64px', objectFit: 'contain', transform: 'scale(1.5)' }} />
            </div>
            <span className="brand-wordmark">Reson8</span>
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
                <p>
                  Connect to your personal offline sanctuary or enter the shared vault. 
                  Experience uncompromised, lossless audio wherever your music lives.
                </p>
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
                Reson8 does not collect, sell, or process any of your personal data.
              </p>
            </>
          )}

          {mode === 'shared' && (
            <>
              <div className="auth-heading">
                <button className="back-link" onClick={() => setMode('select')}>← Back</button>
                <h2>{isSignUp ? 'Join the Experience' : 'Welcome Back'}</h2>
                <p>
                  {isSignUp 
                    ? 'Step into a world of uncompromising high-fidelity audio. Create your profile to start curating a sanctuary of sound perfectly tailored to your tastes.' 
                    : 'Unlock the vault. Immerse yourself in a curated 5TB collection of lossless music, preserved exactly as the artists intended.'}
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
