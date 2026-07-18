/**
 * Extracts a dominant or average color from an image URL.
 * 
 * @param {string} imageUrl - The source of the image
 * @returns {Promise<string>} - Returns an RGB string like 'rgb(255, 0, 0)'
 */
export const extractDominantColor = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Scale down for performance
        canvas.width = 50;
        canvas.height = 50;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < imageData.length; i += 4) {
          // skip fully transparent pixels
          if (imageData[i + 3] < 128) continue;
          
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }
        
        if (count === 0) {
          resolve('var(--accent-rose)'); // fallback
          return;
        }
        
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        // Boost saturation/brightness slightly so it's readable
        const boost = 1.2;
        r = Math.min(255, Math.floor(r * boost));
        g = Math.min(255, Math.floor(g * boost));
        b = Math.min(255, Math.floor(b * boost));
        
        // Ensure it's not too dark (for readability)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        if (luminance < 80) {
          r = Math.min(255, r + 60);
          g = Math.min(255, g + 60);
          b = Math.min(255, b + 60);
        }
        
        resolve(`rgb(${r}, ${g}, ${b})`);
      } catch (err) {
        console.warn('Color extraction failed (CORS or other issue):', err);
        resolve('var(--accent-rose)'); // fallback
      }
    };
    
    img.onerror = () => {
      resolve('var(--accent-rose)'); // fallback
    };
    
    img.src = imageUrl;
  });
};
