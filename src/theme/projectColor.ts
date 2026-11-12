import { projectPalette, ProjectColorKey, colors } from './tokens';

export interface ProjectColor {
  key: ProjectColorKey;
  label: string;
  hex: string;
  onColor: string;
}

const FALLBACK_KEY: ProjectColorKey = 'coral';

export function getProjectColor(key: string | null | undefined): ProjectColor {
  const found = projectPalette.find((p) => p.key === key);
  if (found) return found;
  return projectPalette.find((p) => p.key === FALLBACK_KEY)!;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** mix(color, other, ratio) — ratio is the weight of `other` (0..1). */
export function mix(hexA: string, hexB: string, ratioB: number): string {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex(ar + (br - ar) * ratioB, ag + (bg - ag) * ratioB, ab + (bb - ab) * ratioB);
}

export function softTint(hex: string): string {
  return mix(hex, '#FFFFFF', 0.82);
}

export function midTint(hex: string): string {
  return mix(hex, '#FFFFFF', 0.55);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Palette onColor, falling back to near-black when contrast < 4.5:1 (design.json textOnColor rule). */
export function onColorFor(color: ProjectColor): string {
  if (contrastRatio(color.hex, color.onColor) >= 4.5) return color.onColor;
  if (contrastRatio(color.hex, colors.textPrimary) >= 4.5) return colors.textPrimary;
  return color.onColor;
}

export function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export interface DecorativeArt {
  /** Two other palette colours chosen deterministically from the seed, excluding the project's own colour. */
  shapeColors: [string, string];
  shapes: ('semicircle-bottom' | 'large-circle-offset' | 'small-dot-a' | 'small-dot-b')[];
}

export function decorativeArt(seed: string, ownKey: ProjectColorKey): DecorativeArt {
  const others = projectPalette.filter((p) => p.key !== ownKey);
  const h = hashString(seed);
  const c1 = others[h % others.length];
  const c2 = others[(h >> 8) % others.length];
  return {
    shapeColors: [c1.hex, c2.hex],
    shapes: ['semicircle-bottom', 'large-circle-offset', 'small-dot-a', 'small-dot-b'],
  };
}
