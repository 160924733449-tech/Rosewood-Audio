// Google OAuth 2.0 helper using raw browser authentication flows.

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets'
].join(' ');

let tokenClient = null;

export function initGoogleAuth(clientId, onTokenCallback) {
  return new Promise((resolve) => {
    // Load GIS script dynamically if not present
    if (document.getElementById('google-gis-client')) {
      setupTokenClient();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.id = 'google-gis-client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setupTokenClient();
    };
    document.body.appendChild(script);

    function setupTokenClient() {
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              console.error('GIS authentication error:', tokenResponse);
              return;
            }
            // Save token
            localStorage.setItem('aura_g_access_token', tokenResponse.access_token);
            localStorage.setItem('aura_g_expires_at', Date.now() + (tokenResponse.expires_in * 1000));
            
            // Get user details
            fetchUserInfo(tokenResponse.access_token).then(userInfo => {
              onTokenCallback({
                token: tokenResponse.access_token,
                user: userInfo
              });
            });
          },
        });
        resolve(true);
      } else {
        console.error('Google Accounts client failed to initialize.');
        resolve(false);
      }
    }
  });
}

export function requestGoogleAccessToken() {
  if (tokenClient) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    alert('Google Auth client not initialized. Please enter a valid Client ID first.');
  }
}

export function getCachedToken() {
  const token = localStorage.getItem('aura_g_access_token');
  const expiresAt = localStorage.getItem('aura_g_expires_at');
  
  if (token && expiresAt && Date.now() < parseInt(expiresAt)) {
    return token;
  }
  return null;
}

export function logoutGoogle() {
  localStorage.removeItem('aura_g_access_token');
  localStorage.removeItem('aura_g_expires_at');
  localStorage.removeItem('aura_g_user');
}

async function fetchUserInfo(token) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('aura_g_user', JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.error('Failed to fetch user info:', err);
  }
  return null;
}
