import type { NextConfig } from 'next';

/**
 * Náhľad pre klienta (SITE_ENV=staging) nesmie do Google. noindex je na dvoch
 * miestach, lebo každé pokryje niečo iné:
 *
 * - meta tag v app/[lang]/layout.tsx — stránky,
 * - táto hlavička — všetko ostatné: POV videá, obrázky, API.
 *
 * Zámerne BEZ zákazu v robots.txt: Google musí stránku načítať, aby noindex
 * vôbec uvidel. Zakázaná stránka sa do výsledkov dostane aj tak.
 *
 * headers() sa vyhodnocuje pri builde, takže zmena SITE_ENV chce nové nasadenie.
 */
const isStaging = process.env.SITE_ENV === 'staging';

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Administrácia vždy, aj na ostrom webe: nepatrí do Google, nesmie sa
      // vložiť do cudzej stránky (clickjacking) a nič z nej nemá ostať v cache.
      // `:path*` znamená „nula a viac častí", takže pokryje aj samotné /admin.
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
      ...(isStaging
        ? [
            {
              source: '/:path*',
              headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
