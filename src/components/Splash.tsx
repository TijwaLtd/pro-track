import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, motion, spacing, typography } from '../theme/tokens';
import { BrandMark } from './BrandMark';
import { AppText } from './ui/Text';

/** Splash per design/entry.json: coral background, centred logo + wordmark. */
export function Splash({ visible = true }: { visible?: boolean }) {
  const [scale] = useState(() => new Animated.Value(0.9));
  const [opacity] = useState(() => new Animated.Value(0));
  const [tagline] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: motion.duration.base,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.duration.base,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.timing(tagline, {
      toValue: 1,
      duration: motion.duration.base,
      delay: 150,
      useNativeDriver: true,
    }).start();
  }, [scale, opacity, tagline]);

  if (!visible) return null;

  return (
    <View style={styles.root}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <BrandMark size={96} />
      </Animated.View>
      <Animated.View style={{ opacity }}>
        <AppText
          type="title"
          color="#FFFFFF"
          style={styles.wordmark}
        >
          ProTrack
        </AppText>
      </Animated.View>
      <Animated.View style={{ opacity: tagline }}>
        <AppText type="caption" color="rgba(255,255,255,0.8)" style={styles.tagline}>
          keep your projects close
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.splashBackground,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  wordmark: {
    marginTop: spacing.lg,
    fontFamily: typography.fontFamily.bold,
  },
  tagline: {
    textTransform: 'none',
  },
});
