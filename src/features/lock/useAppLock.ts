import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getLockTimeout, type LockTimeout } from '../../db/repositories/settings';
import { authenticateWithDevice, getEnrolledLevel, hasPhoneLock, SecurityLevel } from './security';

export type LockPhase = 'checking' | 'noLock' | 'locked' | 'unlocked';

const TIMEOUT_MS: Record<LockTimeout, number> = {
  immediately: 0,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
};

/**
 * App access gate. The phone's own security (password/PIN/pattern, plus
 * biometrics when enrolled) is the only unlock — no app PIN, no bypass.
 * The lock gates the UI; it does not encrypt the database.
 */
export function useAppLock(enabled: boolean) {
  const [phase, setPhase] = useState<LockPhase>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const phaseRef = useRef<LockPhase>('checking');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const authenticate = useCallback(async () => {
    setAuthenticating(true);
    setAuthError(null);
    const result = await authenticateWithDevice();
    setAuthenticating(false);
    if (result.success) {
      setPhase('unlocked');
    } else {
      setAuthError('Not unlocked');
    }
  }, []);

  // Initial enrolment check + auto-authenticate.
  const checkEnrolment = useCallback(async () => {
    const level: SecurityLevel = await getEnrolledLevel();
    if (!hasPhoneLock(level)) {
      setPhase('noLock');
      return;
    }
    setPhase('locked');
    await authenticate();
  }, [authenticate]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => void checkEnrolment(), 0);
    return () => clearTimeout(t);
  }, [enabled, checkEnrolment]);

  // Relock when the app has been backgrounded longer than settings.lockTimeout.
  useEffect(() => {
    if (!enabled || phase === 'checking' || phase === 'noLock') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAt.current == null) backgroundedAt.current = Date.now();
        return;
      }
      if (state === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (phaseRef.current !== 'unlocked' || since == null) return;
        const timeout = TIMEOUT_MS[getLockTimeout()] ?? TIMEOUT_MS['30s'];
        if (Date.now() - since >= timeout) {
          setPhase('locked');
          void authenticate();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, phase, authenticate]);

  return { phase, authError, authenticating, authenticate, recheckEnrolment: checkEnrolment };
}
