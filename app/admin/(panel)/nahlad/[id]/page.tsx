import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RouteDetail } from '@/components/route-detail';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { getRouteForAdmin } from '@/lib/routes-db';

/*
 * Náhľad trasy pred zverejnením — hlavne kvôli prekladom, ktoré Miroslav
 * píše ručne: preklep v nemčine má vidieť on, nie zákazník.
 *
 * Prečo pod /admin a nie ako „?nahlad" na verejnom detaile: verejný detail
 * je predgenerovaný pre všetkých. Čítanie cookie by ho spravilo dynamickým
 * pre každého návštevníka, a cookie admina sa aj tak posiela len na /admin.
 *
 * Jazyk je v ?jazyk=, nie v ceste — administrácia je len po slovensky,
 * mení sa iba jazyk obsahu.
 */

// Poradie ako vo formulári: najprv jazyk, v ktorom Miroslav píše. Record
// zaručí, že keď pribudne jazyk v lib/i18n.ts, TypeScript ho tu bude chcieť.
const LOCALE_LABEL: Record<Locale, string> = { sk: 'SK', de: 'DE', en: 'EN', fr: 'FR' };
const PREVIEW_LOCALES = Object.keys(LOCALE_LABEL) as Locale[];

export default async function RoutePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jazyk?: string }>;
}) {
  const { id } = await params;
  const { jazyk } = await searchParams;
  const lang: Locale = jazyk && isLocale(jazyk) ? jazyk : 'sk';

  // getRouteForAdmin() si prihlásenie overí sama — Data Access Layer
  const found = await getRouteForAdmin(id);
  if (!found) notFound();
  const { route, published } = found;
  const dict = await getDictionary(lang);

  return (
    <>
      <div
        role="note"
        className="flex flex-wrap items-center justify-between gap-4 rounded-sm border-l-4 border-warn bg-surface px-5 py-4"
      >
        <p className="text-sm text-ink-2">
          <strong className="font-medium text-warn">Náhľad.</strong> Takto trasu uvidí zákazník.{' '}
          {published
            ? 'Trasa je zverejnená — zákazníci ju už vidia.'
            : 'Trasa je skrytá — zákazníci ju uvidia až po zverejnení v zozname trás.'}
        </p>
        <nav aria-label="Jazyk obsahu" className="flex gap-1">
          {PREVIEW_LOCALES.map((l) => (
            <Link
              key={l}
              href={`/admin/nahlad/${route.id}?jazyk=${l}`}
              aria-current={l === lang ? 'true' : undefined}
              className="rounded-sm border border-line px-3 py-1.5 font-mono text-xs text-ink-2 hover:border-accent hover:text-accent aria-[current=true]:border-accent aria-[current=true]:bg-accent aria-[current=true]:text-ground"
            >
              {LOCALE_LABEL[l]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="-mx-6">
        <RouteDetail
          route={route}
          lang={lang}
          dict={dict}
          back={{ href: '/admin', label: 'Späť na zoznam trás' }}
          preview
        />
      </div>
    </>
  );
}
