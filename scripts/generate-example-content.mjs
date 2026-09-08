/**
 * Vyrobí ukážkové GPX a PDF pre pilotnú trasu, aby sa dal otestovať celý tok
 * od zaplatenia po stiahnutie.
 *
 * POZOR: sú to placeholdery. Stopa je priamkovo interpolovaná medzi
 * priesmykmi, takže NEKOPÍRUJE skutočné cesty. Skutočné GPX dodá Miroslav —
 * tieto slúžia len na to, aby sme vedeli overiť doručovanie, nie navigáciu.
 *
 * Spustenie:  node scripts/generate-example-content.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'content', 'gpx');
mkdirSync(OUT, { recursive: true });

const routes = JSON.parse(
  await import('node:fs').then((fs) =>
    fs.readFileSync(path.join(process.cwd(), 'data', 'routes.json'), 'utf8'),
  ),
);

const EXAMPLE_NOTE =
  'UKAZKOVY OBSAH — priamkova interpolacia medzi priesmykmi, nie skutocna cesta. ' +
  'Sluzi na test doručovania, nie na navigaciu.';

const xml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const header = (name) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="SML Moto — example generator"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${xml(name)}</name>
    <desc>${xml(EXAMPLE_NOTE)}</desc>
  </metadata>`;

/** Body trasy v poradí: štart → zastávky → cieľ. */
function chain(route) {
  return [route.start, ...route.via, route.finish];
}

/** Hustá stopa. Prístroj ju len kreslí, takže čím viac bodov, tým vernejšie. */
function buildTrack(route) {
  const points = chain(route);
  const STEPS = 40;
  const seg = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS;
      seg.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      });
    }
  }
  seg.push(points[points.length - 1]);

  const body = seg
    .map((p) => `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}" />`)
    .join('\n');

  return `${header(route.title.en + ' — track')}
  <trk>
    <name>${xml(route.title.en)}</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`;
}

/**
 * Verzia na navigovanie. Tvarovacie body sú riedke — prístroj si medzi nimi
 * dopočíta cestu sám a z toho vzniká hlasová navigácia zákruta po zákrute.
 */
function buildNavigation(route) {
  const body = chain(route)
    .map(
      (p) =>
        `    <rtept lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><name>${xml(p.name)}</name></rtept>`,
    )
    .join('\n');

  return `${header(route.title.en + ' — navigation')}
  <rte>
    <name>${xml(route.title.en)}</name>
${body}
  </rte>
</gpx>
`;
}

/** Body záujmu ako samostatné waypointy — dajú sa zapnúť nezávisle od trasy. */
function buildPoi(route) {
  const body = route.via
    .map(
      (p) =>
        `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}">
    <name>${xml(p.name)}</name>
    <sym>Summit</sym>
  </wpt>`,
    )
    .join('\n');

  return `${header(route.title.en + ' — points of interest')}
${body}
</gpx>
`;
}

/** Najmenšie platné PDF s jednou stranou textu. Offsety v xref sa počítajú. */
function buildPdf(route) {
  const lines = [
    route.title.en,
    '',
    'EXAMPLE ROADBOOK — placeholder',
    '',
    'This file exists so the delivery flow can be tested',
    'end to end. The real RoadBook is written by the rider',
    'who actually rode the route.',
    '',
    `${route.distanceKm} km  /  ${route.ascentM} m ascent  /  ${route.canton}`,
  ];

  const text = lines
    .map((l, i) => `BT /F1 12 Tf 60 ${760 - i * 20} Td (${l.replace(/([()\\])/g, '\\$1')}) Tj ET`)
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];

  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

  return pdf;
}

let written = 0;
for (const route of routes) {
  if (!route.isExample) {
    console.log(`preskakujem ${route.slug} — nie je označená ako ukážka`);
    continue;
  }

  const files = [
    [route.assets.track, buildTrack(route)],
    [route.assets.navigation, buildNavigation(route)],
    [route.assets.poi, buildPoi(route)],
    [route.assets.roadbook, buildPdf(route)],
  ].filter(([name]) => Boolean(name));

  for (const [name, content] of files) {
    writeFileSync(path.join(OUT, name), content, 'utf8');
    console.log(`  ${name}  (${content.length} B)`);
    written++;
  }
}

console.log(`\nHotovo — ${written} súborov v content/gpx/`);
