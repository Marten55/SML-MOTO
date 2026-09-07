import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Prístup k zaplatenej trase bez databázy a bez prihlasovania.
 *
 * Rozhodnutie C z ponuky: odkaz platí trvalo. Pôvodný návrh bol token na
 * 24 hodín alebo 5 otvorení — pri produkte, ktorý si človek kupuje týždne
 * pred dovolenkou a na ceste otvára opakovane, by to vyrábalo reklamácie.
 *
 * Token je podpísaný sám sebou: nesie údaje aj podpis, takže sa nemusí nikde
 * ukladať a zároveň sa nedá podvrhnúť. Kto ho má, ten zaplatil.
 */

export interface AccessPayload {
  /** Ktorá trasa. */
  routeId: string;
  /** Referencia na platbu — na dohľadanie pri podpore, bez osobných údajov. */
  ref: string;
  /** Kedy bol vydaný (ms). Needôveruje sa mu pri platnosti, je to len stopa. */
  issuedAt: number;
}

function getSecret(): string {
  const secret = process.env.DOWNLOAD_SIGNING_SECRET;
  if (!secret) {
    throw new Error(
      'DOWNLOAD_SIGNING_SECRET nie je nastavený — bez neho sa nedajú vydávať odkazy na stiahnutie.',
    );
  }
  return secret;
}

export function isAccessConfigured(): boolean {
  return Boolean(process.env.DOWNLOAD_SIGNING_SECRET);
}

const b64url = {
  encode: (buf: Buffer) => buf.toString('base64url'),
  decode: (str: string) => Buffer.from(str, 'base64url'),
};

function sign(data: string): string {
  return b64url.encode(createHmac('sha256', getSecret()).update(data).digest());
}

export function createAccessToken(payload: AccessPayload): string {
  const data = b64url.encode(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${data}.${sign(data)}`;
}

export function verifyAccessToken(token: string): AccessPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [data, signature] = parts;

  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);

  // Rovnaká dĺžka je podmienka timingSafeEqual, inak hádže výnimku
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(b64url.decode(data).toString('utf8')) as AccessPayload;
    if (!payload.routeId || typeof payload.issuedAt !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}

/** Ktoré súbory sa dajú stiahnuť. Roadbook je len pri Gold. */
export const DOWNLOAD_KINDS = ['track', 'navigation', 'poi', 'roadbook'] as const;
export type DownloadKind = (typeof DOWNLOAD_KINDS)[number];

export function isDownloadKind(value: string): value is DownloadKind {
  return (DOWNLOAD_KINDS as readonly string[]).includes(value);
}

export function downloadUrl(token: string, kind: DownloadKind): string {
  const params = new URLSearchParams({ token, kind });
  return `/api/download?${params.toString()}`;
}
