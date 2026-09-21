import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_COOKIE, adminAuthConfig, isValidAdminToken } from '@/lib/admin-token';

/*
 * Proxy (do Next.js 15 „middleware") beží pred každou stránkou. Robí dve veci:
 *
 * 1. Administrácia: neprihláseného pošle na /admin/login. Je to len PREDBEŽNÁ
 *    kontrola — skutočná ochrana je requireAdmin() v každej stránke a Server
 *    Action (lib/admin-session.ts). Proxy sa dá obísť zmenou matchera alebo
 *    chybou vo frameworku (CVE-2025-29927), preto naň nespoliehame.
 * 2. Web: adresu bez jazyka presmeruje na jazyk podľa prehliadača.
 */

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

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    if (pathname === '/admin/login') return NextResponse.next();

    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!isValidAdminToken(token, adminAuthConfig(), Date.now())) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

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
