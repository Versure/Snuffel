# Stijlgids voor afbeeldingen in lessen

Een les legt een plek, vorm, volgorde, vergelijking of beweging uit met een tekening, niet alleen met tekst. Deze gids zegt hoe zo'n tekening eruitziet, zodat alle tekeningen in Snuffel bij elkaar en bij Ted passen: de stripstijl van de app, met vaste kleuren, dikke zwarte lijnen en een harde schaduw.

Een tekening is een svg in de map `assets/` van de cursus en staat in de les als blok `figure` (zie `content/schema/v1/catalogus.md`). De app toont hem als `<img>` op een vaste crème kaart met een zwarte rand, ook in de donkere modus. `npm run content:check` bewaakt de regels hieronder die een script kan zien; de rest bewaakt `content-reviewer`.

## Werkwijze

1. Kies per uitlegstap of een tekening helpt (de **beeldlijst** van `snuffel-leren`).
2. Kopieer een sjabloon uit `content/illustrations/templates/` naar `content/courses/<cursus-id>/assets/<naam>.svg` en pas het aan. De app laadt nooit iets uit `content/illustrations/`.
3. `npm run content:check`: kleuren, veiligheid, `viewBox`, tekst en grootte.
4. `npm run content:figures -- <cursus-id>`: maakt van elke tekening een png in `tmp/figures/<cursus-id>/` (licht en donker, telefoon en laptop). **Bekijk elke png**: overlapt er iets, is elk label leesbaar, klopt de tekening met de tekst en de bronnen?
5. Schrijf de `alt` (zie hieronder) en zet de `sourceRefs` bij de tekening: dezelfde bronnen als de tekst die hij laat zien.

## Sjablonen

In `templates/` staan bouwstenen in deze stijl. Kopieer er een naar `assets/` van de cursus en pas hem aan; begin niet elke keer opnieuw.

| Sjabloon              | Wat                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card.svg`            | een kaart met harde schaduw, een titel en een label                                                                                                         |
| `arrow.svg`           | een dikke pijl met een label                                                                                                                                |
| `label.svg`           | een label met een lijn naar een punt                                                                                                                        |
| `step-number.svg`     | genummerde stappen (paars bolletje met wit cijfer) met pijlen ertussen                                                                                      |
| `keyboard-qwerty.svg` | een QWERTY-toetsenbord met dezelfde toetsen en vingerkleuren als de typoefening; een toets is een `<rect>` met `data-key`, de voelstreepjes staan op F en J |

Een toets van het toetsenbord aanpassen is één attribuut: `fill="#ffffff"` voor een toets die nog niet geleerd is, of `stroke="#5b2bb5" stroke-width="4"` om hem te omranden. Met de `viewBox` laat je een deel zien, bijv. `viewBox="0 34 400 88"` voor de drie letterrijen. De labels van het hele toetsenbord zijn kleiner dan 16 (15 toetsen naast elkaar); dat is de enige uitzondering, net als in de typoefening zelf.

## Palet

Alleen deze kleuren; ze staan in `palette.json` en komen uit `web/src/styles/tokens.css`. Een andere kleur weigert `content:check` (`asset-color-off-palette`).

| Kleur       | Waarde                                | Gebruik                                                   |
| ----------- | ------------------------------------- | --------------------------------------------------------- |
| zwart       | `#141414`                             | alle lijnen, tekst en de schaduw                          |
| geel        | `#ffd83d`                             | vlak; wijsvinger                                          |
| paars       | `#5b2bb5`                             | vlak of accent (met witte of gele tekst erop, niet zwart) |
| roze        | `#ff2e7a`                             | vlak of accent (met zwarte tekst erop)                    |
| crème       | `#fff6dc`                             | vlak, achtergrond van een kaart                           |
| wit         | `#ffffff`                             | vlak                                                      |
| lila        | `#cfc3e8`                             | vlak; duim                                                |
| groen       | `#8fe3a8`                             | vlak; middelvinger                                        |
| zacht roze  | `#ffb3cd`                             | vlak; pink                                                |
| blauw       | `#7cc1d8`                             | vlak (water, lucht)                                       |
| oranje      | `#ffc078`                             | vlak; ringvinger                                          |
| goed        | `#12804a`                             | alleen samen met een ✓, nooit als enige teken             |
| fout        | `#c2183f`                             | alleen samen met een ✗, nooit als enige teken             |
| trefwoorden | `none`, `currentColor`, `transparent` | `currentColor` is in een `<img>` altijd zwart             |

- **Vingerkleuren** zijn dezelfde als in de typoefening: pink zacht roze, ringvinger oranje, middelvinger groen, wijsvinger geel, duim lila. Gebruik die kleuren in een andere tekening niet voor iets anders dan vingers, anders raakt een kind in de war.
- **Kleur is nooit het enige teken.** Wat een kleur betekent, staat er ook als label, cijfer, ✓/✗ of patroon bij, en in de `alt`.
- **Geen verlopen** (`linearGradient`, `radialGradient`), geen filters met kleur en geen doorzichtigheid: `opacity`, `fill-opacity` en `stroke-opacity` zijn `1` of `0`.

## Vorm

- **`viewBox` van 400 breed** (`viewBox="0 0 400 H"`, de hoogte kies je zelf; liefst niet hoger dan 400). Geen vaste `width` en `height` nodig; de tekening schaalt mee met de kaart. Zonder `viewBox` weigert `content:check` hem (`asset-viewbox-missing`).
- **Lijnen:** zwart `#141414`, dikte `3` (`stroke-width="3"`), `stroke-linejoin="round"` en `stroke-linecap="round"`. Dunner (2) alleen voor kleine details binnen een vlak.
- **Ronde hoeken:** `rx="12"` op kaarten en grote vlakken; kleine vlakken (een toets) `rx="6"`.
- **Harde schaduw:** een zwarte kopie van de vorm, 6 naar rechts en 6 naar beneden, achter de vorm (eerst tekenen). Alleen onder de grote vormen, niet onder elke toets of elk label.
- **Schematisch, niet realistisch.** Een hand is een vlak met vijf ronde vingertoppen, een toetsenbord is een raster van afgeronde rechthoeken. Geen schaduwen met verloop, geen 3D, geen foto's.
- **Rustig:** hoogstens één ding dat opvalt (een accentkleur, een pijl of een omranding). Laat ruimte tussen vormen (minstens 8).
- **Groot genoeg voor een telefoon:** op een telefoon is een tekening van 400 breed ongeveer 300 tot 340 pixels breed. Labels zijn daarom minstens `font-size="16"`, liever 18; lijnen minstens 2.
- Hoogstens **40 kB** per svg (`asset-too-large`). Een met de hand geschreven tekening blijft daar ruim onder.

## Tekst in een tekening

Een svg in een `<img>` laadt geen webfonts. Daarom:

- alleen **korte labels**: een toets, een vingernaam, een cijfer, een pijl met "pink". Hoogstens **24 tekens** per `<text>`;
- altijd `font-family="Atkinson Hyperlegible, Verdana, sans-serif"`, op de `<text>` of op een `<g>` eromheen, en `font-weight` `400` of `700`. Op een apparaat zonder Atkinson Hyperlegible wordt het Verdana of een ander schreefloos font; dat verschil is klein;
- `content:check` weigert een langere tekst of een ander font (`asset-text-invalid`);
- **uitleg hoort in de les** of in de `caption`, niet in de tekening;
- alles wat in de tekening staat en ertoe doet, staat ook in de `alt`;
- tekst is zwart op een licht vlak, of wit of geel op paars.

## Veilig

Een svg is een tekening, geen programma en geen verpakte foto. `content:check` weigert (`asset-unsafe-content`): `<script>`, `<foreignObject>`, `<image>`, `<!DOCTYPE>` of `<!ENTITY>`, attributen die met `on` beginnen (`onclick`), en `javascript:` of `data:`. Verwijzingen naar een andere site weigert hij ook (`asset-external-ref`). Een svg in `assets/` die geen les gebruikt, geeft een waarschuwing (`asset-unused`).

## Een goede `alt`

De `alt` vervangt de tekening voor wie hem niet ziet (een voorleesprogramma, of als de tekening niet laadt).

- Beschrijf **wat de tekening laat zien en waarom hij er staat**, in één tot drie korte zinnen. Begin niet met "Afbeelding van".
- Noem alles wat ertoe doet: de labels, de kleuren met hun betekenis, wat er gemarkeerd is.
- Niet langer dan nodig; details die niets uitleggen laat je weg.

Goed: _"Toetsenbord met de thuisrij gekleurd: a en ; roze voor de pinken, s en l oranje voor de ringvingers, d en k groen voor de middelvingers, f en j geel voor de wijsvingers. Op de f en de j staat een streepje."_

Fout: _"Toetsenbord"_ (zegt niet wat je moet zien) of _"Een plaatje met allemaal gekleurde toetsen"_ (noemt de betekenis van de kleuren niet).

## Goed en fout

| Goed                                                   | Fout                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| Een toetsenbord met alleen de nieuwe toetsen omrand    | Alle toetsen in felle kleuren, zodat niets meer opvalt              |
| Labels "f" en "j" en een streepje op die toetsen       | Een label met een hele zin: "Leg hier je wijsvingers op de toetsen" |
| Vingerkleuren uit het palet, met een legenda of labels | Rood en groen als enige verschil                                    |
| Een hand als vlak met vijf vingertoppen                | Een realistische hand met nagels en schaduwen                       |
| `viewBox="0 0 400 220"`                                | `width="1200" height="800"` zonder `viewBox`                        |
| Zwarte lijnen van 3, harde schaduw van 6               | Grijze lijntjes van 1, een vage schaduw met doorzichtigheid         |
