export type ThemeKey =
  | 'midnight-neon'
  | 'crisp-daylight'
  | 'cherry-blossom'
  | 'aurora-borealis'
  | 'sunset-ember'
  | 'ocean-bioluminescence'
  | 'cyberpunk-synth'
  | 'emerald-forest'
  | 'lavender-dream'
  | 'amoled-obsidian';

export interface ThemeDefinition {
  key: ThemeKey;
  name: string;
  emoji: string;
  tagline: string;
  isDark: boolean;
  swatch: [string, string, string];
  effect: 'none' | 'petals' | 'aurora' | 'fireflies' | 'bubbles' | 'neon' | 'leaves' | 'orbs' | 'stars';
}

export const CHATTERBOX_THEMES: ThemeDefinition[] = [
  {
    key: 'midnight-neon',
    name: 'Midnight Neon',
    emoji: '🌙',
    tagline: 'Deep navy & electric cyan',
    isDark: true,
    swatch: ['#0b1120', '#38bdf8', '#a78bfa'],
    effect: 'aurora',
  },
  {
    key: 'cherry-blossom',
    name: 'Cherry Blossom',
    emoji: '🌸',
    tagline: 'Falling sakura flower petals',
    isDark: false,
    swatch: ['#fff5f7', '#ec4899', '#f472b6'],
    effect: 'petals',
  },
  {
    key: 'aurora-borealis',
    name: 'Aurora Borealis',
    emoji: '✨',
    tagline: 'Drifting northern lights glow',
    isDark: true,
    swatch: ['#06131f', '#2dd4bf', '#818cf8'],
    effect: 'aurora',
  },
  {
    key: 'sunset-ember',
    name: 'Sunset Ember',
    emoji: '🌅',
    tagline: 'Warm coral & floating fireflies',
    isDark: true,
    swatch: ['#1c0f13', '#fb923c', '#f43f5e'],
    effect: 'fireflies',
  },
  {
    key: 'ocean-bioluminescence',
    name: 'Deep Ocean',
    emoji: '🌊',
    tagline: 'Abyssal teal & rising bubbles',
    isDark: true,
    swatch: ['#04151f', '#06b6d4', '#38bdf8'],
    effect: 'bubbles',
  },
  {
    key: 'cyberpunk-synth',
    name: 'Cyber Neon',
    emoji: '⚡',
    tagline: 'Obsidian & magenta-cyan pulse',
    isDark: true,
    swatch: ['#0d0718', '#f43f5e', '#22d3ee'],
    effect: 'neon',
  },
  {
    key: 'emerald-forest',
    name: 'Mystic Forest',
    emoji: '🌿',
    tagline: 'Deep pine & drifting leaves',
    isDark: true,
    swatch: ['#071710', '#34d399', '#a3e635'],
    effect: 'leaves',
  },
  {
    key: 'lavender-dream',
    name: 'Lavender Mist',
    emoji: '💜',
    tagline: 'Soft lilac & floating dream orbs',
    isDark: false,
    swatch: ['#f7f5ff', '#7c3aed', '#c084fc'],
    effect: 'orbs',
  },
  {
    key: 'crisp-daylight',
    name: 'Crisp Daylight',
    emoji: '☀️',
    tagline: 'Clean minimal light surfaces',
    isDark: false,
    swatch: ['#f8fafc', '#0284c7', '#6d28d9'],
    effect: 'none',
  },
  {
    key: 'amoled-obsidian',
    name: 'AMOLED Starlight',
    emoji: '🌌',
    tagline: 'Pure black & twinkling stars',
    isDark: true,
    swatch: ['#000000', '#38bdf8', '#c084fc'],
    effect: 'stars',
  },
];

export function getThemeDefinition(key?: string): ThemeDefinition {
  return CHATTERBOX_THEMES.find((t) => t.key === key) || CHATTERBOX_THEMES[0];
}
