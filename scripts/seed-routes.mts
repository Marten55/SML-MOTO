/**
 * Naplní tabuľku routes z data/routes.json. Spúšťa sa po vytvorení databázy:
 *
 *   npm run db:seed
 *
 * Dá sa pustiť opakovane — zápis je upsert podľa id, trasy sa nezdvoja.
 * POZOR: prepíše zmeny, ktoré medzitým spravil Miroslav v administrácii
 * pri trasách s rovnakým id. Po spustení ostrej prevádzky ho už nepúšťaj.
 *
 * Dáta prechádzajú tou istou schémou ako web (lib/route-schema.ts), takže
 * do databázy sa nedostane nič, čo by web potom odmietol zobraziť.
 */
import { readFileSync } from 'node:fs';

import { routeSchema, routeToRow } from '../lib/route-schema.ts';
import { connectDatabase, upsertRoutes } from './connections.mts';

const sql = connectDatabase();

const source = JSON.parse(readFileSync('data/routes.json', 'utf8')) as unknown[];

const rows = source.map((raw, index) =>
  routeToRow(routeSchema.parse(raw), {
    // Ukážkové trasy sú dnes na webe, po presune do databázy tam ostanú
    published: true,
    // Po desiatkach, aby sa medzi existujúce dala neskôr vložiť nová
    sortOrder: (index + 1) * 10,
  }),
);

try {
  await upsertRoutes(sql, rows);
} catch (error) {
  console.error('Zápis zlyhal:', error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`Hotovo: ${rows.length} trás v databáze.`);
