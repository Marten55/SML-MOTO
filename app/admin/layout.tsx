import type { Metadata } from 'next';

import { fontVariables } from '../fonts';
import '../globals.css';

/*
 * Vlastný koreňový layout: administrácia je len po slovensky, bez hlavičky
 * a pätičky webu a bez cookie lišty (nič z tretích strán tu nebeží).
 * Prechod medzi webom a administráciou preto znamená plné načítanie stránky.
 */

export const metadata: Metadata = {
  title: 'SML — administrácia',
  // Hlavička X-Robots-Tag v next.config.ts to hovorí tiež; toto je poistka v HTML
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" className={fontVariables}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
