import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';
import { AppText } from './ui/Text';
import { Button } from './ui/Button';
import { BrandMark } from './BrandMark';

interface LockScreenProps {
  authenticating: boolean;
  error: string | null;
  onUnlock: () => void;
}

/** Lock screen per design/entry.json — device credential/biometric only, no app PIN. */
export function LockScreen({ authenticating, error, onUnlock }: LockScreenProps) {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <BrandMark size={64} />
        <AppText type="title" style={styles.title}>
          welcome back
        </AppText>
        <AppText type="body" color="textSecondary" style={styles.subtitle}>
          unlock with your phone&apos;s security
        </AppText>
        {error ? (
          <AppText type="label" color="danger" style={styles.error}>
            {error}
          </AppText>
        ) : null}
        <Button
          label={authenticating ? 'UNLOCKING…' : 'UNLOCK'}
          onPress={onUnlock}
          loading={authenticating}
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
  title: {
    marginTop: spacing.lg,
  },
  subtitle: {
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: spacing.lg,
  },
});
