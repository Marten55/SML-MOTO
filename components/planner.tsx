'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Map as LeafletMap, LayerGroup, Polyline } from 'leaflet';

import type { Dictionary, Locale } from '@/lib/i18n';
import { routeCenter, type Route } from '@/lib/routes';

import 'leaflet/dist/leaflet.css';

/**
 * Bezplatný plánovač trás — vrstva Bronze.
 *
 * Návštevník naklikne body, my mu spočítame trasu a dáme odkaz do Google Maps.
 * Zámerne ukazuje aj svoj limit: trasu vypočítal algoritmus, nikto ju neprešiel.
 * Pod výsledkom sa preto zobrazia overené trasy z rovnakého kraja — free vrstva
 * je lievik, nie konkurencia platenému obsahu.
 */

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const MAX_POINTS = 8;

/** Alpy — tam začína drvivá väčšina toho, čo tento web rieši. */
const INITIAL_VIEW: [number, number] = [46.6, 8.6];
const INITIAL_ZOOM = 8;

interface PlannedRoute {
  path: [number, number][];
  distanceKm: number;
  durationMin: number;
  provider: string;
}

type Status = 'idle' | 'loading' | 'error' | 'done';

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'dark') return true;
  if (stamped === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Vzdušná vzdialenosť v km — na zoradenie blízkych trás stačí. */
function distanceKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function Planner({
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
  const markersRef = useRef<LayerGroup | null>(null);
  const lineRef = useRef<Polyline | null>(null);

  const [points, setPoints] = useState<[number, number][]>([]);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorKey, setErrorKey] = useState<string>('generic');
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  // --- mapa ---
  useEffect(() => {
    if (!holder.current || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const mod = await import('leaflet');
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !holder.current) return;

      const map = L.map(holder.current, { scrollWheelZoom: false }).setView(
        INITIAL_VIEW,
        INITIAL_ZOOM,
      );
      mapRef.current = map;

      L.tileLayer(TILE_URL, {
        attribution: ATTRIBUTION,
        maxZoom: 18,
        className: prefersDark() ? 'sml-tiles-dark' : undefined,
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        setPoints((prev) =>
          prev.length >= MAX_POINTS ? prev : [...prev, [e.latlng.lat, e.latlng.lng]],
        );
        // Nový bod znamená, že predchádzajúci výsledok už neplatí
        setRoute(null);
        setStatus('idle');
        setQrSrc(null);
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- značky pre kliknuté body ---
  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;

    void import('leaflet').then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      group.clearLayers();

      points.forEach(([lat, lng], i) => {
        L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            iconSize: [26, 26],
            html: `<span style="
              display:flex;align-items:center;justify-content:center;
              width:26px;height:26px;border-radius:50%;
              background:${prefersDark() ? '#35d69c' : '#0b7757'};
              color:${prefersDark() ? '#0f1613' : '#f5f7f6'};
              font:600 12px/1 ui-monospace,monospace;
            ">${i + 1}</span>`,
          }),
        }).addTo(group);
      });
    });
  }, [points]);

  // --- vykreslenie vypočítanej trasy ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    void import('leaflet').then((mod) => {
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      lineRef.current?.remove();
      lineRef.current = null;
      if (!route) return;

      lineRef.current = L.polyline(route.path, {
        color: prefersDark() ? '#35d69c' : '#0b7757',
        weight: 4,
        opacity: 0.85,
      }).addTo(map);

      map.fitBounds(L.latLngBounds(route.path), { padding: [40, 40] });
    });
  }, [route]);

  const calculate = useCallback(async () => {
    if (points.length < 2) return;
    setStatus('loading');
    setQrSrc(null);

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorKey(
          body.error === 'not_configured'
            ? 'notConfigured'
            : body.error === 'rate_limited'
              ? 'rateLimited'
              : body.error === 'no_route'
                ? 'noRoute'
                : 'generic',
        );
        setStatus('error');
        return;
      }

      const { route: planned } = (await res.json()) as { route: PlannedRoute };
      setRoute(planned);
      setStatus('done');

      // QR sa načíta až keď je čo kódovať — nezaťažuje stránku pri prvom otvorení
      const QRCode = (await import('qrcode')).default;
      const svg = await QRCode.toString(mapsUrl(points), {
        type: 'svg',
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrSrc(`data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`);
    } catch {
      setErrorKey('generic');
      setStatus('error');
    }
  }, [points]);

  function reset() {
    setPoints([]);
    setRoute(null);
    setStatus('idle');
    setQrSrc(null);
  }

  function undo() {
    setPoints((prev) => prev.slice(0, -1));
    setRoute(null);
    setStatus('idle');
    setQrSrc(null);
  }

  // Overené trasy z rovnakého kraja — free vrstva má viesť k plateným
  const nearby = route
    ? routes
        .map((r) => ({
          route: r,
          km: distanceKm(routeCenter(r), route.path[Math.floor(route.path.length / 2)]),
        }))
        .filter((x) => x.km < 250)
        .sort((a, b) => a.km - b.km)
        .slice(0, 3)
    : [];

  return (
    <div>
      <div className="relative overflow-hidden rounded-sm border border-line">
        <div ref={holder} className="h-[420px] w-full bg-surface-2 md:h-[520px]" />

        {points.length === 0 && (
          <p className="pointer-events-none absolute top-4 right-4 z-[1100] rounded-sm bg-surface/90 px-3 py-2 text-sm text-ink-2 shadow-sm">
            {dict.planner.hint}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={calculate}
          disabled={points.length < 2 || status === 'loading'}
          className="rounded-sm bg-accent px-6 py-3 font-display text-sm font-semibold tracking-wider text-ground uppercase disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? dict.planner.calculating : dict.planner.calculate}
        </button>

        <button
          type="button"
          onClick={undo}
          disabled={points.length === 0}
          className="rounded-sm border border-line px-4 py-3 text-sm hover:border-line-strong disabled:opacity-40"
        >
          {dict.planner.undo}
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={points.length === 0}
          className="rounded-sm border border-line px-4 py-3 text-sm hover:border-line-strong disabled:opacity-40"
        >
          {dict.planner.clear}
        </button>

        <span className="ml-auto font-mono text-sm text-ink-3 tabular-nums">
          {points.length} / {MAX_POINTS}
        </span>
      </div>

      {status === 'error' && (
        <p role="alert" className="mt-4 rounded-sm bg-[color:var(--crit-soft)] px-4 py-3 text-sm text-crit">
          {dict.plannerError[errorKey as keyof typeof dict.plannerError] ??
            dict.plannerError.generic}
        </p>
      )}

      {route && (
        <div className="mt-6 rounded-sm border border-line bg-surface p-5">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <dt className="font-display text-xs tracking-[0.14em] text-ink-3 uppercase">
                {dict.route.length}
              </dt>
              <dd className="font-mono text-2xl tabular-nums">{route.distanceKm} km</dd>
            </div>
            <div>
              <dt className="font-display text-xs tracking-[0.14em] text-ink-3 uppercase">
                {dict.route.duration}
              </dt>
              <dd className="font-mono text-2xl tabular-nums">
                {Math.floor(route.durationMin / 60)} h {route.durationMin % 60} min
              </dd>
            </div>
          </dl>

          <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <a
              href={mapsUrl(points)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-sm bg-accent px-5 py-3.5 text-center font-display text-sm font-semibold tracking-wider text-ground uppercase"
            >
              {dict.delivery.maps}
            </a>

            {qrSrc && (
              <figure className="m-0 flex flex-col items-center gap-2">
                <div className="rounded-sm border border-line bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI */}
                  <img src={qrSrc} alt={dict.delivery.qr} width={120} height={120} />
                </div>
              </figure>
            )}
          </div>

          <p className="mt-5 border-t border-line pt-4 text-sm text-ink-3">
            {dict.planner.algorithmNote}
          </p>
        </div>
      )}

      {nearby.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">
            {dict.planner.nearbyHeading}
          </h2>
          <p className="mt-2 max-w-[60ch] text-ink-2">{dict.planner.nearbyLede}</p>

          <ul className="mt-5 flex flex-col gap-px rounded-sm border border-line bg-line">
            {nearby.map(({ route: r, km }) => (
              <li key={r.id} className="bg-surface">
                <Link
                  href={`/${lang}/trasy/${r.slug}`}
                  className="group flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-2"
                >
                  <span>
                    <span
                      className="font-display text-xs font-bold tracking-[0.16em] uppercase"
                      style={{ color: `var(--${r.tier})` }}
                    >
                      {dict.tiers[r.tier].name}
                    </span>
                    <span className="block font-medium group-hover:text-accent">
                      {r.title[lang]}
                    </span>
                    <span className="block text-sm text-ink-3">
                      {r.region} · {Math.round(km)} km {dict.planner.away}
                    </span>
                  </span>
                  <span className="font-mono tabular-nums">{r.priceChf} CHF</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Rovnaká schéma ako pri predávaných trasách — pozri lib/routes.ts */
function mapsUrl(points: [number, number][]): string {
  const fmt = ([lat, lng]: [number, number]) => `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const list = points.slice(0, MAX_POINTS);

  const params = new URLSearchParams({
    api: '1',
    origin: fmt(list[0]),
    destination: fmt(list[list.length - 1]),
    travelmode: 'driving',
  });

  const via = list.slice(1, -1);
  if (via.length > 0) params.set('waypoints', via.map(fmt).join('|'));

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
