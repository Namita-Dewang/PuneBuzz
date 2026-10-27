import { Cpu, Music, Palette, Sparkles, Trophy, UtensilsCrossed } from 'lucide-react';

// Must match CATEGORIES in server/src/validators/events.schemas.js.
export const CATEGORIES = [
  { value: 'tech', label: 'Tech' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'food', label: 'Food' },
  { value: 'workshop', label: 'Workshop' },
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

export const CATEGORY_ICONS = {
  all: Sparkles,
  tech: Cpu,
  music: Music,
  sports: Trophy,
  food: UtensilsCrossed,
  workshop: Palette,
};

// One soft colour per category (tokens in tailwind.config.js: tech indigo,
// music rose, sports emerald, food amber, workshop sky), used everywhere a
// category appears. Full class names on purpose, so Tailwind can see them.
//   dot    small marker          text   label/icon colour
//   badge  pill on soft fill     chip   selected filter chip
//   band   card header gradient  glyph  large faded icon on feature cards
export const CATEGORY_THEME = {
  tech: {
    dot: 'bg-cat-tech',
    text: 'text-cat-tech',
    badge: 'bg-cat-tech-soft text-cat-tech',
    chip: 'border-cat-tech/45 bg-cat-tech-soft text-cat-tech',
    band: 'bg-linear-to-br from-cat-tech/30 via-cat-tech-soft to-cat-tech-soft/30 dark:from-cat-tech-soft dark:via-cat-tech-soft/70 dark:to-surface',
    glyph: 'text-cat-tech/20 dark:text-cat-tech/12',
  },
  music: {
    dot: 'bg-cat-music',
    text: 'text-cat-music',
    badge: 'bg-cat-music-soft text-cat-music',
    chip: 'border-cat-music/45 bg-cat-music-soft text-cat-music',
    band: 'bg-linear-to-br from-cat-music/30 via-cat-music-soft to-cat-music-soft/30 dark:from-cat-music-soft dark:via-cat-music-soft/70 dark:to-surface',
    glyph: 'text-cat-music/20 dark:text-cat-music/12',
  },
  sports: {
    dot: 'bg-cat-sports',
    text: 'text-cat-sports',
    badge: 'bg-cat-sports-soft text-cat-sports',
    chip: 'border-cat-sports/45 bg-cat-sports-soft text-cat-sports',
    band: 'bg-linear-to-br from-cat-sports/30 via-cat-sports-soft to-cat-sports-soft/30 dark:from-cat-sports-soft dark:via-cat-sports-soft/70 dark:to-surface',
    glyph: 'text-cat-sports/20 dark:text-cat-sports/12',
  },
  food: {
    dot: 'bg-cat-food',
    text: 'text-cat-food',
    badge: 'bg-cat-food-soft text-cat-food',
    chip: 'border-cat-food/45 bg-cat-food-soft text-cat-food',
    band: 'bg-linear-to-br from-cat-food/30 via-cat-food-soft to-cat-food-soft/30 dark:from-cat-food-soft dark:via-cat-food-soft/70 dark:to-surface',
    glyph: 'text-cat-food/20 dark:text-cat-food/12',
  },
  workshop: {
    dot: 'bg-cat-workshop',
    text: 'text-cat-workshop',
    badge: 'bg-cat-workshop-soft text-cat-workshop',
    chip: 'border-cat-workshop/45 bg-cat-workshop-soft text-cat-workshop',
    band: 'bg-linear-to-br from-cat-workshop/30 via-cat-workshop-soft to-cat-workshop-soft/30 dark:from-cat-workshop-soft dark:via-cat-workshop-soft/70 dark:to-surface',
    glyph: 'text-cat-workshop/20 dark:text-cat-workshop/12',
  },
};

// For "All" and any unknown category.
export const NEUTRAL_THEME = {
  dot: 'bg-ink-subtle',
  text: 'text-ink-muted',
  badge: 'bg-sunken text-ink-muted',
  chip: 'border-accent/45 bg-accent-soft text-accent',
  band: 'bg-sunken',
  glyph: 'text-ink-subtle/20',
};

export const categoryTheme = (category) => CATEGORY_THEME[category] ?? NEUTRAL_THEME;

export const PAGE_SIZE = 12;

// Footer link. Set VITE_GITHUB_URL in client/.env to your repository.
export const GITHUB_URL = import.meta.env.VITE_GITHUB_URL || 'https://github.com';
