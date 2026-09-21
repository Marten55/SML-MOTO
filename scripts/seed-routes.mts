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

import { createClient } from '@supabase/supabase-js';

import { routeSchema, routeToRow } from '../lib/route-schema.ts';
import { supabaseUrlProblem } from '../lib/supabase-url.ts';

process.loadEnvFile('.env.local');

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const urlProblem = supabaseUrlProblem(url);
if (urlProblem || !url || !secretKey) {
  console.error(urlProblem ?? 'V .env.local chýba SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const source = JSON.parse(readFileSync('data/routes.json', 'utf8')) as unknown[];

const rows = source.map((raw, index) =>
  routeToRow(routeSchema.parse(raw), {
    // Ukážkové trasy sú dnes na webe, po presune do databázy tam ostanú
    published: true,
    // Po desiatkach, aby sa medzi existujúce dala neskôr vložiť nová
    sortOrder: (index + 1) * 10,
  }),
);

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });
const { error } = await supabase.from('routes').upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Zápis zlyhal:', error.message);
  process.exit(1);
}

console.log(`Hotovo: ${rows.length} trás v databáze.`);
