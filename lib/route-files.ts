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
