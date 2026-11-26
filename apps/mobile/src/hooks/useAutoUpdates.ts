import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

const CHECK_COOLDOWN_MS = 60_000;

/**
 * Silently checks for Expo EAS Over-The-Air (OTA) JS/UI updates on launch
 * and whenever the app returns to foreground. Never interrupts an active call;
 * surfaces a clean `updateReady` flag so the user can apply instantly or on next launch.
 */
export function useAutoUpdates() {
  const [updateReady, setUpdateReady] = useState(false);
  const [reloading, setReloading] = useState(false);
  const lastCheckAtRef = useRef(0);
  const checkingRef = useRef(false);

  const checkAndFetch = useCallback(async () => {
    if (__DEV__ || Platform.OS === 'web') return;
    if (!Updates.isEnabled) return;
    if (checkingRef.current) return;

    const now = Date.now();
    if (now - lastCheckAtRef.current < CHECK_COOLDOWN_MS) return;
    lastCheckAtRef.current = now;
    checkingRef.current = true;

    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) {
          setUpdateReady(true);
        }
      }
    } catch {
      // Never disturb the user on transient offline/network update check failures
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void checkAndFetch();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkAndFetch();
      }
    });
    return () => sub.remove();
  }, [checkAndFetch]);

  const applyUpdateNow = useCallback(async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setReloading(false);
    }
  }, [reloading]);

  return { updateReady, reloading, applyUpdateNow };
}
