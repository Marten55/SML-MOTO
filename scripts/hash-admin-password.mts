/**
 * Vyrobí dva riadky do .env.local (a do premenných na Verceli):
 *
 *   ADMIN_PASSWORD_HASH  — scrypt hash hesla, samotné heslo sa nikam neukladá
 *   ADMIN_SESSION_SECRET — náhodný kľúč na podpis prihlasovacej cookie
 *
 * Spustenie: npm run admin:heslo
 *
 * Heslo sa zadáva až po spustení, nie ako parameter príkazu — parameter by
 * ostal v histórii terminálu. Po zadaní ho terminál ukáže; spusti to tam,
 * kde ti nikto nepozerá cez plece.
 */
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

import { hashPassword } from '../lib/admin-password.ts';

const MIN_LENGTH = 14;

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question('Nové heslo do administrácie: ')).trim();
rl.close();

if (password.length < MIN_LENGTH) {
  console.error(`Heslo má ${password.length} znakov, treba aspoň ${MIN_LENGTH}.`);
  process.exit(1);
}

console.log('\nSkopíruj do .env.local a do Vercelu (typ Secret):\n');
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(32).toString('base64url')}`);
console.log('\nSamotné heslo ulož do Bitwardenu. Mailom ani správou ho neposielaj.');
