/**
 * Pripraví súkromné úložisko na súbory trás a nahrá doň ukážkové súbory
 * z content/gpx/ podľa data/routes.json:
 *
 *   npm run db:subory
 *
 * Dá sa pustiť opakovane — bucket vytvorí len raz a súbory prepíše rovnakými.
 * Na rozdiel od db:seed nesiahne na tabuľku routes, takže je bezpečný
 * aj po spustení ostrej prevádzky.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { ROUTE_FILES_BUCKET, routeFilePath } from '../lib/route-file-path.ts';
import { routeSchema } from '../lib/route-schema.ts';
import { supabaseUrlProblem } from '../lib/supabase-url.ts';

process.loadEnvFile('.env.local');

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const urlProblem = supabaseUrlProblem(url);
if (urlProblem || !url || !secretKey) {
  console.error(urlProblem ?? 'V .env.local chýba SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });

// --- 1. Bucket --------------------------------------------------------------

const { data: bucket } = await supabase.storage.getBucket(ROUTE_FILES_BUCKET);

if (bucket) {
  // Verejný bucket = platené trasy na stiahnutie bez zaplatenia. Radšej skončiť
  // nahlas, než doň potichu nahrávať.
  if (bucket.public) {
    console.error(
      `Bucket ${ROUTE_FILES_BUCKET} je VEREJNÝ. Prepni ho v Supabase → Storage na súkromný a spusti znova.`,
    );
    process.exit(1);
  }
  console.log(`Bucket ${ROUTE_FILES_BUCKET} už existuje (súkromný).`);
} else {
  const { error } = await supabase.storage.createBucket(ROUTE_FILES_BUCKET, {
    public: false,
    // Zdrojový export do 25 MB (MAX_FILE_BYTES v lib/route-builder/parse.ts)
    // pôjde od kroku D3 tiež sem, plus rezerva
    fileSizeLimit: '30MB',
  });
  if (error) {
    console.error(`Bucket sa nepodarilo vytvoriť: ${error.message}`);
    process.exit(1);
  }
  console.log(`Bucket ${ROUTE_FILES_BUCKET} vytvorený (súkromný).`);
}

// --- 2. Ukážkové súbory -------------------------------------------------------

// To isté ako DOWNLOAD_KINDS v lib/access.ts — ten je server-only a skript
// ho importovať nemôže. previewVideo a poster sú verejné, do úložiska nepatria.
const DOWNLOADABLE = ['track', 'navigation', 'poi', 'roadbook'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.gpx': 'application/gpx+xml',
  '.pdf': 'application/pdf',
};

const routes = (JSON.parse(readFileSync('data/routes.json', 'utf8')) as unknown[]).map((raw) =>
  routeSchema.parse(raw),
);

let uploaded = 0;
const missing: string[] = [];

for (const route of routes) {
  for (const kind of DOWNLOADABLE) {
    const filename = route.assets[kind];
    if (!filename) continue;

    const key = routeFilePath(route.id, filename);
    if (!key) {
      console.error(`Nebezpečné meno súboru: ${route.id} / ${filename}`);
      process.exit(1);
    }

    const local = path.join('content', 'gpx', filename);
    if (!existsSync(local)) {
      missing.push(local);
      continue;
    }

    const { error } = await supabase.storage.from(ROUTE_FILES_BUCKET).upload(key, readFileSync(local), {
      upsert: true,
      contentType: CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? 'application/octet-stream',
    });
    if (error) {
      console.error(`${key}: ${error.message}`);
      process.exit(1);
    }
    uploaded++;
  }
}

console.log(`Hotovo: ${uploaded} súborov v úložisku.`);

if (missing.length > 0) {
  // Kupujúci by pri týchto trasách dostal file_missing — nesmie to prejsť potichu
  console.error(`Lokálne chýba ${missing.length} súborov, nenahrané:\n  ${missing.join('\n  ')}`);
  process.exitCode = 1;
}
