'use server';

import { randomUUID } from 'node:crypto';

import { requireAdmin } from '@/lib/admin-session';
import { adminAuthConfig } from '@/lib/admin-token';
import { assembleRoute, routeFromSources, type FieldErrors } from '@/lib/route-draft';
import { downloadSources, removeFiles, signedSourceUploads, uploadPackageFiles } from '@/lib/route-files';
import {
  createUploadTicket,
  MAX_SOURCE_FILES,
  packageFileNames,
  sourcePath,
  verifyUploadTicket,
} from '@/lib/route-upload';
import { insertHiddenRoute, isSlugTaken } from '@/lib/routes-db';
import { slugify } from '@/lib/slug';
import { isSupabaseConfigured } from '@/lib/supabase';

/*
 * Uloženie novej trasy (krok D3). Postup a prečo je rozdelený na dva kroky:
 * lib/route-upload.ts. Obe akcie sú verejné POST adresy — každá overí admina
 * a nič z prehliadača nepovažuje za pravdu: ID a cesty berie z lístka,
 * údaje o trase počíta znova zo súborov v úložisku.
 */

type Failure = { ok: false; message: string; errors?: FieldErrors };

const SLUG_TAKEN = 'Trasa s touto adresou už existuje (aj skrytá). Zmeň názov.';

function notConfigured(): Failure | null {
  if (isSupabaseConfigured()) return null;
  return { ok: false, message: 'Ukladanie potrebuje Supabase — pozri SUPABASE_* v .env.example.' };
}

function ticketSecret(): string {
  // requireAdmin() prešiel, takže nastavenie existuje
  return adminAuthConfig()!.secret;
}

export async function prepareRouteUpload(
  fileNames: unknown,
  name: unknown,
): Promise<{ ok: true; ticket: string; uploadUrls: string[] } | Failure> {
  await requireAdmin();
  const problem = notConfigured();
  if (problem) return problem;

  if (
    !Array.isArray(fileNames) ||
    fileNames.length === 0 ||
    fileNames.length > MAX_SOURCE_FILES ||
    !fileNames.every((n) => typeof n === 'string')
  ) {
    return { ok: false, message: `Nahraj 1 až ${MAX_SOURCE_FILES} súborov GPX, KML alebo CSV.` };
  }

  // Obsadenú adresu povieme hneď — nemá zmysel najprv nahrávať 25 MB
  const slug = typeof name === 'string' ? slugify(name) : '';
  if (slug && (await isSlugTaken(slug))) return { ok: false, message: SLUG_TAKEN, errors: { name: SLUG_TAKEN } };

  const routeId = randomUUID();
  const sources = fileNames.map((n, i) => sourcePath(routeId, i, n));
  if (sources.some((s) => s === null)) {
    return { ok: false, message: 'Dá sa nahrať len GPX, KML alebo CSV.' };
  }

  const uploadUrls = await signedSourceUploads(sources as string[]);
  if (!uploadUrls) return { ok: false, message: 'Úložisko teraz neodpovedá. Skús to o chvíľu znova.' };

  return {
    ok: true,
    ticket: createUploadTicket({ routeId, sources: sources as string[] }, ticketSecret(), Date.now()),
    uploadUrls,
  };
}

export async function saveRoute(
  ticket: unknown,
  draft: unknown,
): Promise<{ ok: true; slug: string } | Failure> {
  await requireAdmin();
  const problem = notConfigured();
  if (problem) return problem;

  const upload = verifyUploadTicket(ticket, ticketSecret(), Date.now());
  if (!upload) {
    return { ok: false, message: 'Nahratie vypršalo alebo je neplatné. Klikni na uloženie znova.' };
  }
  const { routeId, sources } = upload;

  // Čo sa uloží do úložiska pri tomto pokuse — pri neúspechu to zmažeme,
  // aby po trase, ktorá v databáze nie je, neostali súbory
  let written = [...sources];
  const fail = async (result: Failure): Promise<Failure> => {
    await removeFiles(written);
    return result;
  };

  const downloaded = await downloadSources(sources);
  if (!downloaded) {
    return fail({ ok: false, message: 'Súbory sa nenahrali celé. Skús to znova.' });
  }

  const built = routeFromSources(
    // Rozbor potrebuje z mena len príponu; bez priečinkov je hláška o chybe čitateľnejšia
    downloaded.map((f) => ({ name: f.path.split('/').pop()!, content: f.content })),
    draft,
  );
  if (!built.ok) {
    // Prehliadač tú istú kontrolu prešiel — sem sa dostane len podvrhnutý
    // formulár alebo nový kód na serveri a starý v otvorenej karte
    return fail({ ok: false, message: 'Server našiel v údajoch chyby. Obnov stránku a skús znova.', errors: built.errors });
  }

  const { fields, files } = built;
  const names = packageFileNames(fields.slug);
  const packageFiles = [
    { filename: names.track, content: files.master },
    { filename: names.navigation, content: files.navigation },
    ...(files.poi ? [{ filename: names.poi, content: files.poi }] : []),
  ];

  const assembled = assembleRoute(fields, {
    id: routeId,
    assets: {
      track: names.track,
      navigation: names.navigation,
      ...(files.poi ? { poi: names.poi } : {}),
    },
  });
  if ('error' in assembled) {
    // Formulár a routeSchema sa rozišli — chyba v našom kóde, nie v údajoch
    console.error(`[nova-trasa] ${assembled.error}`);
    return fail({ ok: false, message: 'Trasu sa nepodarilo poskladať. Chyba je v aplikácii, nie v tebe.' });
  }

  written = [...written, ...packageFiles.map((f) => `${routeId}/${f.filename}`)];
  if (!(await uploadPackageFiles(routeId, packageFiles))) {
    return fail({ ok: false, message: 'Súbory balíčka sa nepodarilo uložiť. Skús to znova.' });
  }

  try {
    if ((await insertHiddenRoute(assembled.route)) === 'slug_taken') {
      return fail({ ok: false, message: SLUG_TAKEN, errors: { name: SLUG_TAKEN } });
    }
  } catch (error) {
    // requireAdmin() v insertHiddenRoute by presmerovanie hodil výnimkou,
    // ktorú by tento catch zachytil — nestane sa, admin je overený na začiatku
    // tej istej požiadavky
    console.error(error);
    return fail({ ok: false, message: 'Databáza trasu neprijala. Skús to znova.' });
  }

  return { ok: true, slug: fields.slug };
}
