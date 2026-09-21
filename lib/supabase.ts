import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseUrlProblem } from './supabase-url';

/**
 * Dvaja klienti s rôznymi právami — oddelenie podľa oprávnení, nie podľa servera.
 *
 * publicClient()  publishable kľúč, platia pravidlá RLS z migrácie: vidí len
 *                 zverejnené trasy a nezapíše nič. Používa ho verejný web.
 *
 * adminClient()   secret kľúč, RLS obchádza. Smie ho použiť len kód, ktorý
 *                 najprv overil admina (requireAdmin) alebo podpísaný token
 *                 zaplatenej trasy. Nikdy nie priamo s údajmi od návštevníka.
 *
 * Oba žijú len na serveri — prehliadač so Supabase zatiaľ nehovorí vôbec.
 */

// Server si session nepamätá; bez tohto by sa klient pokúšal ukladať prihlásenie.
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

let publicInstance: SupabaseClient | null = null;
let adminInstance: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nie je nastavený — pozri .env.example.`);
  return value;
}

/** Zlá adresa zhodí build s jasnou hláškou, nie s „fetch failed". */
function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  const problem = supabaseUrlProblem(url);
  if (problem) throw new Error(problem);
  return url as string;
}

export function publicClient(): SupabaseClient {
  publicInstance ??= createClient(supabaseUrl(), required('SUPABASE_PUBLISHABLE_KEY'), options);
  return publicInstance;
}

export function adminClient(): SupabaseClient {
  adminInstance ??= createClient(supabaseUrl(), required('SUPABASE_SECRET_KEY'), options);
  return adminInstance;
}
