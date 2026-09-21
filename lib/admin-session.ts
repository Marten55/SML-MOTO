import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { isLoginBlocked, LOGIN_LIMITS } from './admin-login-limit';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminAuthConfig,
  createAdminToken,
  isValidAdminToken,
} from './admin-token';
import { adminClient, isSupabaseConfigured } from './supabase';

/**
 * Data Access Layer pre administráciu. Každá stránka AJ každá Server Action
 * administrácie začína `await requireAdmin()`. Server Action je verejná POST
 * adresa — dá sa zavolať aj mimo našej stránky, takže kontrola na stránke
 * ani v proxy.ts ju nechráni.
 */

const cookieOptions = {
  httpOnly: true,
  // Lokálne beží http, na serveri vždy https
  secure: process.env.NODE_ENV === 'production',
  // Administrácia nepotrebuje cookie pri príchode z cudzieho webu
  sameSite: 'strict',
  path: '/admin',
} as const;

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token, adminAuthConfig(), Date.now());
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}

export async function createAdminSession(): Promise<void> {
  const config = adminAuthConfig();
  if (!config) throw new Error('Administrácia nie je nastavená.');

  (await cookies()).set(ADMIN_COOKIE, createAdminToken(config, Date.now()), {
    ...cookieOptions,
    maxAge: ADMIN_SESSION_SECONDS,
  });
}

export async function deleteAdminSession(): Promise<void> {
  // Mazanie musí mať rovnakú cestu ako zápis, inak prehliadač cookie nechá
  (await cookies()).set(ADMIN_COOKIE, '', { ...cookieOptions, maxAge: 0 });
}

/**
 * IP adresu na Verceli dopĺňa ich infraštruktúra do x-forwarded-for; prvá
 * hodnota je návštevník. Lokálne tam nie je nič a vráti sa 'local'.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || h.get('x-real-ip') || 'local';
}

// ── Limit pokusov ──────────────────────────────────────────────────────────
// V databáze, lebo na Verceli beží viac inštancií naraz. Pamäť slúži len pri
// lokálnom vývoji bez Supabase.
//
// Poradie je dôležité: pokus sa zapíše ako neúspešný UŽ PRED overením hesla
// a až potom sa počíta. Pôvodne to bolo naopak (spočítaj → over → zapíš)
// a 12 pokusov odoslaných naraz prešlo všetkých 12 — každý videl počítadlo
// ešte pred zápisom ostatných. Takto sa súbežné pokusy navzájom vidia.

interface MemoryAttempt {
  id: number;
  ip: string;
  succeeded: boolean;
  at: number;
}
const memoryAttempts: MemoryAttempt[] = [];

export interface LoginAttempt {
  /** null = zápis zlyhal; taký pokus je vždy zablokovaný. */
  id: number | null;
  blocked: boolean;
}

export async function beginLoginAttempt(ip: string): Promise<LoginAttempt> {
  const since = Date.now() - LOGIN_LIMITS.windowMinutes * 60_000;

  if (!isSupabaseConfigured()) {
    const attempt: MemoryAttempt = { id: memoryAttempts.length + 1, ip, succeeded: false, at: Date.now() };
    memoryAttempts.push(attempt);
    const failures = memoryAttempts.filter((a) => !a.succeeded && a.at > since);
    return {
      id: attempt.id,
      // Mínus jeden = bez práve prebiehajúceho pokusu
      blocked: isLoginBlocked({
        ip: failures.filter((a) => a.ip === ip).length - 1,
        global: failures.length - 1,
      }),
    };
  }

  const inserted = await adminClient()
    .from('admin_login_attempts')
    .insert({ ip, succeeded: false })
    .select('id')
    .single();

  // Keď databáza neodpovie, radšej nepustíme nikoho, než by limit nefungoval
  if (inserted.error) {
    console.error('[admin] Pokus o prihlásenie sa nezapísal', inserted.error);
    return { id: null, blocked: true };
  }

  const sinceIso = new Date(since).toISOString();
  const failures = () =>
    adminClient()
      .from('admin_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('succeeded', false)
      .gte('attempted_at', sinceIso);

  const [byIp, all] = await Promise.all([failures().eq('ip', ip), failures()]);

  if (byIp.error || all.error || byIp.count === null || all.count === null) {
    console.error('[admin] Limit pokusov sa nedá overiť', byIp.error ?? all.error);
    return { id: inserted.data.id, blocked: true };
  }

  return {
    id: inserted.data.id,
    blocked: isLoginBlocked({ ip: byIp.count - 1, global: all.count - 1 }),
  };
}

export async function markLoginSucceeded(attempt: LoginAttempt): Promise<void> {
  if (attempt.id === null) return;

  if (!isSupabaseConfigured()) {
    const found = memoryAttempts.find((a) => a.id === attempt.id);
    if (found) found.succeeded = true;
    return;
  }

  const { error } = await adminClient()
    .from('admin_login_attempts')
    .update({ succeeded: true })
    .eq('id', attempt.id);
  if (error) console.error('[admin] Úspešné prihlásenie sa nezapísalo', error);
}
