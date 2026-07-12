export const trackEvent = async (action, songData) => {
  const endpoint = import.meta.env.VITE_GOOGLE_SHEET_ENDPOINT;
  if (!endpoint) {
    console.warn('VITE_GOOGLE_SHEET_ENDPOINT is not set. Tracking disabled.');
    return;
  }

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      action: action,
      songId: songData?.id || 'unknown',
      title: songData?.title || 'unknown',
      artist: songData?.artist || 'unknown',
      genre: songData?.genre || 'unknown',
    };

    // We use no-cors to avoid CORS preflight issues with Google Apps Script
    // Note: With no-cors, we can't read the response, but it still successfully sends.
    await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log(`[Tracker] Logged ${action} for ${payload.title}`);
  } catch (err) {
    console.error('[Tracker] Failed to log event:', err);
  }
};
