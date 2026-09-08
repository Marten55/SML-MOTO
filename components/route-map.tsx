'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Map as LeafletMap, Polyline } from 'leaflet';

import type { Dictionary, Locale } from '@/lib/i18n';
import { routeCenter, type Route } from '@/lib/routes';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';

/**
 * Interaktívna mapa trás — hlavný nápad z klientových poznámok: namiesto
 * nudného zoznamu veľká mapa, kde sú len jeho body.
 *
 * Leaflet sa používa priamo, bez react-leaflet: menej závislostí a žiadne
 * otázky okolo kompatibility s Reactom 19.
 *
 * Podklady sú CARTO nad OpenStreetMap — majú svetlú aj tmavú variantu,
 * takže mapa nekričí v tmavom režime. Žiadny API kľúč, žiadny Google.
 *
 * Markery sa zhlukujú. Bez toho sa pri pohľade na celú Európu alpské trasy
 * zlejú do jednej hrudky a na tie pod ňou sa nedá kliknúť — overené
 * v prehliadači, Bernina s Julierom si takto navzájom blokovali klik.
 * Pri plánovaných stovkách trás je to nutnosť, nie ozdoba.
 */

/**
 * Podklady z OpenStreetMap — bez API kľúča.
 *
 * POZOR pred spustením naostro: OSM má vlastnú politiku používania dlaždíc
 * a komerčnú prevádzku na nich neodporúča. Pred ostrým spustením treba
 * prejsť na poskytovateľa s licenciou (MapTiler, Stadia, Thunderforest)
 * — je to zmena jedného riadku plus kľúč v premenných prostredia.
 *
 * CARTO tu bolo pôvodne, ale bez kľúča vracia dlaždice s vodoznakom
 * „API KEY REQUIRED" cez celú mapu.
 */
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const TIER_COLOR: Record<string, string> = {
  gold: '#8a6600',
  silver: '#5c7079',
};

const TIER_COLOR_DARK: Record<string, string> = {
  gold: '#ddb254',
  silver: '#a9bac4',
};

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'dark') return true;
  if (stamped === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function RouteMap({
  routes,
  lang,
  dict,
}: {
  routes: Route[];
  lang: Locale;
  dict: Dictionary;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lineRef = useRef<Polyline | null>(null);

  const [selected, setSelected] = useState<Route | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!holder.current || mapRef.current) return;

    let cancelled = false;

    // Leaflet siaha na window, takže sa načíta až v prehliadači
    void (async () => {
      const mod = await import('leaflet');

      // markercluster je starý plugin: vešia sa na globálne L a ESM namespace
      // mu nestačí. Bez týchto dvoch riadkov padá na
      // "L.markerClusterGroup is not a function".
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      (globalThis as unknown as { L: typeof L }).L = L;
      await import('leaflet.markercluster');

      if (cancelled || !holder.current) return;

      const dark = prefersDark();

      const map = L.map(holder.current, {
        scrollWheelZoom: false, // inak mapa ukradne skrolovanie stránky
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer(TILE_URL, {
        attribution: ATTRIBUTION,
        maxZoom: 18,
        className: dark ? 'sml-tiles-dark' : undefined,
      }).addTo(map);

      const colors = dark ? TIER_COLOR_DARK : TIER_COLOR;
      const accent = dark ? '#35d69c' : '#0b7757';
      const ground = dark ? '#0f1613' : '#f5f7f6';

      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        // Vlastná ikona, aby zhluk ladil so zvyškom webu a nie s Leafletom
        iconCreateFunction: (c) =>
          L.divIcon({
            html: `<span style="
              display:flex;align-items:center;justify-content:center;
              width:34px;height:34px;border-radius:50%;
              background:${accent};color:${ground};
              font:600 13px/1 ui-monospace,monospace;
            ">${c.getChildCount()}</span>`,
            className: '',
            iconSize: [34, 34],
          }),
      });

      for (const route of routes) {
        // Marker sedí na ťažisku trasy, nie na štarte: označuje, kde trasa je,
        // a nezlepí sa s inou, ktorá vychádza z toho istého mesta.
        const marker = L.circleMarker(routeCenter(route), {
          radius: 8,
          weight: 2,
          color: colors[route.tier] ?? colors.silver,
          fillColor: colors[route.tier] ?? colors.silver,
          fillOpacity: route.passable ? 0.85 : 0.25,
        }).on('click', () => setSelected(route));

        marker.bindTooltip(route.title[lang], { direction: 'top', offset: [0, -8] });
        cluster.addLayer(marker);
      }

      map.addLayer(cluster);

      // Trasy sú naprieč Európou, takže sa zmestia všetky naraz
      map.fitBounds(L.latLngBounds(routes.map(routeCenter)), { padding: [40, 40] });

      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [routes, lang]);

  // Vybraná trasa sa priblíži a naznačí sa jej priebeh
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;

    void import('leaflet').then((L) => {
      if (!mapRef.current) return;

      lineRef.current?.remove();

      const points: [number, number][] = [
        [selected.start.lat, selected.start.lng],
        ...selected.via.map((p) => [p.lat, p.lng] as [number, number]),
        [selected.finish.lat, selected.finish.lng],
      ];

      // Prerušovaná zámerne: je to náznak priebehu, nie presná stopa.
      // Presná trasa je v GPX, ktoré si jazdec kupuje.
      lineRef.current = L.polyline(points, {
        color: prefersDark() ? '#35d69c' : '#0b7757',
        weight: 3,
        opacity: 0.75,
        dashArray: '6 8',
      }).addTo(map);

      map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
    });
  }, [selected]);

  return (
    <div className="relative overflow-hidden rounded-sm border border-line">
      <div
        ref={holder}
        className="h-[420px] w-full bg-surface-2 md:h-[520px]"
        role="application"
        aria-label={dict.map.label}
      />

      {!ready && (
        <p className="absolute inset-0 z-[1100] flex items-center justify-center font-mono text-sm text-ink-3">
          {dict.map.loading}
        </p>
      )}

      {selected ? (
        <SelectedCard
          route={selected}
          lang={lang}
          dict={dict}
          onClose={() => {
            setSelected(null);
            lineRef.current?.remove();
            lineRef.current = null;
          }}
        />
      ) : (
        ready && (
          <p className="pointer-events-none absolute top-4 right-4 z-[1100] rounded-sm bg-surface/90 px-3 py-2 text-sm text-ink-2 shadow-sm">
            {dict.map.hint}
          </p>
        )
      )}
    </div>
  );
}

function SelectedCard({
  route,
  lang,
  dict,
  onClose,
}: {
  route: Route;
  lang: Locale;
  dict: Dictionary;
  onClose: () => void;
}) {
  // z-index nad Leafletom: jeho vrstvy a ovládanie idú až po 1000 a kartu
  // by inak prekryli. Vpravo preto, aby sa nebila s tlačidlami +/− vľavo.
  return (
    <div className="absolute inset-x-4 bottom-4 z-[1100] rounded-sm border border-line bg-surface p-4 shadow-lg sm:inset-x-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-[320px]">
      <button
        type="button"
        onClick={onClose}
        aria-label={dict.map.close}
        className="float-right -mt-1 -mr-1 px-2 py-1 font-mono text-ink-3 hover:text-accent"
      >
        ✕
      </button>

      <span
        className="font-display text-xs font-bold tracking-[0.16em] uppercase"
        style={{ color: `var(--${route.tier})` }}
      >
        {dict.tiers[route.tier].name}
      </span>

      <h3 className="mt-1 font-display text-lg leading-tight font-semibold">
        {route.title[lang]}
      </h3>

      <p className="mt-1 text-sm text-ink-3">
        {route.region}
        {!route.passable && <span className="text-crit"> · {dict.status.closed}</span>}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-ink-3 tabular-nums">
        <div className="flex gap-1.5">
          <dt>{dict.route.length}</dt>
          <dd className="text-ink-2">{route.distanceKm} km</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>{dict.route.curviness}</dt>
          <dd className="text-ink-2">{'▲'.repeat(route.curviness)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-lg tabular-nums">{route.priceChf} CHF</span>
        <Link
          href={`/${lang}/trasy/${route.slug}`}
          className="rounded-sm bg-accent px-4 py-2 font-display text-xs font-semibold tracking-wider text-ground uppercase"
        >
          {dict.map.open}
        </Link>
      </div>
    </div>
  );
}
