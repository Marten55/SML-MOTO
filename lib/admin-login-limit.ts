/**
 * Limit pokusov o prihlásenie. Rozhodnutie je čistá funkcia bez databázy,
 * aby sa dalo otestovať; počty dodáva lib/admin-session.ts.
 *
 * Dve hranice, lebo každá chráni pred iným útokom:
 * - na IP adresu — jeden útočník skúšajúci heslá za sebou,
 * - celková — útok z mnohých adries naraz.
 *
 * Cena celkovej hranice: útočník ňou vie Miroslava na 15 minút zamknúť.
 * Pri jednom adminovi a silnom hesle je to prijateľná daň za to, že
 * hádanie hesla z tisícky adries nejde.
 */
export const LOGIN_LIMITS = {
  windowMinutes: 15,
  perIp: 5,
  global: 50,
} as const;

export function isLoginBlocked(failures: { ip: number; global: number }): boolean {
  return failures.ip >= LOGIN_LIMITS.perIp || failures.global >= LOGIN_LIMITS.global;
}
