import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts,
} from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as Sharing from 'expo-sharing';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatFormHost } from '@/components/ChatFormHost';
import { LockRequiredScreen } from '@/components/LockRequiredScreen';
import { LockScreen } from '@/components/LockScreen';
import { Splash } from '@/components/Splash';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/Text';
import { getDb } from '@/db/database';
import { seedDemoDataIfEmpty } from '@/db/seed';
import { createBackup } from '@/features/backup/backup';
import { useAppLock } from '@/features/lock/useAppLock';
import { reconcileReminders } from '@/features/reminders/scheduler';
import { colors, spacing } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

const SPLASH_MIN_MS = 800;

type BootState = 'splash' | 'ready' | 'error';

/** Routes reminder-notification taps to the item screen. */
function NotificationTapHandler() {
  const router = useRouter();
  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      const itemId = data?.itemId;
      if (typeof itemId === 'string' && itemId) router.push(`/item/${itemId}` as never);
    };
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      open(res.notification.request.content.data as Record<string, unknown>);
    });
    const last = Notifications.getLastNotificationResponse?.();
    if (last) open(last.notification.request.content.data as Record<string, unknown>);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [boot, setBoot] = useState<BootState>('splash');
  const [bootError, setBootError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const bootStart = useRef(0);

  const onExportWhatIHave = useCallback(async () => {
    setExporting(true);
    try {
      const zipUri = await createBackup();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(zipUri, { mimeType: 'application/zip', dialogTitle: 'Export ProTrack backup', UTI: 'public.zip' });
      }
    } catch {
      // Best-effort salvage export; the error screen already shows the boot failure.
    } finally {
      setExporting(false);
    }
  }, []);

  // Privacy: block screenshots, screen recording and the recents preview on all screens.
  useEffect(() => {
    void ScreenCapture.preventScreenCaptureAsync();
    return () => {
      void ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  const runBoot = useCallback(async () => {
    bootStart.current = Date.now();
    setBoot('splash');
    setBootError(null);
    try {
      getDb(); // open DB, run migrations, verify FK + integrity
      seedDemoDataIfEmpty(); // demo data on first launch when the database is empty
      const elapsed = Date.now() - bootStart.current;
      if (elapsed < SPLASH_MIN_MS) {
        await new Promise((r) => setTimeout(r, SPLASH_MIN_MS - elapsed));
      }
      setBoot('ready');
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'Unknown error');
      setBoot('error');
    }
  }, []);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const t = setTimeout(() => void runBoot(), 0);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError, runBoot]);

  const lock = useAppLock(boot === 'ready');

  // Sync DB reminders -> OS notifications once the app is unlocked.
  useEffect(() => {
    if (lock.phase === 'unlocked') void reconcileReminders();
  }, [lock.phase]);

  const fontsReady = fontsLoaded || Boolean(fontError);
  const showSplash = !fontsReady || boot === 'splash' || lock.phase === 'checking';

  // Hide the native splash once the first real screen is ready.
  useEffect(() => {
    if (!showSplash) void SplashScreen.hideAsync();
  }, [showSplash]);

  let content: React.ReactNode;
  if (boot === 'error') {
    content = (
      <View style={styles.errorRoot}>
        <AppText type="title">Something went wrong</AppText>
        <AppText type="body" color="textSecondary" style={styles.errorBody}>
          {bootError}
        </AppText>
        <Button label="Retry" onPress={() => void runBoot()} style={styles.errorButton} />
        <Button
          label={exporting ? 'Exporting…' : 'Export what I have'}
          variant="secondary"
          onPress={() => void onExportWhatIHave()}
          disabled={exporting}
          style={styles.errorButton}
        />
      </View>
    );
  } else if (showSplash) {
    content = <Splash />;
  } else if (lock.phase === 'noLock') {
    content = (
      <LockRequiredScreen onLockFound={() => void lock.recheckEnrolment()} />
    );
  } else if (lock.phase === 'locked') {
    content = (
      <LockScreen
        authenticating={lock.authenticating}
        error={lock.authError}
        onUnlock={() => void lock.authenticate()}
      />
    );
  } else {
    content = (
      <>
        <Stack screenOptions={{ headerShown: false }} />
        <ChatFormHost />
        <NotificationTapHandler />
      </>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={showSplash ? 'light' : 'dark'} />
        {content}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorBody: {
    textAlign: 'center',
  },
  errorButton: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
