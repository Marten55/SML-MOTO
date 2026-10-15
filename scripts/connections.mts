/**
 * Spojenia pre skripty v scripts/. Aplikácia má vlastné (lib/db.ts,
 * lib/storage.ts), ale tie sú 'server-only' a mimo Next.js sa importovať
 * nedajú — balík server-only by skript hneď zhodil.
 */
import { S3Client } from '@aws-sdk/client-s3';
import { neon } from '@neondatabase/serverless';

import { databaseUrlProblem } from '../lib/database-url.ts';

process.loadEnvFile('.env.local');

export function connectDatabase() {
  const url = process.env.DATABASE_URL;
  const problem = databaseUrlProblem(url);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  return neon(url as string);
}

export function connectStorage(): S3Client {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('V .env.local chýba niektoré z R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
    process.exit(1);
  }
  // Rovnaké nastavenie ako lib/storage.ts — vysvetlenie je tam
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/**
 * Zapíše trasy po jednej: nová sa vloží, existujúca (rovnaké id) prepíše.
 * Hodnoty idú ako jeden parameter jsonb ako v lib/routes-db.ts.
 */
export async function upsertRoutes(
  sql: ReturnType<typeof connectDatabase>,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const row of rows) {
    const names = Object.keys(row);
    if (names.some((n) => !/^[a-z_]+$/.test(n))) throw new Error(`Podozrivý stĺpec v ${row.id}`);
    const columns = names.join(', ');
    const updates = names.filter((n) => n !== 'id').map((n) => `${n} = excluded.${n}`).join(', ');
    await sql.query(
      `insert into public.routes (${columns})
       select ${columns} from jsonb_populate_record(null::public.routes, $1::jsonb)
       on conflict (id) do update set ${updates}`,
      [JSON.stringify(row)],
    );
  }
}
