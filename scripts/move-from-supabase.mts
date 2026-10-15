/**
 * JEDNORAZOVÝ presun zo Supabase do Neonu (trasy) a R2 (súbory trás):
 *
 *   npm run db:presun
 *
 * V .env.local musia byť naraz staré SUPABASE_URL + SUPABASE_SECRET_KEY
 * aj nové DATABASE_URL + R2_*. Supabase sa len číta, nič sa v ňom nemaže —
 * kým nový web neoveríš, ostáva ako záloha.
 *
 * Dá sa pustiť opakovane (upsert podľa id, súbory sa prepíšu rovnakými).
 * Po presune skript zmaž spolu s premennými SUPABASE_*.
 *
 * Zámerne bez knižnice @supabase/supabase-js: kvôli jednorazovému čítaniu by
 * v projekte ostala závislosť navyše. Supabase má obyčajné REST rozhranie.
 */
import { PutObjectCommand } from '@aws-sdk/client-s3';

import { ROUTE_FILES_BUCKET } from '../lib/route-file-path.ts';
import { connectDatabase, connectStorage, upsertRoutes } from './connections.mts';

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('V .env.local chýba SUPABASE_URL alebo SUPABASE_SECRET_KEY (starý projekt, odkiaľ sa presúva).');
  process.exit(1);
}

const sql = connectDatabase();
const storage = connectStorage();

// Tie isté hlavičky, aké posiela supabase-js
const auth = { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` };

async function supabase(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...auth, ...init?.headers } });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${await response.text()}`);
  return response;
}

// --- 1. Trasy -----------------------------------------------------------------

// Celé riadky vrátane created_at/updated_at a skrytých trás — nič nemeníme
const rows = (await (await supabase('/rest/v1/routes?select=*&order=id')).json()) as Record<string, unknown>[];
await upsertRoutes(sql, rows);
const [{ n }] = await sql`select count(*)::int as n from public.routes`;
console.log(`Trasy: ${rows.length} prenesených, v Neone je ich spolu ${n}.`);

// --- 2. Súbory ----------------------------------------------------------------

interface StorageItem {
  name: string;
  id: string | null; // null = priečinok
  metadata: { mimetype?: string } | null;
}

/** Storage API vracia jednu úroveň priečinka — do hĺbky ideme sami. */
async function listAll(prefix: string): Promise<{ path: string; type: string }[]> {
  const files: { path: string; type: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const items = (await (
      await supabase(`/storage/v1/object/list/${ROUTE_FILES_BUCKET}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, limit: 1000, offset }),
      })
    ).json()) as StorageItem[];

    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAll(path)));
      else files.push({ path, type: item.metadata?.mimetype ?? 'application/octet-stream' });
    }
    if (items.length < 1000) return files;
  }
}

const files = await listAll('');
let copied = 0;
for (const file of files) {
  const body = new Uint8Array(await (await supabase(`/storage/v1/object/${ROUTE_FILES_BUCKET}/${file.path}`)).arrayBuffer());
  await storage.send(
    new PutObjectCommand({ Bucket: ROUTE_FILES_BUCKET, Key: file.path, Body: body, ContentType: file.type }),
  );
  copied++;
  console.log(`  ${file.path} (${body.byteLength} B)`);
}
console.log(`Súbory: ${copied} z ${files.length} skopírovaných do R2.`);
