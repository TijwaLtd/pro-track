import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';
import { AppText } from './ui/Text';
import { Button } from './ui/Button';
import { getEnrolledLevel, hasPhoneLock } from '../features/lock/security';

interface LockRequiredScreenProps {
  onLockFound: () => void;
}

/** Shown when the phone has no screen lock — the app refuses to open. */
export function LockRequiredScreen({ onLockFound }: LockRequiredScreenProps) {
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    const level = await getEnrolledLevel();
    setChecking(false);
    if (hasPhoneLock(level)) onLockFound();
  };

  // Re-check automatically when the app returns to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void recheck();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <AppText style={styles.icon} accessibilityElementsHidden>
            🔒
          </AppText>
        </View>
        <AppText type="title" style={styles.title}>
          set a phone lock first
        </AppText>
        <AppText type="body" color="textSecondary" style={styles.body}>
          ProTrack keeps payment records, so it only opens on phones protected by a password, PIN or pattern.
        </AppText>
        <Button
          label="OPEN PHONE SETTINGS"
          onPress={() => void Linking.openSettings()}
          style={styles.button}
        />
        <Button
          label={checking ? 'CHECKING…' : "I've set it, check again"}
          variant="secondary"
          onPress={() => void recheck()}
          loading={checking}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
});
