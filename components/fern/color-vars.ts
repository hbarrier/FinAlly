export const COLOR_VARS: Record<
  string,
  { bg: string; ink: string; solid: string }
> = {
  terracotta: {
    bg: 'var(--terracotta-bg)',
    ink: 'var(--terracotta-ink)',
    solid: 'var(--terracotta)',
  },
  sage: {
    bg: 'var(--sage-bg)',
    ink: 'var(--sage-ink)',
    solid: 'var(--sage)',
  },
  rose: {
    bg: 'var(--rose-bg)',
    ink: 'var(--rose-ink)',
    solid: 'var(--rose)',
  },
  teal: {
    bg: 'var(--teal-bg)',
    ink: 'var(--teal-ink)',
    solid: 'var(--teal)',
  },
  lilac: {
    bg: 'var(--lilac-bg)',
    ink: 'var(--lilac-ink)',
    solid: 'var(--lilac)',
  },
  butter: {
    bg: 'var(--butter-bg)',
    ink: 'var(--butter-ink)',
    solid: 'var(--butter)',
  },
}

export const CATEGORY_COLORS = [
  'terracotta',
  'sage',
  'rose',
  'teal',
  'lilac',
  'butter',
] as const

export const CATEGORY_ICONS = [
  'cat-cart',
  'cat-house',
  'cat-bus',
  'cat-fork',
  'cat-film',
  'cat-heart',
  'cat-shirt',
  'cat-bulb',
  'cat-plane',
  'cat-book',
  'cat-briefcase',
  'cat-pen',
  'cat-gift',
  'cat-chart',
  'cat-coffee',
  'cat-phone',
  'cat-fuel',
  'cat-paw',
  'cat-seed',
  'cat-dots',
  'cat-bank',
  'cat-education',
  'tag',
  'cat-gov',
  'cat-divorce',
  'cat-holidays',
] as const
