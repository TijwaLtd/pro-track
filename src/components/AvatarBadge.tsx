import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAvatar } from '../domain/avatars';
import { getProjectColor, mix, onColorFor, softTint } from '../theme/projectColor';
import { radii } from '../theme/tokens';
import { AvatarGlyph } from './AvatarGlyph';

interface AvatarBadgeProps {
  avatarKey: string;
  /** Project colour hex (or palette key) the badge tints against. */
  projectColor: string;
  /** Named size: list=48, hero=120, detail=160 (design.json avatarBadge.sizes). */
  size?: 'list' | 'hero' | 'detail' | number;
  completed?: boolean;
  onPress?: () => void;
}

const SIZE_MAP = { list: 48, hero: 120, detail: 160 } as const;

/**
 * Item avatar. Phase 0 fallback renders the emoji from design/avatars.json;
 * swap to bundled SVGs when assets/avatars/*.svg land.
 */
export function AvatarBadge({ avatarKey, projectColor, size = 'list', completed = false, onPress }: AvatarBadgeProps) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size];
  const avatar = getAvatar(avatarKey);
  const color = getProjectColor(projectColor);
  const glyphSize = Math.round(px * 0.55);
  const glyphColor = mix(color.hex, '#111114', 0.35);

  const inner = (
    <>
      <AvatarGlyph avatar={avatar} size={glyphSize} color={glyphColor} />
      {completed ? (
        <View style={[styles.check, { backgroundColor: onColorFor(color) }]}>
          <Text style={[styles.checkGlyph, { color: color.hex }]}>✓</Text>
        </View>
      ) : null}
    </>
  );

  const boxStyle = [
    styles.badge,
    {
      width: px,
      height: px,
      borderRadius: Math.min(radii.lg, px / 3),
      backgroundColor: softTint(color.hex),
      opacity: completed ? 0.6 : 1,
    },
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${avatar.label} avatar`}
        style={boxStyle}
      >
        {inner}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={`${avatar.label} avatar`} style={boxStyle}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    fontSize: 11,
    fontWeight: '700',
  },
});
