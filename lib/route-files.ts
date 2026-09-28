import 'server-only';

import { ROUTE_FILES_BUCKET, routeFilePath } from './route-file-path';
import { adminClient } from './supabase';

/**
 * Súbory trás (GPX, roadbook) v súkromnom buckete Supabase Storage.
 *
 * Prečo nie na disku: repo je verejné, takže skutočné GPX nesmú byť v gite,
 * a na Verceli sa za behu na disk zapisovať nedá — trasa pridaná
 * z administrácie by nemala kam.
 *
 * Bucket nemá žiadne pravidlá pre verejný kľúč, takže ho vidí len server
 * so secret kľúčom. Vytvára ho scripts/upload-route-files.mts.
 */

/**
 * Ako dlho platí odkaz na stiahnutie. Prehliadač ho otvorí hneď po
 * presmerovaní, takže minúta stačí. Trvalý je token v e-maile, nie tento odkaz.
 */
const SIGNED_URL_SECONDS = 60;

/**
 * Krátkodobý odkaz, ktorý súbor rovno stiahne pod jeho menom. Súbor tak
 * nejde cez funkciu na Verceli — tá unesie najviac 4,5 MB a platila by sa
 * za každý prenesený bajt.
 *
 * Volať LEN po overení tokenu zaplatenej trasy alebo admina.
 */
export async function signedDownloadUrl(routeId: string, filename: string): Promise<string | null> {
  const path = routeFilePath(routeId, filename);
  if (!path) {
    console.error(`[route-files] nebezpečná cesta: ${routeId} / ${filename}`);
    return null;
  }

  const { data, error } = await adminClient()
    .storage.from(ROUTE_FILES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS, { download: filename });

  if (error || !data) {
    // Najčastejšie súbor v úložisku chýba — zákazník zaplatil, takže to treba vidieť v logu
    console.error(`[route-files] ${path}: ${error?.message ?? 'bez odkazu'}`);
    return null;
  }
  return data.signedUrl;
}

// ── Nahratie novej trasy (krok D3) ─────────────────────────────────────────
//
// Volať LEN za requireAdmin() a s cestami z overeného lístka (lib/route-upload.ts).

/**
 * Jednorazové adresy, na ktoré prehliadač nahrá zdrojový export. Každá platí
 * len pre svoju cestu a len na jedno nahratie — overené proti Supabase 28. 9.
 * Prehliadač pri tom nepotrebuje žiadny náš kľúč.
 */
export async function signedSourceUploads(paths: string[]): Promise<string[] | null> {
  const bucket = adminClient().storage.from(ROUTE_FILES_BUCKET);
  const urls: string[] = [];
  for (const path of paths) {
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error || !data) {
      console.error(`[route-files] adresa na nahratie ${path}: ${error?.message ?? 'bez odkazu'}`);
      return null;
    }
    urls.push(data.signedUrl);
  }
  return urls;
}

/** Stiahne nahraté zdroje ako text. null, keď niektorý chýba (prehliadač ho nenahral). */
export async function downloadSources(paths: string[]): Promise<{ path: string; content: string }[] | null> {
  const bucket = adminClient().storage.from(ROUTE_FILES_BUCKET);
  const files: { path: string; content: string }[] = [];
  for (const path of paths) {
    const { data, error } = await bucket.download(path);
    if (error || !data) {
      console.error(`[route-files] zdroj ${path}: ${error?.message ?? 'prázdny'}`);
      return null;
    }
    files.push({ path, content: await data.text() });
  }
  return files;
}

/** Uloží vygenerované GPX balíčka pod menami, ktoré dostane zákazník. */
export async function uploadPackageFiles(
  routeId: string,
  files: { filename: string; content: string }[],
): Promise<boolean> {
  const bucket = adminClient().storage.from(ROUTE_FILES_BUCKET);
  for (const { filename, content } of files) {
    const path = routeFilePath(routeId, filename);
    if (!path) {
      console.error(`[route-files] nebezpečná cesta: ${routeId} / ${filename}`);
      return false;
    }
    const { error } = await bucket.upload(path, new Blob([content], { type: 'application/gpx+xml' }), {
      contentType: 'application/gpx+xml',
    });
    if (error) {
      console.error(`[route-files] ${path}: ${error.message}`);
      return false;
    }
  }
  return true;
}

/**
 * Zmaže súbory trasy, ktorá sa neuložila — inak by v úložisku ostali navždy
 * a nikto by o nich nevedel. Chyba mazania uloženie nezastaví, len sa zapíše.
 */
export async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await adminClient().storage.from(ROUTE_FILES_BUCKET).remove(paths);
  if (error) console.error(`[route-files] upratanie ${paths.join(', ')}: ${error.message}`);
}

/** Cesty všetkých zdrojových exportov trasy — pri výmene sa staré zmažú. */
export async function listSources(routeId: string): Promise<string[]> {
  const { data, error } = await adminClient()
    .storage.from(ROUTE_FILES_BUCKET)
    .list(`${routeId}/source`, { limit: 100 });
  if (error) {
    console.error(`[route-files] zoznam zdrojov ${routeId}: ${error.message}`);
    return [];
  }
  return data.map((f) => `${routeId}/source/${f.name}`);
}
