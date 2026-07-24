/**
 * Smoothly tweens the volume of an HTMLAudioElement.
 * @param {HTMLAudioElement} audio - The audio element
 * @param {number} targetVol - The target volume (0.0 to 1.0)
 * @param {number} durationMs - Duration of the fade in milliseconds
 * @returns {Promise} Resolves when the tween is complete
 */
export function tweenVolume(audio, targetVol, durationMs = 300) {
  return new Promise(resolve => {
    if (!audio) return resolve();
    
    // Clear any existing tween interval to prevent fighting
    if (audio._tweenInterval) {
      clearInterval(audio._tweenInterval);
    }

    const startVol = audio.gainNode ? audio.gainNode.gain.value : audio.volume;
    const diff = targetVol - startVol;
    
    if (diff === 0 || durationMs <= 0) {
      if (audio.gainNode) audio.gainNode.gain.value = Math.max(0, Math.min(1, targetVol));
      else audio.volume = Math.max(0, Math.min(1, targetVol));
      return resolve();
    }

    const steps = 20; // Fixed number of steps for smoothness
    const stepTime = durationMs / steps;
    const volStep = diff / steps;
    let currentStep = 0;

    audio._tweenInterval = setInterval(() => {
      currentStep++;
      let nextVol = startVol + (volStep * currentStep);
      
      // Clamp bounds
      if (nextVol < 0) nextVol = 0;
      if (nextVol > 1) nextVol = 1;
      
      try {
        if (audio.gainNode) {
          audio.gainNode.gain.value = nextVol;
        } else {
          audio.volume = nextVol;
        }
      } catch (e) {
        // Handle edge cases where audio element might be destroyed
        clearInterval(audio._tweenInterval);
        resolve();
      }

      if (currentStep >= steps) {
        clearInterval(audio._tweenInterval);
        try {
          if (audio.gainNode) audio.gainNode.gain.value = Math.max(0, Math.min(1, targetVol));
          else audio.volume = Math.max(0, Math.min(1, targetVol));
        } catch(e){}
        resolve();
      }
    }, stepTime);
  });
}
