import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Encrypts small secrets (OAuth refresh tokens) before they are stored, with AES-256-GCM and a key
 * derived from SESSION_SECRET. A copied database file alone does not reveal the tokens.
 */
export function createSecretBox(secret: string) {
  const key = Buffer.from(hkdfSync('sha256', secret, 'campusmate', 'integration-tokens', 32));

  return {
    seal(plain: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
    },
    open(sealed: string): string {
      const [iv, tag, data] = sealed.split('.').map((part) => Buffer.from(part, 'base64url'));
      if (!iv || !tag || !data) throw new Error('Malformed sealed value');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    },
  };
}

export type SecretBox = ReturnType<typeof createSecretBox>;
