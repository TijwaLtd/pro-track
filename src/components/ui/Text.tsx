import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, typography, type TypeScaleKey } from '../../theme/tokens';

const FONT_FAMILY: Record<string, string> = {
  regular: typography.fontFamily.regular,
  medium: typography.fontFamily.medium,
  semibold: typography.fontFamily.semibold,
  bold: typography.fontFamily.bold,
};

interface AppTextProps extends TextProps {
  type?: TypeScaleKey;
  color?: keyof typeof colors | (string & {});
}

export function AppText({ type = 'body', color = 'textPrimary', style, ...rest }: AppTextProps) {
  const scale = typography.scale[type] as {
    size: number;
    lineHeight: number;
    weight: string;
    letterSpacing?: number;
    transform?: string;
  };
  const textStyle: TextStyle = {
    fontSize: scale.size,
    lineHeight: scale.lineHeight,
    fontFamily: FONT_FAMILY[scale.weight] ?? FONT_FAMILY.regular,
    ...(scale.letterSpacing ? { letterSpacing: scale.letterSpacing } : {}),
    ...(scale.transform === 'uppercase' ? { textTransform: 'uppercase' } : {}),
    color: color in colors ? colors[color as keyof typeof colors] : color,
  };
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={typography.maxFontScale}
      style={[textStyle, style]}
    />
  );
}
