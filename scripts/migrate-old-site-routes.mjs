/**
 * Prenesie 9 trás zo starého statického webu (index.html na vetve main)
 * do data/routes.json.
 *
 * Čísla, sezóny aj odporúčaná výbava pochádzajú zo starého webu — nevymýšľam
 * ich. Súradnice sú polyline z jeho mini-máp, takže sú geograficky reálne,
 * ale nekopírujú presnú cestu; skutočné GPX dodá Miroslav.
 *
 * Spustenie:  node scripts/migrate-old-site-routes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const COORDS = JSON.parse(
  readFileSync(path.join(process.cwd(), 'scripts', 'old-site-coords.json'), 'utf8'),
);

/** Zo súvislej polyline vyberie štart, cieľ a najviac 6 bodov medzi. */
function pickPoints(line, prefix) {
  const start = { lat: line[0][0], lng: line[0][1], name: `${prefix} — štart` };
  const finish = {
    lat: line[line.length - 1][0],
    lng: line[line.length - 1][1],
    name: `${prefix} — cieľ`,
  };

  const inner = line.slice(1, -1);
  const want = Math.min(6, inner.length);
  const via = [];
  for (let i = 0; i < want; i++) {
    const pt = inner[Math.round((i * (inner.length - 1)) / Math.max(1, want - 1))];
    via.push({ lat: pt[0], lng: pt[1], name: `${prefix} ${i + 1}` });
  }

  return { start, finish, via };
}

const ROUTES = [
  {
    id: 'r001', slug: 'furka-grimsel-susten', map: 'dbmap-1', tier: 'gold', priceChf: 19,
    region: 'Uri · Wallis · Bern', country: 'CH',
    distanceKm: 310, ascentM: 2429, durationHours: '7–9', avgTempC: 8,
    passable: true, difficulty: 'medium', curviness: 5, seasonFrom: 6, seasonTo: 10,
    prefix: 'Furka',
    title: {
      de: 'Furka · Grimsel · Susten', en: 'Furka · Grimsel · Susten',
      fr: 'Furka · Grimsel · Susten', sk: 'Furka · Grimsel · Susten',
    },
    summary: {
      de: 'Die grosse Drei an einem Tag. Furka mit den engen Kehren und dem Blick auf das Belvédère, Grimsel zwischen Granit und Stauseen, Susten als der fahrerisch schönste der drei. Wer vor neun startet, hat die Pässe fast für sich.',
      en: 'The big three in one day. Furka with its tight hairpins and the view of the Belvédère, Grimsel between granite and reservoirs, Susten the finest of the three to ride. Start before nine and the passes are almost yours alone.',
      fr: 'Les trois grands en une journée. Le Furka et ses lacets serrés face au Belvédère, le Grimsel entre granit et barrages, le Susten, le plus beau des trois à rouler. Partez avant neuf heures et les cols sont presque à vous.',
      sk: 'Veľká trojka za jeden deň. Furka s ostrými vracákmi a výhľadom na Belvédère, Grimsel medzi žulou a priehradami, Susten jazdecky najkrajší z trojice. Kto vyrazí pred deviatou, má priesmyky takmer pre seba.',
    },
    highlights: [
      { de: 'Die Kehren am Belvédère — der Blick, den alle vom Furka kennen', en: 'The hairpins at the Belvédère — the view everyone knows the Furka for', fr: 'Les lacets du Belvédère — la vue qui a fait la réputation du Furka', sk: 'Vracáky pri Belvédère — výhľad, ktorý z Furky pozná každý' },
      { de: 'Granitwände und Stauseen auf der Grimsel-Nordseite', en: 'Granite walls and reservoirs on the north side of the Grimsel', fr: 'Parois de granit et lacs de barrage sur le versant nord du Grimsel', sk: 'Žulové steny a priehradné jazerá na severnej strane Grimselu' },
      { de: 'Postautos haben überall Vorrang — in engen Kurven hupen sie', en: 'PostBuses have right of way everywhere — they sound their horn in blind corners', fr: 'Les cars postaux sont prioritaires partout — ils klaxonnent dans les virages', sk: 'Poštové autobusy majú všade prednosť — v ostrých zákrutách trúbia' },
    ],
    gear: {
      de: 'Winterjacke · beheizte Handschuhe · wasserdichte Überzieher',
      en: 'Winter jacket · heated gloves · waterproof overlays',
      fr: 'Veste hiver · gants chauffants · surpantalon imperméable',
      sk: 'Zimná moto bunda · vyhrievané rukavice · vodonepriepustné návleky',
    },
  },
  {
    id: 'r002', slug: 'bernina-maloja', map: 'dbmap-2', tier: 'silver', priceChf: 9,
    region: 'Graubünden', country: 'CH',
    distanceKm: 195, ascentM: 2328, durationHours: '4–5', avgTempC: 10,
    passable: true, difficulty: 'easy', curviness: 4, seasonFrom: 5, seasonTo: 11,
    prefix: 'Bernina',
    title: {
      de: 'Berninapass & Malojapass', en: 'Bernina Pass & Maloja Pass',
      fr: 'Col de la Bernina & col de la Maloja', sk: 'Berninapass a Malojapass',
    },
    summary: {
      de: 'Zwei ruhige, breite Pässe im Engadin, die man auch mit vollem Gepäck geniesst. Am Bernina fährt die rote Bahn neben der Strasse, an der Maloja schrauben sich die Kehren in die Ebene hinunter.',
      en: 'Two calm, wide passes in the Engadine that stay enjoyable even fully loaded. On the Bernina the red train runs beside the road; on the Maloja the hairpins screw down onto the plain.',
      fr: 'Deux cols larges et tranquilles en Engadine, agréables même chargé. Au Bernina, le train rouge longe la route ; à la Maloja, les lacets descendent en vis vers la plaine.',
      sk: 'Dva pokojné, široké priesmyky v Engadine, ktoré si užiješ aj s plnou batožinou. Pri Bernine ide popri ceste červený vlak, na Maloji sa vracáky zavŕtavajú dolu do roviny.',
    },
    highlights: [
      { de: 'Die rote Berninabahn direkt neben der Strasse', en: 'The red Bernina railway right beside the road', fr: 'Le train rouge de la Bernina le long de la route', sk: 'Červená Berninabahn priamo popri ceste' },
      { de: 'Die Kehren der Maloja — von oben sieht man alle auf einmal', en: 'The Maloja hairpins — from the top you see them all at once', fr: 'Les lacets de la Maloja — vus d’en haut, tous d’un coup', sk: 'Vracáky Maloje — zhora ich vidíš všetky naraz' },
    ],
    gear: {
      de: 'Sommerjacke mit Futter · normale Handschuhe',
      en: 'Summer jacket with liner · standard gloves',
      fr: 'Veste été avec doublure · gants standard',
      sk: 'Letná moto bunda s podšívkou · štandardné rukavice',
    },
  },
  {
    id: 'r003', slug: 'julier-fluela', map: 'dbmap-3', tier: 'silver', priceChf: 9,
    region: 'Graubünden', country: 'CH',
    distanceKm: 210, ascentM: 2383, durationHours: '4–5', avgTempC: 9,
    passable: true, difficulty: 'easy', curviness: 3, seasonFrom: 5, seasonTo: 11,
    prefix: 'Julier',
    title: {
      de: 'Julierpass & Flüelapass', en: 'Julier Pass & Flüela Pass',
      fr: 'Col du Julier & col de la Flüela', sk: 'Julierpass a Flüelapass',
    },
    summary: {
      de: 'Der Julier ist fast das ganze Jahr offen und fliesst in langen, schnellen Bögen. Der Flüela ist rauer und leerer — kahle Hochebene, wenig Verkehr, und oben zwei kleine Seen.',
      en: 'The Julier is open almost year round and flows in long, fast sweepers. The Flüela is rougher and emptier — bare high plateau, little traffic, and two small lakes at the top.',
      fr: 'Le Julier est ouvert presque toute l’année et enchaîne de longues courbes rapides. La Flüela est plus rude et plus vide — haut plateau nu, peu de trafic, deux petits lacs au sommet.',
      sk: 'Julier je otvorený takmer celý rok a plynie v dlhých, rýchlych oblúkoch. Flüela je drsnejšia a prázdnejšia — holá náhorná plošina, málo áut a hore dve malé jazerá.',
    },
    highlights: [
      { de: 'Der Julier bleibt oft bis in den Winter offen', en: 'The Julier often stays open into winter', fr: 'Le Julier reste souvent ouvert jusqu’en hiver', sk: 'Julier býva otvorený až do zimy' },
      { de: 'Die karge Hochebene der Flüela — kaum Verkehr', en: 'The bare high plateau of the Flüela — hardly any traffic', fr: 'Le haut plateau dénudé de la Flüela — presque personne', sk: 'Holá náhorná plošina Flüely — takmer žiadna doprava' },
    ],
    gear: {
      de: 'Sommerjacke + Fleece · normale Handschuhe',
      en: 'Summer jacket + fleece layer · standard gloves',
      fr: 'Veste été + polaire · gants standard',
      sk: 'Letná bunda a fleece vrstva · štandardné rukavice',
    },
  },
  {
    id: 'r004', slug: 'passo-dello-stelvio', map: 'dbmap-4', tier: 'silver', priceChf: 9,
    region: 'Lombardia · Südtirol', country: 'IT',
    distanceKm: 180, ascentM: 2758, durationHours: '4–5', avgTempC: 7,
    passable: true, difficulty: 'hard', curviness: 5, seasonFrom: 6, seasonTo: 9,
    prefix: 'Stelvio',
    title: {
      de: 'Passo dello Stelvio', en: 'Passo dello Stelvio',
      fr: 'Col du Stelvio', sk: 'Passo dello Stelvio',
    },
    summary: {
      de: 'Achtundvierzig nummerierte Kehren auf der Nordseite — der berühmteste Pass der Alpen und im Hochsommer entsprechend voll. Früh losfahren oder gar nicht. Oben ist es auch im Juli selten über zehn Grad.',
      en: 'Forty-eight numbered hairpins on the north side — the most famous pass in the Alps and, in high summer, as busy as that sounds. Go early or not at all. Even in July it is rarely above ten degrees at the top.',
      fr: 'Quarante-huit lacets numérotés sur le versant nord — le col le plus célèbre des Alpes, et donc bondé en plein été. Partez tôt ou pas du tout. Au sommet, il dépasse rarement dix degrés, même en juillet.',
      sk: 'Štyridsaťosem číslovaných vracákov na severnej strane — najslávnejší priesmyk Álp a v lete tomu zodpovedá aj návštevnosť. Vyraziť skoro ráno, alebo vôbec. Hore býva aj v júli málokedy viac ako desať stupňov.',
    },
    highlights: [
      { de: 'Die 48 nummerierten Kehren der Nordrampe', en: 'The 48 numbered hairpins of the north ramp', fr: 'Les 48 lacets numérotés de la rampe nord', sk: 'Štyridsaťosem číslovaných vracákov severnej rampy' },
      { de: 'Im Juli und August ab dem Vormittag sehr voll', en: 'Very busy from mid-morning in July and August', fr: 'Très fréquenté dès la fin de matinée en juillet-août', sk: 'V júli a auguste od dopoludnia veľmi plno' },
    ],
    gear: {
      de: 'Winterausrüstung · beheizte Handschuhe · Thermohose',
      en: 'Winter kit · heated gloves · thermal base layer',
      fr: 'Équipement hiver · gants chauffants · sous-vêtement thermique',
      sk: 'Zimná moto výbava · vyhrievané rukavice · termo spodky',
    },
  },
  {
    id: 'r005', slug: 'pordoi-sella-ronda', map: 'dbmap-5', tier: 'silver', priceChf: 9,
    region: 'Dolomiti', country: 'IT',
    distanceKm: 55, ascentM: 2239, durationHours: '2–3', avgTempC: 12,
    passable: true, difficulty: 'easy', curviness: 5, seasonFrom: 5, seasonTo: 10,
    prefix: 'Sella',
    title: {
      de: 'Passo Pordoi & Sella Ronda', en: 'Passo Pordoi & Sella Ronda',
      fr: 'Passo Pordoi & Sella Ronda', sk: 'Passo Pordoi a Sella Ronda',
    },
    summary: {
      de: 'Die kürzeste Runde im Angebot und die dichteste: vier Pässe um den Sellastock in gut zwei Stunden. Kaum eine Gerade, dafür ununterbrochen Dolomitenwände über dir.',
      en: 'The shortest loop here and the densest: four passes around the Sella massif in a little over two hours. Almost no straights, and Dolomite walls above you the whole way.',
      fr: 'La boucle la plus courte et la plus dense : quatre cols autour du massif du Sella en un peu plus de deux heures. Presque aucune ligne droite, et les parois des Dolomites au-dessus tout du long.',
      sk: 'Najkratší okruh z ponuky a zároveň najhustejší: štyri priesmyky okolo masívu Sella za dve hodiny. Takmer žiadna rovinka a nad tebou celý čas dolomitské steny.',
    },
    highlights: [
      { de: 'Vier Pässe in einer Runde — Pordoi, Sella, Gardena, Campolongo', en: 'Four passes in one loop — Pordoi, Sella, Gardena, Campolongo', fr: 'Quatre cols en une boucle — Pordoi, Sella, Gardena, Campolongo', sk: 'Štyri priesmyky v jednom okruhu — Pordoi, Sella, Gardena, Campolongo' },
      { de: 'Lässt sich gut mit einem halben Tag anderswo kombinieren', en: 'Combines well with half a day somewhere else', fr: 'Se combine bien avec une demi-journée ailleurs', sk: 'Dá sa dobre spojiť s pol dňom inde' },
    ],
    gear: {
      de: 'Sommerausrüstung · normale Handschuhe',
      en: 'Summer kit · standard gloves',
      fr: 'Équipement été · gants standard',
      sk: 'Letná moto výbava · štandardné rukavice',
    },
  },
  {
    id: 'r006', slug: 'galibier-telegraphe', map: 'dbmap-6', tier: 'silver', priceChf: 9,
    region: 'Savoie · Hautes-Alpes', country: 'FR',
    distanceKm: 185, ascentM: 2642, durationHours: '3–4', avgTempC: 10,
    passable: true, difficulty: 'medium', curviness: 4, seasonFrom: 6, seasonTo: 10,
    prefix: 'Galibier',
    title: {
      de: 'Col du Galibier & Télégraphe', en: 'Col du Galibier & Télégraphe',
      fr: 'Col du Galibier & col du Télégraphe', sk: 'Col du Galibier a Télégraphe',
    },
    summary: {
      de: 'Zuerst der Télégraphe im Wald, dann über Valloire hinauf zum Galibier, wo der Baumbestand aufhört und nur noch Geröll bleibt. Ein Klassiker aus der Tour de France, auf zwei Rädern mit Motor deutlich entspannter.',
      en: 'First the Télégraphe through the trees, then up past Valloire to the Galibier, where the treeline ends and only scree remains. A Tour de France classic, considerably more relaxed with an engine.',
      fr: 'D’abord le Télégraphe sous les arbres, puis la montée par Valloire vers le Galibier, où la forêt s’arrête et il ne reste que la caillasse. Un classique du Tour, nettement plus tranquille avec un moteur.',
      sk: 'Najprv Télégraphe lesom, potom cez Valloire hore na Galibier, kde končí les a ostáva už len sutina. Klasika z Tour de France — na motorke podstatne pohodovejšie.',
    },
    highlights: [
      { de: 'Oberhalb der Baumgrenze wird es schlagartig kahl', en: 'Above the treeline it turns bare all at once', fr: 'Au-dessus de la limite des arbres, tout devient nu d’un coup', sk: 'Nad hranicou lesa je zrazu úplne holo' },
      { de: 'Im Sommer viele Rennradfahrer — Abstand halten', en: 'Plenty of road cyclists in summer — leave room', fr: 'Beaucoup de cyclistes en été — laissez de la place', sk: 'V lete veľa cyklistov — nechaj im miesto' },
    ],
    gear: {
      de: 'Sommerjacke mit Membran · Regenhandschuhe',
      en: 'Summer jacket with membrane · rain gloves',
      fr: 'Veste été à membrane · gants de pluie',
      sk: 'Letná bunda s membránou · rukavice do dažďa',
    },
  },
  {
    id: 'r007', slug: 'transfagarasan', map: 'dbmap-7', tier: 'silver', priceChf: 9,
    region: 'Argeș · Sibiu', country: 'RO',
    distanceKm: 150, ascentM: 2042, durationHours: '3–4', avgTempC: 15,
    passable: true, difficulty: 'medium', curviness: 5, seasonFrom: 7, seasonTo: 10,
    prefix: 'Transfăgărășan',
    title: {
      de: 'Transfăgărășan', en: 'Transfăgărășan',
      fr: 'Transfăgărășan', sk: 'Transfăgărășan',
    },
    summary: {
      de: 'Von Curtea de Argeș nach Cârțișoara. Die kürzeste Saison im Angebot — oben liegt bis in den Juli Schnee — dafür Kehren, die sich in einer Wand stapeln, und der Bâlea-See als Ziel.',
      en: 'From Curtea de Argeș to Cârțișoara. The shortest season here — snow lies at the top into July — but the hairpins stack up a single wall, with Lake Bâlea at the end.',
      fr: 'De Curtea de Argeș à Cârțișoara. La saison la plus courte de la sélection — la neige tient au sommet jusqu’en juillet — mais les lacets s’empilent sur une seule paroi, avec le lac Bâlea au bout.',
      sk: 'Z Curtea de Argeș do Cârțișoary. Najkratšia sezóna z ponuky — hore leží sneh až do júla — zato vracáky naskladané v jednej stene a na konci jazero Bâlea.',
    },
    highlights: [
      { de: 'Die gestapelten Kehren zum Bâlea-See', en: 'The stacked hairpins up to Lake Bâlea', fr: 'Les lacets empilés jusqu’au lac Bâlea', sk: 'Naskladané vracáky až k jazeru Bâlea' },
      { de: 'Öffnet erst Anfang Juli — vorher ist oben zu', en: 'Opens only in early July — before that the top is shut', fr: 'N’ouvre que début juillet — avant, le sommet est fermé', sk: 'Otvára sa až začiatkom júla — predtým je hore zavreté' },
    ],
    gear: {
      de: 'Sommerausrüstung · leichte Windjacke im Gepäck',
      en: 'Summer kit · light windbreaker in the luggage',
      fr: 'Équipement été · coupe-vent léger dans les bagages',
      sk: 'Letná moto výbava · ľahká vetrovka v batožine',
    },
  },
  {
    id: 'r008', slug: 'trollstigen', map: 'dbmap-8', tier: 'silver', priceChf: 9,
    region: 'Møre og Romsdal', country: 'NO',
    distanceKm: 65, ascentM: 858, durationHours: '1–2', avgTempC: 8,
    passable: true, difficulty: 'medium', curviness: 5, seasonFrom: 5, seasonTo: 10,
    prefix: 'Trollstigen',
    title: {
      de: 'Trollstigen', en: 'Trollstigen', fr: 'Trollstigen', sk: 'Trollstigen',
    },
    summary: {
      de: 'Åndalsnes nach Valldal. Elf Kehren an einer nassen Felswand, mit einem Wasserfall mitten durch die Strasse. Kurz, aber der Belag ist fast immer feucht — hier zählt Zurückhaltung mehr als Tempo.',
      en: 'Åndalsnes to Valldal. Eleven hairpins on a wet rock face, with a waterfall cutting through the road. Short, but the surface is nearly always damp — restraint counts for more than speed here.',
      fr: 'D’Åndalsnes à Valldal. Onze lacets sur une paroi humide, avec une cascade qui traverse la route. Court, mais le revêtement est presque toujours mouillé — mieux vaut la retenue que la vitesse.',
      sk: 'Åndalsnes do Valldalu. Jedenásť vracákov na mokrej skalnej stene a vodopád priamo cez cestu. Krátke, ale povrch je takmer vždy vlhký — tu sa viac oplatí zdržanlivosť než tempo.',
    },
    highlights: [
      { de: 'Der Stigfossen fällt direkt neben der Strasse', en: 'The Stigfossen falls right beside the road', fr: 'La cascade Stigfossen tombe au bord de la route', sk: 'Vodopád Stigfossen padá priamo popri ceste' },
      { de: 'Fast immer nasser Belag — vorsichtig bremsen', en: 'Almost always a wet surface — brake gently', fr: 'Revêtement presque toujours mouillé — freinez doucement', sk: 'Takmer vždy mokrý povrch — brzdi opatrne' },
    ],
    gear: {
      de: 'Regenjacke · warme Handschuhe',
      en: 'Waterproof jacket · warm gloves',
      fr: 'Veste de pluie · gants chauds',
      sk: 'Nepremokavá bunda · teplé rukavice',
    },
  },
  {
    id: 'r009', slug: 'col-de-la-bonette', map: 'dbmap-9', tier: 'silver', priceChf: 9,
    region: 'Alpes-Maritimes', country: 'FR',
    distanceKm: 210, ascentM: 2802, durationHours: '4–5', avgTempC: 5,
    passable: false, difficulty: 'hard', curviness: 4, seasonFrom: 6, seasonTo: 10,
    prefix: 'Bonette',
    title: {
      de: 'Col de la Bonette', en: 'Col de la Bonette',
      fr: 'Col de la Bonette', sk: 'Col de la Bonette',
    },
    summary: {
      de: 'Die höchste asphaltierte Durchgangsstrasse der Alpen. Ganz oben führt eine Schleife um den Gipfel, die sonst nirgends nötig wäre — genau deshalb fährt man sie. Kalt, karg und meistens leer.',
      en: 'The highest paved through-road in the Alps. Right at the top a loop runs around the summit that serves no purpose at all — which is exactly why you ride it. Cold, bare and usually empty.',
      fr: 'La plus haute route goudronnée des Alpes. Tout en haut, une boucle contourne le sommet sans aucune nécessité — et c’est précisément pour ça qu’on la fait. Froid, nu, et le plus souvent désert.',
      sk: 'Najvyššie položená asfaltová prejazdná cesta v Alpách. Úplne hore vedie okolo vrcholu slučka, ktorá nemá žiadny účel — a práve preto sa ide. Chladno, holo a väčšinou prázdno.',
    },
    highlights: [
      { de: 'Die sinnlose Gipfelschleife auf 2 802 m', en: 'The pointless summit loop at 2,802 m', fr: 'La boucle sommitale inutile à 2 802 m', sk: 'Nezmyselná vrcholová slučka v 2 802 m' },
      { de: 'Auch im Sommer selten über zehn Grad', en: 'Rarely above ten degrees even in summer', fr: 'Rarement plus de dix degrés, même en été', sk: 'Aj v lete málokedy viac ako desať stupňov' },
    ],
    gear: {
      de: 'Winterjacke · beheizte Handschuhe · Thermoschicht',
      en: 'Winter jacket · heated gloves · thermal layer',
      fr: 'Veste hiver · gants chauffants · couche thermique',
      sk: 'Zimná moto bunda · vyhrievané rukavice · termo vrstva',
    },
  },
];

const out = ROUTES.map((r) => {
  const line = COORDS[r.map];
  if (!line) throw new Error(`chýbajú súradnice pre ${r.slug} (${r.map})`);

  const { start, finish, via } = pickPoints(line, r.prefix);

  return {
    id: r.id,
    slug: r.slug,
    tier: r.tier,
    priceChf: r.priceChf,
    region: r.region,
    country: r.country,
    distanceKm: r.distanceKm,
    ascentM: r.ascentM,
    durationHours: r.durationHours,
    avgTempC: r.avgTempC,
    passable: r.passable,
    difficulty: r.difficulty,
    curviness: r.curviness,
    seasonFrom: r.seasonFrom,
    seasonTo: r.seasonTo,
    start,
    finish,
    via,
    // Počasie sa ťahá pre najvyšší bod trasy — tam sa rozhoduje, či ísť
    weatherPoint: { ...via[Math.floor(via.length / 2)], name: r.prefix },
    title: r.title,
    summary: r.summary,
    highlights: r.highlights,
    gear: r.gear,
    assets: {
      track: `example-${r.slug}-track.gpx`,
      navigation: `example-${r.slug}-navigation.gpx`,
      poi: `example-${r.slug}-poi.gpx`,
      ...(r.tier === 'gold' ? { roadbook: `example-${r.slug}-roadbook.pdf` } : {}),
    },
    isExample: true,
  };
});

writeFileSync(
  path.join(process.cwd(), 'data', 'routes.json'),
  JSON.stringify(out, null, 2) + '\n',
  'utf8',
);

console.log(`Zapísaných ${out.length} trás do data/routes.json`);
for (const r of out) {
  console.log(
    `  ${r.slug.padEnd(24)} ${String(r.tier).padEnd(7)} ${String(r.priceChf).padStart(2)} CHF  ` +
      `${String(r.distanceKm).padStart(3)} km  ${r.country}  ${r.passable ? 'prejazdná' : 'ZAVRETÁ'}`,
  );
}
