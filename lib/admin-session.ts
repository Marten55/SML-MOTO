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

const memoryAttempts: { ip: string; succeeded: boolean; at: number }[] = [];

export async function loginBlocked(ip: string): Promise<boolean> {
  const since = Date.now() - LOGIN_LIMITS.windowMinutes * 60_000;

  if (!isSupabaseConfigured()) {
    const failures = memoryAttempts.filter((a) => !a.succeeded && a.at > since);
    return isLoginBlocked({
      ip: failures.filter((a) => a.ip === ip).length,
      global: failures.length,
    });
  }

  const sinceIso = new Date(since).toISOString();
  const table = () =>
    adminClient()
      .from('admin_login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('succeeded', false)
      .gte('attempted_at', sinceIso);

  const [byIp, all] = await Promise.all([table().eq('ip', ip), table()]);

  // Keď databáza neodpovie, radšej nepustíme nikoho, než by limit nefungoval
  if (byIp.error || all.error) {
    console.error('[admin] Limit pokusov sa nedá overiť', byIp.error ?? all.error);
    return true;
  }

  return isLoginBlocked({ ip: byIp.count ?? 0, global: all.count ?? 0 });
}

export async function recordLoginAttempt(ip: string, succeeded: boolean): Promise<void> {
  if (!isSupabaseConfigured()) {
    memoryAttempts.push({ ip, succeeded, at: Date.now() });
    return;
  }

  const { error } = await adminClient()
    .from('admin_login_attempts')
    .insert({ ip, succeeded });
  if (error) console.error('[admin] Pokus o prihlásenie sa nezapísal', error);
}
