/**
 * Mapové podklady pre všetky mapy na webe — katalóg, plánovač aj náhľad
 * trasy v administrácii. Na jednom mieste, lebo sa pred spustením menia.
 *
 * POZOR pred spustením naostro: OSM má vlastnú politiku používania dlaždíc
 * a komerčnú prevádzku na nich neodporúča. Pred ostrým spustením treba
 * prejsť na poskytovateľa s licenciou (MapTiler, Stadia, Thunderforest)
 * — zmena TILE_URL a ATTRIBUTION tu plus kľúč v premenných prostredia.
 *
 * CARTO tu bolo pôvodne, ale bez kľúča vracia dlaždice s vodoznakom
 * „API KEY REQUIRED" cez celú mapu.
 */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Trieda z globals.css, ktorá dlaždice v tmavom režime stlmí. */
export const DARK_TILES_CLASS = 'sml-tiles-dark';

/** Tmavý režim podľa prepínača na stránke, inak podľa systému. */
export function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'dark') return true;
  if (stamped === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
