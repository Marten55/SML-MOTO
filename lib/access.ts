import 'server-only';

import { signToken, verifyToken } from './signed-token';

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

export function createAccessToken(payload: AccessPayload): string {
  return signToken(payload, getSecret());
}

export function verifyAccessToken(token: string): AccessPayload | null {
  const payload = verifyToken(token, getSecret()) as Partial<AccessPayload> | null;
  if (!payload?.routeId || typeof payload.issuedAt !== 'number') return null;
  return payload as AccessPayload;
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
