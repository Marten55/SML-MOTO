import type { SwissGrid } from './types';

/**
 * Prevod zo švajčiarskej súradnicovej siete na zemepisné súradnice (WGS84).
 *
 * Swisstopo štandardne pracuje v sieti LV95 (CH1903+): súradnice sú metre
 * na východ a na sever, napríklad E 2 600 000 / N 1 200 000 je Bern.
 * Google Maps, Garmin aj GPX ale potrebujú stupne zemepisnej šírky a dĺžky.
 * Keby sa to neprepočítalo, trasa by skončila mimo planéty.
 *
 * Vzorce sú oficiálne približné vzorce swisstopo („Näherungsformeln"),
 * presné zhruba na meter — na navigáciu motorky úplne dostatočné.
 * Overené na referenčnom bode Bern v teste.
 *
 * Staršia sieť LV03 (E ~600 000) sa líši len posunom o 2 a 1 milión metrov.
 */

interface GridRange {
  eMin: number;
  eMax: number;
  nMin: number;
  nMax: number;
}

// Rozsahy pokrývajú Švajčiarsko s rezervou, aby prešli aj trasy tesne za hranicou
const RANGES: Record<SwissGrid, GridRange> = {
  LV95: { eMin: 2_450_000, eMax: 2_900_000, nMin: 1_050_000, nMax: 1_350_000 },
  LV03: { eMin: 450_000, eMax: 900_000, nMin: 50_000, nMax: 350_000 },
};

const inRange = (v: number, min: number, max: number) => v >= min && v <= max;

/**
 * Rozpozná sieť podľa veľkosti čísel a zároveň povie, ktoré z nich je
 * východná súradnica. V CSV nemusia byť stĺpce v poradí E, N.
 */
export function detectSwissGrid(
  a: number,
  b: number,
): { grid: SwissGrid; e: number; n: number } | null {
  for (const grid of ['LV95', 'LV03'] as const) {
    const r = RANGES[grid];
    if (inRange(a, r.eMin, r.eMax) && inRange(b, r.nMin, r.nMax)) return { grid, e: a, n: b };
    if (inRange(b, r.eMin, r.eMax) && inRange(a, r.nMin, r.nMax)) return { grid, e: b, n: a };
  }
  return null;
}

export function swissToWgs84(e: number, n: number, grid: SwissGrid): { lat: number; lng: number } {
  // Posun do stredu siete (Bern) a prevod na 1000 km jednotky
  const offsetE = grid === 'LV95' ? 2_600_000 : 600_000;
  const offsetN = grid === 'LV95' ? 1_200_000 : 200_000;
  const y = (e - offsetE) / 1_000_000;
  const x = (n - offsetN) / 1_000_000;

  // Výsledok vo vzorcoch vychádza v jednotkách 10 000" — preto násobenie 100/36
  const lngUnits =
    2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const latUnits =
    16.9023892 +
    3.238272 * x -
    0.270978 * y * y -
    0.002528 * x * x -
    0.0447 * y * y * x -
    0.014 * x * x * x;

  return { lat: (latUnits * 100) / 36, lng: (lngUnits * 100) / 36 };
}
