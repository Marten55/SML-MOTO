'use client';

import dynamic from 'next/dynamic';
import { useDeferredValue, useId, useMemo, useState } from 'react';

import {
  buildRoutePackage,
  MAX_FILE_BYTES,
  type InputFile,
  type Issue,
  type RoutePackage,
  type RouteStats,
} from '@/lib/route-builder';
import { slugify } from '@/lib/slug';

/*
 * Rozbor beží celý v prehliadači — súbor sa nikam neposiela.
 *
 * - Žiadny limit veľkosti požiadavky: serverová funkcia na Verceli unesie
 *   najviac 4,5 MB, export s tisíckami bodov by sa tam nezmestil.
 * - Výsledok je hneď, bez čakania na server.
 * - Kým Miroslav trasu nezverejní (krok D), nič z nej neopustí jeho počítač.
 *
 * Pri zverejnení (krok D) server rozbor zopakuje sám — prehliadaču sa pri
 * zápise do databázy veriť nedá.
 */

// Leaflet potrebuje window — mapa sa načíta až v prehliadači
const PreviewMap = dynamic(() => import('./preview-map').then((m) => m.PreviewMap), {
  ssr: false,
  loading: () => (
    <div className="aspect-[16/10] w-full animate-pulse rounded-sm border border-line bg-surface-2" />
  ),
});

const ACCEPT = '.gpx,.kml,.csv';
const FALLBACK_NAME = 'Nová trasa';

export function RouteBuilderForm() {
  const nameId = useId();
  const [name, setName] = useState('');
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // Rozbor sa robí nanovo aj pri zmene názvu (ide do GPX). useDeferredValue
  // zabezpečí, že písanie do poľa nezamrzne, kým sa balíček prepočítava.
  const deferredName = useDeferredValue(name);
  const pkg = useMemo<RoutePackage | null>(
    () =>
      inputs.length === 0
        ? null
        : buildRoutePackage(inputs, { name: deferredName.trim() || FALLBACK_NAME }),
    [inputs, deferredName],
  );

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;

    const errors: string[] = [];
    const read: InputFile[] = [];

    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        errors.push(`${file.name}: súbor má ${(file.size / 1024 / 1024).toFixed(1)} MB, najviac sa dá 25 MB.`);
        continue;
      }
      if (/\.kmz$/i.test(file.name)) {
        errors.push(`${file.name}: KMZ je zbalený KML. V Swisstopo exportuj priamo KML.`);
        continue;
      }
      read.push({ name: file.name, content: await file.text() });
    }

    setReadErrors(errors);
    // Súbor s rovnakým menom nahradí starší — Miroslav ho mohol medzitým opraviť
    setInputs((current) => [
      ...current.filter((f) => !read.some((r) => r.name === f.name)),
      ...read,
    ]);
  }

  function removeFile(fileName: string) {
    setInputs((current) => current.filter((f) => f.name !== fileName));
  }

  const slug = slugify(deferredName) || 'trasa';

  return (
    <div className="mt-8 flex flex-col gap-8">
      <label htmlFor={nameId} className="flex max-w-xl flex-col gap-2">
        <span className="font-display text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase">
          Názov trasy
        </span>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="napr. Furka · Grimsel · Susten"
          maxLength={120}
          className="rounded-sm border border-line bg-surface px-4 py-3 text-base focus:border-accent focus:outline-none"
        />
        <span className="text-sm text-ink-3">
          Uloží sa do GPX súborov — navigácia ho ukáže v zozname trás.
        </span>
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={`rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'
        }`}
      >
        <p className="font-display text-xl font-semibold">Sem pretiahni export zo Swisstopo</p>
        <p className="mt-1 text-sm text-ink-3">GPX, KML alebo CSV · viac súborov naraz · najviac 25 MB</p>
        <label className="mt-5 inline-block cursor-pointer rounded-sm bg-accent px-5 py-3 font-display text-sm font-semibold tracking-wider text-ground uppercase focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
          Vybrať súbory
          <input
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              void addFiles(e.target.files);
              // Rovnaký súbor sa dá vybrať znova (po úprave v Swisstopo)
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {readErrors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-crit">
          {readErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {inputs.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Nahraté súbory">
          {inputs.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2 rounded-sm border border-line bg-surface py-1.5 pr-1.5 pl-3 font-mono text-sm"
            >
              {f.name}
              <button
                type="button"
                onClick={() => removeFile(f.name)}
                aria-label={`Odstrániť ${f.name}`}
                className="rounded-sm px-2 text-ink-3 hover:bg-surface-2 hover:text-crit"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {pkg && <Result pkg={pkg} slug={slug} />}
    </div>
  );
}

// ── Výsledok ───────────────────────────────────────────────────────────────

function Result({ pkg, slug }: { pkg: RoutePackage; slug: string }) {
  return (
    <section className="flex flex-col gap-8" aria-live="polite">
      <Verdict pkg={pkg} />
      <IssueList issues={pkg.issues} />
      {pkg.stats && <StatsGrid stats={pkg.stats} waypointCount={pkg.waypoints.length} />}
      {(pkg.track.length > 0 || pkg.waypoints.length > 0) && (
        <PreviewMap track={pkg.track} waypoints={pkg.waypoints} />
      )}
      {pkg.files && <Downloads files={pkg.files} slug={slug} />}
      {pkg.mapsLinks.length > 0 && <MapsLinks links={pkg.mapsLinks} />}
      <p className="text-sm text-ink-3">
        Rozbor prebehol v tvojom prehliadači, nič sa zatiaľ neuložilo. Zverejnenie trasy
        do katalógu pribudne v ďalšom kroku.
      </p>
    </section>
  );
}

function Verdict({ pkg }: { pkg: RoutePackage }) {
  const warnings = pkg.issues.filter((i) => i.level === 'warning').length;

  if (!pkg.ok) {
    return (
      <div className="rounded-sm border-l-4 border-crit bg-surface px-5 py-4">
        <p className="font-display text-xl font-semibold text-crit">Túto trasu sa nedá predať</p>
        <p className="mt-1 text-sm text-ink-2">Oprav chyby nižšie a nahraj súbor znova.</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border-l-4 border-accent bg-surface px-5 py-4">
      <p className="font-display text-xl font-semibold text-accent">Balíček je pripravený</p>
      <p className="mt-1 text-sm text-ink-2">
        {warnings === 0
          ? 'Kontrola nenašla nič podozrivé.'
          : `Kontrola našla ${warnings} ${warnings === 1 ? 'vec' : warnings < 5 ? 'veci' : 'vecí'} na preverenie — pozri upozornenia.`}
      </p>
    </div>
  );
}

const LEVEL: Record<Issue['level'], { label: string; className: string; order: number }> = {
  error: { label: 'Chyba', className: 'text-crit', order: 0 },
  warning: { label: 'Upozornenie', className: 'text-warn', order: 1 },
  info: { label: 'Info', className: 'text-ink-3', order: 2 },
};

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  const sorted = [...issues].sort((a, b) => LEVEL[a.level].order - LEVEL[b.level].order);

  return (
    <ul className="flex flex-col divide-y divide-line rounded-sm border border-line bg-surface">
      {sorted.map((issue, i) => (
        <li key={`${issue.code}-${i}`} className="grid grid-cols-[7.5rem_1fr] gap-3 px-5 py-3 text-sm">
          <span className={`font-display text-xs font-semibold tracking-[0.12em] uppercase ${LEVEL[issue.level].className}`}>
            {LEVEL[issue.level].label}
          </span>
          <span className="text-ink-2">{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function StatsGrid({ stats, waypointCount }: { stats: RouteStats; waypointCount: number }) {
  const m = (v: number | null) => (v === null ? '—' : `${Math.round(v).toLocaleString('sk-SK')} m`);
  const items = [
    { label: 'Dĺžka', value: `${stats.distanceKm.toLocaleString('sk-SK', { maximumFractionDigits: 1 })} km` },
    { label: 'Stúpanie', value: m(stats.ascentM) },
    { label: 'Klesanie', value: m(stats.descentM) },
    { label: 'Najnižšie / najvyššie', value: `${m(stats.minEleM)} / ${m(stats.maxEleM)}` },
    { label: 'Bodov stopy', value: stats.pointCount.toLocaleString('sk-SK') },
    { label: 'Bodov záujmu', value: String(waypointCount) },
    { label: 'Priemerný rozostup', value: m(stats.meanSpacingM) },
    { label: 'Najväčšia medzera', value: m(stats.maxGapM) },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3">
          <dt className="font-display text-xs font-semibold tracking-[0.12em] text-ink-3 uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 font-mono text-base tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function download(content: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/gpx+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  // Prehliadač si súbor medzitým prevzal; odkaz by inak držal pamäť
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Downloads({ files, slug }: { files: NonNullable<RoutePackage['files']>; slug: string }) {
  const rows = [
    { key: 'master', content: files.master, label: 'Stopa + body', hint: 'Hlavný súbor — presná čiara, prístroj ju nemá ako prepočítať.' },
    { key: 'navigation', content: files.navigation, label: 'Na navigovanie', hint: 'Tvarovacie body pre hlasovú navigáciu zákruta po zákrute.' },
    { key: 'poi', content: files.poi, label: 'Body záujmu', hint: 'Čerpačky, obedy, vyhliadky — dajú sa zapnúť zvlášť.' },
  ].filter((r): r is typeof r & { content: string } => r.content !== null);

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">Balíček</h2>
      <ul className="mt-3 flex flex-col divide-y divide-line rounded-sm border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span>
              <span className="block font-medium">{r.label}</span>
              <span className="block text-sm text-ink-3">{r.hint}</span>
            </span>
            <button
              type="button"
              onClick={() => download(r.content, `${slug}-${r.key}.gpx`)}
              className="rounded-sm border border-line px-4 py-2 font-mono text-sm hover:border-accent hover:text-accent"
            >
              {slug}-{r.key}.gpx ↓
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MapsLinks({ links }: { links: RoutePackage['mapsLinks'] }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold">Odkazy do Google Maps</h2>
      <p className="mt-1 text-sm text-ink-3">
        Google Maps unesie v odkaze len pár zastávok, dlhšia trasa je preto rozdelená na úseky.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {link.label}
            </a>
            <span className="ml-2 font-mono text-xs text-ink-3">{link.points} bodov</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
