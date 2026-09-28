import { emptyRouteDraft, MAX_HIGHLIGHTS, type RouteDraft } from './route-draft';

/**
 * Rozpísaný formulár novej trasy v localStorage prehliadača — aby ho nezmazal
 * omylom kliknutý odkaz „Trasy" alebo zatvorená karta.
 *
 * Prečo nie v databáze: tabuľka routes berie len hotovú trasu (povinné
 * stĺpce), a samostatná tabuľka na polotovary by znamenala druhý tvar tých
 * istých dát. Cena: koncept je len v tomto prehliadači a súbory GPX sa po
 * návrate nahrávajú znova (sú veľké a text formulára je to, čo bolí stratiť).
 *
 * Nič tajné tu nie je — texty, ktoré aj tak pôjdu do verejného katalógu.
 */

/** Pri zmene tvaru RouteDraft netreba verziu zvyšovať — restoreDraft neznáme polia zahodí. */
export const DRAFT_STORAGE_KEY = 'sml-admin:nova-trasa';

interface Stored {
  savedAt: number;
  draft: RouteDraft;
}

type Localized = RouteDraft['title'];

function isLocalized(v: unknown, template: Localized): v is Localized {
  if (typeof v !== 'object' || v === null) return false;
  return Object.keys(template).every((k) => typeof (v as Record<string, unknown>)[k] === 'string');
}

/**
 * Z čohokoľvek, čo leží v localStorage, spraví platný koncept — alebo null.
 * Uložené dáta mohla zapísať staršia verzia formulára: pole, ktoré medzitým
 * pribudlo, dostane predvolenú hodnotu, pole zlého typu sa ignoruje.
 * Formulár tak nikdy nespadne na tom, čo si prehliadač pamätá.
 */
export function restoreDraft(raw: string | null): { savedAt: number; draft: RouteDraft } | null {
  if (!raw) return null;
  let parsed: Partial<Stored>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed?.savedAt !== 'number' || typeof parsed.draft !== 'object' || parsed.draft === null) {
    return null;
  }

  const saved = parsed.draft as Record<string, unknown>;
  const draft = emptyRouteDraft();
  const target = draft as Record<string, unknown>;

  for (const [key, fallback] of Object.entries(draft)) {
    const value = saved[key];
    if (key === 'highlights') {
      const template = (fallback as Localized[])[0];
      if (Array.isArray(value) && value.length > 0 && value.every((h) => isLocalized(h, template))) {
        target.highlights = value.slice(0, MAX_HIGHLIGHTS);
      }
    } else if (typeof fallback === 'object') {
      if (isLocalized(value, fallback as Localized)) target[key] = value;
    } else if (typeof value === typeof fallback) {
      target[key] = value;
    }
  }

  return { savedAt: parsed.savedAt, draft };
}

/** Oplatí sa koncept vôbec ukladať? Prázdny formulár by po návrate strašil hláškou o obnove. */
export function hasContent(draft: RouteDraft): boolean {
  const empty = JSON.stringify(emptyRouteDraft());
  return JSON.stringify(draft) !== empty;
}

// localStorage môže hodiť výnimku (súkromné okno v Safari, plná kvóta,
// zakázané úložisko). Stratený koncept nesmie zhodiť formulár.

export function loadDraft(): { savedAt: number; draft: RouteDraft } | null {
  try {
    return restoreDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveDraft(draft: RouteDraft): void {
  try {
    if (!hasContent(draft)) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const stored: Stored = { savedAt: Date.now(), draft };
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Nevadí — formulár funguje ďalej, len bez zálohy
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Pozri saveDraft
  }
}
