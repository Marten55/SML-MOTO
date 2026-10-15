/**
 * Overí súkromné úložisko na súbory trás a nahrá doň ukážkové súbory
 * z content/gpx/ podľa data/routes.json:
 *
 *   npm run db:subory
 *
 * Bucket `route-files` sa NEVYTVÁRA tu, ale ručne v Cloudflare → R2 (README).
 * Kľúč, ktorý má aplikácia, smie len čítať a zapisovať súbory — kľúč na
 * zakladanie bucketov by na serveri bol zbytočne silný.
 *
 * Dá sa pustiť opakovane — súbory prepíše rovnakými. Nesiahne na tabuľku
 * routes, takže je bezpečný aj po spustení ostrej prevádzky.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { ROUTE_FILES_BUCKET, routeFilePath } from '../lib/route-file-path.ts';
import { routeSchema } from '../lib/route-schema.ts';
import { connectStorage } from './connections.mts';

const storage = connectStorage();

// --- 1. Bucket --------------------------------------------------------------

try {
  await storage.send(new HeadBucketCommand({ Bucket: ROUTE_FILES_BUCKET }));
} catch (error) {
  console.error(
    `Bucket ${ROUTE_FILES_BUCKET} nie je dostupný (${(error as Error).name}). ` +
      'Vytvor ho v Cloudflare → R2 a skontroluj, že API token má prístup práve k nemu.',
  );
  process.exit(1);
}
// Či je bucket verejný, sa cez S3 API zistiť nedá — to stráži README
// a nastavenie v Cloudflare (Public access: Disabled).
console.log(`Bucket ${ROUTE_FILES_BUCKET} je dostupný.`);

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

    try {
      await storage.send(
        new PutObjectCommand({
          Bucket: ROUTE_FILES_BUCKET,
          Key: key,
          Body: readFileSync(local),
          ContentType: CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? 'application/octet-stream',
        }),
      );
    } catch (error) {
      console.error(`${key}: ${(error as Error).message}`);
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
