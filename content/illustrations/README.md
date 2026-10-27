# Stijlgids voor afbeeldingen in lessen

Een les legt een plek, vorm, volgorde, vergelijking of beweging uit met een tekening, niet alleen met tekst. Deze gids zegt hoe zo'n tekening eruitziet, zodat alle tekeningen in Snuffel bij elkaar en bij Ted passen: de **rijke stripstijl** van de app: echte vormen (handen met nagels en knokkels, een kind met hoofd, romp, armen en benen, toetsen met diepte), schaduw in twee tinten, vaste kleuren, dikke zwarte lijnen en een harde schaduw.

Een tekening is een svg in de map `assets/` van de cursus en staat in de les als blok `figure` (zie `content/schema/v1/catalogus.md`). De app toont hem als `<img>` op een vaste crème kaart met een zwarte rand, ook in de donkere modus. `npm run content:check` bewaakt de regels hieronder die een script kan zien; de rest bewaakt `content-reviewer`.

## Werkwijze

1. Kies per uitlegstap of een tekening helpt (de **beeldlijst** van `snuffel-leren`).
2. Kopieer een sjabloon uit `content/illustrations/templates/` naar `content/courses/<cursus-id>/assets/<naam>.svg` en pas het aan. De app laadt nooit iets uit `content/illustrations/`.
3. `npm run content:check`: kleuren, veiligheid, `viewBox`, tekst en grootte.
4. `npm run content:figures -- <cursus-id>`: maakt van elke tekening een png in `tmp/figures/<cursus-id>/` (licht en donker, telefoon en laptop). **Bekijk elke png**: overlapt er iets, is elk label leesbaar, klopt de tekening met de tekst en de bronnen?
5. Schrijf de `alt` (zie hieronder) en zet de `sourceRefs` bij de tekening: dezelfde bronnen als de tekst die hij laat zien.

## Sjablonen

In `templates/` staan bouwstenen in deze stijl. Kopieer er een naar `assets/` van de cursus en pas hem aan; begin niet elke keer opnieuw.

| Sjabloon              | Wat                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `card.svg`            | een kaart met harde schaduw, een titel en een label                                                                                                                                                                |
| `arrow.svg`           | een dikke pijl met een label                                                                                                                                                                                       |
| `label.svg`           | een label met een lijn naar een punt                                                                                                                                                                               |
| `hand.svg`            | een linkerhand van bovenaf in typhouding (vingers als capsules met nagel en twee plooien, handpalm met knokkels, duim, blauwe mouw), en de rechterhand als spiegelbeeld met `<use>`                                |
| `person-sitting.svg`  | een kind van opzij aan een bureau: hoofd met haar, oog en oor, romp in een roze shirt, armen, blauwe broek, schoenen; stoel en bureau met diepte, toetsenbord en scherm                                            |
| `step-number.svg`     | genummerde stappen (paars bolletje met wit cijfer) met pijlen ertussen                                                                                                                                             |
| `keyboard-qwerty.svg` | een QWERTY-toetsenbord met diepte (donkere body, toetsen met een lila zijkant) en dezelfde toetsen en vingerkleuren als de typoefening; een toets is een `<rect>` met `data-key`, de voelstreepjes staan op F en J |

Een toets van het toetsenbord aanpassen is één attribuut: `fill="#ffffff"` voor een toets die nog niet geleerd is, of `stroke="#5b2bb5" stroke-width="4"` om hem te omranden. De letters op het hele toetsenbord zijn kleiner dan 15 (12, want er staan 15 toetsen naast elkaar); dat is de enige uitzondering, net als in de typoefening zelf.

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
| donkerpaars | `#3d2d66`                             | body van een toetsenbord, scherm                          |
| goed        | `#12804a`                             | alleen samen met een ✓, nooit als enige teken             |
| fout        | `#c2183f`                             | alleen samen met een ✗, nooit als enige teken             |
| trefwoorden | `none`, `currentColor`, `transparent` | `currentColor` is in een `<img>` altijd zwart             |

**Huidskleuren** (vier tinten per huidskleur: huid, schaduw, lijn voor plooien en nagelrand, nagel; in `palette.json` onder `skinTones` en als tokens `--snf-color-skin-tone-1` tot `-3`, alleen voor tekeningen):

| Huid              | Huid      | Schaduw   | Lijn      | Nagel     |
| ----------------- | --------- | --------- | --------- | --------- |
| licht (`tone-1`)  | `#f6d2b5` | `#e5ad88` | `#a86a4a` | `#fbe8da` |
| midden (`tone-2`) | `#d9a06f` | `#b97b4c` | `#7a4a2a` | `#f0cfb2` |
| donker (`tone-3`) | `#8d5a3b` | `#6b4129` | `#3e2416` | `#c99a7e` |

- **Eén huidskleur per tekening.** In een cursus wisselen de tekeningen met mensen of handen van huidskleur (licht, midden, donker, en weer licht). Dat is een afspraak voor de maker en de reviewer, geen check.
- **Kleren en mouwen nooit paars:** paars betekent op een toetsenbord "nieuw". Gebruik blauw `#7cc1d8`, roze `#ff2e7a`, wit of zwart.
- **Vingerkleuren** zijn dezelfde als in de typoefening: pink zacht roze, ringvinger oranje, middelvinger groen, wijsvinger geel, duim lila. Gebruik zacht roze, oranje, groen en geel in een andere tekening niet voor iets anders dan vingers, anders raakt een kind in de war. Lila is daarnaast de kleur van de zijkant van een voorwerp (toets, stoel, bureau).
- **Kleur is nooit het enige teken.** Wat een kleur betekent, staat er ook als label, cijfer, ✓/✗ of patroon bij, en in de `alt`.
- **Geen verlopen** (`linearGradient`, `radialGradient`), geen filters met kleur en geen doorzichtigheid: `opacity`, `fill-opacity` en `stroke-opacity` zijn `1` of `0`.

## Vorm

- **`viewBox` van 400 breed** (`viewBox="0 0 400 H"`, de hoogte kies je zelf; liefst niet hoger dan 400). Geen vaste `width` en `height` nodig; de tekening schaalt mee met de kaart. Zonder `viewBox` weigert `content:check` hem (`asset-viewbox-missing`).
- **Lijnen:** zwart `#141414`, dikte `3` (`stroke-width="3"`), `stroke-linejoin="round"` en `stroke-linecap="round"`. Dunner (2) alleen voor kleine details binnen een vlak.
- **Ronde hoeken:** `rx="12"` op kaarten en grote vlakken; kleine vlakken (een toets) `rx="6"`.
- **Harde schaduw:** een zwarte kopie van de vorm, 6 naar rechts en 6 naar beneden, achter de vorm (eerst tekenen). Alleen onder de grote vormen (een kaart, de body van een toetsenbord), niet onder elke toets of elk label.
- **Echte vormen, eenvoudig getekend.** Een hand heeft vingers, nagels en knokkels; een kind heeft een hoofd, een romp, armen en benen; een toets heeft een bovenkant en een zijkant. Geen foto's, geen verlopen, geen perspectief met verdwijnpunt.
- **Schaduw in twee tinten, zonder verloop:** een vorm van huid is eerst de schaduwkleur met een zwarte rand van 2,5, met daarop een iets kleinere vorm in de lichte huidskleur, naar links-boven geschoven. Plooien en de rand van een nagel in de lijnkleur van die huid (1 tot 1,5).
- **Diepte bij voorwerpen:** de zijkant van een toets, stoel of bureau is lila `#cfc3e8` en ligt 3 tot 4 onder de bovenkant; de body van een toetsenbord is donkerpaars `#3d2d66` met een zwarte schaduw (6, 6).
- **Hergebruik met `<use href="#id">`:** teken een hand één keer en spiegel hem voor de andere hand (`transform="translate(B 0) scale(-1 1)"`). Zo blijft een tekening klein.
- **Rustig:** hoogstens één ding dat opvalt (een accentkleur, een pijl of een omranding). Laat ruimte tussen vormen (minstens 8).
- **Groot genoeg voor een telefoon:** op een telefoon is een tekening van 400 breed ongeveer 300 tot 340 pixels breed. Labels zijn daarom minstens `font-size="15"`, liever 16 tot 18; lijnen minstens 2.
- Hoogstens **40 kB** per svg (`asset-too-large`). Een toetsenbord met diepte is ongeveer 14 kB; hergebruik met `<use>` houdt handen klein.

## Zo teken je …

**Een hand (van bovenaf, typhouding)** — begin met `templates/hand.svg`.

1. Vier vingers als capsules (`rect` met `rx` = halve breedte), een beetje uitwaaierend (draai de pink -7°, de ringvinger -3°, de wijsvinger 4°). Elke vinger: schaduwvorm met zwarte rand, lichte vorm erop, een nagel aan de top (nagelkleur, rand in de lijnkleur) en twee plooien (korte boogjes in de lijnkleur).
2. Een handpalm onder de vingers, met vier kleine boogjes voor de knokkels.
3. Een duim die schuin naar binnen wijst, naar de spatiebalk.
4. Een mouw over de pols (blauw, met een witte streep), nooit paars.
5. De andere hand is `<use href="#hand-left" transform="translate(B 0) scale(-1 1)"/>`; tekst nooit in de gespiegelde groep.

**Een persoon (van opzij)** — begin met `templates/person-sitting.svg`.

- Hoofd: een cirkel in de schaduwkleur met daarop een kleinere lichte cirkel; een oor, een oog (wit met een zwarte pupil), een klein neusje en een mond in de lijnkleur, zwart haar.
- Romp: een afgeronde vorm in de kleur van het shirt; armen en benen als dikke capsules met een zwarte rand (mouw in de shirtkleur, onderarm in twee huidtinten, broek blauw).
- Houding klopt met de les: rug tegen de leuning, bovenarm langs het lijf, onderarm naar het toetsenbord, voeten plat, ruimte tussen knie en bureau.

**Een toets** — begin met `templates/keyboard-qwerty.svg`.

- Eerst de zijkant: een lila `rect` 3 lager, dan de bovenkant erop (wit of in de vingerkleur), beide met een zwarte rand van 2 en `rx="4"`. De letter in het bovenste deel; een voelstreepje is een kort zwart lijntje onderaan de bovenkant.

## Tekst in een tekening

Een svg in een `<img>` laadt geen webfonts. Daarom:

- alleen **korte labels**: een toets, een vingernaam, een cijfer, een pijl met "pink". Hoogstens **24 tekens** per `<text>`;
- altijd `font-family="Atkinson Hyperlegible, Verdana, sans-serif"`, op de `<text>` of op een `<g>` eromheen, en `font-weight` `400` of `700`. Op een apparaat zonder Atkinson Hyperlegible wordt het Verdana of een ander schreefloos font; dat verschil is klein;
- `content:check` weigert een langere tekst of een ander font (`asset-text-invalid`);
- **uitleg hoort in de les** of in de `caption`, niet in de tekening;
- alles wat in de tekening staat en ertoe doet, staat ook in de `alt`;
- tekst is zwart op een licht vlak, of wit of geel op paars.

## Veilig

Een svg is een tekening, geen programma en geen verpakte foto. `content:check` weigert (`asset-unsafe-content`):

- elk element dat niet in de lijst met tekenelementen staat: alleen `svg`, `g`, `defs`, `symbol`, `use`, `title`, `desc`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `text`, `tspan`, `clipPath` en `style` mogen (dus geen `<script>`, `<foreignObject>`, `<image>`, `<a>`, HTML zoals `<img>`);
- elk element met een voorvoegsel (`<h:img>`) en elke `xmlns` die niet die van SVG of xlink is;
- `<!DOCTYPE>` of `<!ENTITY>`, en `<?xml-stylesheet?>` of een andere processing instruction dan `<?xml …?>`;
- attributen die met `on` beginnen (`onclick`), `src`, `srcset`, `poster` en `xml:base`, en `javascript:` of `data:`;
- een `href` of `url(…)` die niet met `#` begint (een ander bestand);
- in `<style>`: `@import`, `@font-face`, `\` en `image-set()`, `image()` of `src()`; in een `style`-attribuut: `\` en dezelfde functies;
- animatie: `<set>`, `<animate>`, `<animateTransform>`, `<animateMotion>`, `<animateColor>` en `<discard>`. Een tekening staat stil.

Filters (`<filter>`) en `mix-blend-mode` veranderen kleuren; die weigert hij als kleur buiten het palet. Verwijzingen naar een andere site weigert hij ook, ook in hoofdletters of met entiteiten (`h&#x74;tps://`) (`asset-external-ref`). Een svg in `assets/` die geen les gebruikt, geeft een waarschuwing (`asset-unused`).

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
| Een hand met vingers, nagels en twee huidtinten        | Een hand als vlak of als stokjes, of met een verloop als schaduw    |
| `viewBox="0 0 400 220"`                                | `width="1200" height="800"` zonder `viewBox`                        |
| Zwarte lijnen van 3, harde schaduw van 6               | Grijze lijntjes van 1, een vage schaduw met doorzichtigheid         |
| Een blauwe mouw, één huidskleur per tekening           | Een paarse mouw (paars is "nieuw"), twee huidskleuren door elkaar   |
