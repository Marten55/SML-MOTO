/**
 * Názov trasy → časť adresy a názvu súboru: „Furka · Grimsel · Susten"
 * → `furka-grimsel-susten`. Rovnaký tvar vyžaduje stĺpec slug v databáze.
 *
 * Diakritika sa odstráni cez normalizáciu Unicode: „ž" sa rozloží na „z"
 * a samostatný mäkčeň, ktorý potom `\p{Diacritic}` zmaže.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}
