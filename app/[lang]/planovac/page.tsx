import { notFound } from 'next/navigation';

import { getDictionary, isLocale, locales } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
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
    <div className="mx-auto max-w-3xl px-6 py-24">
      <p className="font-mono text-xs tracking-wider text-ink-3 uppercase">
        {dict.common.soon}
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">
        {dict.nav.planner}
      </h1>
      <p className="mt-6 max-w-[60ch] text-lg text-ink-2">{dict.tiers.bronze.short}</p>
    </div>
  );
}
