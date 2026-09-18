'use server';

import { redirect } from 'next/navigation';

import { verifyPassword } from '@/lib/admin-password';
import {
  clientIp,
  createAdminSession,
  deleteAdminSession,
  loginBlocked,
  recordLoginAttempt,
} from '@/lib/admin-session';
import { adminAuthConfig } from '@/lib/admin-token';

/*
 * Server Actions administrácie. Každá je verejná POST adresa — dá sa zavolať
 * aj bez našej stránky. Prihlásenie je jediná, ktorá nevolá requireAdmin(),
 * lebo práve ono ho vydáva; ostatné (od kroku B) začínajú `await requireAdmin()`.
 */

export interface LoginState {
  error: string | null;
}

/** Dlhšie heslo nikto nemá; obmedzenie bráni zahlteniu scryptu obrovským vstupom. */
const MAX_PASSWORD_LENGTH = 200;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const config = adminAuthConfig();
  if (!config) {
    console.error('[admin] ADMIN_PASSWORD_HASH alebo ADMIN_SESSION_SECRET chýba');
    return { error: 'Administrácia nie je nastavená.' };
  }

  const ip = await clientIp();
  if (await loginBlocked(ip)) {
    return { error: 'Priveľa neúspešných pokusov. Skús to znova o 15 minút.' };
  }

  const password = formData.get('password');
  if (typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) {
    return { error: 'Zadaj heslo.' };
  }

  const ok = await verifyPassword(password, config.passwordHash);
  await recordLoginAttempt(ip, ok);

  // Rovnaká hláška pri každom neúspechu — nič nenapovedá, čo bolo zle
  if (!ok) return { error: 'Nesprávne heslo.' };

  await createAdminSession();
  redirect('/admin');
}

export async function logout(): Promise<void> {
  await deleteAdminSession();
  redirect('/admin/login');
}
