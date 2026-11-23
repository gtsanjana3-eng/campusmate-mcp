/**
 * Logging standard: one JSON line per event, with an event name and plain fields.
 * Fields whose name looks secret are always redacted, so a careless call can't leak a token.
 */
type Fields = Record<string, unknown>;

const SECRET_KEY = /token|secret|passcode|password|cookie|authorization/i;

export function redact(fields: Fields): Fields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      SECRET_KEY.test(key) ? '[redacted]' : value,
    ]),
  );
}

const write = (level: 'info' | 'error', event: string, fields: Fields) => {
  const line = JSON.stringify({ at: new Date().toISOString(), level, event, ...redact(fields) });
  if (level === 'error') console.error(line);
  else console.info(line);
};

export const log = {
  info: (event: string, fields: Fields = {}) => write('info', event, fields),
  error: (event: string, error: unknown, fields: Fields = {}) =>
    write('error', event, {
      ...fields,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    }),
};
