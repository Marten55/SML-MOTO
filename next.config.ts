import type { NextConfig } from 'next';

/**
 * Náhľad pre klienta beží na subdoméne ADM a nesmie sa dostať do Google.
 * Inak by sa zaindexovali ukážkové trasy a zástupné Impressum pod cudzou
 * doménou a ostrý web by potom súťažil sám so sebou o tie isté texty.
 *
 * Zámerne len hlavička noindex, BEZ zákazu v robots.txt: Google musí stránku
 * načítať, aby noindex vôbec uvidel. Zakázaná stránka sa môže do výsledkov
 * dostať aj tak — ako holá adresa, na ktorú niekto odkázal.
 *
 * headers() sa vyhodnocuje pri builde, takže zmena SITE_ENV chce nové nasadenie.
 */
const isStaging = process.env.SITE_ENV === 'staging';

const nextConfig: NextConfig = {
  async headers() {
    if (!isStaging) return [];

    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
