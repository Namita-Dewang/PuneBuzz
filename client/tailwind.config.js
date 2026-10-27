// PuneBuzz design system: "the city's evenings, gathered in one place".
//
// All colours are semantic tokens. Components use names like `bg-surface`,
// `text-ink-muted` or `bg-accent`, never raw hex values or Tailwind palette
// colours. Each token is a CSS variable defined below for light (:root) and
// dark (.dark), so dark mode is just a class on <html>, and components rarely
// need `dark:` variants.
//
// Tailwind 4 loads this file through `@config` in src/index.css.
import plugin from 'tailwindcss/plugin';

const light = {
  // surfaces
  canvas: '#FAF7F2', // warm off-white page background
  surface: '#FFFDF9', // cards, inputs
  sunken: '#F3EEE6', // wells, table headers, skeletons
  // text
  ink: '#1C1917', // deep ink
  'ink-muted': '#6B635C', // secondary text (AA on canvas)
  'ink-subtle': '#A39A91', // placeholders, decorative
  // lines
  line: '#E7E0D6',
  'line-strong': '#D6CCBF',
  // the one accent: terracotta
  accent: '#C2410C',
  'accent-hover': '#9A3412',
  'accent-soft': '#FBEADF',
  'on-accent': '#FFFFFF',
  // status
  success: '#2F7A4A',
  'success-soft': '#E6F2E8',
  warning: '#A55B0B',
  'warning-soft': '#FBF0D9',
  closed: '#78716C',
  'closed-soft': '#EFEAE3',
  danger: '#B42318',
  'danger-soft': '#FBE8E5',
  'on-danger': '#FFFFFF',
  // categories: one soft colour each, used on chips, card bands and badges.
  // The base value is readable text on its -soft background (WCAG AA).
  'cat-tech': '#4F46E5', // indigo
  'cat-tech-soft': '#EEF0FF',
  'cat-music': '#BE123C', // rose
  'cat-music-soft': '#FFF0F3',
  'cat-sports': '#047857', // emerald
  'cat-sports-soft': '#E6F5EE',
  'cat-food': '#B45309', // amber
  'cat-food-soft': '#FEF3DF',
  'cat-workshop': '#0369A1', // sky
  'cat-workshop-soft': '#E6F4FC',
  // hero glow (warm)
  glow: 'rgb(234 88 12 / 0.16)',
  'glow-2': 'rgb(245 158 11 / 0.12)',
  // focus ring
  ring: '#C2410C',
};

// Shadows are theme tokens too: warm and faint on light, deeper on dark,
// where a light-tinted shadow would simply disappear.
const lightShadows = {
  soft: '0 1px 2px rgb(28 25 23 / 0.05), 0 1px 1px rgb(28 25 23 / 0.03)',
  lift: '0 14px 30px -14px rgb(28 25 23 / 0.22), 0 2px 6px rgb(28 25 23 / 0.05)',
  pop: '0 24px 48px -16px rgb(28 25 23 / 0.28)',
};
const darkShadows = {
  soft: '0 1px 2px rgb(0 0 0 / 0.5)',
  lift: '0 18px 36px -14px rgb(0 0 0 / 0.75), 0 0 0 1px rgb(255 237 213 / 0.04)',
  pop: '0 28px 56px -16px rgb(0 0 0 / 0.85), 0 0 0 1px rgb(255 237 213 / 0.05)',
};

const dark = {
  canvas: '#141210',
  surface: '#1C1916',
  sunken: '#24201C',
  ink: '#F4EEE6', // warm off-white text
  'ink-muted': '#B5ACA2',
  'ink-subtle': '#7D746B',
  line: '#2E2925',
  'line-strong': '#3D3631',
  accent: '#EA580C',
  'accent-hover': '#F97316',
  'accent-soft': '#3A1F12',
  'on-accent': '#1A110B', // dark text on the brighter orange keeps AA contrast
  success: '#6FC28B',
  'success-soft': '#1C2A20',
  warning: '#E9A93B',
  'warning-soft': '#2E2414',
  closed: '#A8A29E',
  'closed-soft': '#24201C',
  danger: '#F2897D',
  'danger-soft': '#301A17',
  'on-danger': '#1A110B',
  'cat-tech': '#A5B4FC',
  'cat-tech-soft': '#1E2040',
  'cat-music': '#FDA4AF',
  'cat-music-soft': '#3B1820',
  'cat-sports': '#6EE7B7',
  'cat-sports-soft': '#11291F',
  'cat-food': '#FCD34D',
  'cat-food-soft': '#33270D',
  'cat-workshop': '#7DD3FC',
  'cat-workshop-soft': '#0F2738',
  glow: 'rgb(234 88 12 / 0.3)',
  'glow-2': 'rgb(180 83 9 / 0.14)',
  ring: '#EA580C',
};

const toVars = (tokens, prefix = '--pb-') =>
  Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`${prefix}${name}`, value]));

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: Object.fromEntries(Object.keys(light).map((name) => [name, `var(--pb-${name})`])),
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      fontSize: {
        // Confident editorial titles; body copy stays at a comfortable 15-16px.
        display: ['clamp(2.25rem, 1.6rem + 2.6vw, 3.75rem)', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
        title: ['clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        heading: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
      },
      maxWidth: {
        prose: '65ch',
        page: '72rem',
      },
      borderRadius: {
        '2xl': '1.125rem',
      },
      boxShadow: {
        // "lift" is the hover state for interactive cards. Values per theme above.
        soft: 'var(--pb-shadow-soft)',
        lift: 'var(--pb-shadow-lift)',
        pop: 'var(--pb-shadow-pop)',
      },
      // Motion: only 150-200ms transitions on hover and focus (no entrance
      // animations). Skeletons pulse while loading.
      transitionDuration: {
        DEFAULT: '150ms',
      },
      // The one deliberate animation: the booking success moment. Applied with
      // motion-safe: so prefers-reduced-motion gets a static check instead.
      keyframes: {
        'check-pop': {
          '0%': { transform: 'scale(0.4)', opacity: '0' },
          '60%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'check-draw': {
          from: { strokeDashoffset: '24' },
          to: { strokeDashoffset: '0' },
        },
        'success-ring': {
          from: { boxShadow: '0 0 0 0 var(--pb-success)' },
          to: { boxShadow: '0 0 0 10px transparent' },
        },
      },
      animation: {
        'check-pop': 'check-pop 360ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'check-draw': 'check-draw 320ms ease-out 120ms both',
        'success-ring': 'success-ring 700ms ease-out',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': { ...toVars(light), ...toVars(lightShadows, '--pb-shadow-'), colorScheme: 'light' },
        '.dark': { ...toVars(dark), ...toVars(darkShadows, '--pb-shadow-'), colorScheme: 'dark' },
      });
    }),
  ],
};
