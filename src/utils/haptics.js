import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Utility for triggering device haptic feedback using Capacitor.
 */
export const triggerHaptic = async (type = 'light') => {
  const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

  try {
    if (isNative) {
      switch (type) {
        case 'light':
          await Haptics.impact({ style: ImpactStyle.Light });
          break;
        case 'medium':
          await Haptics.impact({ style: ImpactStyle.Medium });
          break;
        case 'heavy':
          await Haptics.impact({ style: ImpactStyle.Heavy });
          break;
        case 'success':
          await Haptics.notification({ type: NotificationType.Success });
          break;
        case 'error':
          await Haptics.notification({ type: NotificationType.Error });
          break;
        default:
          await Haptics.impact({ style: ImpactStyle.Light });
      }
    } else {
      // Web fallback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        switch (type) {
          case 'light': navigator.vibrate(10); break;
          case 'medium': navigator.vibrate(20); break;
          case 'heavy': navigator.vibrate(40); break;
          case 'success': navigator.vibrate([10, 50, 10]); break;
          case 'error': navigator.vibrate([10, 50, 10, 50, 10]); break;
          default: navigator.vibrate(10);
        }
      }
    }
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
};
