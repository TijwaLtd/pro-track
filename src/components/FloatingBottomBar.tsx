import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './ui/Text';
import { colors, components, radii, spacing } from '../theme/tokens';

interface FloatingBottomBarProps {
  onAdd: () => void;
  onSettings: () => void;
}

/** Floating bottom bar per design/home.json bottomBar. */
export function FloatingBottomBar({ onAdd, onSettings }: FloatingBottomBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={[styles.pill, styles.pillActive]} accessibilityRole="button" accessibilityLabel="Home">
          <AppText type="caption" color={colors.onAccent}>HOME</AppText>
        </View>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="New project"
          style={styles.iconBtn}
        >
          <AppText type="title" color="textPrimary">＋</AppText>
        </Pressable>
        <Pressable
          onPress={onSettings}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.iconBtn}
        >
          <AppText type="title" color="textPrimary">⚙</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: components.bottomBar.height,
    ...{
      shadowColor: '#111114',
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
  },
  pill: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.accent },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
