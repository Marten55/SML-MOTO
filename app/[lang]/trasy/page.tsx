import { notFound } from 'next/navigation';

import { RouteCatalog } from '@/components/route-catalog';
import { getDictionary, isLocale, locales } from '@/lib/i18n';
import { getAllRoutes } from '@/lib/routes';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RoutesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const routes = getAllRoutes();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold md:text-5xl">{dict.nav.routes}</h1>

      <div className="mt-10">
        <RouteCatalog routes={routes} lang={lang} dict={dict} />
      </div>
    </div>
  );
}
