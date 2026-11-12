import avatarsSpec from '../../design/avatars.json';

export type IconFamily = 'MaterialCommunityIcons' | 'Ionicons';

export interface AvatarIcon {
  family: IconFamily;
  name: string;
}

export interface AvatarDef {
  key: string;
  label: string;
  emoji: string;
  /** When set, render a vector icon glyph instead of the emoji. */
  icon?: AvatarIcon;
}

export interface AvatarGroup {
  id: string;
  label: string;
  items: AvatarDef[];
}

const mci = (name: string): AvatarIcon => ({ family: 'MaterialCommunityIcons', name });

function iconAvatars(entries: [string, string][]): AvatarDef[] {
  return entries.map(([name, label]) => ({
    key: `icon-mci-${name}`,
    label,
    emoji: '',
    icon: mci(name),
  }));
}

/** Curated @expo/vector-icons sets, grouped for the avatar picker tabs. */
const ICON_GROUPS: AvatarGroup[] = [
  {
    id: 'icons-farm',
    label: 'Farm',
    items: iconAvatars([
      ['grass', 'Grass'],
      ['sprout', 'Sprout'],
      ['wheat', 'Wheat'],
      ['flower', 'Flower'],
      ['flower-tulip', 'Tulip'],
      ['tree', 'Tree'],
      ['leaf', 'Leaf'],
      ['water', 'Water'],
      ['weather-sunny', 'Sunny'],
      ['weather-rainy', 'Rain'],
      ['fire', 'Fire'],
      ['snowflake', 'Snow'],
    ]),
  },
  {
    id: 'icons-money',
    label: 'Money',
    items: iconAvatars([
      ['cash', 'Cash'],
      ['cash-multiple', 'Cash stack'],
      ['bank', 'Bank'],
      ['piggy-bank', 'Savings'],
      ['cash-register', 'Till'],
      ['hand-coin', 'Payment'],
      ['chart-line', 'Trend'],
      ['wallet', 'Wallet'],
      ['credit-card', 'Card'],
      ['receipt', 'Receipt'],
      ['package', 'Package'],
      ['cart', 'Cart'],
      ['truck', 'Truck'],
      ['basket', 'Basket'],
      ['store', 'Store'],
    ]),
  },
  {
    id: 'icons-plans',
    label: 'Plans',
    items: iconAvatars([
      ['calendar', 'Calendar'],
      ['calendar-clock', 'Schedule'],
      ['clock-outline', 'Clock'],
      ['alarm', 'Alarm'],
      ['bell-outline', 'Reminder'],
      ['flag', 'Flag'],
      ['flag-checkered', 'Finish'],
      ['map-marker', 'Location'],
      ['compass', 'Compass'],
      ['target', 'Target'],
    ]),
  },
  {
    id: 'icons-files',
    label: 'Files',
    items: iconAvatars([
      ['file-document', 'Document'],
      ['file-pdf-box', 'PDF'],
      ['clipboard-text', 'Checklist'],
      ['note-text', 'Notes'],
      ['pencil', 'Edit'],
      ['book-open', 'Book'],
      ['archive', 'Archive'],
    ]),
  },
  {
    id: 'icons-life',
    label: 'Life',
    items: iconAvatars([
      ['account-group', 'Team'],
      ['account', 'Person'],
      ['heart', 'Heart'],
      ['home', 'Home'],
      ['paw', 'Pet'],
      ['dog', 'Dog'],
      ['cat', 'Cat'],
      ['fish', 'Fish'],
      ['bird', 'Bird'],
      ['bug', 'Bug'],
      ['bicycle', 'Bike'],
      ['car', 'Car'],
      ['bus', 'Bus'],
      ['airplane', 'Flight'],
      ['gift', 'Gift'],
      ['star', 'Star'],
      ['crown', 'Award'],
      ['trophy', 'Trophy'],
      ['school', 'School'],
      ['hospital', 'Health'],
      ['pill', 'Medicine'],
      ['tools', 'Tools'],
      ['hammer', 'Hammer'],
      ['wrench', 'Wrench'],
    ]),
  },
];

export const avatarGroups: AvatarGroup[] = [...avatarsSpec.groups, ...ICON_GROUPS];
export const ALL_AVATARS: AvatarDef[] = avatarGroups.flatMap((g) => g.items);

const byKey = new Map(ALL_AVATARS.map((a) => [a.key, a]));

export function getAvatar(key: string | null | undefined): AvatarDef {
  return (key && byKey.get(key)) || ALL_AVATARS[0];
}

/** Pick a random avatar, preferring keys not in `usedKeys` (fallback: any). */
export function pickRandomAvatar(usedKeys: ReadonlySet<string> = new Set()): AvatarDef {
  const unused = ALL_AVATARS.filter((a) => !usedKeys.has(a.key));
  const pool = unused.length > 0 ? unused : ALL_AVATARS;
  return pool[Math.floor(Math.random() * pool.length)];
}
