import { getDb } from './database';
import { createItem } from './repositories/items';
import { createProject } from './repositories/projects';

/**
 * Demo seed: a single maize-farming project with its input costs.
 * Runs only when the projects table is empty, in development and production builds.
 * Amounts are whole KES -> minor units (x100).
 */

const KES = 'KES';
const toMinor = (kes: number) => kes * 100;

interface SeedItem {
  title: string;
  description: string;
  expectedKsh: number | null;
  avatar_key: string;
}

const ITEMS: SeedItem[] = [
  {
    title: 'Land leasing',
    description: 'Lease the farmland for the season.',
    expectedKsh: 57_000,
    avatar_key: 'baobab',
  },
  {
    title: 'Planting fertilizer',
    description: '15 bags for planting.',
    expectedKsh: 30_000,
    avatar_key: 'sunflower',
  },
  {
    title: 'Top dressing fertilizer',
    description: '15 bags for top dressing.',
    expectedKsh: 15_000,
    avatar_key: 'tulip',
  },
  {
    title: 'Seedlings',
    description: '15 acres × 10kg/acre; 2kg packets @ KES 900 (75 packets).',
    expectedKsh: 67_500,
    avatar_key: 'acacia',
  },
  {
    title: 'Ploughing',
    description: '15 acres @ KES 3,500/acre.',
    expectedKsh: 52_500,
    avatar_key: 'bamboo',
  },
  {
    title: 'Harrowing',
    description: '15 acres @ KES 3,000/acre.',
    expectedKsh: 45_000,
    avatar_key: 'cactus',
  },
  {
    title: 'Planting',
    description: '15 acres @ KES 3,000/acre.',
    expectedKsh: 45_000,
    avatar_key: 'lotus',
  },
  {
    title: 'Chemicals',
    description: '10 litres @ KES 7,500/litre.',
    expectedKsh: 75_000,
    avatar_key: 'aloe',
  },
];

/**
 * Seeds the demo project when the database has no projects.
 * Returns true when data was inserted. Safe to call anytime — it no-ops
 * on a non-empty database.
 */
export function seedDemoData(): boolean {
  const db = getDb();
  const row = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM projects');
  if ((row?.n ?? 0) > 0) return false;

  const project = createProject({
    name: 'Maize Farming',
    description: 'Maize farming project — land preparation, inputs and field operations.',
    currency_code: KES,
    color_key: 'sunshine',
  });

  for (const item of ITEMS) {
    createItem({
      project_id: project.id,
      title: item.title,
      description: item.description,
      expected_amount_minor: item.expectedKsh === null ? null : toMinor(item.expectedKsh),
      currency_code: KES,
      avatar_key: item.avatar_key,
    });
  }
  return true;
}

/** Auto-seed on first launch in any build when there are no projects yet. */
export function seedDemoDataIfEmpty(): void {
  seedDemoData();
}
