/** Single source of truth for URL paths. Import these instead of writing paths inline. */
export const ROUTES = {
  home: '/',
  login: '/login',
  approvals: '/approvals',
  activity: '/activity',
  permissions: '/permissions',
  connect: '/connect',
} as const;

/** Pages shown in the header once logged in. */
export const NAV_LINKS = [
  { to: ROUTES.home, label: 'Today' },
  { to: ROUTES.approvals, label: 'Approvals' },
  { to: ROUTES.activity, label: 'Activity' },
  { to: ROUTES.permissions, label: 'Permissions' },
  { to: ROUTES.connect, label: 'Connect' },
] as const;
