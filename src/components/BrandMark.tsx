import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/tokens';

/** White rounded square with coral flag/check glyph — the ProTrack logo mark. */
export function BrandMark({ size = 96 }: { size?: number }) {
  const poleW = Math.max(3, size * 0.045);
  const flagW = size * 0.3;
  const flagH = size * 0.2;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          shadowRadius: size * 0.16,
          shadowOffset: { width: 0, height: size * 0.06 },
        },
      ]}
    >
      {/* flag on pole */}
      <View style={[styles.pole, { width: poleW, height: size * 0.34, left: size * 0.3, top: size * 0.2 }]} />
      <View style={[styles.flag, { width: flagW, height: flagH, left: size * 0.3 + poleW, top: size * 0.2 }]} />
      {/* check */}
      <View
        style={[
          styles.check,
          {
            width: size * 0.3,
            height: size * 0.16,
            borderBottomWidth: Math.max(3, size * 0.07),
            borderRightWidth: Math.max(3, size * 0.07),
            borderBottomRightRadius: size * 0.06,
            marginTop: size * 0.12,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111114',
    shadowOpacity: 0.12,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  pole: {
    position: 'absolute',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  flag: {
    position: 'absolute',
    backgroundColor: colors.accent,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  check: {
    borderBottomColor: colors.accent,
    borderRightColor: colors.accent,
    transform: [{ rotate: '-45deg' }],
  },
});
