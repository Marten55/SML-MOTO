import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Heslo do administrácie nie je v premenných prostredia čitateľne, ale ako
 * scrypt hash. Kto uvidí nastavenia na Verceli alebo unikne .env, heslo z toho
 * nezíska — scrypt je zámerne pomalý a náročný na pamäť, takže hádanie je drahé.
 *
 * Formát `scrypt:<soľ>:<hash>` v base64url. Oddeľovač je dvojbodka, nie $:
 * Next.js v .env súboroch rozbaľuje `$NIECO` ako odkaz na inú premennú
 * a hash by sa ticho pokazil.
 *
 * Hash vyrobí `npm run admin:heslo` (scripts/hash-admin-password.ts).
 */

const KEY_LENGTH = 64;
const PREFIX = 'scrypt';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return [PREFIX, salt.toString('base64url'), key.toString('base64url')].join(':');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [prefix, saltText, keyText, ...rest] = stored.split(':');
  if (prefix !== PREFIX || !saltText || !keyText || rest.length > 0) return false;

  const expected = Buffer.from(keyText, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, Buffer.from(saltText, 'base64url'));
  return timingSafeEqual(expected, actual);
}
