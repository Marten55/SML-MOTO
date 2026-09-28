'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';

import {
  DEFAULT_PRICE_CHF,
  DRAFT_LOCALES,
  GEOMETRY_ERROR,
  MAX_HIGHLIGHTS,
  TEXT_LIMITS,
  type DraftCheck,
  type FieldErrors,
  type RouteDraft,
  type RouteGeometry,
} from '@/lib/route-draft';
import type { Route } from '@/lib/routes';
import { slugify } from '@/lib/slug';

/*
 * Údaje do katalógu — to, čo GPX nevie: cena, texty v štyroch jazykoch,
 * obtiažnosť, sezóna, bod na počasie.
 *
 * Formulár nič nekontroluje sám. Stav drží rodič (route-builder-form.tsx)
 * a kontrolu robí checkDraft() z lib/route-draft.ts — tá istá, ktorú pri
 * uložení zopakuje server. Tu sa len zobrazuje a zapisuje do stavu.
 *
 * Každé pole má data-field s cestou ku kľúču v chybách („title.de"), aby
 * rodič vedel po kontrole presunúť kurzor na prvé chybné pole na stránke.
 */

const LABEL = 'font-display text-xs font-semibold tracking-[0.14em] text-ink-3 uppercase';
const INPUT =
  'w-full rounded-sm border border-line bg-surface px-4 py-3 text-base focus:border-accent focus:outline-none aria-[invalid=true]:border-crit';

const LOCALE_LABEL: Record<(typeof DRAFT_LOCALES)[number], string> = {
  sk: 'Slovensky',
  de: 'Nemecky',
  en: 'Anglicky',
  fr: 'Francúzsky',
};

// Record<Route[...], …> — keď pribudne krajina alebo obtiažnosť v type Route,
// TypeScript tu nahlási chýbajúci popis
const COUNTRY_LABEL: Record<Route['country'], string> = {
  CH: 'Švajčiarsko',
  IT: 'Taliansko',
  FR: 'Francúzsko',
  RO: 'Rumunsko',
  NO: 'Nórsko',
};

const DIFFICULTY_LABEL: Record<Route['difficulty'], string> = {
  easy: 'Pohodová',
  medium: 'Stredná',
  hard: 'Náročná',
};

const MONTHS = [
  'január', 'február', 'marec', 'apríl', 'máj', 'jún',
  'júl', 'august', 'september', 'október', 'november', 'december',
];

type Localized = RouteDraft['title'];

interface Props {
  draft: RouteDraft;
  setDraft: Dispatch<SetStateAction<RouteDraft>>;
  geometry: RouteGeometry | null;
  /** Prázdne, kým Miroslav prvýkrát neklikne na kontrolu — nie červené pole hneď po otvorení. */
  errors: FieldErrors;
  /** Neúspešná kontrola; null pred prvým kliknutím a keď je všetko vyplnené. */
  result: Extract<DraftCheck, { ok: false }> | null;
  onSave: () => void;
  /** Kým sa ukladá, tlačidlo nejde stlačiť druhýkrát — vznikli by dve trasy. */
  saving: boolean;
  /** Priebeh alebo chyba uloženia od rodiča. */
  status: ReactNode;
  idPrefix: string;
}

export function RouteDetailsForm({
  draft,
  setDraft,
  geometry,
  errors,
  result,
  onSave,
  saving,
  status,
  idPrefix,
}: Props) {
  const fid = (path: string) => `${idPrefix}-${path.replaceAll('.', '-')}`;

  function set<K extends keyof RouteDraft>(key: K, value: RouteDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setTier(tier: Route['tier']) {
    setDraft((d) => {
      // Predvolenú cenu vymení s vrstvou, vlastnú cenu (napr. 12) nechá tak
      const price = d.priceChf.trim();
      const isDefault = price === '' || Object.values(DEFAULT_PRICE_CHF).some((p) => String(p) === price);
      return { ...d, tier, priceChf: isDefault ? String(DEFAULT_PRICE_CHF[tier]) : d.priceChf };
    });
  }

  const weatherOptions = geometry?.weatherOptions ?? [];
  // Po výmene súborov môže vybraný bod v trase chýbať — výber sa vtedy ukáže prázdny
  const weatherKey = weatherOptions.some((o) => o.key === draft.weatherKey) ? draft.weatherKey : '';

  function chooseWeather(key: string) {
    setDraft((d) => {
      const previous = weatherOptions.find((o) => o.key === d.weatherKey);
      const next = weatherOptions.find((o) => o.key === key);
      // Meno bodu sa prepíše len vtedy, keď ho Miroslav neupravoval sám
      const custom = d.weatherName.trim() !== '' && d.weatherName !== previous?.suggestedName;
      return { ...d, weatherKey: key, weatherName: custom ? d.weatherName : (next?.suggestedName ?? '') };
    });
  }

  function fillEmptyTitles() {
    setDraft((d) => {
      const title = { ...d.title };
      for (const locale of DRAFT_LOCALES) if (title[locale].trim() === '') title[locale] = d.name.trim();
      return { ...d, title };
    });
  }

  function setHighlight(index: number, value: Localized) {
    setDraft((d) => ({ ...d, highlights: d.highlights.map((h, i) => (i === index ? value : h)) }));
  }

  const slug = slugify(draft.name);

  return (
    <form
      noValidate // hlášky dáva zod po slovensky, bublinky prehliadača by ich predbehli
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="flex flex-col gap-12 border-t border-line-strong pt-10"
    >
      <div>
        <h2 className="font-display text-3xl font-semibold">Údaje do katalógu</h2>
        <p className="mt-2 max-w-[62ch] text-ink-2">
          GPX nevie, za koľko sa trasa predáva ani ako ju opísať. Toto všetko uvidí zákazník na
          stránke trasy a podľa toho ju nájde vo filtroch katalógu.
        </p>
      </div>

      <Section title="Zo stopy" lede="Doplní sa samo z nahratého súboru, nič sa tu neprepisuje.">
        <DerivedFacts geometry={geometry} slug={slug} />
      </Section>

      <Section title="Predaj">
        <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
          <Choice
            legend="Vrstva"
            path="tier"
            id={fid('tier')}
            value={draft.tier}
            error={errors.tier}
            onChange={(v) => setTier(v as Route['tier'])}
            options={[
              { value: 'silver', label: 'Silver', hint: 'GPX a body záujmu' },
              { value: 'gold', label: 'Gold', hint: 'navyše roadbook a POV videá' },
            ]}
          />
          <TextField
            label="Cena (CHF)"
            path="priceChf"
            id={fid('priceChf')}
            value={draft.priceChf}
            error={errors.priceChf}
            onChange={(v) => set('priceChf', v)}
            inputMode="numeric"
            hint={`Cenník: Silver ${DEFAULT_PRICE_CHF.silver}, Gold ${DEFAULT_PRICE_CHF.gold}.`}
          />
        </div>
      </Section>

      <Section title="Trasa">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Krajina" id={fid('country')} error={errors.country}>
            <select
              id={fid('country')}
              data-field="country"
              value={draft.country}
              onChange={(e) => set('country', e.target.value)}
              aria-invalid={Boolean(errors.country)}
              aria-describedby={errors.country ? `${fid('country')}-error` : undefined}
              className={INPUT}
            >
              <option value="">— vyber —</option>
              {Object.entries(COUNTRY_LABEL).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <TextField
            label="Kraj alebo kantón"
            path="region"
            id={fid('region')}
            value={draft.region}
            error={errors.region}
            onChange={(v) => set('region', v)}
            placeholder="napr. Uri · Wallis · Bern"
            hint="Vlastné meno, neprekladá sa."
          />
        </div>

        <Choice
          legend="Obtiažnosť"
          path="difficulty"
          id={fid('difficulty')}
          value={draft.difficulty}
          error={errors.difficulty}
          onChange={(v) => set('difficulty', v)}
          options={Object.entries(DIFFICULTY_LABEL).map(([value, label]) => ({ value, label }))}
        />

        <Choice
          legend="Kľukatosť"
          path="curviness"
          id={fid('curviness')}
          value={draft.curviness}
          error={errors.curviness}
          onChange={(v) => set('curviness', v)}
          hint="1 = pohodová kochačka, 5 = samá zákruta."
          options={[1, 2, 3, 4, 5].map((n) => ({
            value: String(n),
            label: '▲'.repeat(n),
            ariaLabel: `${n} z 5`,
          }))}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className={LABEL}>Sezóna — priesmyk býva otvorený</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(['seasonFrom', 'seasonTo'] as const).map((key) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <label htmlFor={fid(key)} className="font-mono text-xs text-ink-3">
                    {key === 'seasonFrom' ? 'od' : 'do'}
                  </label>
                  <select
                    id={fid(key)}
                    data-field={key}
                    value={draft[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={Boolean(errors[key])}
                    className={INPUT}
                  >
                    {MONTHS.map((month, i) => (
                      <option key={month} value={String(i + 1)}>
                        {month}
                      </option>
                    ))}
                  </select>
                  {errors[key] && <p className="text-sm text-crit">{errors[key]}</p>}
                </div>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Trvanie (h)"
              path="durationHours"
              id={fid('durationHours')}
              value={draft.durationHours}
              error={errors.durationHours}
              onChange={(v) => set('durationHours', v)}
              placeholder="7–9"
              hint="Aj so zastávkami."
            />
            <TextField
              label="Teplota (°C)"
              path="avgTempC"
              id={fid('avgTempC')}
              value={draft.avgTempC}
              error={errors.avgTempC}
              onChange={(v) => set('avgTempC', v)}
              placeholder="8"
              hint="Priemer na vrchole v sezóne."
            />
          </div>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            data-field="passable"
            checked={draft.passable}
            onChange={(e) => set('passable', e.target.checked)}
            className="mt-1 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block font-medium">Priesmyk je teraz otvorený</span>
            <span className="block text-sm text-ink-3">
              Zavretý sa na webe označí červenou, jazdcovi to ušetrí zbytočnú cestu.
            </span>
          </span>
        </label>
      </Section>

      <Section title="Počasie" lede="Na stránke trasy sa ukáže predpoveď pre jeden bod — najlepšie priesmyk.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Bod na trase"
            id={fid('weatherKey')}
            error={errors.weatherKey}
            hint={geometry ? undefined : 'Body sa ponúknu po nahratí trasy.'}
          >
            <select
              id={fid('weatherKey')}
              data-field="weatherKey"
              value={weatherKey}
              onChange={(e) => chooseWeather(e.target.value)}
              disabled={!geometry}
              aria-invalid={Boolean(errors.weatherKey)}
              aria-describedby={errors.weatherKey ? `${fid('weatherKey')}-error` : undefined}
              className={`${INPUT} disabled:opacity-60`}
            >
              <option value="">— vyber —</option>
              {weatherOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <TextField
            label="Meno bodu"
            path="weatherName"
            id={fid('weatherName')}
            value={draft.weatherName}
            error={errors.weatherName}
            onChange={(v) => set('weatherName', v)}
            placeholder="napr. Furka"
            hint="Zákazník uvidí „Počasie na …“. Neprekladá sa."
          />
        </div>
      </Section>

      <Section
        title="Texty"
        lede="Každý text vo všetkých štyroch jazykoch. Preklad môže byť strojový, ale nech ho pred zverejnením prečíta rodený hovoriaci."
      >
        <LocalizedFields
          legend="Názov na stránke"
          path="title"
          fid={fid}
          value={draft.title}
          errors={errors}
          max={TEXT_LIMITS.title}
          onChange={(title) => set('title', title)}
          action={
            <button
              type="button"
              onClick={fillEmptyTitles}
              disabled={draft.name.trim() === ''}
              className="font-mono text-xs text-accent hover:underline disabled:text-ink-3 disabled:no-underline"
            >
              doplniť názov trasy do prázdnych
            </button>
          }
        />

        <LocalizedFields
          legend="Popis"
          hint="Prvá veta sa ukáže aj vo výsledkoch Google — nech povie, prečo tam ísť."
          path="summary"
          fid={fid}
          value={draft.summary}
          errors={errors}
          max={TEXT_LIMITS.summary}
          rows={4}
          onChange={(summary) => set('summary', summary)}
        />

        <fieldset>
          <legend className={LABEL}>Čo ťa tam čaká</legend>
          <p className="mt-1 text-sm text-ink-3">
            Krátke body — vyhliadka, známa zákruta, na čo si dať pozor. Najviac {MAX_HIGHLIGHTS}.
          </p>
          <ol className="mt-4 flex flex-col gap-6">
            {draft.highlights.map((highlight, i) => (
              <li key={i} className="rounded-sm border border-line p-4">
                <LocalizedFields
                  legend={`Bod ${i + 1}`}
                  path={`highlights.${i}`}
                  fid={fid}
                  value={highlight}
                  errors={errors}
                  max={TEXT_LIMITS.highlight}
                  onChange={(value) => setHighlight(i, value)}
                  action={
                    draft.highlights.length > 1 && (
                      <button
                        type="button"
                        onClick={() => set('highlights', draft.highlights.filter((_, j) => j !== i))}
                        className="font-mono text-xs text-ink-3 hover:text-crit"
                      >
                        odstrániť
                      </button>
                    )
                  }
                />
              </li>
            ))}
          </ol>
          {draft.highlights.length < MAX_HIGHLIGHTS && (
            <button
              type="button"
              data-field="highlights"
              onClick={() =>
                set('highlights', [...draft.highlights, { sk: '', de: '', en: '', fr: '' }])
              }
              className="mt-4 rounded-sm border border-line px-4 py-2 font-mono text-sm hover:border-accent hover:text-accent"
            >
              + pridať bod
            </button>
          )}
          {errors.highlights && <p className="mt-2 text-sm text-crit">{errors.highlights}</p>}
        </fieldset>

        <LocalizedFields
          legend="Výbava — čo si obliecť"
          path="gear"
          fid={fid}
          value={draft.gear}
          errors={errors}
          max={TEXT_LIMITS.gear}
          rows={2}
          onChange={(gear) => set('gear', gear)}
        />
      </Section>

      <div className="flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-sm bg-accent px-6 py-3 font-display text-sm font-semibold tracking-wider text-ground uppercase disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? 'Ukladám…' : 'Uložiť ako skrytú trasu'}
          </button>
          <p className="max-w-[62ch] text-sm text-ink-3">
            Uloží sa aj s nahratými súbormi. V katalógu sa neukáže, kým ju nezverejníš v zozname
            trás.
          </p>
        </div>
        {result && <CheckResult result={result} />}
        {status}
      </div>
    </form>
  );
}

// ── Časti formulára ────────────────────────────────────────────────────────

function Section({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        {lede && <p className="mt-1 max-w-[62ch] text-sm text-ink-3">{lede}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-crit">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

function TextField({
  label,
  path,
  id,
  value,
  error,
  hint,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  path: string;
  id: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'numeric' | 'text';
}) {
  return (
    <Field label={label} id={id} error={error} hint={hint}>
      <input
        id={id}
        data-field={path}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={INPUT}
      />
    </Field>
  );
}

/** Prepínač ako rad tlačidiel. Pod ním sú obyčajné radio inputy — klávesnica aj čítačka fungujú. */
function Choice({
  legend,
  path,
  id,
  value,
  error,
  hint,
  onChange,
  options,
}: {
  legend: string;
  path: string;
  id: string;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string; ariaLabel?: string }[];
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <fieldset aria-describedby={describedBy}>
      <legend className={LABEL}>{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o, i) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-sm border px-4 py-2.5 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
              error ? 'border-crit' : 'border-line hover:border-line-strong'
            }`}
          >
            <input
              type="radio"
              name={id}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              // Kurzor po neúspešnej kontrole skočí na prvú možnosť skupiny
              data-field={i === 0 ? path : undefined}
              aria-label={o.ariaLabel}
              className="sr-only"
            />
            <span className="block font-medium">{o.label}</span>
            {o.hint && <span className="block text-xs text-ink-3">{o.hint}</span>}
          </label>
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-sm text-crit">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-2 text-sm text-ink-3">
            {hint}
          </p>
        )
      )}
    </fieldset>
  );
}

/**
 * Jeden text v štyroch jazykoch vedľa seba — pri kontrole prekladu je hneď
 * vidno, či nemčina hovorí to isté čo slovenčina, a chýbajúci jazyk nezapadne
 * na inej karte.
 */
function LocalizedFields({
  legend,
  hint,
  path,
  fid,
  value,
  errors,
  max,
  rows,
  onChange,
  action,
}: {
  legend: string;
  hint?: string;
  path: string;
  fid: (path: string) => string;
  value: Localized;
  errors: FieldErrors;
  max: number;
  /** Zadané = viacriadkové pole s počítadlom znakov. */
  rows?: number;
  onChange: (value: Localized) => void;
  action?: ReactNode;
}) {
  return (
    <fieldset>
      {/* legend musí byť prvé dieťa fieldsetu, inak skupina stratí meno pre čítačku.
          float ho vytrhne zo zvláštneho vykresľovania, aby vedľa neho mohlo stáť tlačidlo. */}
      <legend className={`${LABEL} float-left`}>{legend}</legend>
      {action && <div className="float-right">{action}</div>}
      {hint && <p className="clear-both pt-1 text-sm text-ink-3">{hint}</p>}
      <div className="clear-both grid gap-4 pt-3 sm:grid-cols-2">
        {DRAFT_LOCALES.map((locale) => {
          const fieldPath = `${path}.${locale}`;
          const id = fid(fieldPath);
          const error = errors[fieldPath];
          const common = {
            id,
            'data-field': fieldPath,
            value: value[locale],
            'aria-invalid': Boolean(error),
            'aria-describedby': error ? `${id}-error` : undefined,
            className: INPUT,
          };
          const update = (text: string) => onChange({ ...value, [locale]: text });

          return (
            <div key={locale} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="flex justify-between font-mono text-xs text-ink-3">
                <span>{LOCALE_LABEL[locale]}</span>
                {/* Zámerne bez maxLength: vložený dlhší preklad by prehliadač ticho
                    orezal uprostred vety. Radšej ukážeme počet a chybu. */}
                {rows && (
                  <span className={value[locale].length > max ? 'text-crit' : undefined}>
                    {value[locale].length}/{max}
                  </span>
                )}
              </label>
              {rows ? (
                <textarea {...common} rows={rows} onChange={(e) => update(e.target.value)} />
              ) : (
                <input {...common} onChange={(e) => update(e.target.value)} />
              )}
              {error && (
                <p id={`${id}-error`} className="text-sm text-crit">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

function DerivedFacts({ geometry, slug }: { geometry: RouteGeometry | null; slug: string }) {
  const items = [
    { label: 'Dĺžka', value: geometry ? `${geometry.distanceKm.toLocaleString('sk-SK')} km` : '—' },
    {
      label: 'Stúpanie',
      value: !geometry ? '—' : geometry.ascentM === null ? 'súbor nemá výšky' : `${geometry.ascentM.toLocaleString('sk-SK')} m`,
    },
    { label: 'Body pre Google Maps', value: geometry ? String(geometry.via.length + 2) : '—' },
    { label: 'Adresa stránky', value: `/trasy/${slug || '…'}` },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3">
          <dt className="font-display text-xs font-semibold tracking-[0.12em] text-ink-3 uppercase">
            {item.label}
          </dt>
          <dd className="mt-1 font-mono text-sm break-all tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function plural(n: number, [one, few, many]: [string, string, string]): string {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

function CheckResult({ result }: { result: Extract<DraftCheck, { ok: false }> }) {
  const { [GEOMETRY_ERROR]: geometryError, ...fieldErrors } = result.errors;
  const count = Object.keys(fieldErrors).length;

  return (
    <div aria-live="polite" className="rounded-sm border-l-4 border-crit bg-surface px-5 py-4">
      <p className="font-display text-xl font-semibold text-crit">Ešte to nie je kompletné</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm text-ink-2">
        {geometryError && <li>{geometryError}</li>}
        {count > 0 && (
          <li>
            Skontroluj {count} {plural(count, ['pole', 'polia', 'polí'])} označené červenou.
          </li>
        )}
      </ul>
    </div>
  );
}
