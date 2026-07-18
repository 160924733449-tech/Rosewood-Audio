/**
 * Utility for triggering device haptic feedback.
 * Works primarily on Android and some desktop platforms.
 * iOS Safari has limited support for navigator.vibrate.
 */
export const triggerHaptic = (type = 'light') => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  try {
    switch (type) {
      case 'light':
        // A subtle tick
        navigator.vibrate(10);
        break;
      case 'medium':
        // A slightly stronger bump
        navigator.vibrate(20);
        break;
      case 'heavy':
        // A deep thud
        navigator.vibrate(40);
        break;
      case 'success':
        // Two quick bumps
        navigator.vibrate([10, 50, 10]);
        break;
      case 'error':
        // Three quick bumps
        navigator.vibrate([10, 50, 10, 50, 10]);
        break;
      default:
        navigator.vibrate(10);
    }
  } catch (error) {
    // Ignore errors on devices that don't support it or if policy blocks it
    console.warn('Haptic feedback failed:', error);
  }
};
