import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native';

import type { AvatarDef } from '../domain/avatars';
import { colors } from '../theme/tokens';

const FAMILIES = {
  MaterialCommunityIcons,
  Ionicons,
} as const;

interface AvatarGlyphProps {
  avatar: AvatarDef;
  /** Rendered size in px (icon glyph or emoji font size). */
  size: number;
  color?: string;
}

/** Renders an avatar's visual: vector icon when defined, emoji otherwise. */
export function AvatarGlyph({ avatar, size, color = colors.textPrimary }: AvatarGlyphProps) {
  if (avatar.icon) {
    const Icon = FAMILIES[avatar.icon.family];
    return <Icon name={avatar.icon.name as never} size={size} color={color} />;
  }
  return (
    <Text style={{ fontSize: size }} allowFontScaling={false}>
      {avatar.emoji}
    </Text>
  );
}
