// Generates src/theme/tokens.ts from design/design.json.
// Run: node scripts/gen-tokens.js
const fs = require('fs');
const path = require('path');

const design = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'design', 'design.json'), 'utf8'));

const out = `// AUTO-GENERATED from design/design.json by scripts/gen-tokens.js. Do not edit by hand.
export const colors = ${JSON.stringify(design.colors, null, 2)} as const;
export type ColorToken = keyof typeof colors;

export const projectPalette = ${JSON.stringify(design.projectPalette, null, 2)} as const;
export type ProjectColorKey = (typeof projectPalette)[number]['key'];

export const spacing = ${JSON.stringify(design.spacing, null, 2)} as const;
export const radii = ${JSON.stringify(design.radii, null, 2)} as const;

export const typography = {
  fontFamily: ${JSON.stringify(design.typography.fontFamily)},
  dynamicType: ${JSON.stringify(design.typography.dynamicType)},
  maxFontScale: ${JSON.stringify(design.typography.maxFontScale)},
  scale: ${JSON.stringify(design.typography.scale, null, 2)},
} as const;
export type TypeScaleKey = keyof typeof typography.scale;

export const elevation = ${JSON.stringify(design.elevation, null, 2)} as const;

export const components = ${JSON.stringify(design.components, null, 2)} as const;
export const statusStyles = ${JSON.stringify(design.statusStyles, null, 2)} as const;
export const motion = ${JSON.stringify(design.motion, null, 2)} as const;
export const accessibility = ${JSON.stringify(design.accessibility, null, 2)} as const;
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'theme', 'tokens.ts'), out);
console.log('wrote src/theme/tokens.ts');
