// AUTO-GENERATED from design/design.json by scripts/gen-tokens.js. Do not edit by hand.
export const colors = {
  "background": "#F6F6F8",
  "surface": "#FFFFFF",
  "surfaceMuted": "#F1F1F4",
  "textPrimary": "#111114",
  "textSecondary": "#6B6B76",
  "textTertiary": "#A0A0AB",
  "border": "#E8E8EE",
  "accent": "#FF6B6B",
  "onAccent": "#FFFFFF",
  "success": "#2FBF83",
  "warning": "#F5A524",
  "danger": "#E5484D",
  "overlay": "rgba(17,17,20,0.45)",
  "bubbleApp": "#F1F1F4",
  "bubbleAppText": "#111114",
  "bubbleUserText": "#FFFFFF",
  "splashBackground": "#FF6B6B"
} as const;
export type ColorToken = keyof typeof colors;

export const projectPalette = [
  {
    "key": "coral",
    "label": "Coral",
    "hex": "#FF6B6B",
    "onColor": "#FFFFFF"
  },
  {
    "key": "purple",
    "label": "Purple",
    "hex": "#5E3EA6",
    "onColor": "#FFFFFF"
  },
  {
    "key": "sunshine",
    "label": "Sunshine",
    "hex": "#FFE27A",
    "onColor": "#111114"
  },
  {
    "key": "sky",
    "label": "Sky",
    "hex": "#7DD3FC",
    "onColor": "#111114"
  },
  {
    "key": "mint",
    "label": "Mint",
    "hex": "#5FD3A5",
    "onColor": "#111114"
  },
  {
    "key": "tangerine",
    "label": "Tangerine",
    "hex": "#FF9F5A",
    "onColor": "#111114"
  },
  {
    "key": "rose",
    "label": "Rose",
    "hex": "#F472B6",
    "onColor": "#FFFFFF"
  },
  {
    "key": "indigo",
    "label": "Indigo",
    "hex": "#4F6BED",
    "onColor": "#FFFFFF"
  },
  {
    "key": "ink",
    "label": "Ink",
    "hex": "#1F1F24",
    "onColor": "#FFFFFF"
  }
] as const;
export type ProjectColorKey = (typeof projectPalette)[number]['key'];

export const spacing = {
  "xs": 4,
  "sm": 8,
  "md": 12,
  "lg": 16,
  "xl": 20,
  "xxl": 24,
  "huge": 32
} as const;
export const radii = {
  "sm": 10,
  "md": 16,
  "lg": 24,
  "xl": 32,
  "pill": 999
} as const;

export const typography = {
  fontFamily: {"regular":"Inter_400Regular","medium":"Inter_500Medium","semibold":"Inter_600SemiBold","bold":"Inter_700Bold"},
  dynamicType: true,
  maxFontScale: 2,
  scale: {
  "display": {
    "size": 28,
    "lineHeight": 34,
    "weight": "bold"
  },
  "title": {
    "size": 22,
    "lineHeight": 28,
    "weight": "bold"
  },
  "heading": {
    "size": 18,
    "lineHeight": 24,
    "weight": "semibold"
  },
  "body": {
    "size": 15,
    "lineHeight": 22,
    "weight": "regular"
  },
  "label": {
    "size": 13,
    "lineHeight": 18,
    "weight": "semibold"
  },
  "caption": {
    "size": 11,
    "lineHeight": 14,
    "weight": "medium",
    "letterSpacing": 0.6,
    "transform": "uppercase"
  }
},
} as const;
export type TypeScaleKey = keyof typeof typography.scale;

export const elevation = {
  "card": {
    "shadowColor": "#111114",
    "shadowOpacity": 0.08,
    "shadowRadius": 24,
    "shadowOffset": {
      "width": 0,
      "height": 10
    },
    "androidElevation": 6
  },
  "floating": {
    "shadowColor": "#111114",
    "shadowOpacity": 0.14,
    "shadowRadius": 20,
    "shadowOffset": {
      "width": 0,
      "height": 8
    },
    "androidElevation": 10
  }
} as const;

export const components = {
  "button": {
    "primary": {
      "bg": "accent",
      "text": "onAccent",
      "height": 56,
      "radius": "pill",
      "typography": "label"
    },
    "secondary": {
      "bg": "surfaceMuted",
      "text": "textPrimary",
      "height": 56,
      "radius": "pill"
    },
    "icon": {
      "size": 48,
      "radius": "pill",
      "bg": "surface",
      "border": "border"
    }
  },
  "chip": {
    "height": 28,
    "paddingH": 10,
    "radius": "pill",
    "typography": "caption"
  },
  "input": {
    "height": 56,
    "radius": "md",
    "bg": "surfaceMuted",
    "focusBorder": "accent",
    "errorBorder": "danger"
  },
  "sheet": {
    "radiusTop": "xl",
    "handle": {
      "w": 40,
      "h": 4,
      "color": "border"
    },
    "bg": "surface",
    "backdrop": "overlay"
  },
  "bottomBar": {
    "height": 64,
    "radius": "pill",
    "bg": "surface",
    "elevation": "floating",
    "margin": 16
  },
  "swatchPicker": {
    "swatchSize": 44,
    "gap": 12,
    "selected": {
      "ring": 3,
      "ringColor": "textPrimary",
      "innerGap": 3,
      "checkIcon": true
    },
    "a11yLabel": "{label} colour"
  },
  "chatBubble": {
    "app": {
      "bg": "bubbleApp",
      "text": "bubbleAppText",
      "radius": {
        "tl": 6,
        "tr": 20,
        "br": 20,
        "bl": 20
      },
      "maxWidth": "82%",
      "typography": "body"
    },
    "user": {
      "bg": "activeAccent",
      "text": "bubbleUserText",
      "radius": {
        "tl": 20,
        "tr": 6,
        "br": 20,
        "bl": 20
      },
      "maxWidth": "82%",
      "typography": "body",
      "activeAccentRule": "accent by default; switches to the chosen project colour once a colour is picked"
    },
    "typing": {
      "dots": 3,
      "size": 6,
      "color": "textTertiary",
      "durationMs": 450
    }
  },
  "quickChip": {
    "height": 44,
    "paddingH": 16,
    "radius": "pill",
    "bg": "surface",
    "border": "border",
    "selected": {
      "bg": "textPrimary",
      "text": "#FFFFFF"
    },
    "typography": "label"
  },
  "avatarTile": {
    "size": 64,
    "radius": "lg",
    "bg": "projectSoftTint",
    "selected": {
      "ring": 3,
      "ringColor": "textPrimary"
    },
    "a11yLabel": "{label}"
  },
  "avatarBadge": {
    "sizes": {
      "list": 48,
      "hero": 120,
      "detail": 160
    },
    "radius": "lg",
    "bg": "projectSoftTint",
    "completed": {
      "saturation": 0.4,
      "checkBadge": true
    }
  }
} as const;
export const statusStyles = {
  "payment": {
    "unpaid": {
      "label": "Unpaid",
      "fg": "danger",
      "bg": "rgba(229,72,77,0.12)"
    },
    "partially_paid": {
      "label": "Partly paid",
      "fg": "warning",
      "bg": "rgba(245,165,36,0.16)"
    },
    "paid": {
      "label": "Paid",
      "fg": "success",
      "bg": "rgba(47,191,131,0.14)"
    },
    "overpaid": {
      "label": "Overpaid",
      "fg": "accent",
      "bg": "rgba(255,107,107,0.14)"
    },
    "not_applicable": {
      "label": "No cost",
      "fg": "textSecondary",
      "bg": "surfaceMuted"
    }
  },
  "completion": {
    "open": "Open",
    "in_progress": "In progress",
    "completed": "Done",
    "cancelled": "Cancelled"
  }
} as const;
export const motion = {
  "duration": {
    "fast": 120,
    "base": 220,
    "slow": 360
  },
  "easing": "cubic-bezier(0.2, 0.8, 0.2, 1)",
  "reduceMotion": "replace transitions with 0ms fades",
  "chat": {
    "bubbleIn": "slide-up 12px + fade, 220ms",
    "inputDockSwap": "cross-fade 160ms",
    "reduceMotion": "no slide, instant"
  }
} as const;
export const accessibility = {
  "minTouchTarget": 48,
  "contrast": "WCAG AA",
  "labelsRequired": true,
  "colorNeverSoleIndicator": "status always has text label"
} as const;
