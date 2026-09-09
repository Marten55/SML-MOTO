import QRCode from 'qrcode';

/**
 * QR kód s odkazom na trasu v Google Maps.
 *
 * Z poznámok klienta: jazdec si trasu pozerá na počítači, naskenuje ju
 * mobilom a otvorí sa mu rovno v navigácii. Ušetrí to prepisovanie odkazu
 * alebo posielanie si mailu samému sebe.
 *
 * Generuje sa na serveri — do prehliadača ide hotový obrázok, žiadny
 * JavaScript a žiadne volanie cudzej služby. Existujú API, ktoré QR kód
 * vyrobia za teba, ale posielať im odkaz na zaplatenú trasu nemá zmysel.
 */

export async function RouteQr({ url, label }: { url: string; label: string }) {
  // SVG namiesto PNG: je ostrý pri každej veľkosti aj po vytlačení
  // do roadbooku a zaberie menej než obrázok.
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 2, // „tichá zóna" okolo kódu — bez nej ho čítačky nechytia
    errorCorrectionLevel: 'M',
    color: {
      // Natvrdo čierna na bielej, bez ohľadu na tému stránky.
      // V tmavom režime by svetlý kód na tmavom podklade nenaskenoval nikto.
      dark: '#000000',
      light: '#ffffff',
    },
  });

  // Zabalené do data URI, aby sa dalo vložiť ako obyčajný obrázok
  // a nemuseli sme vkladať cudzie HTML do stránky.
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      {/* Biele pozadie je súčasť funkčnosti, nie dizajnu — pozri komentár vyššie */}
      <div className="rounded-sm border border-line bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI, next/image ho neoptimalizuje */}
        <img src={src} alt={label} width={148} height={148} />
      </div>
      <figcaption className="max-w-[26ch] text-center text-sm text-ink-3">
        {label}
      </figcaption>
    </figure>
  );
}
