/**
 * Kontrola DATABASE_URL ešte pred prvým spojením.
 *
 * Poučenie z 21. 9. 2026 (preklep v adrese Supabase): zlá adresa inak
 * skončí hláškou „fetch failed", ktorá nepovie nič — skutočná príčina je
 * schovaná v error.cause a do logu Vercelu sa nedostane.
 *
 * Bez 'server-only', aby to vedeli použiť testy aj skripty v scripts/.
 */

/** null = adresa je v poriadku, inak zrozumiteľný popis chyby. */
export function databaseUrlProblem(url: string | undefined): string | null {
  if (!url) return 'DATABASE_URL nie je nastavený — pozri .env.example.';

  const hints: string[] = [];
  if (/["'\s]/.test(url)) hints.push('obsahuje úvodzovky alebo medzeru');
  if (!/^postgres(ql)?:\/\//.test(url)) hints.push('nezačína na postgresql://');

  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    hints.push('nedá sa prečítať ako adresa');
  }
  if (parsed) {
    if (!parsed.password) hints.push('chýba heslo (časť medzi : a @)');
    if (parsed.pathname.length <= 1) hints.push('chýba názov databázy za lomkou');
  }

  if (hints.length === 0) return null;
  return `DATABASE_URL musí mať tvar postgresql://<používateľ>:<heslo>@<server>/<databáza> — ${hints.join(', ')}.`;
}
