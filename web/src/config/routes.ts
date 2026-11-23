/** Single source of truth for URL paths. Import these instead of writing paths inline. */
export const ROUTES = {
  home: '/',
  items: '/items',
} as const;

export const NAV_LINKS = [
  { to: ROUTES.home, label: 'Home' },
  { to: ROUTES.items, label: 'Items' },
] as const;
