import Link from 'next/link';

import type { Dictionary, Locale } from '@/lib/i18n';
import type { Route } from '@/lib/routes';

export function RouteCard({
  route,
  lang,
  dict,
}: {
  route: Route;
  lang: Locale;
  dict: Dictionary;
}) {
  return (
    <Link
      href={`/${lang}/trasy/${route.slug}`}
      className="group flex flex-col rounded-sm border border-line bg-surface transition-colors hover:border-line-strong"
    >
      {/* Miesto pre POV video. Kým nedorazí, drží pomer strán, aby karta neposkakovala. */}
      <div className="flex aspect-video items-center justify-center border-b border-line bg-surface-2">
        <span className="font-mono text-xs text-ink-3">POV</span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span
            className="font-display text-xs font-bold tracking-[0.16em] uppercase"
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

        <h3 className="mt-2 font-display text-xl leading-tight font-semibold group-hover:text-accent">
          {route.title[lang]}
        </h3>

        <p className="mt-1 text-sm text-ink-3">
          {route.region}
          {!route.passable && (
            <span className="text-crit"> · {dict.status.closed}</span>
          )}
        </p>

        <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-ink-3 tabular-nums">
          <div className="flex gap-1.5">
            <dt>{dict.route.length}</dt>
            <dd className="text-ink-2">{route.distanceKm} km</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{dict.route.ascent}</dt>
            <dd className="text-ink-2">{route.ascentM} m</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>{dict.route.curviness}</dt>
            <dd className="text-ink-2">{'▲'.repeat(route.curviness)}</dd>
          </div>
        </dl>

        <p className="mt-auto pt-5 font-mono text-lg tabular-nums">
          {route.priceChf} CHF
        </p>
      </div>
    </Link>
  );
}
