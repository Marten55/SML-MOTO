import type { NextConfig } from 'next';

/*
 * noindex pre náhľad (SITE_ENV=staging) tu NIE JE, hoci by sem patril ako
 * hlavička X-Robots-Tag cez headers(). Lokálne fungovala, na Verceli sa
 * neprejavila (15. 9. 2026, príčina nezistená). Je v app/[lang]/layout.tsx
 * ako meta tag — overené na živom náhľade.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
