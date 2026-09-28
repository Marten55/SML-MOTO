import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getDictionary, isLocale, locales } from '@/lib/i18n';
import { getAllRoutes, getRouteBySlug } from '@/lib/routes-db';
import { RouteDetail } from '@/components/route-detail';

/**
 * Stránka ostáva predgenerovaná, ale Next.js ju sám prestaví každú polhodinu,
 * aby počasie nezamrzlo na hodnote z builderu. Obsah trasy sa nemení, takže
 * je to len kvôli meteo bloku — a je to lacnejšie a menej krehké než ťahať
 * počasie zvlášť cez klientský JavaScript.
 */
export const revalidate = 1800;

// Pri builde sa predgenerujú zverejnené trasy. Novú trasu z administrácie
// Next.js vyrenderuje pri prvej návšteve (dynamicParams je predvolene zapnuté).
export async function generateStaticParams() {
  const routes = await getAllRoutes();
  return locales.flatMap((lang) => routes.map((route) => ({ lang, slug: route.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const route = await getRouteBySlug(slug);
  if (!route || !isLocale(lang)) return {};

  return {
    title: route.title[lang],
    description: route.summary[lang],
  };
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();

  const route = await getRouteBySlug(slug);
  if (!route) notFound();

  const dict = await getDictionary(lang);

  return (
    <RouteDetail
      route={route}
      lang={lang}
      dict={dict}
      back={{ href: `/${lang}/trasy`, label: dict.route.backToRoutes }}
    />
  );
}
