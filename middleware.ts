import { NextResponse, type NextRequest } from 'next/server';

const locales = ['en', 'de', 'fr', 'sk'] as const;
const defaultLocale = 'de';

/**
 * Vyberie jazyk z hlavičky Accept-Language. Nechcem kvôli tomu ťahať knižnicu,
 * na štyri jazyky stačí zoradiť podľa q-hodnoty a vziať prvý, ktorý poznáme.
 */
function pickLocale(header: string | null): string {
  if (!header) return defaultLocale;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return {
        tag: tag.trim().toLowerCase(),
        q: q ? Number.parseFloat(q.split('=')[1]) || 0 : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    // "de-CH" aj "de" majú viesť na "de"
    const base = tag.split('-')[0];
    if ((locales as readonly string[]).includes(base)) return base;
  }

  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = pickLocale(request.headers.get('accept-language'));
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  return NextResponse.redirect(url);
}

export const config = {
  // Všetko okrem API, interných súborov Next.js a statických assetov
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
};
