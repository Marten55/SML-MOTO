import 'server-only';

export const locales = ['en', 'de', 'fr', 'sk'] as const;
export type Locale = (typeof locales)[number];

/**
 * Nemčina je predvolená — hlavný trh je Švajčiarsko a pri právnych textoch
 * je nemecká verzia tá rozhodujúca.
 */
export const defaultLocale: Locale = 'de';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  sk: 'Slovenčina',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Slovníky sa načítavajú dynamicky, aby sa do klientskeho balíka nedostali
 * preklady jazykov, ktoré návštevník nepozerá.
 */
const dictionaries = {
  en: () => import('@/dictionaries/en.json').then((m) => m.default),
  de: () => import('@/dictionaries/de.json').then((m) => m.default),
  fr: () => import('@/dictionaries/fr.json').then((m) => m.default),
  sk: () => import('@/dictionaries/sk.json').then((m) => m.default),
};

export type Dictionary = Awaited<ReturnType<(typeof dictionaries)['de']>>;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
