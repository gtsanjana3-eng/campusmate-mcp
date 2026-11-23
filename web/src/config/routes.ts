/** Single source of truth for URL paths. Import these instead of writing paths inline. */
export const ROUTES = {
  home: '/',
  login: '/login',
  connect: '/connect',
} as const;

/** Pages shown in the header once logged in. Today, Approvals, Activity and Permissions join later. */
export const NAV_LINKS = [{ to: ROUTES.connect, label: 'Connect' }] as const;
