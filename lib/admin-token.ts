import { createHash } from 'node:crypto';

import { signToken, verifyToken } from './signed-token';

/**
 * Prihlásenie do administrácie: podpísaná cookie s dátumom platnosti.
 * Žiadna tabuľka sessions — pri jednom adminovi by to bola zbytočná vec navyše.
 *
 * Bez 'server-only' a bez next/headers, aby to vedel použiť proxy.ts aj testy.
 * Čítanie a zápis cookie rieši lib/admin-session.ts.
 */

export const ADMIN_COOKIE = 'sml_admin';
export const ADMIN_SESSION_SECONDS = 12 * 60 * 60;

/** Kratší kľúč sa dá uhádnuť — radšej administráciu nepustíme vôbec. */
const MIN_SECRET_LENGTH = 32;

interface AdminSessionPayload {
  /** Koniec platnosti v ms. */
  exp: number;
  /** Odtlačok hashu hesla — zmena hesla tak odhlási všetky zariadenia. */
  pv: string;
}

export interface AdminAuthConfig {
  secret: string;
  passwordHash: string;
}

/** null = administrácia nie je nastavená a nikoho nepustí (fail closed). */
export function adminAuthConfig(): AdminAuthConfig | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!secret || secret.length < MIN_SECRET_LENGTH || !passwordHash) return null;
  return { secret, passwordHash };
}

export function passwordVersion(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

export function createAdminToken(config: AdminAuthConfig, now: number): string {
  const payload: AdminSessionPayload = {
    exp: now + ADMIN_SESSION_SECONDS * 1000,
    pv: passwordVersion(config.passwordHash),
  };
  return signToken(payload, config.secret);
}

export function isValidAdminToken(
  token: string | undefined,
  config: AdminAuthConfig | null,
  now: number,
): boolean {
  if (!token || !config) return false;

  const payload = verifyToken(token, config.secret) as Partial<AdminSessionPayload> | null;
  if (!payload || typeof payload.exp !== 'number') return false;

  return payload.exp > now && payload.pv === passwordVersion(config.passwordHash);
}
