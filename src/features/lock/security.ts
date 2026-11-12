import * as LocalAuthentication from 'expo-local-authentication';
import { SecurityLevel } from 'expo-local-authentication';

export { SecurityLevel };

/** DEVICE/CREDENTIAL or BIOMETRIC* — anything above NONE means the phone has a screen lock. */
export async function getEnrolledLevel(): Promise<SecurityLevel> {
  return LocalAuthentication.getEnrolledLevelAsync();
}

export function hasPhoneLock(level: SecurityLevel): boolean {
  return level !== SecurityLevel.NONE;
}

export async function authenticateWithDevice(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ProTrack',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return { success: result.success };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}
