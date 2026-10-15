import 'server-only';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { MAX_FILE_BYTES } from './route-builder/parse';
import { ROUTE_FILES_BUCKET, routeFilePath } from './route-file-path';
import { storage } from './storage';

/**
 * Súbory trás (GPX, roadbook) v súkromnom buckete Cloudflare R2 (lib/storage.ts).
 *
 * Prečo nie na disku: repo je verejné, takže skutočné GPX nesmú byť v gite,
 * a na Verceli sa za behu na disk zapisovať nedá — trasa pridaná
 * z administrácie by nemala kam.
 */

/**
 * Ako dlho platí odkaz na stiahnutie. Prehliadač ho otvorí hneď po
 * presmerovaní, takže minúta stačí. Trvalý je token v e-maile, nie tento odkaz.
 */
const SIGNED_URL_SECONDS = 60;

/**
 * Ako dlho platí adresa na nahratie zdroja. Nahratie ide hneď po kliknutí,
 * takže 15 minút je s rezervou aj na pomalé pripojenie — a kratšie než lístok
 * (lib/route-upload.ts), ktorý adresu sprevádza.
 */
export const UPLOAD_URL_SECONDS = 15 * 60;

/** NoSuchKey / NotFound — súbor v úložisku nie je. Ostatné chyby sú výpadok. */
function isMissing(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'NoSuchKey' || name === 'NotFound';
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

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

  // Podpísať sa dá aj adresa na neexistujúci súbor — zákazník by potom dostal
  // XML chybu od R2 namiesto našej hlášky. Jedna požiadavka navyše za to stojí.
  try {
    await storage().send(new HeadObjectCommand({ Bucket: ROUTE_FILES_BUCKET, Key: path }));
  } catch (error) {
    // Najčastejšie súbor v úložisku chýba — zákazník zaplatil, takže to treba vidieť v logu
    console.error(`[route-files] ${path}: ${isMissing(error) ? 'súbor chýba' : describe(error)}`);
    return null;
  }

  return getSignedUrl(
    storage(),
    new GetObjectCommand({
      Bucket: ROUTE_FILES_BUCKET,
      Key: path,
      // Prehliadač súbor uloží pod týmto menom, nie pod cestou v úložisku
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: SIGNED_URL_SECONDS },
  );
}

// ── Nahratie novej trasy (krok D3) ─────────────────────────────────────────
//
// Volať LEN za requireAdmin() a s cestami z overeného lístka (lib/route-upload.ts).

/**
 * Adresy, na ktoré prehliadač nahrá zdrojový export (PUT so súborom v tele).
 * Každá platí len pre svoju cestu a UPLOAD_URL_SECONDS. Prehliadač pri tom
 * nepotrebuje žiadny náš kľúč.
 *
 * Rozdiel oproti Supabase: adresa nie je jednorazová, do vypršania sa na ňu
 * dá nahrať aj opakovane. Nevadí to — cesta má v mene náhodnú dávku a server
 * súbor aj tak znova prečíta a skontroluje (downloadSources, parse).
 */
export async function signedSourceUploads(paths: string[]): Promise<string[] | null> {
  try {
    return await Promise.all(
      paths.map((path) =>
        getSignedUrl(storage(), new PutObjectCommand({ Bucket: ROUTE_FILES_BUCKET, Key: path }), {
          expiresIn: UPLOAD_URL_SECONDS,
        }),
      ),
    );
  } catch (error) {
    console.error(`[route-files] adresy na nahratie: ${describe(error)}`);
    return null;
  }
}

/** Stiahne nahraté zdroje ako text. null, keď niektorý chýba (prehliadač ho nenahral). */
export async function downloadSources(paths: string[]): Promise<{ path: string; content: string }[] | null> {
  const files: { path: string; content: string }[] = [];
  for (const path of paths) {
    try {
      const object = await storage().send(new GetObjectCommand({ Bucket: ROUTE_FILES_BUCKET, Key: path }));
      // Supabase stražil veľkosť pravidlom bucketu, R2 také nemá. Podpísaná
      // adresa na nahratie veľkosť neobmedzí, takže kontrola musí byť tu.
      if ((object.ContentLength ?? 0) > MAX_FILE_BYTES) {
        console.error(`[route-files] zdroj ${path}: ${object.ContentLength} B je nad limit`);
        return null;
      }
      files.push({ path, content: (await object.Body?.transformToString('utf-8')) ?? '' });
    } catch (error) {
      console.error(`[route-files] zdroj ${path}: ${isMissing(error) ? 'chýba' : describe(error)}`);
      return null;
    }
  }
  return files;
}

/** Uloží vygenerované GPX balíčka pod menami, ktoré dostane zákazník. */
export async function uploadPackageFiles(
  routeId: string,
  files: { filename: string; content: string }[],
): Promise<boolean> {
  for (const { filename, content } of files) {
    const path = routeFilePath(routeId, filename);
    if (!path) {
      console.error(`[route-files] nebezpečná cesta: ${routeId} / ${filename}`);
      return false;
    }
    try {
      await storage().send(
        new PutObjectCommand({
          Bucket: ROUTE_FILES_BUCKET,
          Key: path,
          Body: content,
          ContentType: 'application/gpx+xml',
        }),
      );
    } catch (error) {
      console.error(`[route-files] ${path}: ${describe(error)}`);
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
  try {
    const result = await storage().send(
      new DeleteObjectsCommand({
        Bucket: ROUTE_FILES_BUCKET,
        Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    // Hromadné mazanie neskončí výnimkou, keď zlyhá len časť — tá je v Errors
    for (const failed of result.Errors ?? []) {
      console.error(`[route-files] upratanie ${failed.Key}: ${failed.Code} ${failed.Message}`);
    }
  } catch (error) {
    console.error(`[route-files] upratanie ${paths.join(', ')}: ${describe(error)}`);
  }
}

/** Cesty všetkých zdrojových exportov trasy — pri výmene sa staré zmažú. */
export async function listSources(routeId: string): Promise<string[]> {
  try {
    const result = await storage().send(
      new ListObjectsV2Command({ Bucket: ROUTE_FILES_BUCKET, Prefix: `${routeId}/source/`, MaxKeys: 100 }),
    );
    return (result.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : []));
  } catch (error) {
    console.error(`[route-files] zoznam zdrojov ${routeId}: ${describe(error)}`);
    return [];
  }
}
