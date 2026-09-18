import { afterEach, describe, expect, it, vi } from 'vitest';

import { isLoginBlocked, LOGIN_LIMITS } from './admin-login-limit';
import { hashPassword, verifyPassword } from './admin-password';
import {
  ADMIN_SESSION_SECONDS,
  adminAuthConfig,
  createAdminToken,
  isValidAdminToken,
  type AdminAuthConfig,
} from './admin-token';

describe('heslo (scrypt)', () => {
  it('overí správne heslo a odmietne zlé', async () => {
    const stored = await hashPassword('Priesmyk-Furka-2436');
    expect(await verifyPassword('Priesmyk-Furka-2436', stored)).toBe(true);
    expect(await verifyPassword('priesmyk-furka-2436', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('hash neobsahuje $ — Next.js by ho v .env súbore rozbalil', async () => {
    expect(await hashPassword('Priesmyk-Furka-2436')).not.toContain('$');
  });

  it('rovnaké heslo dá zakaždým iný hash (soľ)', async () => {
    expect(await hashPassword('rovnake-heslo-123')).not.toBe(
      await hashPassword('rovnake-heslo-123'),
    );
  });

  it('pokazený uložený hash nikoho nepustí', async () => {
    for (const bad of ['', 'heslo', 'scrypt:', 'scrypt:abc', 'bcrypt:a:b', 'scrypt:a:b:c']) {
      expect(await verifyPassword('heslo', bad)).toBe(false);
    }
  });
});

describe('prihlasovací token', () => {
  const config: AdminAuthConfig = {
    secret: 'x'.repeat(40),
    passwordHash: 'scrypt:soľ:hash-povodneho-hesla',
  };
  const now = 1_757_000_000_000;

  it('platí počas 12 hodín a potom nie', () => {
    const token = createAdminToken(config, now);
    expect(isValidAdminToken(token, config, now + 60_000)).toBe(true);
    expect(isValidAdminToken(token, config, now + ADMIN_SESSION_SECONDS * 1000 + 1)).toBe(false);
  });

  it('zmena hesla odhlási všetky zariadenia', () => {
    const token = createAdminToken(config, now);
    const afterChange = { ...config, passwordHash: 'scrypt:ina:hash-noveho-hesla' };
    expect(isValidAdminToken(token, afterChange, now + 1000)).toBe(false);
  });

  it('zmena kľúča odhlási všetky zariadenia', () => {
    const token = createAdminToken(config, now);
    expect(isValidAdminToken(token, { ...config, secret: 'y'.repeat(40) }, now)).toBe(false);
  });

  it('bez nastavenia alebo bez cookie nepustí nikoho', () => {
    expect(isValidAdminToken(createAdminToken(config, now), null, now)).toBe(false);
    expect(isValidAdminToken(undefined, config, now)).toBe(false);
    expect(isValidAdminToken('', config, now)).toBe(false);
  });
});

describe('nastavenie z premenných prostredia', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('krátky kľúč = administrácia vypnutá', () => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', 'scrypt:a:b');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'kratky');
    expect(adminAuthConfig()).toBeNull();
  });

  it('bez hashu hesla = administrácia vypnutá', () => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'z'.repeat(40));
    expect(adminAuthConfig()).toBeNull();
  });

  it('s oboma hodnotami je zapnutá', () => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', 'scrypt:a:b');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'z'.repeat(40));
    expect(adminAuthConfig()).toEqual({ secret: 'z'.repeat(40), passwordHash: 'scrypt:a:b' });
  });
});

describe('limit pokusov', () => {
  it('piaty neúspech z jednej IP zamkne', () => {
    expect(isLoginBlocked({ ip: LOGIN_LIMITS.perIp - 1, global: 0 })).toBe(false);
    expect(isLoginBlocked({ ip: LOGIN_LIMITS.perIp, global: LOGIN_LIMITS.perIp })).toBe(true);
  });

  it('útok z mnohých adries zamkne celkovým limitom', () => {
    expect(isLoginBlocked({ ip: 0, global: LOGIN_LIMITS.global - 1 })).toBe(false);
    expect(isLoginBlocked({ ip: 0, global: LOGIN_LIMITS.global })).toBe(true);
  });
});
