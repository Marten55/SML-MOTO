import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Podpísaný token bez databázy: údaje a HMAC-SHA256 podpis v jednom reťazci.
 * Kto nepozná tajný kľúč, nevie vyrobiť platný podpis — token sa teda nedá
 * podvrhnúť ani upraviť. Používa ho odkaz na zaplatenú trasu (lib/access.ts)
 * aj prihlásenie do administrácie (lib/admin-token.ts), každý s iným kľúčom.
 *
 * Formát `<base64url(JSON)>.<base64url(podpis)>` sa NESMIE zmeniť: zákazníci
 * majú v e-mailoch trvalé odkazy s tokenmi a všetky by prestali fungovať.
 * Chráni to test v lib/signed-token.test.ts.
 *
 * Bez 'server-only', lebo ho potrebuje aj proxy.ts a testy. Do prehliadača
 * sa aj tak nedostane — node:crypto by build pre klienta zhodil.
 */

export function signToken(payload: unknown, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${data}.${hmac(data, secret)}`;
}

/** Vráti obsah tokenu, alebo null, ak je podpis zlý alebo token poškodený. */
export function verifyToken(token: string, secret: string): unknown {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  const expected = Buffer.from(hmac(data, secret));
  const actual = Buffer.from(signature);

  // Rovnaká dĺžka je podmienka timingSafeEqual, inak hádže výnimku
  if (expected.length !== actual.length) return null;
  // Porovnanie v konštantnom čase — z dĺžky odpovede sa nedá hádať podpis po znakoch
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function hmac(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}
