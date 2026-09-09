import 'server-only';

import type { GeoPoint } from './routes';

/**
 * Počasie na trase — tretí pilier služby z klientových poznámok.
 *
 * Zdroj je Open-Meteo: bez API kľúča, bez registrácie, dáta z európskych
 * meteomodelov. Klient v poznámkach uvažoval nad Meteoblue, ale ten má
 * osobitné podmienky pre komerčné použitie a kľúč — Open-Meteo nás nechá
 * začať hneď.
 *
 * POZOR pred spustením naostro: bezplatné pásmo Open-Meteo je určené na
 * nekomerčné použitie. Pre e-shop treba pred ostrým spustením overiť ich
 * licenciu a prípadne prejsť na platený plán. Je to zmena URL a kľúča,
 * nie prepisovanie — rovnaká situácia ako pri mapových dlaždiciach.
 */

export interface RouteWeather {
  /** Teplota práve teraz, v stupňoch Celzia. */
  temperatureC: number;
  /** Rýchlosť vetra v km/h — na motorke to cítiť viac než v aute. */
  windKmh: number;
  /** Zrážky za poslednú hodinu v milimetroch. */
  precipitationMm: number;
  /** Kód počasia podľa WMO. Prekladá sa cez weatherLabel(). */
  code: number;
  /** Predpoveď na najbližšie dni — jazdec plánuje dopredu, nie na teraz. */
  forecast: DayForecast[];
  /** Kedy sa dáta stiahli. Aby sa dalo povedať „aktuálne k …". */
  fetchedAt: string;
}

export interface DayForecast {
  date: string;
  maxC: number;
  minC: number;
  precipitationMm: number;
  code: number;
}

/**
 * Meteorológovia používajú číselné kódy podľa normy WMO. Nie sú to náhodné
 * čísla — sú zoskupené: 0–3 obloha, 45–48 hmla, 51–67 dážď, 71–86 sneh,
 * 95–99 búrky. Preto sa dajú zaradiť do kategórií, nie prekladať jeden po
 * druhom.
 */
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}

/** Tvar odpovede z Open-Meteo — len tie polia, ktoré si pýtame. */
interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    weather_code?: number[];
  };
}

/** Ako dlho sa odpoveď drží v cache. Počasie sa za pol hodinu nezmení natoľko,
 *  aby to jazdcovi vadilo — a chráni to nás aj Open-Meteo pred zbytočnou záťažou. */
const CACHE_SECONDS = 1800;

export async function getRouteWeather(point: GeoPoint): Promise<RouteWeather | null> {
  const params = new URLSearchParams({
    latitude: point.lat.toFixed(4),
    longitude: point.lng.toFixed(4),
    current: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
    timezone: 'auto',
    forecast_days: '4',
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      // POZOR: Next.js 16 už fetch NEcachuje sám od seba — to je zmena oproti
      // starším verziám. Bez `force-cache` by sa Open-Meteo volalo pri každom
      // načítaní stránky a rýchlo by nás zablokovalo.
      // Overené v node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md
      cache: 'force-cache',
      next: { revalidate: CACHE_SECONDS },
      // Cudzí server môže visieť. Radšej sa vzdáme počasia, než aby kvôli nemu
      // čakala celá stránka.
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.error(`[weather] Open-Meteo vrátil ${res.status}`);
      return null;
    }

    const data = (await res.json()) as OpenMeteoResponse;
    const current = data.current;
    if (!current || typeof current.temperature_2m !== 'number') return null;

    const daily = data.daily;
    const forecast: DayForecast[] = [];

    if (daily?.time) {
      for (let i = 0; i < daily.time.length; i++) {
        forecast.push({
          date: daily.time[i],
          maxC: Math.round(daily.temperature_2m_max?.[i] ?? 0),
          minC: Math.round(daily.temperature_2m_min?.[i] ?? 0),
          precipitationMm: daily.precipitation_sum?.[i] ?? 0,
          code: daily.weather_code?.[i] ?? 0,
        });
      }
    }

    return {
      temperatureC: Math.round(current.temperature_2m),
      windKmh: Math.round(current.wind_speed_10m ?? 0),
      precipitationMm: current.precipitation ?? 0,
      code: current.weather_code ?? 0,
      forecast,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Sem spadne aj vypršaný timeout. Počasie je doplnok — keď nie je,
    // stránka musí fungovať ďalej.
    console.error('[weather] Načítanie zlyhalo', error);
    return null;
  }
}
