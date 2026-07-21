export const QUALITY_LEVELS = {
  high: 'original',      
  standard: 'original',  
  low: 'original'         
};

/**
 * Parses the browser's connection speed.
 */
export function getAutoQualityLevel() {
  return QUALITY_LEVELS.high;
}

/**
 * Returns the audio URL.
 * (Note: We previously injected Cloudinary bitrate transformations like b_128k,
 * but Cloudinary's on-the-fly audio processing causes a massive 5-10 second TTFB delay
 * on first play. To ensure instant playback, we now serve the original fast CDN url).
 * 
 * @param {string} url - The original audio URL
 * @param {string} quality - 'auto', 'high', 'standard', or 'low'
 * @returns {string} The original fast URL
 */
export function getQualityTransformedUrl(url, quality = 'auto') {
  return url;
}
