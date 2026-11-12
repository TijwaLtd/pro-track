import { StyleSheet, View } from 'react-native';
import { decorativeArt, getProjectColor } from '../theme/projectColor';

interface DecorativeArtProps {
  /** Seed — typically project id — for deterministic shape colours. */
  seed: string;
  colorKey: string;
  /** 'hero' | 'list' | 'header' — controls shape scale. */
  variant?: 'hero' | 'list' | 'header';
  /** Extra shapes hidden behind content; pointerEvents none. */
  style?: object;
}

/** Flat decorative shapes over the project colour (design.json projectColorRules.decorativeArt). */
export function DecorativeArt({ seed, colorKey, variant = 'hero', style }: DecorativeArtProps) {
  const art = decorativeArt(seed, getProjectColor(colorKey).key);
  const [c1, c2] = art.shapeColors;
  const s = variant === 'list' ? 0.6 : variant === 'header' ? 0.8 : 1;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {/* semicircle bottom-centre */}
      <View
        style={[
          styles.semicircle,
          {
            backgroundColor: c1,
            opacity: 0.28,
            width: 220 * s,
            height: 110 * s,
            left: '30%',
            bottom: -55 * s,
            borderTopLeftRadius: 110 * s,
            borderTopRightRadius: 110 * s,
          },
        ]}
      />
      {/* large circle offset bottom-right */}
      <View
        style={[
          styles.circle,
          {
            backgroundColor: c2,
            opacity: 0.28,
            width: 180 * s,
            height: 180 * s,
            right: -50 * s,
            bottom: -60 * s,
          },
        ]}
      />
      {/* small dots */}
      <View style={[styles.dot, { backgroundColor: c1, opacity: 0.4, width: 14 * s, height: 14 * s, right: '22%', top: '18%' }]} />
      <View style={[styles.dot, { backgroundColor: c2, opacity: 0.4, width: 10 * s, height: 10 * s, left: '12%', bottom: '30%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  semicircle: { position: 'absolute' },
  circle: { position: 'absolute', borderRadius: 999 },
  dot: { position: 'absolute', borderRadius: 999 },
});
