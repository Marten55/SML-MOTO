'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * Krátka ukážka z trasy, ktorá sa rozbehne, keď si ju jazdec všimne:
 * na počítači pod kurzorom, na mobile keď karta príde na obrazovku.
 *
 * Toto je VEREJNÁ ukážka na pár sekúnd, nie platené POV video. Plné POV
 * videá sú súčasť Gold a patria tam, kam GPX — za /api/download, nikdy
 * do public/.
 *
 * Na čo sa reaguje: ak je komponent vnútri prvku s `data-pov-trigger`
 * (celá karta), spúšťa ho prejdenie cez celú kartu, nie len cez obrázok.
 * Vďaka tomu môže karta ostať serverovým komponentom — klientsky je
 * len tento malý kúsok.
 */
export function PovPreview({
  src,
  poster,
  sizes,
  eager = false,
  className = '',
}: {
  src: string;
  /** Prvý záber ukážky. Bez neho sa pri načítaní stránky nič nesťahuje. */
  poster?: string;
  sizes: string;
  /**
   * Plagát je hneď na obrazovke (prvé karty katalógu, detail trasy) —
   * načítať ho hneď, nie až keď si ho prehliadač všimne. Inak je to
   * najneskôr vykreslený veľký prvok stránky a stránka pôsobí pomalšie.
   */
  eager?: boolean;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    const video = videoRef.current;
    if (!box || !video) return;
    const target = box.closest<HTMLElement>('[data-pov-trigger]') ?? box;

    // Kto si v systéme vypol animácie, nechce ani video, ktoré sa samo hýbe
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Prehliadač pustí video bez kliknutia len vtedy, keď je stlmené.
    // React atribút `muted` do HTML zo servera nevypíše, preto ho istíme tu.
    video.muted = true;

    const play = () => {
      // play() vracia Promise. Keď kurzor odíde skôr, než sa video načíta,
      // pause() ho preruší chybou AbortError — tu je to bežný stav, nie chyba.
      video.play().catch(() => {});
    };
    const stop = () => {
      video.pause();
      video.currentTime = 0; // nabudúce zase od začiatku, ukážka má svoj ťah
    };

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      target.addEventListener('pointerenter', play);
      target.addEventListener('pointerleave', stop);
      // Aj kto chodí po stránke klávesnicou, má vidieť to isté
      target.addEventListener('focusin', play);
      target.addEventListener('focusout', stop);
      return () => {
        target.removeEventListener('pointerenter', play);
        target.removeEventListener('pointerleave', stop);
        target.removeEventListener('focusin', play);
        target.removeEventListener('focusout', stop);
      };
    }

    // Dotyková obrazovka kurzor nemá. Video sa spustí, keď je karta takmer
    // celá vidno — na mobile je to tá, na ktorú sa človek práve pozerá.
    // Kto má v prehliadači zapnuté šetrenie dát, dostane len obrázok.
    const { connection } = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (connection?.saveData) return;

    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? play() : stop()),
      { threshold: 0.75 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className={`relative overflow-hidden bg-surface-2 ${className}`}>
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        // Kým nie je treba, nesťahuje sa nič: deväť kariet po megabajte
        // by inak spomalilo prvé načítanie katalógu
        preload={poster ? 'none' : 'metadata'}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-hidden
        tabIndex={-1}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Plagát leží nad videom a pri spustení sa rozplynie — prechod je plynulý,
          lebo plagát je presne prvý záber ukážky */}
      {poster && (
        <Image
          src={poster}
          alt=""
          fill
          sizes={sizes}
          loading={eager ? 'eager' : 'lazy'}
          className={`object-cover transition-opacity duration-300 ${playing ? 'opacity-0' : 'opacity-100'}`}
        />
      )}

      <span
        aria-hidden
        className={`absolute bottom-2 left-2 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-white transition-opacity duration-300 ${playing ? 'opacity-0' : 'opacity-100'}`}
      >
        ▶ POV
      </span>
    </div>
  );
}
