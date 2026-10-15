import 'server-only';
import { neon, NeonDbError, type NeonQueryFunction } from '@neondatabase/serverless';

import { databaseUrlProblem } from './database-url';

/**
 * Spojenie s databázou (Neon, čistý Postgres).
 *
 * Prečo ovládač cez HTTP, nie klasické spojenie (pg, postgres.js): na Verceli
 * každá požiadavka môže bežať v inej inštancii funkcie. Trvalé TCP spojenia
 * by sa hromadili a databáza by ich pri bezplatnom pláne rýchlo vyčerpala.
 * Cez HTTP je jeden dotaz jedna krátka požiadavka, nič sa nedrží otvorené.
 * Cena: dotazy nemôžu zdieľať session — transakcia sa dá len cez
 * sql.transaction([...]) naraz, nie „otvor, rozhodni sa, potvrď".
 *
 * Jedno spojenie s plnými právami, žiadne RLS ako pri Supabase. Kto smie čo
 * vidieť, rozhoduje kód: verejný web číta LEN cez getAllRoutes() s podmienkou
 * published = true (lib/routes-db.ts), všetko ostatné je za requireAdmin()
 * alebo za overeným tokenom zaplatenej trasy.
 *
 * Len na serveri — prehliadač s databázou nehovorí vôbec.
 */

let instance: NeonQueryFunction<false, false> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  // Zlá adresa zhodí build s jasnou hláškou, nie s „fetch failed"
  const problem = databaseUrlProblem(url);
  if (problem) throw new Error(problem);
  instance ??= neon(url as string);
  return instance;
}

/** Postgres: porušená podmienka unique. constraint = ktorá (napr. routes_slug_key). */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  return error instanceof NeonDbError && error.code === '23505' && (error.constraint ?? error.message).includes(constraint);
}

/** Text chyby do logu — NeonDbError aj sieťová chyba. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
