import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getDictionary, isLocale } from '@/lib/i18n';
import { getAllRoutes } from '@/lib/routes';
import { RouteCard } from '@/components/route-card';

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);
  const routes = getAllRoutes();

  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="border-b border-line py-16 md:py-24">
        <p className="font-display text-xs font-semibold tracking-[0.22em] text-accent uppercase">
          {dict.brand.tagline}
        </p>

        <h1 className="mt-4 max-w-[18ch] font-display text-5xl leading-[0.95] font-bold text-balance md:text-7xl">
          {dict.home.title}
        </h1>

        <p className="mt-6 max-w-[62ch] text-lg text-ink-2">{dict.home.subtitle}</p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`/${lang}/trasy`}
            className="rounded-sm bg-accent px-6 py-3 font-display text-sm font-semibold tracking-wider text-ground uppercase"
          >
            {dict.home.browse}
          </Link>
          <Link
            href={`/${lang}/planovac`}
            className="rounded-sm border border-line-strong px-6 py-3 font-display text-sm font-semibold tracking-wider uppercase hover:border-accent hover:text-accent"
          >
            {dict.home.planFree}
          </Link>
        </div>
      </section>

      <section className="grid gap-px border-b border-line bg-line py-px md:grid-cols-3">
        {(['bronze', 'silver', 'gold'] as const).map((tier) => (
          <div key={tier} className="bg-ground px-6 py-8">
            <span
              className="font-display text-sm font-bold tracking-[0.19em] uppercase"
              style={{ color: `var(--${tier})` }}
            >
              {dict.tiers[tier].name}
            </span>
            <p className="mt-2 text-sm text-ink-2">{dict.tiers[tier].short}</p>
          </div>
        ))}
      </section>

      <section className="py-16">
        <h2 className="font-display text-3xl font-semibold">{dict.nav.routes}</h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} lang={lang} dict={dict} />
          ))}
        </div>
      </section>
    </div>
  );
}
