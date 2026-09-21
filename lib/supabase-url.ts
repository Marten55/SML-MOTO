/**
 * Kontrola adresy projektu Supabase ešte pred prvým spojením.
 *
 * Preklep v adrese (21. 9. 2026: `.supabase.com` namiesto `.supabase.co`)
 * inak skončí hláškou „fetch failed", ktorá nepovie nič — skutočná príčina
 * (ENOTFOUND) je schovaná v error.cause a do logu Vercelu sa nedostane.
 *
 * Zámerne prísne: vlastnú doménu pre Supabase nepoužívame. Keby sme ju raz
 * nastavili, treba ju sem doplniť.
 *
 * Bez 'server-only', aby to vedeli použiť testy aj scripts/seed-routes.mts.
 */

const PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/;

/** null = adresa je v poriadku, inak zrozumiteľný popis chyby. */
export function supabaseUrlProblem(url: string | undefined): string | null {
  if (!url) return 'SUPABASE_URL nie je nastavený — pozri .env.example.';
  if (PATTERN.test(url)) return null;

  const hints: string[] = [];
  if (/\.supabase\.com\b/.test(url)) hints.push('končí na .supabase.com, správne je .supabase.co');
  if (/["'\s]/.test(url)) hints.push('obsahuje úvodzovky alebo medzeru');
  if (!url.startsWith('https://')) hints.push('nezačína na https://');
  if (/\.supabase\.co\/./.test(url)) hints.push('za .co nemá byť žiadna cesta');

  return (
    'SUPABASE_URL musí mať tvar https://<id-projektu>.supabase.co' +
    (hints.length ? ` — ${hints.join(', ')}` : '') +
    '.'
  );
}
