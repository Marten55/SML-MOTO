import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getDictionary, isLocale, locales } from '@/lib/i18n';
import { getAllRoutes, getRouteBySlug, googleMapsUrl } from '@/lib/routes';
import { UnlockButton } from '@/components/unlock-button';

export function generateStaticParams() {
  return locales.flatMap((lang) =>
    getAllRoutes().map((route) => ({ lang, slug: route.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const route = getRouteBySlug(slug);
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

  const route = getRouteBySlug(slug);
  if (!route) notFound();

  const dict = await getDictionary(lang);

  const facts = [
    { label: dict.route.length, value: `${route.distanceKm} km` },
    { label: dict.route.ascent, value: `${route.ascentM} m` },
    { label: dict.route.duration, value: `${route.durationHours} h` },
    { label: dict.route.temp, value: `${route.avgTempC} °C` },
    { label: dict.route.region, value: route.region },
    { label: dict.route.difficulty, value: dict.difficulty[route.difficulty] },
    { label: dict.route.curviness, value: '▲'.repeat(route.curviness) },
    {
      label: dict.route.season,
      value: `${romanMonth(route.seasonFrom)} – ${romanMonth(route.seasonTo)}`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Link href={`/${lang}/trasy`} className="font-mono text-xs text-ink-3 hover:text-accent">
        ← {dict.route.backToRoutes}
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-display text-sm font-bold tracking-[0.19em] uppercase"
              style={{ color: `var(--${route.tier})` }}
            >
              {dict.tiers[route.tier].name}
            </span>
            {route.isExample && (
              <span className="rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-3">
                {dict.common.example}
              </span>
            )}
          </div>

          <h1 className="mt-3 max-w-[20ch] font-display text-4xl leading-[1.02] font-semibold text-balance md:text-5xl">
            {route.title[lang]}
          </h1>

          {/* Zavretý priesmyk je jediná vec, ktorá jazdcovi ušetrí zbytočnú cestu */}
          <p
            className={`mt-4 inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm ${
              route.passable
                ? 'bg-accent-soft text-accent'
                : 'bg-[color:var(--crit-soft)] text-crit'
            }`}
          >
            <span aria-hidden className="font-mono">
              {route.passable ? '✓' : '✕'}
            </span>
            {route.passable ? dict.status.openHint : dict.status.closedHint}
          </p>

          <div className="mt-8 flex aspect-video items-center justify-center rounded-sm border border-line bg-surface-2">
            <span className="font-mono text-xs text-ink-3">POV</span>
          </div>

          <p className="mt-8 max-w-[64ch] text-lg text-ink-2">{route.summary[lang]}</p>

          <h2 className="mt-12 font-display text-2xl font-semibold">
            {dict.route.highlights}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {route.highlights.map((h, i) => (
              <li key={i} className="grid grid-cols-[18px_1fr] gap-2 text-ink-2">
                <span className="font-mono text-accent">+</span>
                <span>{h[lang]}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 font-display text-2xl font-semibold">{dict.route.gear}</h2>
          <p className="mt-3 max-w-[60ch] text-ink-2">{route.gear[lang]}</p>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-sm border border-line bg-surface p-6">
            <dl className="flex flex-col gap-3">
              {facts.map((f) => (
                <div
                  key={f.label}
                  className="flex justify-between gap-4 border-b border-line pb-3 text-sm last:border-0 last:pb-0"
                >
                  <dt className="text-ink-3">{f.label}</dt>
                  <dd className="font-mono tabular-nums">{f.value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-6 font-mono text-3xl tabular-nums">{route.priceChf} CHF</p>

            <UnlockButton slug={route.slug} lang={lang} dict={dict} />

            <p className="mt-3 text-center text-xs text-ink-3">{dict.checkout.methods}</p>
          </div>

          <a
            href={googleMapsUrl(route)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block rounded-sm border border-line px-4 py-3 text-center text-sm text-ink-2 hover:border-accent hover:text-accent"
          >
            {dict.delivery.maps}
          </a>
        </aside>
      </div>
    </div>
  );
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
function romanMonth(month: number): string {
  return ROMAN[month] ?? String(month);
}
