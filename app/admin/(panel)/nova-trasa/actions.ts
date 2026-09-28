'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/admin-session';
import { adminAuthConfig } from '@/lib/admin-token';
import {
  assembleRoute,
  checkDraft,
  geometryFromRoute,
  routeFromSources,
  type FieldErrors,
  type PackageFiles,
  type RouteFields,
} from '@/lib/route-draft';
import {
  downloadSources,
  listSources,
  removeFiles,
  signedSourceUploads,
  uploadPackageFiles,
} from '@/lib/route-files';
import {
  createUploadTicket,
  MAX_SOURCE_FILES,
  packageFileNames,
  sourcePath,
  uploadBatch,
  verifyUploadTicket,
  type UploadTicket,
} from '@/lib/route-upload';
import type { RouteAssets } from '@/lib/routes';
import { getRouteForAdmin, insertHiddenRoute, isSlugTaken, updateRouteContent } from '@/lib/routes-db';
import { slugify } from '@/lib/slug';
import { isSupabaseConfigured } from '@/lib/supabase';

/*
 * Uloženie novej trasy (krok D3) a úprava existujúcej (krok D5). Postup
 * a prečo je rozdelený na dva kroky: lib/route-upload.ts. Všetky akcie sú
 * verejné POST adresy — každá overí admina a nič z prehliadača nepovažuje
 * za pravdu: ID a cesty berie z lístka, údaje o trase počíta znova zo
 * súborov v úložisku alebo z uloženej trasy.
 */

type Failure = { ok: false; message: string; errors?: FieldErrors };

const SLUG_TAKEN = 'Trasa s touto adresou už existuje (aj skrytá). Zmeň názov.';
const TICKET_INVALID = 'Nahratie vypršalo alebo je neplatné. Klikni na uloženie znova.';
const SERVER_ERRORS = 'Server našiel v údajoch chyby. Obnov stránku a skús znova.';

function notConfigured(): Failure | null {
  if (isSupabaseConfigured()) return null;
  return { ok: false, message: 'Ukladanie potrebuje Supabase — pozri SUPABASE_* v .env.example.' };
}

function ticketSecret(): string {
  // requireAdmin() prešiel, takže nastavenie existuje
  return adminAuthConfig()!.secret;
}

/**
 * Rezervuje nahratie zdrojového exportu. Bez `editId` pre novú trasu (server
 * vymyslí ID), s `editId` pre výmenu súborov existujúcej trasy.
 */
export async function prepareRouteUpload(
  fileNames: unknown,
  name: unknown,
  editId?: unknown,
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

  let ticketBase: Pick<UploadTicket, 'kind' | 'routeId'>;
  if (editId === undefined) {
    // Obsadenú adresu povieme hneď — nemá zmysel najprv nahrávať 25 MB
    const slug = typeof name === 'string' ? slugify(name) : '';
    if (slug && (await isSlugTaken(slug))) return { ok: false, message: SLUG_TAKEN, errors: { name: SLUG_TAKEN } };
    ticketBase = { kind: 'new', routeId: randomUUID() };
  } else {
    // Lístok len na trasu, ktorá naozaj existuje
    if (typeof editId !== 'string' || !(await getRouteForAdmin(editId))) {
      return { ok: false, message: 'Trasa už neexistuje. Obnov stránku.' };
    }
    ticketBase = { kind: 'replace', routeId: editId };
  }

  const batch = uploadBatch(Date.now());
  const sources = fileNames.map((n, i) => sourcePath(ticketBase.routeId, batch, i, n));
  if (sources.some((s) => s === null)) {
    return { ok: false, message: 'Dá sa nahrať len GPX, KML alebo CSV.' };
  }

  const uploadUrls = await signedSourceUploads(sources as string[]);
  if (!uploadUrls) return { ok: false, message: 'Úložisko teraz neodpovedá. Skús to o chvíľu znova.' };

  return {
    ok: true,
    ticket: createUploadTicket({ ...ticketBase, sources: sources as string[] }, ticketSecret(), Date.now()),
    uploadUrls,
  };
}

/** Stiahne nahraté zdroje a zopakuje nad nimi rozbor aj kontrolu formulára. */
async function buildFromUpload(
  sources: string[],
  draft: unknown,
): Promise<{ ok: true; fields: RouteFields; files: PackageFiles } | Failure> {
  const downloaded = await downloadSources(sources);
  if (!downloaded) return { ok: false, message: 'Súbory sa nenahrali celé. Skús to znova.' };

  const built = routeFromSources(
    // Rozbor potrebuje z mena len príponu; bez priečinkov je hláška o chybe čitateľnejšia
    downloaded.map((f) => ({ name: f.path.split('/').pop()!, content: f.content })),
    draft,
  );
  // Prehliadač tú istú kontrolu prešiel — sem sa dostane len podvrhnutý
  // formulár alebo nový kód na serveri a starý v otvorenej karte
  if (!built.ok) return { ok: false, message: SERVER_ERRORS, errors: built.errors };
  return built;
}

/** GPX balíčka pod danými menami (poi len keď trasa body záujmu má). */
function packageUploads(files: PackageFiles, names: ReturnType<typeof packageFileNames>) {
  return [
    { filename: names.track, content: files.master },
    { filename: names.navigation, content: files.navigation },
    ...(files.poi ? [{ filename: names.poi, content: files.poi }] : []),
  ];
}

const ASSEMBLY_FAILED = 'Trasu sa nepodarilo poskladať. Chyba je v aplikácii, nie v tebe.';

// ── Nová trasa (D3) ────────────────────────────────────────────────────────

export async function saveRoute(
  ticket: unknown,
  draft: unknown,
): Promise<{ ok: true; slug: string } | Failure> {
  await requireAdmin();
  const problem = notConfigured();
  if (problem) return problem;

  const upload = verifyUploadTicket(ticket, ticketSecret(), Date.now());
  if (!upload || upload.kind !== 'new') return { ok: false, message: TICKET_INVALID };
  const { routeId, sources } = upload;

  // Čo sa uloží do úložiska pri tomto pokuse — pri neúspechu to zmažeme,
  // aby po trase, ktorá v databáze nie je, neostali súbory
  let written = [...sources];
  const fail = async (result: Failure): Promise<Failure> => {
    await removeFiles(written);
    return result;
  };

  const built = await buildFromUpload(sources, draft);
  if (!built.ok) return fail(built);

  const { fields, files } = built;
  const names = packageFileNames(fields.slug);
  const packageFiles = packageUploads(files, names);

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
    return fail({ ok: false, message: ASSEMBLY_FAILED });
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

// ── Úprava existujúcej trasy (D5) ──────────────────────────────────────────

/**
 * Uloží zmeny existujúcej trasy.
 *
 * ticket = null → menia sa len údaje z formulára, stopa a súbory ostávajú.
 * ticket z prepareRouteUpload(…, id) → nový export: server z neho spočíta
 * trasu nanovo a vymení súbory balíčka.
 *
 * Adresa (slug): zverejnenej trase sa nemení nikdy — odkazy z Googlu,
 * zdieľaní a e-mailov by viedli na 404. Skrytej len vtedy, keď o to
 * Miroslav výslovne požiada (renameSlug), inak by ju zmenila hocijaká
 * úprava názvu.
 *
 * Poradie pri výmene súborov je zámerné: nové súbory s novými menami →
 * zápis do databázy → až potom zmazanie starých. Keď čokoľvek zlyhá pred
 * zápisom, zmažú sa len nové súbory a trasa funguje ďalej so starými.
 */
export async function updateRoute(
  id: unknown,
  ticket: unknown,
  draft: unknown,
  renameSlug: unknown,
): Promise<{ ok: true; slug: string } | Failure> {
  await requireAdmin();
  const problem = notConfigured();
  if (problem) return problem;

  const found = typeof id === 'string' ? await getRouteForAdmin(id) : null;
  if (!found) return { ok: false, message: 'Trasa už neexistuje alebo má v databáze chybné údaje.' };
  const { route: current, published } = found;

  let upload: UploadTicket | null = null;
  if (ticket !== null) {
    upload = verifyUploadTicket(ticket, ticketSecret(), Date.now());
    if (!upload || upload.kind !== 'replace' || upload.routeId !== current.id) {
      return { ok: false, message: TICKET_INVALID };
    }
  }

  let written: string[] = upload ? [...upload.sources] : [];
  const fail = async (result: Failure): Promise<Failure> => {
    await removeFiles(written);
    return result;
  };

  // Údaje trasy: z nového exportu, alebo z uloženej trasy
  let fields: RouteFields;
  let files: PackageFiles | null = null;
  if (upload) {
    const built = await buildFromUpload(upload.sources, draft);
    if (!built.ok) return fail(built);
    ({ fields, files } = built);
  } else {
    const check = checkDraft(draft, geometryFromRoute(current));
    if (!check.ok) return { ok: false, message: SERVER_ERRORS, errors: check.errors };
    fields = check.fields;
  }

  const slug = !published && renameSlug === true ? fields.slug : current.slug;
  if (slug !== current.slug && (await isSlugTaken(slug))) {
    return fail({ ok: false, message: SLUG_TAKEN, errors: { name: SLUG_TAKEN } });
  }

  // Súbory: roadbook a videá (Gold) ostávajú, vymieňa sa len GPX balíček
  let assets: RouteAssets = current.assets;
  let replaced: string[] = [];
  if (files) {
    const { track, navigation, poi } = current.assets;
    const names = packageFileNames(slug, [track, navigation, poi].filter((n): n is string => Boolean(n)));
    const packageFiles = packageUploads(files, names);
    written = [...written, ...packageFiles.map((f) => `${current.id}/${f.filename}`)];
    if (!(await uploadPackageFiles(current.id, packageFiles))) {
      return fail({ ok: false, message: 'Súbory balíčka sa nepodarilo uložiť. Skús to znova.' });
    }
    assets = { ...current.assets, track: names.track, navigation: names.navigation, poi: names.poi };
    // Nový export bez bodov záujmu — starý poi súbor by k trase už nepatril
    if (!files.poi) delete assets.poi;
    replaced = [track, navigation, poi].filter((n): n is string => Boolean(n)).map((n) => `${current.id}/${n}`);
  }

  const assembled = assembleRoute({ ...fields, slug }, { id: current.id, assets, isExample: current.isExample });
  if ('error' in assembled) {
    console.error(`[uprava-trasy] ${assembled.error}`);
    return fail({ ok: false, message: ASSEMBLY_FAILED });
  }

  try {
    const result = await updateRouteContent(assembled.route);
    if (result === 'slug_taken') return fail({ ok: false, message: SLUG_TAKEN, errors: { name: SLUG_TAKEN } });
    if (result === 'not_found') return fail({ ok: false, message: 'Trasa medzitým zmizla. Obnov stránku.' });
  } catch (error) {
    // Pozri poznámku o requireAdmin() v saveRoute
    console.error(error);
    return fail({ ok: false, message: 'Databáza zmeny neprijala. Skús to znova.' });
  }

  // Databáza už ukazuje na nové súbory — staré balíčky a staré zdroje preč.
  // Zlyhanie tu nič nepokazí, len ostane pár súborov navyše (zapíše sa do logu).
  if (upload) {
    const oldSources = (await listSources(current.id)).filter((p) => !upload.sources.includes(p));
    await removeFiles([...replaced, ...oldSources]);
  }

  // Zverejnená trasa sa zmenila na webe; skrytú verejnosť nevidí, ale
  // obnovenie nič nestojí a nemusíme riešiť, či bola medzitým zverejnená
  revalidatePath('/[lang]', 'layout');
  revalidatePath('/admin');
  return { ok: true, slug };
}
