'use client';

import { useMemo, useState } from 'react';

import type { Dictionary, Locale } from '@/lib/i18n';
import type { Route } from '@/lib/routes';
import { RouteCard } from './route-card';

type LengthBand = 'short' | 'medium' | 'long';

const LENGTH_BANDS: Record<LengthBand, (km: number) => boolean> = {
  short: (km) => km <= 100,
  medium: (km) => km > 100 && km <= 200,
  long: (km) => km > 200,
};

const ALL = '__all__';

export function RouteCatalog({
  routes,
  lang,
  dict,
}: {
  routes: Route[];
  lang: Locale;
  dict: Dictionary;
}) {
  const [country, setCountry] = useState<string>(ALL);
  const [length, setLength] = useState<string>(ALL);
  const [tier, setTier] = useState<string>(ALL);

  // Ponúkame len tie krajiny, ktoré naozaj máme — prázdny filter je horší než žiadny
  const countries = useMemo(
    () => [...new Set(routes.map((r) => r.country))].sort(),
    [routes],
  );

  const visible = useMemo(
    () =>
      routes.filter((r) => {
        if (country !== ALL && r.country !== country) return false;
        if (tier !== ALL && r.tier !== tier) return false;
        if (length !== ALL && !LENGTH_BANDS[length as LengthBand](r.distanceKm)) return false;
        return true;
      }),
    [routes, country, length, tier],
  );

  const isFiltered = country !== ALL || length !== ALL || tier !== ALL;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-5 border-b border-line pb-6">
        <Filter
          label={dict.filters.country}
          value={country}
          onChange={setCountry}
          allLabel={dict.filters.all}
          options={countries.map((c) => ({
            value: c,
            label: dict.countries[c as keyof typeof dict.countries] ?? c,
          }))}
        />

        <Filter
          label={dict.filters.length}
          value={length}
          onChange={setLength}
          allLabel={dict.filters.all}
          options={[
            { value: 'short', label: dict.filters.short },
            { value: 'medium', label: dict.filters.medium },
            { value: 'long', label: dict.filters.long },
          ]}
        />

        <Filter
          label={dict.filters.tier}
          value={tier}
          onChange={setTier}
          allLabel={dict.filters.all}
          options={[
            { value: 'silver', label: dict.tiers.silver.name },
            { value: 'gold', label: dict.tiers.gold.name },
          ]}
        />

        <p className="ml-auto font-mono text-sm text-ink-3 tabular-nums" aria-live="polite">
          {visible.length} {dict.filters.count}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-ink-2">{dict.filters.none}</p>
          <button
            type="button"
            onClick={() => {
              setCountry(ALL);
              setLength(ALL);
              setTier(ALL);
            }}
            className="mt-4 font-mono text-sm text-accent hover:underline"
          >
            {dict.filters.reset}
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Prvý riadok mriežky je na počítači hneď na obrazovke */}
          {visible.map((route, i) => (
            <RouteCard key={route.id} route={route} lang={lang} dict={dict} eager={i < 3} />
          ))}
        </div>
      )}

      {isFiltered && visible.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setCountry(ALL);
            setLength(ALL);
            setTier(ALL);
          }}
          className="mt-8 font-mono text-sm text-ink-3 hover:text-accent"
        >
          {dict.filters.reset}
        </button>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div>
      <span className="block font-display text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
        {label}
      </span>
      <div className="mt-2 flex flex-wrap gap-1">
        <Chip active={value === ALL} onClick={() => onChange(ALL)}>
          {allLabel}
        </Chip>
        {options.map((o) => (
          <Chip key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? 'rounded-sm bg-accent-soft px-3 py-1.5 text-sm text-accent'
          : 'rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-line-strong'
      }
    >
      {children}
    </button>
  );
}
