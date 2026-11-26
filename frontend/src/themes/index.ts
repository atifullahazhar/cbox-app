// Chatterbox CB1.1 — Dedicated 100-Theme Library (10 Categories x 10 Animated Themes)

export type ThemeKey = string;
export type ThemeEffectTier = 'high' | 'lite' | 'normal';

export type ThemeEffect =
  | 'none'
  | 'petals'
  | 'aurora'
  | 'fireflies'
  | 'bubbles'
  | 'neon'
  | 'leaves'
  | 'orbs'
  | 'stars';

export interface ThemePalette {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentHover: string;
  violet: string;
  success: string;
  danger: string;
  warning: string;
}

export interface ThemeDefinition {
  key: ThemeKey;
  name: string;
  emoji: string;
  tagline: string;
  category: string;
  isDark: boolean;
  swatch: [string, string, string];
  effect: ThemeEffect;
  effectTier: ThemeEffectTier;
  palette: ThemePalette;
}

export const THEME_CATEGORIES: string[] = [
  "Core Signature",
  "Floral & Botanical",
  "Neon & Cyberpunk",
  "Cosmos & Space",
  "Ocean & Aqua",
  "Sunset & Warm",
  "Forest & Nature",
  "Pastel & Dreamy",
  "Luxury & Royal",
  "Minimal & AMOLED"
];

export const CHATTERBOX_THEMES: ThemeDefinition[] = [
  {
    "key": "midnight-neon",
    "name": "Midnight Neon",
    "emoji": "🌙",
    "tagline": "Deep navy & electric cyan",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#0b1120",
      "#38bdf8",
      "#a78bfa"
    ],
    "effect": "aurora",
    "palette": {
      "bg": "11 17 32",
      "surface": "23 29 43",
      "elevated": "35 41 54",
      "border": "52 57 70",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "56 189 248",
      "accentHover": "92 201 249",
      "violet": "167 139 250",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "cherry-blossom",
    "name": "Cherry Blossom",
    "emoji": "🌸",
    "tagline": "Falling sakura flower petals",
    "category": "Core Signature",
    "isDark": false,
    "swatch": [
      "#fff5f7",
      "#db2777",
      "#c026d3"
    ],
    "effect": "petals",
    "palette": {
      "bg": "255 245 247",
      "surface": "255 255 255",
      "elevated": "252 229 237",
      "border": "247 200 219",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "219 39 119",
      "accentHover": "188 34 102",
      "violet": "192 38 211",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "aurora-borealis",
    "name": "Aurora Borealis",
    "emoji": "✨",
    "tagline": "Drifting northern lights glow",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#06131f",
      "#2dd4bf",
      "#818cf8"
    ],
    "effect": "aurora",
    "palette": {
      "bg": "6 19 31",
      "surface": "18 31 42",
      "elevated": "31 43 53",
      "border": "48 59 69",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "45 212 191",
      "accentHover": "83 220 203",
      "violet": "129 140 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "sunset-ember",
    "name": "Sunset Ember",
    "emoji": "🌅",
    "tagline": "Warm coral & floating fireflies",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#1c0f13",
      "#fb923c",
      "#f43f5e"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "28 15 19",
      "surface": "39 27 31",
      "elevated": "51 39 43",
      "border": "67 56 59",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "251 146 60",
      "accentHover": "252 166 95",
      "violet": "244 63 94",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "ocean-bioluminescence",
    "name": "Deep Ocean",
    "emoji": "🌊",
    "tagline": "Abyssal teal & rising bubbles",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#04151f",
      "#06b6d4",
      "#38bdf8"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "4 21 31",
      "surface": "17 33 42",
      "elevated": "29 44 53",
      "border": "47 61 69",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "6 182 212",
      "accentHover": "51 195 220",
      "violet": "56 189 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "cyberpunk-synth",
    "name": "Cyber Neon",
    "emoji": "⚡",
    "tagline": "Obsidian & magenta-cyan pulse",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#0d0718",
      "#f43f5e",
      "#22d3ee"
    ],
    "effect": "neon",
    "palette": {
      "bg": "13 7 24",
      "surface": "25 19 36",
      "elevated": "37 32 47",
      "border": "54 49 63",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "244 63 94",
      "accentHover": "246 98 123",
      "violet": "34 211 238",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "emerald-forest",
    "name": "Mystic Forest",
    "emoji": "🌿",
    "tagline": "Deep pine & drifting leaves",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#071710",
      "#34d399",
      "#a3e635"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "7 23 16",
      "surface": "19 35 28",
      "elevated": "32 46 40",
      "border": "49 62 57",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "52 211 153",
      "accentHover": "89 219 171",
      "violet": "163 230 53",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "lavender-dream",
    "name": "Lavender Mist",
    "emoji": "💜",
    "tagline": "Soft lilac & floating dream orbs",
    "category": "Core Signature",
    "isDark": false,
    "swatch": [
      "#f7f5ff",
      "#7c3aed",
      "#c084fc"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "247 245 255",
      "surface": "255 255 255",
      "elevated": "237 230 254",
      "border": "220 204 251",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "124 58 237",
      "accentHover": "107 50 204",
      "violet": "192 132 252",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "crisp-daylight",
    "name": "Crisp Daylight",
    "emoji": "☀️",
    "tagline": "Clean minimal light surfaces",
    "category": "Core Signature",
    "isDark": false,
    "swatch": [
      "#f8fafc",
      "#0284c7",
      "#6d28d9"
    ],
    "effect": "none",
    "palette": {
      "bg": "248 250 252",
      "surface": "255 255 255",
      "elevated": "228 241 248",
      "border": "194 224 240",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "2 132 199",
      "accentHover": "2 114 171",
      "violet": "109 40 217",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "amoled-obsidian",
    "name": "AMOLED Starlight",
    "emoji": "🌌",
    "tagline": "Pure black & twinkling stars",
    "category": "Core Signature",
    "isDark": true,
    "swatch": [
      "#000000",
      "#38bdf8",
      "#c084fc"
    ],
    "effect": "stars",
    "palette": {
      "bg": "0 0 0",
      "surface": "10 13 20",
      "elevated": "19 23 34",
      "border": "34 40 58",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "56 189 248",
      "accentHover": "92 201 249",
      "violet": "192 132 252",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "rose-quartz",
    "name": "Rose Quartz",
    "emoji": "🌹",
    "tagline": "Velvet rose & falling petals",
    "category": "Floral & Botanical",
    "isDark": false,
    "swatch": [
      "#fff1f2",
      "#e11d48",
      "#f43f5e"
    ],
    "effect": "petals",
    "palette": {
      "bg": "255 241 242",
      "surface": "255 255 255",
      "elevated": "253 224 228",
      "border": "248 194 205",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "225 29 72",
      "accentHover": "194 25 62",
      "violet": "244 63 94",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "sakura-night",
    "name": "Sakura Night",
    "emoji": "🌺",
    "tagline": "Midnight indigo & pink petals",
    "category": "Floral & Botanical",
    "isDark": true,
    "swatch": [
      "#160b18",
      "#f472b6",
      "#c084fc"
    ],
    "effect": "petals",
    "palette": {
      "bg": "22 11 24",
      "surface": "34 23 36",
      "elevated": "45 35 47",
      "border": "62 52 63",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "244 114 182",
      "accentHover": "246 139 195",
      "violet": "192 132 252",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "lotus-pond",
    "name": "Lotus Pond",
    "emoji": "🪷",
    "tagline": "Serene pond teal & lotus pink",
    "category": "Floral & Botanical",
    "isDark": true,
    "swatch": [
      "#081b1b",
      "#f472b6",
      "#2dd4bf"
    ],
    "effect": "petals",
    "palette": {
      "bg": "8 27 27",
      "surface": "20 38 38",
      "elevated": "33 50 50",
      "border": "50 66 66",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "244 114 182",
      "accentHover": "246 139 195",
      "violet": "45 212 191",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "sunflower-field",
    "name": "Sunflower Field",
    "emoji": "🌻",
    "tagline": "Warm golden bloom daylight",
    "category": "Floral & Botanical",
    "isDark": false,
    "swatch": [
      "#fefce8",
      "#ca8a04",
      "#ea580c"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "254 252 232",
      "surface": "255 255 255",
      "elevated": "250 243 214",
      "border": "243 227 182",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "202 138 4",
      "accentHover": "174 119 3",
      "violet": "234 88 12",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "tulip-garden",
    "name": "Tulip Garden",
    "emoji": "🌷",
    "tagline": "Spring coral & fresh petal glow",
    "category": "Floral & Botanical",
    "isDark": false,
    "swatch": [
      "#fff7ed",
      "#ea580c",
      "#db2777"
    ],
    "effect": "petals",
    "palette": {
      "bg": "255 247 237",
      "surface": "255 255 255",
      "elevated": "253 234 219",
      "border": "250 212 188",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "234 88 12",
      "accentHover": "201 76 10",
      "violet": "219 39 119",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "matcha-bloom",
    "name": "Matcha Bloom",
    "emoji": "🍵",
    "tagline": "Creamy matcha & drifting leaves",
    "category": "Floral & Botanical",
    "isDark": false,
    "swatch": [
      "#f2f8f3",
      "#15803d",
      "#0d9488"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "242 248 243",
      "surface": "255 255 255",
      "elevated": "224 238 228",
      "border": "193 222 203",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "21 128 61",
      "accentHover": "18 110 52",
      "violet": "13 148 136",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "hibiscus-glow",
    "name": "Hibiscus Glow",
    "emoji": "💮",
    "tagline": "Tropical crimson & warm sparks",
    "category": "Floral & Botanical",
    "isDark": true,
    "swatch": [
      "#210912",
      "#fb7185",
      "#f59e0b"
    ],
    "effect": "petals",
    "palette": {
      "bg": "33 9 18",
      "surface": "44 21 30",
      "elevated": "55 34 42",
      "border": "71 51 58",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "251 113 133",
      "accentHover": "252 139 155",
      "violet": "245 158 11",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "orchid-velvet",
    "name": "Orchid Velvet",
    "emoji": "🪻",
    "tagline": "Deep plum & glowing orchid orbs",
    "category": "Floral & Botanical",
    "isDark": true,
    "swatch": [
      "#1a0c24",
      "#e879f9",
      "#a855f7"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "26 12 36",
      "surface": "37 24 47",
      "elevated": "49 36 58",
      "border": "65 53 73",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "232 121 249",
      "accentHover": "236 145 250",
      "violet": "168 85 247",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "marigold-fest",
    "name": "Marigold Fest",
    "emoji": "🌼",
    "tagline": "Festive saffron & warm fireflies",
    "category": "Floral & Botanical",
    "isDark": false,
    "swatch": [
      "#fffbeb",
      "#d97706",
      "#e11d48"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "255 251 235",
      "surface": "255 255 255",
      "elevated": "252 240 217",
      "border": "247 222 185",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "217 119 6",
      "accentHover": "187 102 5",
      "violet": "225 29 72",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "wisteria-rain",
    "name": "Wisteria Rain",
    "emoji": "💐",
    "tagline": "Soft violet petals & mist",
    "category": "Floral & Botanical",
    "isDark": false,
    "swatch": [
      "#faf5ff",
      "#9333ea",
      "#ec4899"
    ],
    "effect": "petals",
    "palette": {
      "bg": "250 245 255",
      "surface": "255 255 255",
      "elevated": "242 229 253",
      "border": "227 202 250",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "147 51 234",
      "accentHover": "126 44 201",
      "violet": "236 72 153",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "tokyo-drift",
    "name": "Tokyo Drift",
    "emoji": "🗼",
    "tagline": "Midnight asphalt & neon crimson",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#0b0a14",
      "#ef4444",
      "#38bdf8"
    ],
    "effect": "neon",
    "palette": {
      "bg": "11 10 20",
      "surface": "23 22 32",
      "elevated": "35 34 44",
      "border": "52 52 60",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "239 68 68",
      "accentHover": "242 102 102",
      "violet": "56 189 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "synthwave-84",
    "name": "Synthwave 84",
    "emoji": "📼",
    "tagline": "Retro purple & sunset neon",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#170926",
      "#f43f5e",
      "#facc15"
    ],
    "effect": "neon",
    "palette": {
      "bg": "23 9 38",
      "surface": "35 21 49",
      "elevated": "46 34 60",
      "border": "62 51 75",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "244 63 94",
      "accentHover": "246 98 123",
      "violet": "250 204 21",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "plasma-volt",
    "name": "Plasma Volt",
    "emoji": "🔋",
    "tagline": "High-voltage violet & cyan",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#0a071a",
      "#a855f7",
      "#06b6d4"
    ],
    "effect": "neon",
    "palette": {
      "bg": "10 7 26",
      "surface": "22 19 37",
      "elevated": "34 32 49",
      "border": "52 49 65",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "168 85 247",
      "accentHover": "184 116 248",
      "violet": "6 182 212",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "laser-lime",
    "name": "Laser Lime",
    "emoji": "🟢",
    "tagline": "Dark cyber slate & neon lime",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#08120c",
      "#84cc16",
      "#22d3ee"
    ],
    "effect": "neon",
    "palette": {
      "bg": "8 18 12",
      "surface": "20 30 24",
      "elevated": "33 42 36",
      "border": "50 58 53",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "132 204 22",
      "accentHover": "154 213 64",
      "violet": "34 211 238",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "arcade-magenta",
    "name": "Arcade Magenta",
    "emoji": "🕹️",
    "tagline": "80s arcade pink & electric blue",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#14081d",
      "#ec4899",
      "#60a5fa"
    ],
    "effect": "neon",
    "palette": {
      "bg": "20 8 29",
      "surface": "32 20 40",
      "elevated": "44 33 52",
      "border": "60 50 67",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "236 72 153",
      "accentHover": "239 105 171",
      "violet": "96 165 250",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "tron-grid",
    "name": "Tron Grid",
    "emoji": "💠",
    "tagline": "Deep grid black & ice blue",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#040b14",
      "#00d8ff",
      "#3b82f6"
    ],
    "effect": "neon",
    "palette": {
      "bg": "4 11 20",
      "surface": "17 23 32",
      "elevated": "29 35 44",
      "border": "47 52 60",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "0 216 255",
      "accentHover": "46 223 255",
      "violet": "59 130 246",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "hologram-pulse",
    "name": "Hologram Pulse",
    "emoji": "🌈",
    "tagline": "Iridescent teal & lilac shimmer",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#0c1020",
      "#2dd4bf",
      "#e879f9"
    ],
    "effect": "aurora",
    "palette": {
      "bg": "12 16 32",
      "surface": "24 28 43",
      "elevated": "36 40 54",
      "border": "53 57 70",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "45 212 191",
      "accentHover": "83 220 203",
      "violet": "232 121 249",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "acid-mint",
    "name": "Acid Mint",
    "emoji": "🧪",
    "tagline": "Dark obsidian & glowing mint",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#061412",
      "#10b981",
      "#a3e635"
    ],
    "effect": "neon",
    "palette": {
      "bg": "6 20 18",
      "surface": "18 32 30",
      "elevated": "31 44 42",
      "border": "48 60 58",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "16 185 129",
      "accentHover": "59 198 152",
      "violet": "163 230 53",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "hyper-violet",
    "name": "Hyper Violet",
    "emoji": "🔮",
    "tagline": "Ultra-deep indigo & violet beams",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#0f0720",
      "#8b5cf6",
      "#f472b6"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "15 7 32",
      "surface": "27 19 43",
      "elevated": "39 32 54",
      "border": "56 49 70",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "139 92 246",
      "accentHover": "160 121 248",
      "violet": "244 114 182",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "matrix-code",
    "name": "Matrix Code",
    "emoji": "💻",
    "tagline": "Terminal black & emerald glow",
    "category": "Neon & Cyberpunk",
    "isDark": true,
    "swatch": [
      "#020b05",
      "#22c55e",
      "#4ade80"
    ],
    "effect": "stars",
    "palette": {
      "bg": "2 11 5",
      "surface": "15 23 18",
      "elevated": "27 35 30",
      "border": "45 52 48",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "34 197 94",
      "accentHover": "74 207 123",
      "violet": "74 222 128",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "milky-way",
    "name": "Milky Way",
    "emoji": "🌠",
    "tagline": "Deep cosmos & stardust glow",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#070a18",
      "#60a5fa",
      "#c084fc"
    ],
    "effect": "stars",
    "palette": {
      "bg": "7 10 24",
      "surface": "19 22 36",
      "elevated": "32 34 47",
      "border": "49 52 63",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "96 165 250",
      "accentHover": "125 181 251",
      "violet": "192 132 252",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "nebula-dream",
    "name": "Nebula Dream",
    "emoji": "🌌",
    "tagline": "Cosmic fuchsia & astral mist",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#120821",
      "#d946ef",
      "#38bdf8"
    ],
    "effect": "aurora",
    "palette": {
      "bg": "18 8 33",
      "surface": "30 20 44",
      "elevated": "42 33 55",
      "border": "58 50 71",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "217 70 239",
      "accentHover": "224 103 242",
      "violet": "56 189 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "solar-flare",
    "name": "Solar Flare",
    "emoji": "☀️",
    "tagline": "Dark void & blazing solar orange",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#190b06",
      "#f97316",
      "#facc15"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "25 11 6",
      "surface": "36 23 18",
      "elevated": "48 35 31",
      "border": "64 52 48",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "249 115 22",
      "accentHover": "250 140 64",
      "violet": "250 204 21",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "lunar-silver",
    "name": "Lunar Silver",
    "emoji": "🌕",
    "tagline": "Moonlit slate & crisp silver",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#0f131a",
      "#cbd5e1",
      "#94a3b8"
    ],
    "effect": "stars",
    "palette": {
      "bg": "15 19 26",
      "surface": "27 31 37",
      "elevated": "39 43 49",
      "border": "56 59 65",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "203 213 225",
      "accentHover": "212 221 230",
      "violet": "148 163 184",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "mars-horizon",
    "name": "Mars Horizon",
    "emoji": "🪐",
    "tagline": "Red planet rust & dusty amber",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#1c0c0a",
      "#ea580c",
      "#fb7185"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "28 12 10",
      "surface": "39 24 22",
      "elevated": "51 36 34",
      "border": "67 53 52",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "234 88 12",
      "accentHover": "238 118 56",
      "violet": "251 113 133",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "deep-blackhole",
    "name": "Blackhole Core",
    "emoji": "🕳️",
    "tagline": "Pure void & accretion amber",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#020205",
      "#f59e0b",
      "#6366f1"
    ],
    "effect": "stars",
    "palette": {
      "bg": "2 2 5",
      "surface": "15 15 18",
      "elevated": "27 27 30",
      "border": "45 45 48",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "245 158 11",
      "accentHover": "247 175 55",
      "violet": "99 102 241",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "supernova-gold",
    "name": "Supernova Gold",
    "emoji": "💥",
    "tagline": "Midnight sky & radiant gold",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#0d0c18",
      "#eab308",
      "#f43f5e"
    ],
    "effect": "stars",
    "palette": {
      "bg": "13 12 24",
      "surface": "25 24 36",
      "elevated": "37 36 47",
      "border": "54 53 63",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "234 179 8",
      "accentHover": "238 193 52",
      "violet": "244 63 94",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "saturn-rings",
    "name": "Saturn Rings",
    "emoji": "💫",
    "tagline": "Warm champagne & cosmic bronze",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#15120d",
      "#d4a373",
      "#fbbf24"
    ],
    "effect": "stars",
    "palette": {
      "bg": "21 18 13",
      "surface": "33 30 25",
      "elevated": "44 42 37",
      "border": "61 58 54",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "212 163 115",
      "accentHover": "220 180 140",
      "violet": "251 191 36",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "comet-trail",
    "name": "Comet Trail",
    "emoji": "☄️",
    "tagline": "Ice cyan tail on deep space",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#06101f",
      "#38bdf8",
      "#2dd4bf"
    ],
    "effect": "stars",
    "palette": {
      "bg": "6 16 31",
      "surface": "18 28 42",
      "elevated": "31 40 53",
      "border": "48 57 69",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "56 189 248",
      "accentHover": "92 201 249",
      "violet": "45 212 191",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "event-horizon",
    "name": "Event Horizon",
    "emoji": "🔭",
    "tagline": "Ultraviolet space & twilight",
    "category": "Cosmos & Space",
    "isDark": true,
    "swatch": [
      "#0b081c",
      "#818cf8",
      "#f472b6"
    ],
    "effect": "aurora",
    "palette": {
      "bg": "11 8 28",
      "surface": "23 20 39",
      "elevated": "35 33 51",
      "border": "52 50 67",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "129 140 248",
      "accentHover": "152 161 249",
      "violet": "244 114 182",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "coral-reef",
    "name": "Coral Reef",
    "emoji": "🪸",
    "tagline": "Turquoise sea & coral accents",
    "category": "Ocean & Aqua",
    "isDark": true,
    "swatch": [
      "#051a22",
      "#fb7185",
      "#2dd4bf"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "5 26 34",
      "surface": "18 37 45",
      "elevated": "30 49 56",
      "border": "48 65 72",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "251 113 133",
      "accentHover": "252 139 155",
      "violet": "45 212 191",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "glacier-ice",
    "name": "Glacier Ice",
    "emoji": "🧊",
    "tagline": "Crisp arctic white & frost blue",
    "category": "Ocean & Aqua",
    "isDark": false,
    "swatch": [
      "#f0f9ff",
      "#0284c7",
      "#0891b2"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "240 249 255",
      "surface": "255 255 255",
      "elevated": "221 240 251",
      "border": "188 223 243",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "2 132 199",
      "accentHover": "2 114 171",
      "violet": "8 145 178",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "tropical-lagoon",
    "name": "Tropical Lagoon",
    "emoji": "🏝️",
    "tagline": "Bright lagoon aqua & rising foam",
    "category": "Ocean & Aqua",
    "isDark": false,
    "swatch": [
      "#ecfeff",
      "#0891b2",
      "#10b981"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "236 254 255",
      "surface": "255 255 255",
      "elevated": "218 245 249",
      "border": "186 230 238",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "8 145 178",
      "accentHover": "7 125 153",
      "violet": "16 185 129",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "abyssal-blue",
    "name": "Abyssal Blue",
    "emoji": "🐋",
    "tagline": "Deep trench navy & cobalt glow",
    "category": "Ocean & Aqua",
    "isDark": true,
    "swatch": [
      "#030d1c",
      "#3b82f6",
      "#06b6d4"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "3 13 28",
      "surface": "16 25 39",
      "elevated": "28 37 51",
      "border": "46 54 67",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "59 130 246",
      "accentHover": "94 152 248",
      "violet": "6 182 212",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "high"
  },
  {
    "key": "seafoam-breeze",
    "name": "Seafoam Breeze",
    "emoji": "🐚",
    "tagline": "Airy coastal mint & aqua tint",
    "category": "Ocean & Aqua",
    "isDark": false,
    "swatch": [
      "#f0fdfa",
      "#0d9488",
      "#0284c7"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "240 253 250",
      "surface": "255 255 255",
      "elevated": "222 245 241",
      "border": "190 230 225",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "13 148 136",
      "accentHover": "11 127 117",
      "violet": "2 132 199",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "high"
  },
  {
    "key": "arctic-frost",
    "name": "Arctic Frost",
    "emoji": "❄️",
    "tagline": "Frozen blue-grey & crystalline",
    "category": "Ocean & Aqua",
    "isDark": true,
    "swatch": [
      "#0a1622",
      "#7dd3fc",
      "#a5f3fc"
    ],
    "effect": "stars",
    "palette": {
      "bg": "10 22 34",
      "surface": "22 34 45",
      "elevated": "34 45 56",
      "border": "52 62 72",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "125 211 252",
      "accentHover": "148 219 253",
      "violet": "165 243 252",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "sapphire-tide",
    "name": "Sapphire Tide",
    "emoji": "💎",
    "tagline": "Royal ocean sapphire & cyan",
    "category": "Ocean & Aqua",
    "isDark": true,
    "swatch": [
      "#071226",
      "#2563eb",
      "#38bdf8"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "7 18 38",
      "surface": "19 30 49",
      "elevated": "32 42 60",
      "border": "49 58 75",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "37 99 235",
      "accentHover": "76 127 239",
      "violet": "56 189 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "pacific-dusk",
    "name": "Pacific Dusk",
    "emoji": "🌊",
    "tagline": "Twilight ocean & violet surf",
    "category": "Ocean & Aqua",
    "isDark": true,
    "swatch": [
      "#0b1526",
      "#38bdf8",
      "#a78bfa"
    ],
    "effect": "aurora",
    "palette": {
      "bg": "11 21 38",
      "surface": "23 33 49",
      "elevated": "35 44 60",
      "border": "52 61 75",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "56 189 248",
      "accentHover": "92 201 249",
      "violet": "167 139 250",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "emerald-cove",
    "name": "Emerald Cove",
    "emoji": "🐢",
    "tagline": "Hidden sea green & calm bubbles",
    "category": "Ocean & Aqua",
    "isDark": true,
    "swatch": [
      "#051a17",
      "#10b981",
      "#06b6d4"
    ],
    "effect": "bubbles",
    "palette": {
      "bg": "5 26 23",
      "surface": "18 37 35",
      "elevated": "30 49 46",
      "border": "48 65 62",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "16 185 129",
      "accentHover": "59 198 152",
      "violet": "6 182 212",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "pearl-mist",
    "name": "Pearl Mist",
    "emoji": "🦪",
    "tagline": "Lustrous ocean white & sky blue",
    "category": "Ocean & Aqua",
    "isDark": false,
    "swatch": [
      "#f4f9fc",
      "#0369a1",
      "#6366f1"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "244 249 252",
      "surface": "255 255 255",
      "elevated": "225 237 245",
      "border": "191 217 232",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "3 105 161",
      "accentHover": "3 90 138",
      "violet": "99 102 241",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "golden-hour",
    "name": "Golden Hour",
    "emoji": "🌇",
    "tagline": "Warm amber dusk & soft glow",
    "category": "Sunset & Warm",
    "isDark": false,
    "swatch": [
      "#fffbeb",
      "#d97706",
      "#ea580c"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "255 251 235",
      "surface": "255 255 255",
      "elevated": "252 240 217",
      "border": "247 222 185",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "217 119 6",
      "accentHover": "187 102 5",
      "violet": "234 88 12",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "desert-mirage",
    "name": "Desert Mirage",
    "emoji": "🏜️",
    "tagline": "Sandstone dark & copper heat",
    "category": "Sunset & Warm",
    "isDark": true,
    "swatch": [
      "#1c120c",
      "#f59e0b",
      "#fb923c"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "28 18 12",
      "surface": "39 30 24",
      "elevated": "51 42 36",
      "border": "67 58 53",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "245 158 11",
      "accentHover": "247 175 55",
      "violet": "251 146 60",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "amber-honey",
    "name": "Amber Honey",
    "emoji": "🍯",
    "tagline": "Rich honey dark & golden sparks",
    "category": "Sunset & Warm",
    "isDark": true,
    "swatch": [
      "#1a1306",
      "#fbbf24",
      "#f97316"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "26 19 6",
      "surface": "37 31 18",
      "elevated": "49 43 31",
      "border": "65 59 48",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "251 191 36",
      "accentHover": "252 203 75",
      "violet": "249 115 22",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "terracotta-clay",
    "name": "Terracotta Clay",
    "emoji": "🏺",
    "tagline": "Earthy clay light & warm rust",
    "category": "Sunset & Warm",
    "isDark": false,
    "swatch": [
      "#fdf6f0",
      "#c2410c",
      "#b45309"
    ],
    "effect": "none",
    "palette": {
      "bg": "253 246 240",
      "surface": "255 255 255",
      "elevated": "248 232 222",
      "border": "240 206 190",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "194 65 12",
      "accentHover": "167 56 10",
      "violet": "180 83 9",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "peach-sorbet",
    "name": "Peach Sorbet",
    "emoji": "🍑",
    "tagline": "Sweet pastel peach & coral glow",
    "category": "Sunset & Warm",
    "isDark": false,
    "swatch": [
      "#fff5f0",
      "#f97316",
      "#ec4899"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "255 245 240",
      "surface": "255 255 255",
      "elevated": "255 235 223",
      "border": "254 216 192",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "249 115 22",
      "accentHover": "214 99 19",
      "violet": "236 72 153",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "autumn-maple",
    "name": "Autumn Maple",
    "emoji": "🍁",
    "tagline": "Crisp crimson maple & fall leaves",
    "category": "Sunset & Warm",
    "isDark": true,
    "swatch": [
      "#1b0d0a",
      "#ef4444",
      "#f59e0b"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "27 13 10",
      "surface": "38 25 22",
      "elevated": "50 37 34",
      "border": "66 54 52",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "239 68 68",
      "accentHover": "242 102 102",
      "violet": "245 158 11",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "volcano-ash",
    "name": "Volcano Ash",
    "emoji": "🌋",
    "tagline": "Basalt charcoal & molten lava",
    "category": "Sunset & Warm",
    "isDark": true,
    "swatch": [
      "#140c0c",
      "#f43f5e",
      "#fb923c"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "20 12 12",
      "surface": "32 24 24",
      "elevated": "44 36 36",
      "border": "60 53 53",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "244 63 94",
      "accentHover": "246 98 123",
      "violet": "251 146 60",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "cinnamon-spice",
    "name": "Cinnamon Spice",
    "emoji": "☕",
    "tagline": "Cozy espresso & warm cinnamon",
    "category": "Sunset & Warm",
    "isDark": true,
    "swatch": [
      "#19110d",
      "#d97706",
      "#e11d48"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "25 17 13",
      "surface": "36 29 25",
      "elevated": "48 41 37",
      "border": "64 57 54",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "217 119 6",
      "accentHover": "224 143 51",
      "violet": "225 29 72",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "mango-tango",
    "name": "Mango Tango",
    "emoji": "🥭",
    "tagline": "Sunny mango & tropical zest",
    "category": "Sunset & Warm",
    "isDark": false,
    "swatch": [
      "#fff9eb",
      "#ea580c",
      "#eab308"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "255 249 235",
      "surface": "255 255 255",
      "elevated": "253 236 217",
      "border": "250 214 186",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "234 88 12",
      "accentHover": "201 76 10",
      "violet": "234 179 8",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "saffron-royal",
    "name": "Saffron Royal",
    "emoji": "🧡",
    "tagline": "Deep royal burgundy & saffron",
    "category": "Sunset & Warm",
    "isDark": true,
    "swatch": [
      "#1f0b11",
      "#f59e0b",
      "#fb7185"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "31 11 17",
      "surface": "42 23 29",
      "elevated": "53 35 41",
      "border": "69 52 57",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "245 158 11",
      "accentHover": "247 175 55",
      "violet": "251 113 133",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "bamboo-zen",
    "name": "Bamboo Zen",
    "emoji": "🎋",
    "tagline": "Tranquil bamboo & fresh leaves",
    "category": "Forest & Nature",
    "isDark": false,
    "swatch": [
      "#f3faf4",
      "#16a34a",
      "#0d9488"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "243 250 244",
      "surface": "255 255 255",
      "elevated": "225 243 230",
      "border": "194 231 207",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "22 163 74",
      "accentHover": "19 140 64",
      "violet": "13 148 136",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "pine-shadow",
    "name": "Pine Shadow",
    "emoji": "🌲",
    "tagline": "Deep evergreen & soft fireflies",
    "category": "Forest & Nature",
    "isDark": true,
    "swatch": [
      "#06140e",
      "#22c55e",
      "#10b981"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "6 20 14",
      "surface": "18 32 26",
      "elevated": "31 44 38",
      "border": "48 60 55",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "34 197 94",
      "accentHover": "74 207 123",
      "violet": "16 185 129",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "moss-garden",
    "name": "Moss Garden",
    "emoji": "🪴",
    "tagline": "Earthy forest moss & sage glow",
    "category": "Forest & Nature",
    "isDark": true,
    "swatch": [
      "#0d1710",
      "#84cc16",
      "#34d399"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "13 23 16",
      "surface": "25 35 28",
      "elevated": "37 46 40",
      "border": "54 62 57",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "132 204 22",
      "accentHover": "154 213 64",
      "violet": "52 211 153",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "rainforest-mist",
    "name": "Rainforest Mist",
    "emoji": "🌴",
    "tagline": "Lush canopy teal & emerald",
    "category": "Forest & Nature",
    "isDark": true,
    "swatch": [
      "#051715",
      "#14b8a6",
      "#4ade80"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "5 23 21",
      "surface": "18 35 33",
      "elevated": "30 46 44",
      "border": "48 62 61",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "20 184 166",
      "accentHover": "62 197 182",
      "violet": "74 222 128",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "jade-valley",
    "name": "Jade Valley",
    "emoji": "🟢",
    "tagline": "Polished jade stone & calm aura",
    "category": "Forest & Nature",
    "isDark": false,
    "swatch": [
      "#ecfdf5",
      "#059669",
      "#0284c7"
    ],
    "effect": "orbs",
    "palette": {
      "bg": "236 253 245",
      "surface": "255 255 255",
      "elevated": "218 245 234",
      "border": "185 230 214",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "5 150 105",
      "accentHover": "4 129 90",
      "violet": "2 132 199",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "sage-calm",
    "name": "Sage Calm",
    "emoji": "🍃",
    "tagline": "Minimal muted sage daylight",
    "category": "Forest & Nature",
    "isDark": false,
    "swatch": [
      "#f4f7f5",
      "#2f855a",
      "#4d7c0f"
    ],
    "effect": "none",
    "palette": {
      "bg": "244 247 245",
      "surface": "255 255 255",
      "elevated": "228 238 233",
      "border": "201 222 211",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "47 133 90",
      "accentHover": "40 114 77",
      "violet": "77 124 15",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "fern-dew",
    "name": "Fern Dew",
    "emoji": "🌿",
    "tagline": "Morning dew emerald & lime",
    "category": "Forest & Nature",
    "isDark": true,
    "swatch": [
      "#091911",
      "#4ade80",
      "#2dd4bf"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "9 25 17",
      "surface": "21 36 29",
      "elevated": "34 48 41",
      "border": "51 64 57",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "74 222 128",
      "accentHover": "107 228 151",
      "violet": "45 212 191",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "cedar-cabin",
    "name": "Cedar Cabin",
    "emoji": "🪵",
    "tagline": "Warm timber brown & forest green",
    "category": "Forest & Nature",
    "isDark": true,
    "swatch": [
      "#17120e",
      "#84cc16",
      "#f59e0b"
    ],
    "effect": "fireflies",
    "palette": {
      "bg": "23 18 14",
      "surface": "35 30 26",
      "elevated": "46 42 38",
      "border": "62 58 55",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "132 204 22",
      "accentHover": "154 213 64",
      "violet": "245 158 11",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "meadow-spring",
    "name": "Meadow Spring",
    "emoji": "🌱",
    "tagline": "Bright meadow green & sky tint",
    "category": "Forest & Nature",
    "isDark": false,
    "swatch": [
      "#f7fee7",
      "#4d7c0f",
      "#059669"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "247 254 231",
      "surface": "255 255 255",
      "elevated": "233 244 214",
      "border": "210 225 183",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "77 124 15",
      "accentHover": "66 107 13",
      "violet": "5 150 105",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "lite"
  },
  {
    "key": "olive-grove",
    "name": "Olive Grove",
    "emoji": "🫒",
    "tagline": "Mediterranean olive & warm stone",
    "category": "Forest & Nature",
    "isDark": true,
    "swatch": [
      "#14170d",
      "#a3e635",
      "#eab308"
    ],
    "effect": "leaves",
    "palette": {
      "bg": "20 23 13",
      "surface": "32 35 25",
      "elevated": "44 46 37",
      "border": "60 62 54",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "163 230 53",
      "accentHover": "180 234 89",
      "violet": "234 179 8",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "lite"
  },
  {
    "key": "cotton-candy",
    "name": "Cotton Candy",
    "emoji": "🍬",
    "tagline": "Sweet pink & sky blue clouds",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#fdf2f8",
      "#ec4899",
      "#3b82f6"
    ],
    "effect": "none",
    "palette": {
      "bg": "253 242 248",
      "surface": "255 255 255",
      "elevated": "252 228 240",
      "border": "249 205 227",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "236 72 153",
      "accentHover": "203 62 132",
      "violet": "59 130 246",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "sky-cloud",
    "name": "Sky Cloud",
    "emoji": "☁️",
    "tagline": "Soft blue sky & floating orbs",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#f0f9ff",
      "#0284c7",
      "#818cf8"
    ],
    "effect": "none",
    "palette": {
      "bg": "240 249 255",
      "surface": "255 255 255",
      "elevated": "221 240 251",
      "border": "188 223 243",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "2 132 199",
      "accentHover": "2 114 171",
      "violet": "129 140 248",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "mint-cream",
    "name": "Mint Cream",
    "emoji": "🍨",
    "tagline": "Cool pastel mint & crisp teal",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#f0fdf4",
      "#0d9488",
      "#16a34a"
    ],
    "effect": "none",
    "palette": {
      "bg": "240 253 244",
      "surface": "255 255 255",
      "elevated": "222 245 235",
      "border": "190 230 220",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "13 148 136",
      "accentHover": "11 127 117",
      "violet": "22 163 74",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "buttercup-soft",
    "name": "Buttercup Soft",
    "emoji": "💛",
    "tagline": "Gentle pastel yellow & warmth",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#fefce8",
      "#b45309",
      "#d97706"
    ],
    "effect": "none",
    "palette": {
      "bg": "254 252 232",
      "surface": "255 255 255",
      "elevated": "248 238 214",
      "border": "238 215 183",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "180 83 9",
      "accentHover": "155 71 8",
      "violet": "217 119 6",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "lilac-haze",
    "name": "Lilac Haze",
    "emoji": "🦋",
    "tagline": "Dreamy pastel lilac & plum",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#f5f3ff",
      "#7c3aed",
      "#db2777"
    ],
    "effect": "none",
    "palette": {
      "bg": "245 243 255",
      "surface": "255 255 255",
      "elevated": "235 228 254",
      "border": "218 202 251",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "124 58 237",
      "accentHover": "107 50 204",
      "violet": "219 39 119",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "baby-blue",
    "name": "Baby Blue",
    "emoji": "🩵",
    "tagline": "Powder blue calm & soft indigo",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#eff6ff",
      "#2563eb",
      "#0284c7"
    ],
    "effect": "none",
    "palette": {
      "bg": "239 246 255",
      "surface": "255 255 255",
      "elevated": "223 234 253",
      "border": "195 214 251",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "37 99 235",
      "accentHover": "32 85 202",
      "violet": "2 132 199",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "blush-pearl",
    "name": "Blush Pearl",
    "emoji": "🩷",
    "tagline": "Warm rosewater & soft petals",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#fff1f5",
      "#be185d",
      "#e11d48"
    ],
    "effect": "none",
    "palette": {
      "bg": "255 241 245",
      "surface": "255 255 255",
      "elevated": "250 224 233",
      "border": "241 193 212",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "190 24 93",
      "accentHover": "163 21 80",
      "violet": "225 29 72",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "vanilla-latte",
    "name": "Vanilla Latte",
    "emoji": "🧋",
    "tagline": "Creamy warm vanilla & caramel",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#faf6f0",
      "#92400e",
      "#b45309"
    ],
    "effect": "none",
    "palette": {
      "bg": "250 246 240",
      "surface": "255 255 255",
      "elevated": "242 231 222",
      "border": "227 206 190",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "146 64 14",
      "accentHover": "126 55 12",
      "violet": "180 83 9",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "pistachio-whip",
    "name": "Pistachio Whip",
    "emoji": "🧁",
    "tagline": "Soft pistachio green & mint",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#f4fbe8",
      "#3f6212",
      "#15803d"
    ],
    "effect": "none",
    "palette": {
      "bg": "244 251 232",
      "surface": "255 255 255",
      "elevated": "230 239 215",
      "border": "204 217 185",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "63 98 18",
      "accentHover": "54 84 15",
      "violet": "21 128 61",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "periwinkle",
    "name": "Periwinkle",
    "emoji": "🪁",
    "tagline": "Cool periwinkle blue & lavender",
    "category": "Pastel & Dreamy",
    "isDark": false,
    "swatch": [
      "#eef2ff",
      "#4f46e5",
      "#7c3aed"
    ],
    "effect": "none",
    "palette": {
      "bg": "238 242 255",
      "surface": "255 255 255",
      "elevated": "225 228 253",
      "border": "203 204 249",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "79 70 229",
      "accentHover": "68 60 197",
      "violet": "124 58 237",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "obsidian-gold",
    "name": "Obsidian Gold",
    "emoji": "👑",
    "tagline": "Jet black & 24k metallic gold",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#08080a",
      "#eab308",
      "#f59e0b"
    ],
    "effect": "none",
    "palette": {
      "bg": "8 8 10",
      "surface": "20 20 22",
      "elevated": "33 33 34",
      "border": "50 50 52",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "234 179 8",
      "accentHover": "238 193 52",
      "violet": "245 158 11",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "royal-velvet",
    "name": "Royal Velvet",
    "emoji": "⚜️",
    "tagline": "Imperial purple & crown gold",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#14091f",
      "#a855f7",
      "#fbbf24"
    ],
    "effect": "none",
    "palette": {
      "bg": "20 9 31",
      "surface": "32 21 42",
      "elevated": "44 34 53",
      "border": "60 51 69",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "168 85 247",
      "accentHover": "184 116 248",
      "violet": "251 191 36",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "champagne-silk",
    "name": "Champagne Silk",
    "emoji": "🥂",
    "tagline": "Warm ivory silk & champagne",
    "category": "Luxury & Royal",
    "isDark": false,
    "swatch": [
      "#faf7f2",
      "#a16207",
      "#b45309"
    ],
    "effect": "none",
    "palette": {
      "bg": "250 247 242",
      "surface": "255 255 255",
      "elevated": "243 235 223",
      "border": "230 214 190",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "161 98 7",
      "accentHover": "138 84 6",
      "violet": "180 83 9",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "ruby-crown",
    "name": "Ruby Crown",
    "emoji": "♦️",
    "tagline": "Deep garnet velvet & ruby shine",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#1c070c",
      "#e11d48",
      "#fbbf24"
    ],
    "effect": "none",
    "palette": {
      "bg": "28 7 12",
      "surface": "39 19 24",
      "elevated": "51 32 36",
      "border": "67 49 53",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "225 29 72",
      "accentHover": "230 70 105",
      "violet": "251 191 36",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "emerald-luxe",
    "name": "Emerald Luxe",
    "emoji": "💚",
    "tagline": "Dark jewel emerald & gold trim",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#051712",
      "#10b981",
      "#eab308"
    ],
    "effect": "none",
    "palette": {
      "bg": "5 23 18",
      "surface": "18 35 30",
      "elevated": "30 46 42",
      "border": "48 62 58",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "16 185 129",
      "accentHover": "59 198 152",
      "violet": "234 179 8",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "onyx-silver",
    "name": "Onyx Silver",
    "emoji": "🪙",
    "tagline": "Matte onyx black & platinum",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#0b0c10",
      "#e2e8f0",
      "#94a3b8"
    ],
    "effect": "none",
    "palette": {
      "bg": "11 12 16",
      "surface": "23 24 28",
      "elevated": "35 36 40",
      "border": "52 53 57",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "226 232 240",
      "accentHover": "231 236 243",
      "violet": "148 163 184",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "bronze-empire",
    "name": "Bronze Empire",
    "emoji": "🏛️",
    "tagline": "Dark bronze & antique copper",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#16100b",
      "#d97706",
      "#b45309"
    ],
    "effect": "none",
    "palette": {
      "bg": "22 16 11",
      "surface": "34 28 23",
      "elevated": "45 40 35",
      "border": "62 57 52",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "217 119 6",
      "accentHover": "224 143 51",
      "violet": "180 83 9",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "sapphire-king",
    "name": "Sapphire King",
    "emoji": "🔷",
    "tagline": "Royal midnight blue & diamond",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#070e21",
      "#3b82f6",
      "#fbbf24"
    ],
    "effect": "none",
    "palette": {
      "bg": "7 14 33",
      "surface": "19 26 44",
      "elevated": "32 38 55",
      "border": "49 55 71",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "59 130 246",
      "accentHover": "94 152 248",
      "violet": "251 191 36",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "rose-gold",
    "name": "Rose Gold",
    "emoji": "✨",
    "tagline": "Chic dark cocoa & rose gold",
    "category": "Luxury & Royal",
    "isDark": true,
    "swatch": [
      "#191014",
      "#f472b6",
      "#fbbf24"
    ],
    "effect": "none",
    "palette": {
      "bg": "25 16 20",
      "surface": "36 28 32",
      "elevated": "48 40 44",
      "border": "64 57 60",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "244 114 182",
      "accentHover": "246 139 195",
      "violet": "251 191 36",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "ivory-marble",
    "name": "Ivory Marble",
    "emoji": "🤍",
    "tagline": "Gallery marble white & onyx",
    "category": "Luxury & Royal",
    "isDark": false,
    "swatch": [
      "#f9f8f6",
      "#1e293b",
      "#7c3aed"
    ],
    "effect": "none",
    "palette": {
      "bg": "249 248 246",
      "surface": "255 255 255",
      "elevated": "231 231 231",
      "border": "201 202 205",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "30 41 59",
      "accentHover": "26 35 51",
      "violet": "124 58 237",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "pure-pitch",
    "name": "Pure Pitch",
    "emoji": "⬛",
    "tagline": "True #000000 OLED minimalist",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#000000",
      "#f8fafc",
      "#94a3b8"
    ],
    "effect": "none",
    "palette": {
      "bg": "0 0 0",
      "surface": "10 13 20",
      "elevated": "19 23 34",
      "border": "34 40 58",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "248 250 252",
      "accentHover": "249 251 253",
      "violet": "148 163 184",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "graphite-pro",
    "name": "Graphite Pro",
    "emoji": "🖥️",
    "tagline": "Studio dark grey & steel blue",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#121417",
      "#60a5fa",
      "#818cf8"
    ],
    "effect": "none",
    "palette": {
      "bg": "18 20 23",
      "surface": "30 32 35",
      "elevated": "42 44 46",
      "border": "58 60 62",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "96 165 250",
      "accentHover": "125 181 251",
      "violet": "129 140 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "slate-mono",
    "name": "Slate Mono",
    "emoji": "🪨",
    "tagline": "Balanced slate & crisp accent",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#0f172a",
      "#94a3b8",
      "#38bdf8"
    ],
    "effect": "none",
    "palette": {
      "bg": "15 23 42",
      "surface": "27 35 53",
      "elevated": "39 46 63",
      "border": "56 62 78",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "148 163 184",
      "accentHover": "167 180 197",
      "violet": "56 189 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "paper-ink",
    "name": "Paper Ink",
    "emoji": "📄",
    "tagline": "High-contrast editorial white",
    "category": "Minimal & AMOLED",
    "isDark": false,
    "swatch": [
      "#ffffff",
      "#0f172a",
      "#2563eb"
    ],
    "effect": "none",
    "palette": {
      "bg": "255 255 255",
      "surface": "255 255 255",
      "elevated": "236 236 238",
      "border": "202 204 208",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "15 23 42",
      "accentHover": "13 20 36",
      "violet": "37 99 235",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "nordic-frost",
    "name": "Nordic Frost",
    "emoji": "🏔️",
    "tagline": "Scandinavian dark blue-grey",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#1a202c",
      "#88c0d0",
      "#81a1c1"
    ],
    "effect": "none",
    "palette": {
      "bg": "26 32 44",
      "surface": "37 43 55",
      "elevated": "49 54 65",
      "border": "65 70 80",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "136 192 208",
      "accentHover": "157 203 216",
      "violet": "129 161 193",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "carbon-fiber",
    "name": "Carbon Fiber",
    "emoji": "🏎️",
    "tagline": "Stealth carbon & racing red",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#0a0a0c",
      "#ef4444",
      "#f97316"
    ],
    "effect": "none",
    "palette": {
      "bg": "10 10 12",
      "surface": "22 22 24",
      "elevated": "34 34 36",
      "border": "52 52 53",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "239 68 68",
      "accentHover": "242 102 102",
      "violet": "249 115 22",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "charcoal-soft",
    "name": "Charcoal Soft",
    "emoji": "✏️",
    "tagline": "Easy-on-eyes matte charcoal",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#18181b",
      "#a1a1aa",
      "#38bdf8"
    ],
    "effect": "none",
    "palette": {
      "bg": "24 24 27",
      "surface": "36 36 38",
      "elevated": "47 47 50",
      "border": "63 63 66",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "161 161 170",
      "accentHover": "178 178 185",
      "violet": "56 189 248",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "espresso-dark",
    "name": "Espresso Dark",
    "emoji": "🫘",
    "tagline": "Warm dark roast & cream text",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#171311",
      "#d6b48c",
      "#f59e0b"
    ],
    "effect": "none",
    "palette": {
      "bg": "23 19 17",
      "surface": "35 31 29",
      "elevated": "46 43 41",
      "border": "62 59 57",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "214 180 140",
      "accentHover": "221 194 161",
      "violet": "245 158 11",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  },
  {
    "key": "chalk-minimal",
    "name": "Chalk Minimal",
    "emoji": "⬜",
    "tagline": "Soft off-white & cool indigo",
    "category": "Minimal & AMOLED",
    "isDark": false,
    "swatch": [
      "#f5f6f8",
      "#4f46e5",
      "#0ea5e9"
    ],
    "effect": "none",
    "palette": {
      "bg": "245 246 248",
      "surface": "255 255 255",
      "elevated": "232 232 246",
      "border": "208 207 244",
      "text": "30 27 46",
      "muted": "91 86 112",
      "accent": "79 70 229",
      "accentHover": "68 60 197",
      "violet": "14 165 233",
      "success": "22 163 74",
      "danger": "225 29 72",
      "warning": "217 119 6"
    },
    "effectTier": "normal"
  },
  {
    "key": "titanium",
    "name": "Titanium",
    "emoji": "⚙️",
    "tagline": "Brushed dark metal & ice cyan",
    "category": "Minimal & AMOLED",
    "isDark": true,
    "swatch": [
      "#111418",
      "#38bdf8",
      "#94a3b8"
    ],
    "effect": "none",
    "palette": {
      "bg": "17 20 24",
      "surface": "29 32 36",
      "elevated": "41 44 47",
      "border": "57 60 63",
      "text": "241 245 249",
      "muted": "148 163 184",
      "accent": "56 189 248",
      "accentHover": "92 201 249",
      "violet": "148 163 184",
      "success": "74 222 128",
      "danger": "248 113 113",
      "warning": "251 191 36"
    },
    "effectTier": "normal"
  }
];

const THEME_MAP = new Map<string, ThemeDefinition>(
  CHATTERBOX_THEMES.map((t) => [t.key, t])
);

export function getThemeDefinition(key?: string): ThemeDefinition {
  return (key && THEME_MAP.get(key)) || CHATTERBOX_THEMES[0];
}
