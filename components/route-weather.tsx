import type { Dictionary } from '@/lib/i18n';
import type { GeoPoint } from '@/lib/routes';
import { getRouteWeather, weatherKind, type WeatherKind } from '@/lib/weather';

/**
 * Počasie na kľúčovom bode trasy.
 *
 * Server component — dáta sa načítajú na serveri a do prehliadača ide hotové
 * HTML. Žiadny JavaScript, žiadne preblikávanie, funguje aj s vypnutým JS.
 *
 * Čerstvosť rieši ISR na stránke, ktorá tento komponent používa
 * (`export const revalidate` v page.tsx), nie tento súbor.
 */

const ICON: Record<WeatherKind, string> = {
  clear: '☀',
  cloudy: '☁',
  fog: '≡',
  rain: '☂',
  snow: '❄',
  storm: '⚡',
};

export async function RouteWeather({
  point,
  dict,
  locale,
}: {
  point: GeoPoint;
  dict: Dictionary;
  locale: string;
}) {
  const weather = await getRouteWeather(point);

  // Počasie je doplnok. Keď ho nemáme, sekcia sa jednoducho nezobrazí —
  // je to lepšie než prázdny rámik s hláškou o chybe.
  if (!weather) return null;

  const kind = weatherKind(weather.code);
  const dayName = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold">{dict.weather.heading}</h2>
      <p className="mt-1 text-sm text-ink-3">
        {dict.weather.at} {point.name}
      </p>

      <div className="mt-5 rounded-sm border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span aria-hidden className="font-mono text-3xl text-accent">
            {ICON[kind]}
          </span>

          <span className="font-mono text-3xl tabular-nums">
            {weather.temperatureC} °C
          </span>

          <span className="text-ink-2">{dict.weatherKind[kind]}</span>

          <dl className="ml-auto flex gap-x-5 font-mono text-xs text-ink-3 tabular-nums">
            <div className="flex gap-1.5">
              <dt>{dict.weather.wind}</dt>
              <dd className="text-ink-2">{weather.windKmh} km/h</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>{dict.weather.rain}</dt>
              <dd className="text-ink-2">{weather.precipitationMm.toFixed(1)} mm</dd>
            </div>
          </dl>
        </div>

        {weather.forecast.length > 1 && (
          <ul className="mt-5 grid grid-cols-2 gap-px border-t border-line bg-line pt-px sm:grid-cols-4">
            {weather.forecast.map((day) => (
              <li key={day.date} className="bg-surface px-3 py-3 text-center">
                <span className="block font-display text-xs tracking-wider text-ink-3 uppercase">
                  {dayName.format(new Date(day.date))}
                </span>
                <span aria-hidden className="mt-1 block font-mono text-lg text-ink-2">
                  {ICON[weatherKind(day.code)]}
                </span>
                <span className="mt-1 block font-mono text-sm tabular-nums">
                  {day.maxC}° <span className="text-ink-3">{day.minC}°</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-2 font-mono text-xs text-ink-3">{dict.weather.source}</p>
    </section>
  );
}
