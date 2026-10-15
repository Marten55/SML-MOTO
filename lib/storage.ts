import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

/**
 * Úložisko súborov trás — Cloudflare R2, súkromný bucket `route-files`.
 *
 * R2 hovorí rovnakým jazykom (API) ako Amazon S3, preto oficiálny AWS klient:
 * je najrozšírenejší a pri prípadnom presune na S3 alebo Backblaze B2 sa mení
 * len adresa a kľúče, nie kód.
 *
 * Bucket je súkromný, kým v Cloudflare nezapneš „Public access" — to sa NIKDY
 * nesmie stať, platené GPX by boli na stiahnutie zadarmo. Súbory sa dostanú
 * von len cez krátkodobý podpísaný odkaz (lib/route-files.ts).
 */

let instance: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nie je nastavený — pozri .env.example.`);
  return value;
}

export function storage(): S3Client {
  instance ??= new S3Client({
    // R2 nemá regióny ako AWS; 'auto' je hodnota, ktorú Cloudflare predpisuje
    region: 'auto',
    endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
    // Novšie verzie SDK pridávajú kontrolný súčet do KAŽDEJ požiadavky, aj do
    // podpísanej adresy na nahratie. Prehliadač ho nepošle a R2 nahratie
    // odmietne. Takto ho SDK pridá len tam, kde ho S3 vyslovene vyžaduje.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return instance;
}
