import 'server-only';
import { cache } from 'react';

import routesJson from '@/data/routes.json';
import { requireAdmin } from './admin-session';
import { errorMessage, isDatabaseConfigured, isUniqueViolation, sql } from './db';
import { routeSchema, routeToRow, rowToRoute, type RouteRow } from './route-schema';
import { isSellable, type Route } from './routes';

/**
 * Odkiaľ web berie trasy. Zdrojom je databáza (Neon, lib/db.ts); data/routes.json
 * ostáva ako seed (scripts/seed-routes.ts) a ako záloha pri lokálnom vývoji.
 *
 * Záloha platí LEN mimo produkcie — rovnaké pravidlo ako pri demo serveri
 * v lib/routing.ts. Na ostrom webe by tichý prechod na JSON predával podľa
 * starých cien a nikto by si nevšimol, že databáza nie je pripojená.
 */

function jsonFallbackAllowed(): boolean {
  return !isDatabaseConfigured() && process.env.NODE_ENV !== 'production';
}

function assertConfigured(): void {
  if (!isDatabaseConfigured() && !jsonFallbackAllowed()) {
    throw new Error('[routes] Databáza nie je nastavená — pozri DATABASE_URL v .env.example.');
  }
}

function routesFromJson(): Route[] {
  return (routesJson as unknown[]).map((r) => routeSchema.parse(r));
}

/** Pokazenú trasu vynechá a zapíše do logu — jedna chyba nezhodí celý katalóg. */
function validRoutes(rows: RouteRow[]): Route[] {
  const routes: Route[] = [];
  for (const row of rows) {
    const result = rowToRoute(row);
    if ('error' in result) console.error(`[routes] Neplatná ${result.error}`);
    else routes.push(result.route);
  }
  return routes;
}

// ── Prevod riadkov ─────────────────────────────────────────────────────────
//
// to_jsonb(r) vráti riadok ako JSON v tvare, aký kedysi vracal Supabase:
// numeric ako číslo, timestamptz ako ISO text, jsonb ako objekt. Bez toho by
// ovládač vrátil numeric ako text a časy ako Date a rowToRoute by ich musel
// prekladať — takto zod v lib/route-schema.ts stráži presne to isté čo predtým.

async function selectRows(query: Promise<Record<string, unknown>[]>, context: string): Promise<RouteRow[]> {
  try {
    return (await query).map((r) => r.row as RouteRow);
  } catch (error) {
    throw new Error(`[routes] ${context}: ${errorMessage(error)}`);
  }
}

function rowById(id: string): Promise<RouteRow[]> {
  return selectRows(
    sql()`select to_jsonb(r) as row from public.routes r where r.id = ${id}`,
    `Trasu ${id} sa nepodarilo načítať`,
  );
}

/**
 * Zoznam stĺpcov pre zápis. Mená pochádzajú z routeToRow (náš kód, nie
 * návštevník), ale do SQL idú ako text, takže ich radšej overím.
 */
function columnList(row: object): string {
  const names = Object.keys(row);
  for (const name of names) {
    if (!/^[a-z_]+$/.test(name)) throw new Error(`[routes] Podozrivý názov stĺpca: ${name}`);
  }
  return names.join(', ');
}

// Hodnoty idú ako JEDEN parameter jsonb a Postgres ich sám rozloží do stĺpcov
// (jsonb_populate_record) aj s prevodom typov. Žiadne skladanie hodnôt do SQL.
const FROM_JSON = 'from jsonb_populate_record(null::public.routes, $1::jsonb)';

// cache() = jedno načítanie na požiadavku, hoci trasy chce stránka aj metadata
export const getAllRoutes = cache(async (): Promise<Route[]> => {
  if (jsonFallbackAllowed()) return routesFromJson();
  assertConfigured();

  // published je jediné, čo oddeľuje verejný katalóg od skrytých trás —
  // databáza to sama nestráži (žiadne RLS, pozri lib/db.ts)
  const rows = await selectRows(
    sql()`select to_jsonb(r) as row from public.routes r where r.published order by r.sort_order, r.id`,
    'Trasy sa nepodarilo načítať',
  );
  return validRoutes(rows);
});

/** Len zverejnené — podľa toho sa predáva a zobrazuje. */
export async function getRouteBySlug(slug: string): Promise<Route | undefined> {
  return (await getAllRoutes()).find((r) => r.slug === slug);
}

/**
 * Trasa, za ktorú už niekto zaplatil — aj keď ju Miroslav medzičasom stiahol
 * z predaja. Prístup je trvalý (rozhodnutie C), takže stiahnutie musí fungovať
 * ďalej. Preto bez podmienky published.
 *
 * Volať LEN s ID z overeného tokenu alebo zaplatenej Stripe session.
 */
export async function getPurchasedRoute(id: string): Promise<Route | undefined> {
  if (jsonFallbackAllowed()) return routesFromJson().find((r) => r.id === id);
  assertConfigured();

  const [row] = await rowById(id);
  if (!row) return undefined;
  return validRoutes([row])[0];
}

export interface AdminRouteItem {
  id: string;
  slug: string;
  title: string;
  tier: string;
  priceChf: number;
  published: boolean;
  isExample: boolean;
  updatedAt: string | null;
  /** Neprázdne, keď riadok v databáze nezodpovedá schéme. */
  problem: string | null;
}

/** Všetky trasy vrátane nezverejnených. Overenie admina je priamo tu (DAL). */
export async function getRoutesForAdmin(): Promise<AdminRouteItem[]> {
  await requireAdmin();

  if (jsonFallbackAllowed()) {
    return routesFromJson().map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title.sk,
      tier: r.tier,
      priceChf: r.priceChf,
      published: true,
      isExample: r.isExample ?? false,
      updatedAt: null,
      problem: null,
    }));
  }
  assertConfigured();

  const rows = await selectRows(
    sql()`select to_jsonb(r) as row from public.routes r order by r.sort_order, r.id`,
    'Zoznam pre administráciu zlyhal',
  );

  return rows.map((row) => {
    const result = rowToRoute(row);
    const title = (row.title as { sk?: string } | null)?.sk ?? row.slug;
    return {
      id: row.id,
      slug: row.slug,
      title,
      tier: row.tier,
      priceChf: row.price_chf,
      published: row.published,
      isExample: row.is_example,
      updatedAt: row.updated_at ?? null,
      problem: 'error' in result ? result.error : null,
    };
  });
}

// ── Zápis z administrácie (krok D3) ────────────────────────────────────────

/** Je adresa trasy obsadená? Aj skrytou trasou — slug je jedinečný v celej tabuľke. */
export async function isSlugTaken(slug: string): Promise<boolean> {
  await requireAdmin();
  try {
    const rows = await sql()`select 1 from public.routes where slug = ${slug}`;
    return rows.length > 0;
  } catch (error) {
    throw new Error(`[routes] Kontrola adresy ${slug} zlyhala: ${errorMessage(error)}`);
  }
}

/**
 * Uloží novú trasu ako skrytú (published = false). Zverejní ju až Miroslav
 * v zozname trás (krok D4). Nová trasa ide na koniec katalógu.
 *
 * 'slug_taken' namiesto výnimky: kontrola pred nahratím súborov a zápis nie
 * sú jedna operácia, takže adresu mohol medzitým obsadiť niekto iný (druhá
 * karta prehliadača). Rozhodne databáza, nie predchádzajúca kontrola.
 */
export async function insertHiddenRoute(route: Route): Promise<'ok' | 'slug_taken'> {
  await requireAdmin();

  let lastOrder: number;
  try {
    const [last] = await sql()`select coalesce(max(sort_order), 0) as n from public.routes`;
    lastOrder = Number(last.n);
  } catch (error) {
    throw new Error(`[routes] Poradie trás sa nepodarilo zistiť: ${errorMessage(error)}`);
  }

  const row = routeToRow(route, { published: false, sortOrder: lastOrder + 1 });
  const columns = columnList(row);
  try {
    await sql().query(`insert into public.routes (${columns}) select ${columns} ${FROM_JSON}`, [
      JSON.stringify(row),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) return 'slug_taken';
    throw new Error(`[routes] Trasu ${route.id} sa nepodarilo uložiť: ${errorMessage(error)}`);
  }
  return 'ok';
}

// ── Zverejnenie (krok D4) ──────────────────────────────────────────────────

export type PublishResult = 'ok' | 'not_found' | 'invalid';

/**
 * Zverejní trasu alebo ju stiahne z predaja. Stiahnutie nič nemaže:
 * kto trasu kúpil, stiahne si ju ďalej (getPurchasedRoute číta aj skryté).
 *
 * Zverejniť sa dá len trasa, ktorá prejde routeSchema a má obe podoby GPX.
 * Pokazený riadok by katalóg ticho vynechal (validRoutes) — Miroslav by
 * videl „Zverejnená" a zákazník nič. Radšej odmietnuť nahlas.
 */
export async function setRoutePublished(id: string, published: boolean): Promise<PublishResult> {
  await requireAdmin();

  const [row] = await rowById(id);
  if (!row) return 'not_found';

  if (published) {
    const result = rowToRoute(row);
    if ('error' in result || !isSellable(result.route)) {
      console.error(`[routes] ${id} sa nedá zverejniť: ${'error' in result ? result.error : 'chýba GPX'}`);
      return 'invalid';
    }
  }

  try {
    await sql()`update public.routes set published = ${published} where id = ${id}`;
  } catch (error) {
    throw new Error(
      `[routes] Trasu ${id} sa nepodarilo ${published ? 'zverejniť' : 'skryť'}: ${errorMessage(error)}`,
    );
  }
  return 'ok';
}

/**
 * Trasa pre náhľad v administrácii — aj skrytá. null aj pri pokazenom
 * riadku: taký sa zákazníkovi neukáže, takže nemá čo náhľadovať.
 */
export interface AdminRoute {
  route: Route;
  published: boolean;
  /** ISO čas poslednej zmeny v databáze; null pri lokálnom JSON. */
  updatedAt: string | null;
}

export async function getRouteForAdmin(id: string): Promise<AdminRoute | null> {
  await requireAdmin();
  if (jsonFallbackAllowed()) {
    const route = routesFromJson().find((r) => r.id === id);
    return route ? { route, published: true, updatedAt: null } : null;
  }
  assertConfigured();

  const [row] = await rowById(id);
  if (!row) return null;
  const route = validRoutes([row])[0];
  return route ? { route, published: row.published, updatedAt: row.updated_at ?? null } : null;
}

// ── Úprava (krok D5) ───────────────────────────────────────────────────────

/**
 * Prepíše obsah existujúcej trasy. Stav zverejnenia a poradie v katalógu
 * nemení — na to je zoznam trás (D4). 'slug_taken' ako pri insertHiddenRoute.
 */
export async function updateRouteContent(route: Route): Promise<'ok' | 'slug_taken' | 'not_found'> {
  await requireAdmin();
  const row: Partial<RouteRow> = routeToRow(route, { published: false, sortOrder: 0 });
  // Tieto dva stĺpce patria zoznamu trás — úprava textov ich nesmie prepísať
  delete row.published;
  delete row.sort_order;
  delete row.id;

  const columns = columnList(row);
  let updated: Record<string, unknown>[];
  try {
    updated = await sql().query(
      `update public.routes set (${columns}) = (select ${columns} ${FROM_JSON}) where id = $2 returning id`,
      [JSON.stringify(row), route.id],
    );
  } catch (error) {
    if (isUniqueViolation(error, 'slug')) return 'slug_taken';
    throw new Error(`[routes] Trasu ${route.id} sa nepodarilo upraviť: ${errorMessage(error)}`);
  }
  return updated.length === 0 ? 'not_found' : 'ok';
}
