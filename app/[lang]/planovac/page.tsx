import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';

import { getDictionary, isLocale, locales } from '@/lib/i18n';
import { getAllRoutes } from '@/lib/routes';

// Leaflet siaha na window, takže sa plánovač nesmie renderovať na serveri
const Planner = dynamic(() =>
  import('@/components/planner').then((m) => m.Planner),
);

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};

  const dict = await getDictionary(lang);
  return { title: dict.planner.title, description: dict.planner.lede };
}

export default async function PlannerPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const dict = await getDictionary(lang);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="font-display text-xs font-semibold tracking-[0.22em] text-bronze uppercase">
        {dict.tiers.bronze.name} · {dict.common.free}
      </p>

      <h1 className="mt-3 max-w-[20ch] font-display text-4xl leading-[1.04] font-semibold text-balance md:text-5xl">
        {dict.planner.title}
      </h1>

      <p className="mt-5 max-w-[62ch] text-lg text-ink-2">{dict.planner.lede}</p>

      <div className="mt-10">
        <Planner routes={getAllRoutes()} lang={lang} dict={dict} />
      </div>
    </div>
  );
}
