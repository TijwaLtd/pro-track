#!/usr/bin/env python3
"""Generate Pro-Track/ProTrack app icons from the BrandMark geometry.

Brand: coral (#FF6B6B) flag-on-pole + check glyph — the inverse of the
in-app BrandMark (white tile, coral glyph) so it reads on any background.

Outputs (all in assets/images/):
  icon.png                      1024  coral bg + white glyph (iOS/general)
  android-icon-background.png  1024  solid coral (adaptive bg)
  android-icon-foreground.png  1024  transparent + white glyph, safe zone
  android-icon-monochrome.png  1024  transparent + white glyph silhouette
  splash-icon.png               512  transparent + white glyph
  favicon.png                    64  coral bg + white glyph
"""

from PIL import Image, ImageDraw
import math, os

CORAL = (255, 107, 107, 255)
WHITE = (255, 255, 255, 255)
BG = (246, 246, 248, 255)  # colors.background

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
SS = 4  # supersample factor


def glyph_draw(g: ImageDraw.ImageDraw, S: float, color, ox: float, oy: float, scale: float = 1.0):
    """Draw the flag+check glyph. Coordinates match BrandMark.tsx proportions
    (units of S, origin top-left), scaled by `scale` around the glyph centre."""
    cx, cy = 0.50 * S, 0.51 * S  # approx centre of the glyph block

    def P(x, y):
        return (ox + cx + (x * S - cx) * scale, oy + cy + (y * S - cy) * scale)

    pole_w = 0.045 * S * scale
    pole_x = 0.30 * S
    pole_top = 0.20 * S
    pole_h = 0.34 * S * scale
    px, py = P(pole_x, pole_top)
    g.rounded_rectangle([px, py, px + pole_w, py + pole_h], radius=max(2, pole_w / 2), fill=color)

    flag_x = pole_x + 0.045 * S
    flag_w = 0.30 * S * scale
    flag_h = 0.20 * S * scale
    flag_top = 0.20 * S
    fx, fy = P(flag_x, flag_top)
    r = min(4 * scale, flag_h * 0.2)
    g.rounded_rectangle([fx, fy, fx + flag_w, fy + flag_h], radius=r, fill=color)
    # square off the left corners (flag attaches to pole)
    g.rectangle([fx, fy, fx + r, fy + flag_h], fill=color)

    # check mark: polyline ✓ under the flag, like BrandMark's rotated border
    lw = max(3, 0.07 * S * scale)
    pts = [P(0.37, 0.71), P(0.465, 0.80), P(0.63, 0.665)]
    g.line(pts, fill=color, width=int(lw), joint='curve')
    # round the caps
    for p in (pts[0], pts[-1]):
        g.ellipse([p[0] - lw / 2, p[1] - lw / 2, p[0] + lw / 2, p[1] + lw / 2], fill=color)


def render(size: int, bg, glyph_color, glyph_scale: float, pad_ratio: float = 0.0):
    """Render at `size`, supersampled, returns PIL Image (RGB or RGBA)."""
    S = size * SS
    img = Image.new('RGBA', (S, S), bg)
    d = ImageDraw.Draw(img)
    usable = S * (1 - pad_ratio * 2)
    ox = (S - usable) / 2
    oy = (S - usable) / 2
    glyph_draw(d, usable, glyph_color, ox, oy, glyph_scale)
    img = img.resize((size, size), Image.LANCZOS)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)

    # App icon: coral bg, white glyph at ~52% width (glyph native width ~0.345*S,
    # scale 1.5 -> ~0.52*S)
    icon = render(1024, CORAL, WHITE, glyph_scale=1.5)
    icon.convert('RGB').save(os.path.join(OUT, 'icon.png'))

    # Android adaptive: solid coral background
    Image.new('RGB', (1024, 1024), CORAL).save(os.path.join(OUT, 'android-icon-background.png'))

    # Foreground: transparent, white glyph centred inside the ~66% safe zone.
    # pad_ratio 0.17 keeps the glyph within the inner 66% circle.
    fg = render(1024, (0, 0, 0, 0), WHITE, glyph_scale=1.15, pad_ratio=0.17)
    fg.save(os.path.join(OUT, 'android-icon-foreground.png'))

    # Monochrome: same silhouette (Android tints it)
    mono = render(1024, (0, 0, 0, 0), WHITE, glyph_scale=1.15, pad_ratio=0.17)
    mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))

    # Splash icon: transparent glyph, larger (splash imageWidth=76pt)
    splash = render(512, (0, 0, 0, 0), WHITE, glyph_scale=1.5)
    splash.save(os.path.join(OUT, 'splash-icon.png'))

    # Favicon: coral bg + white glyph
    fav = render(64, CORAL, WHITE, glyph_scale=1.5).convert('RGB')
    fav.save(os.path.join(OUT, 'favicon.png'))

    print('icons written to', OUT)


if __name__ == '__main__':
    main()
