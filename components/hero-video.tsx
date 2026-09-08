'use client';

import { useEffect, useState } from 'react';

/**
 * Video hero prevzatý zo starého webu — dve YouTube slučky, ktoré sa striedajú
 * s prelínaním.
 *
 * Dve odchýlky oproti pôvodnému riešeniu, obe kvôli švajčiarskemu nDSG:
 *
 * 1. youtube-nocookie.com namiesto youtube.com — YouTube potom neukladá
 *    sledovacie cookies, kým divák video sám nespustí.
 * 2. Video sa načíta až po súhlase s cookies. Dovtedy je vidno statické
 *    pozadie s nadpisom. Vkladanie YouTube bez súhlasu je vo Švajčiarsku
 *    aj v EÚ dlhodobo napadnuteľné a hero je presne to miesto, kde by to
 *    niekto našiel ako prvé.
 */

const VIDEO_IDS = ['zn-YwIemAus', '8zWSY4LYMlI'];
const SWAP_AFTER_MS = 22_000;

export function HeroVideo({ consent }: { consent: boolean }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!consent) return;

    const id = window.setInterval(
      () => setActive((i) => (i + 1) % VIDEO_IDS.length),
      SWAP_AFTER_MS,
    );
    return () => window.clearInterval(id);
  }, [consent]);

  if (!consent) return null;

  return (
    <>
      {VIDEO_IDS.map((videoId, i) => (
        <iframe
          key={videoId}
          // loop potrebuje playlist s tým istým id, inak sa video neopakuje
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&disablekb=1`}
          title=""
          aria-hidden
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          className={`pointer-events-none absolute top-1/2 left-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-1000 ${
            i === active ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </>
  );
}
