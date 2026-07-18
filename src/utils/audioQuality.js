export const QUALITY_LEVELS = {
  high: 'b_320k',      // High fidelity
  standard: 'b_128k',  // Good balance
  low: 'b_64k'         // Data Saver
};

/**
 * Parses the browser's connection speed and returns the ideal Cloudinary bitrate string.
 */
export function getAutoQualityLevel() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return QUALITY_LEVELS.standard; // Fallback

  const type = connection.effectiveType; // 'slow-2g', '2g', '3g', or '4g'
  const saveData = connection.saveData; // true if user has enabled data saver mode

  if (saveData || type === 'slow-2g' || type === '2g') {
    return QUALITY_LEVELS.low;
  }
  if (type === '3g') {
    return QUALITY_LEVELS.standard;
  }
  return QUALITY_LEVELS.high;
}

/**
 * Injects a Cloudinary transformation (like b_128k) into the URL to force bitrate conversion.
 * 
 * @param {string} url - The original audio URL
 * @param {string} quality - 'auto', 'high', 'standard', or 'low'
 * @returns {string} The transformed URL (or original if not Cloudinary)
 */
export function getQualityTransformedUrl(url, quality = 'auto') {
  if (!url || typeof url !== 'string') return url;
  
  // Only intercept URLs that are hosted on Cloudinary
  if (!url.includes('res.cloudinary.com')) {
    return url;
  }

  // Determine the target transformation string
  let targetTransformation = '';
  if (quality === 'auto') {
    targetTransformation = getAutoQualityLevel();
  } else {
    targetTransformation = QUALITY_LEVELS[quality] || QUALITY_LEVELS.standard;
  }

  // Cloudinary URLs typically look like:
  // https://res.cloudinary.com/cloud_name/video/upload/v12345/filename.mp3
  // We want to safely insert our transformation between /upload/ and /v...
  
  // Strip any existing bitrate transformations first so we don't stack them
  let cleanUrl = url.replace(/\/upload\/(b_\d+k,?)?/, '/upload/');

  // If the url already had other transformations (like q_auto), we preserve them
  // For simplicity, we just inject the bitrate right after /upload/
  if (cleanUrl.includes('/upload/')) {
    return cleanUrl.replace('/upload/', `/upload/${targetTransformation}/`);
  }

  return cleanUrl;
}
