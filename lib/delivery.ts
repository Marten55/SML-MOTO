import 'server-only';

import { createAccessToken, type DownloadKind } from './access';
import type { Locale } from './i18n';
import { googleMapsUrl, type Route } from './routes';
import { sendMail } from './mail';

/** Čo všetko sa dá k trase stiahnuť — podľa toho, čo reálne existuje. */
export function availableDownloads(route: Route): DownloadKind[] {
  const kinds: DownloadKind[] = ['track', 'navigation'];
  if (route.assets.poi) kinds.push('poi');
  if (route.assets.roadbook) kinds.push('roadbook');
  return kinds;
}

export function accessTokenFor(route: Route, ref: string): string {
  return createAccessToken({ routeId: route.id, ref, issuedAt: Date.now() });
}

/** Trvalý odkaz, ktorý ide do mailu. Rozhodnutie C — neexpiruje. */
export function permanentLink(baseUrl: string, lang: Locale, token: string): string {
  return `${baseUrl}/${lang}/odomknute?token=${encodeURIComponent(token)}`;
}

const SUBJECTS: Record<Locale, (title: string) => string> = {
  de: (t) => `Deine Route: ${t}`,
  en: (t) => `Your route: ${t}`,
  fr: (t) => `Votre itinéraire : ${t}`,
  sk: (t) => `Tvoja trasa: ${t}`,
};

const BODY: Record<Locale, { intro: string; keep: string; ride: string; open: string }> = {
  de: {
    intro: 'Danke — deine Route ist bereit.',
    keep: 'Dieser Link läuft nicht ab. Heb dir die Mail auf, dann kommst du jederzeit wieder dran.',
    ride: 'Gute Fahrt.',
    open: 'Route öffnen',
  },
  en: {
    intro: 'Thank you — your route is ready.',
    keep: 'This link does not expire. Keep this email and you can come back to it any time.',
    ride: 'Ride safe.',
    open: 'Open route',
  },
  fr: {
    intro: 'Merci — votre itinéraire est prêt.',
    keep: "Ce lien n'expire pas. Gardez cet e-mail et vous y reviendrez quand vous voudrez.",
    ride: 'Bonne route.',
    open: "Ouvrir l'itinéraire",
  },
  sk: {
    intro: 'Ďakujem — tvoja trasa je pripravená.',
    keep: 'Tento odkaz neexpiruje. Nechaj si mail a vrátiš sa k nemu kedykoľvek.',
    ride: 'Šťastnú cestu.',
    open: 'Otvoriť trasu',
  },
};

export async function sendRouteEmail(opts: {
  to: string;
  route: Route;
  lang: Locale;
  token: string;
  baseUrl: string;
}): Promise<boolean> {
  const { to, route, lang, token, baseUrl } = opts;

  const title = route.title[lang];
  const link = permanentLink(baseUrl, lang, token);
  const maps = googleMapsUrl(route);
  const copy = BODY[lang];

  const text = [
    copy.intro,
    '',
    title,
    '',
    `${copy.open}: ${link}`,
    `Google Maps: ${maps}`,
    '',
    copy.keep,
    '',
    copy.ride,
    'SML — Simply Moto Life',
  ].join('\n');

  const html = `
<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#10181c;max-width:520px">
  <p>${escapeHtml(copy.intro)}</p>
  <h2 style="font-size:20px;margin:24px 0 8px">${escapeHtml(title)}</h2>
  <p style="margin:24px 0">
    <a href="${link}" style="background:#0b7757;color:#fff;padding:12px 22px;border-radius:3px;text-decoration:none;display:inline-block">
      ${escapeHtml(copy.open)}
    </a>
  </p>
  <p style="margin:16px 0"><a href="${maps}" style="color:#0b7757">Google Maps</a></p>
  <p style="color:#5d6e66;font-size:14px">${escapeHtml(copy.keep)}</p>
  <p style="color:#5d6e66;font-size:14px;margin-top:28px">
    ${escapeHtml(copy.ride)}<br>SML — Simply Moto Life
  </p>
</div>`.trim();

  return sendMail({ to, subject: SUBJECTS[lang](title), html, text });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
