'use client';

import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

import { DARK_TILES_CLASS, prefersDark, TILE_ATTRIBUTION, TILE_URL } from '@/lib/map-tiles';
import type { TrackPoint, Waypoint } from '@/lib/route-builder';

import 'leaflet/dist/leaflet.css';

type Leaflet = typeof import('leaflet');

/**
 * Náhľad nahratej trasy: stopa, štart, cieľ a body záujmu. Miroslav tu na prvý
 * pohľad uvidí, či export sedí — rovná čiara cez horu znamená, že v súbore sú
 * len body a nie stopa.
 *
 * Mapa sa vytvorí raz a pri novom súbore sa len prekreslí vrstva. Vytvárať ju
 * zakaždým znova by blikalo a Leaflet by hádzal chybu o už použitom kontajneri.
 */
export function PreviewMap({ track, waypoints }: { track: TrackPoint[]; waypoints: Waypoint[] }) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Leaflet siaha na window, načíta sa až v prehliadači
    void (async () => {
      const mod = await import('leaflet');
      const L = (mod as unknown as { default?: Leaflet }).default ?? mod;
      if (cancelled || !holder.current || mapRef.current) return;

      const map = L.map(holder.current, { scrollWheelZoom: false });
      L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 18,
        className: prefersDark() ? DARK_TILES_CLASS : undefined,
      }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    const dark = prefersDark();
    const accent = dark ? '#35d69c' : '#0b7757';
    const warn = dark ? '#e0b054' : '#8a6210';
    const ground = dark ? '#0f1613' : '#ffffff';

    const line = track.map((p) => [p.lat, p.lng] as [number, number]);
    if (line.length >= 2) {
      L.polyline(line, { color: accent, weight: 4, opacity: 0.9 }).addTo(layer);
      const end = { radius: 7, weight: 3, color: ground, fillOpacity: 1 };
      L.circleMarker(line[0], { ...end, fillColor: accent }).bindTooltip('Štart').addTo(layer);
      L.circleMarker(line[line.length - 1], { ...end, fillColor: '#b33a2b' })
        .bindTooltip('Cieľ')
        .addTo(layer);
    }

    for (const w of waypoints) {
      L.circleMarker([w.lat, w.lng], {
        radius: 5,
        weight: 2,
        color: ground,
        fillColor: warn,
        fillOpacity: 1,
      })
        .bindTooltip(w.name)
        .addTo(layer);
    }

    const all: [number, number][] = [...line, ...waypoints.map((w) => [w.lat, w.lng] as [number, number])];
    if (all.length > 0) map.fitBounds(L.latLngBounds(all), { padding: [28, 28], maxZoom: 14 });
  }, [ready, track, waypoints]);

  return (
    <div
      ref={holder}
      className="aspect-[16/10] w-full overflow-hidden rounded-sm border border-line bg-surface-2"
      role="img"
      aria-label={`Náhľad trasy: ${track.length} bodov stopy, ${waypoints.length} bodov záujmu`}
    />
  );
}
