'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/admin-session';
import { setRoutePublished } from '@/lib/routes-db';
import { isSupabaseConfigured } from '@/lib/supabase';

/*
 * Zverejnenie a stiahnutie trasy z predaja (krok D4). Verejná POST adresa
 * ako každá Server Action — admina overí sama a ID aj smer berie z formulára
 * len ako prianie; či sa trasa dá zverejniť, rozhodne setRoutePublished().
 */

export interface PublishState {
  error: string | null;
}

export async function togglePublished(_prev: PublishState, formData: FormData): Promise<PublishState> {
  await requireAdmin();
  // Lokálne bez Supabase sa trasy čítajú z data/routes.json — tam niet čo meniť
  if (!isSupabaseConfigured()) return { error: 'Zverejňovanie potrebuje Supabase.' };

  const id = formData.get('id');
  const target = formData.get('published');
  if (typeof id !== 'string' || (target !== 'true' && target !== 'false')) {
    return { error: 'Neplatná požiadavka. Obnov stránku.' };
  }
  const published = target === 'true';

  const result = await setRoutePublished(id, published);
  if (result === 'not_found') return { error: 'Trasa už neexistuje. Obnov stránku.' };
  if (result === 'invalid') {
    return { error: 'Trasa má neúplné údaje alebo jej chýba GPX, preto sa nedá zverejniť.' };
  }

  // Celý verejný web naraz: úvod (mapa trás), katalóg, detail, plánovač
  // a všetko, čo pod [lang] pribudne neskôr. Pri zmene raz za čas je to
  // lacnejšie než zoznam stránok, na ktorý sa pri novej stránke zabudne.
  // Stránky sa neprestavia hneď, ale pri najbližšej návšteve.
  revalidatePath('/[lang]', 'layout');
  revalidatePath('/admin');
  return { error: null };
}
