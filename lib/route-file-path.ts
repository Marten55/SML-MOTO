/**
 * Kde v úložisku leží súbor trasy. Zámerne bez 'server-only' — cestu
 * potrebujú testy aj skript scripts/upload-route-files.mts.
 *
 * Tvar `<id trasy>/<meno súboru>`:
 * - ID sa nemení ani pri premenovaní trasy, takže zmena slugu nepokazí
 *   odkazy v e-mailoch, ktoré už zákazníci dostali,
 * - dve trasy nemôžu prepísať súbor tej druhej,
 * - súbory jednej trasy sa dajú zmazať naraz ako priečinok.
 */

/** Súkromný bucket v Supabase Storage. Bez overeného tokenu sa k nemu nikto nedostane. */
export const ROUTE_FILES_BUCKET = 'route-files';

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
// Bodka a pomlčka až za prvým znakom: meno nesmie začínať '.' (skryté súbory)
// a v kombinácii so zákazom '/' nemá ako vyjsť mimo priečinka trasy.
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Cesta k súboru v buckete, alebo null, keď ID či meno nevyzerá bezpečne.
 * Mená pochádzajú z našej databázy, nie od návštevníka — kontrola je tu pre
 * prípad, že sa do databázy niekedy dostane niečo, čo tam nemalo byť.
 */
export function routeFilePath(routeId: string, filename: string): string | null {
  if (!SAFE_ID.test(routeId)) return null;
  if (!SAFE_FILENAME.test(filename) || filename.includes('..')) return null;
  return `${routeId}/${filename}`;
}
