import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';

export interface NativeLiveKitRuntime {
  available: boolean;
  LiveKitRN: typeof import('@livekit/react-native') | null;
  LiveKitClient: typeof import('livekit-client') | null;
}

let initialized = false;
let cachedRuntime: NativeLiveKitRuntime | null = null;

function hasNativeWebRtcModule(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    if (NativeModules && NativeModules.WebRTCModule) {
      return true;
    }
    if (
      TurboModuleRegistry &&
      typeof TurboModuleRegistry.get === 'function' &&
      TurboModuleRegistry.get('WebRTCModule')
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Safely initializes @livekit/react-native WebRTC globals ONLY when the app
 * is running in a native APK / EAS Development Build containing WebRTCModule.
 * Inside Expo Go (which does not bundle WebRTCModule), this is a safe no-op.
 */
export function initNativeLiveKitIfAvailable(): NativeLiveKitRuntime {
  if (cachedRuntime) {
    return cachedRuntime;
  }

  if (!hasNativeWebRtcModule()) {
    cachedRuntime = { available: false, LiveKitRN: null, LiveKitClient: null };
    return cachedRuntime;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LiveKitRN = require('@livekit/react-native') as typeof import('@livekit/react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LiveKitClient = require('livekit-client') as typeof import('livekit-client');

    if (!initialized && typeof LiveKitRN.registerGlobals === 'function') {
      LiveKitRN.registerGlobals();
      initialized = true;
    }

    cachedRuntime = {
      available: true,
      LiveKitRN,
      LiveKitClient,
    };
    return cachedRuntime;
  } catch {
    cachedRuntime = { available: false, LiveKitRN: null, LiveKitClient: null };
    return cachedRuntime;
  }
}

export function isNativeLiveKitAvailable(): boolean {
  return initNativeLiveKitIfAvailable().available;
}
