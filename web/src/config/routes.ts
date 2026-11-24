/** Single source of truth for URL paths. Import these instead of writing paths inline. */
export const ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  assistant: '/assistant',
  approvals: '/approvals',
  activity: '/activity',
  permissions: '/permissions',
  connect: '/connect',
} as const;

/** Pages shown in the header once logged in. */
export const NAV_LINKS = [
  { to: ROUTES.home, label: 'Dashboard' },
  { to: ROUTES.assistant, label: 'Assistant' },
  { to: ROUTES.approvals, label: 'Approvals' },
  { to: ROUTES.permissions, label: 'MCP tools' },
  { to: ROUTES.activity, label: 'Activity' },
  { to: ROUTES.connect, label: 'Connect' },
] as const;
