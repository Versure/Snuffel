# Inhoudsformaat v1: catalogus

Dit is de handleiding bij het inhoudsformaat van Snuffel, versie 1. Hij is voor Jop en voor de skill `snuffel-leren`: wat er in een cursus en een les mag staan, hoe je het opschrijft en welke controles `npm run content:check` doet. De precieze regels staan in de JSON-schema's in deze map (`course.schema.json`, `lesson.schema.json`, `manifest.schema.json`, `terms.schema.json`); bij twijfel geldt het schema.

Sleutels zijn Engels, teksten Nederlands.

Id's die met `voorbeeld-` beginnen zijn gereserveerd voor voorbeelden in `content/fixtures/` (gemaakt met `/snuffel-leren <wens> --voorbeeld`); in `content/courses/` komen ze nooit voor.

## Bestanden

```
content/
├─ terms.json                         vaktermen voor alle cursussen
├─ schema/v1/                         deze catalogus, de schema's en inline-markup.cases.json
├─ courses/<cursus-id>/               echte inhoud
│  ├─ course.json
│  ├─ lessons/01-<les-id>.json        nummer voor de volgorde in de map, daarna het les-id
│  └─ assets/<naam>.svg               afbeeldingen voor deze cursus
└─ fixtures/courses/<cursus-id>/      testdata (de proefles) en voorbeelden, nooit in de image
```

- De mapnaam van een cursus is het cursus-id.
- Elk bestand begint met `"schemaVersion": 1`.
- `npm run content:build` zet alles klaar in `web/public/content/` (niet in git): `manifest.json`, `<cursus-id>/course.json`, `<cursus-id>/lessons/<les-id>.json` en de gebruikte afbeeldingen. In de uitvoer heet een lesbestand naar het les-id, niet naar het nummer, zodat een adres nooit verandert als de volgorde wijzigt. Het manifest noemt per cursus elke gebruikte afbeelding met de hash van de bytes (`assets`), zodat de app een gewijzigde svg nooit uit de cache van de browser haalt.
- Fixtures gaan alleen mee met `npm run content:build:fixtures` (dat doen `npm start` en `npm run e2e`). De image voor de NAS wordt zonder fixtures gebouwd: een kind ziet de proefles nooit.

## Id's

- Een id bestaat uit kleine letters, cijfers en losse streepjes, 1 tot 60 tekens: `aanbeet-of-vastzitten`, `vraag-1`. Niet `Vraag_1`, niet `-vraag`, niet `vraag--1`.
- **Cursus-id's** zijn uniek. **Les-id's** zijn uniek over **alle** cursussen samen (ook de fixtures), want de voortgang slaat alleen het les-id op.
- Binnen één les zijn de id's van stappen, quizvragen, interacties en checklist-items samen uniek (één lijst). Optie-id's zijn uniek binnen hun vraag. Bron-id's zijn uniek binnen de cursus. Termen in de `glossary` zijn uniek binnen de les (hoofdletters tellen niet).
- Blokken en signaalkaarten hebben geen id: er hangt geen voortgang aan.
- Waar de voortgang aan hangt:

  | In de les                     | In PocketBase                         |
  | ----------------------------- | ------------------------------------- |
  | `steps[].id`                  | `lesson_progress.step_id`             |
  | id van een `practice`-stap    | `checklist_states.checklist_id`       |
  | `items[].id` in die stap      | `checklist_states.checked` (de lijst) |
  | `questions[].id`, `options[]` | `quiz_attempts.question_id/option_id` |
  | `interaction.id`              | `interaction_results.interaction_id`  |
  | `version`                     | `content_version`                     |

### "Nooit wijzigen"

Zodra een les op `main` staat als `published`, geldt voor die les:

- het cursus-id, het les-id en alle id's uit de tabel hierboven blijven bestaan, onder dezelfde ouder (een vraag blijft in dezelfde quizstap, een optie bij dezelfde vraag);
- een id dat op `main` bij iets anders hoorde, gebruik je niet opnieuw;
- de les blijft `published`;
- verandert er ook maar iets aan de les (tekst, volgorde, een nieuwe vraag), dan gaat `version` één omhoog. Alleen de volgorde van sleutels in het bestand telt niet als wijziging.

Wel mag: nieuwe stappen, vragen, opties of items toevoegen (met een hogere `version`), teksten verbeteren (met een hogere `version`), en een nieuwe les toevoegen. Een les die op `main` nog `planned` is, mag je vrij veranderen.

`npm run content:check` vergelijkt dit met `main` (of `origin/main`, of `--base <ref>`). Bestaat geen van beide, dan meldt de check "id-stabiliteit niet gecontroleerd: geen main gevonden" en gaat verder. Fixtures vallen buiten deze vergelijking.

## Statussen

| Status      | Betekenis                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `planned`   | de les komt nog: alleen `id` en `title` in `course.json`, geen bestand; de app toont hem als "komt" |
| `published` | de les is af: `file` is verplicht, het bestand bestaat en is volledig gecontroleerd                 |

Een les die nog niet af is, staat op een `content/<cursus-id>-<les-id>`-branch, niet op `main`. Een les intrekken kan in v1 niet.

## `course.json`

```json
{
  "schemaVersion": 1,
  "id": "roofvissen",
  "title": "Roofvissen met kunstaas",
  "audience": "Ouder en kind, beginners",
  "goal": "Zelfstandig met kunstaas op snoek en baars vissen in de vijver",
  "successCriterion": "Een roofvis zelf vangen, onthaken en terugzetten",
  "kind": "course",
  "ted": { "greeting": "Klaar om te snuffelen?" },
  "lessons": [
    {
      "id": "aanbeet-of-vastzitten",
      "title": "Aanbeet of vastzitten?",
      "status": "published",
      "file": "lessons/01-aanbeet-of-vastzitten.json"
    },
    { "id": "onthaken", "title": "Veilig onthaken", "status": "planned" }
  ],
  "sources": [
    {
      "id": "svnl-visblad-streetfishing",
      "title": "Hét Visblad: streetfishing",
      "url": "https://www.sportvisserijnederland.nl/files/rvnl_5997.pdf",
      "publisher": "Sportvisserij Nederland",
      "type": "association",
      "reliability": "high",
      "accessedOn": "2026-10-19",
      "note": "Landelijke sportvisserijbond"
    }
  ]
}
```

- `kind`: `course` (leertraject) of `practice` (huiswerk-oefenles). Bij `practice` zijn ook `subject`, `schoolLevel`, `method` en `chapter` verplicht.
- De volgorde van `lessons` is de volgorde in de app.

## Bronnen en betrouwbaarheid

Elke bron in `sources` heeft `id`, `title`, `url` (alleen `https://`), `publisher`, `type`, `reliability` en `accessedOn` (de datum waarop je hem las, `JJJJ-MM-DD`); `note` mag.

- `type`: `government`, `association`, `education`, `science`, `media`, `encyclopedia`, `manufacturer`, `shop`, `blog`, `forum`, `method`.
- `reliability`:
  - `high`: overheid, vakbond of vereniging, onderwijsinstelling, wetenschap;
  - `medium`: gerenommeerde media, encyclopedie, fabrikant over zijn eigen product, methode van een uitgever over de eigen lesstof (`method`, bij huiswerk);
  - `low`: winkel, blog, forum.
- `sourceRefs` is verplicht op elk blok (bij `signal-cards` op elke kaart), elke quizvraag (die geldt voor vraag, opties en feedback samen), elk checklist-item en elke interactiestap. Een lege lijst `[]` mag alleen bij tekst zonder feitelijke bewering; dat beoordeelt de reviewer.
- Een niet-lege lijst steunt nooit alleen op `low`-bronnen: er staat altijd minstens één `medium`- of `high`-bron bij.

## Een les

```json
{
  "schemaVersion": 1,
  "id": "aanbeet-of-vastzitten",
  "version": 1,
  "title": "Aanbeet of vastzitten?",
  "sticker": "Roofvissen · les 1",
  "objective": "Na deze les weet je hoe een aanbeet voelt.",
  "concept": "aanbeet herkennen",
  "estimatedMinutes": 10,
  "glossary": [{ "term": "aanslaan", "definition": "kort en stevig de hengel omhoog halen" }],
  "ted": {
    "intro": { "mood": "cool", "text": "Yo! Ik ben Ted." },
    "correct": ["Goed gevoeld!", "Strak!"],
    "incorrect": ["Bijna.", "Oeps, kijk nog eens."],
    "finished": "Tijd voor het echte werk aan de waterkant."
  },
  "steps": [],
  "furtherReading": [
    { "sourceRef": "svnl-visblad-streetfishing", "why": "Over roofvissen in stadswater." }
  ],
  "faq": [{ "q": "Wat als ik twijfel?", "a": "Sla aan." }]
}
```

- `version` begint bij 1 en gaat omhoog bij elke wijziging na publicatie.
- `estimatedMinutes`: 8 tot 12, en hoogstens 2 minuten naast de berekende tijd (zie "Checks").
- Ted heeft vier stemmingen (`mood`): `cool` (stoer), `happy` (blij), `thinking` (nadenkend), `oops` (oeps).
- `glossary`, `furtherReading` en `faq` zijn verplicht, maar mogen leeg zijn.

## Staptypen

Elke stap heeft `id`, `type` en `title`. Een les van een leertraject (`kind: course`) heeft precies één `quiz`-stap; een oefenles hoogstens één.

**`explain`**: uitleg in blokken.

```json
{ "id": "uitleg", "type": "explain", "title": "Wachten kost je de vis", "blocks": [] }
```

**`interaction`**: een spel of oefening uit de vaste catalogus (zie "Interacties").

```json
{
  "id": "spel",
  "type": "interaction",
  "title": "Voel de lijn",
  "intro": "Kijk goed: is het een vis of zit je vast?",
  "interaction": { "id": "voel-spel", "kind": "trace-game", "config": {} },
  "sourceRefs": ["svnl-roofvis-9303"]
}
```

**`quiz`**: 3 tot 5 vragen, elk met 3 of 4 opties en feedback bij elke optie. `intro` mag.

```json
{
  "id": "quiz",
  "type": "quiz",
  "title": "Quiz",
  "intro": "Vier situaties aan het water.",
  "questions": [
    {
      "id": "schokken-terug",
      "prompt": "Het wordt zwaar en je voelt schokken terug. Wat doe je?",
      "options": [
        { "id": "aanslaan", "text": "Direct aanslaan", "feedback": "Klopt. Er leeft iets." },
        { "id": "wachten", "text": "Wachten op de vis", "feedback": "Dan spuugt hij het aas uit." },
        { "id": "vieren", "text": "Lijn laten vieren", "feedback": "Dan voel je niets meer." }
      ],
      "correctOptionId": "aanslaan",
      "hints": ["Hoe snel merkt een roofvis dat het aas nep is?"],
      "sourceRefs": ["svnl-roofvis-9303"]
    }
  ]
}
```

**`practice`**: een checklist voor buiten de app. `practiceKind` is `at-the-water` (aan het water) of `do-it-yourself` (zelf doen). Items mogen `links` hebben.

```json
{
  "id": "aan-het-water",
  "type": "practice",
  "practiceKind": "at-the-water",
  "title": "Aan het water",
  "intro": "De volgende keer bij de vijver:",
  "items": [
    {
      "id": "vispas",
      "text": "Neem je VISpas mee.",
      "links": [{ "label": "VISpas-check", "url": "https://www.sportvisunie.nl/…" }],
      "sourceRefs": ["vispas-check"]
    }
  ],
  "successCriterion": "Gelukt als je zonder te kijken kunt zeggen: bodem, plant, vast of vis."
}
```

## Bloktypen (in een `explain`-stap)

| Type           | Velden                                              | Voorbeeld                                                                                                         |
| -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `text`         | `text`, `sourceRefs`                                | `{ "type": "text", "text": "Een plant schudt niet.", "sourceRefs": ["…"] }`                                       |
| `example`      | `text`, `sourceRefs`                                | `{ "type": "example", "text": "Je draait een shad binnen…", "sourceRefs": [] }`                                   |
| `signal-cards` | `cards[]` met `icon`, `title`, `text`, `sourceRefs` | `{ "type": "signal-cards", "cards": [{ "icon": "tick", "title": "Een tik", "text": "…", "sourceRefs": ["…"] }] }` |
| `rule`         | `title`, `text`, `sourceRefs`                       | `{ "type": "rule", "title": "Twijfel? Sla aan!", "text": "…", "sourceRefs": ["…"] }`                              |
| `tip`          | `text`, `sourceRefs`, `title` mag                   | `{ "type": "tip", "title": "Tip", "text": "Gevlochten lijn rekt bijna niet.", "sourceRefs": ["…"] }`              |
| `figure`       | `src`, `alt`, `sourceRefs`, `caption` mag           | `{ "type": "figure", "src": "assets/hengeltop.svg", "alt": "Een buigende hengeltop", "sourceRefs": [] }`          |
| `ted-says`     | `mood`, `text`, `sourceRefs`                        | `{ "type": "ted-says", "mood": "thinking", "text": "Let op je hengeltop.", "sourceRefs": [] }`                    |

- `icon` is de naam van een icoon uit de vaste set van de app (tabel hieronder). Een andere naam is een `schema`-fout; de melding noemt de toegestane namen. Een nieuw icoon vraagt een tekening in de app en een regel in het schema.

| `icon`     | Tekening                                                      | Kleur |
| ---------- | ------------------------------------------------------------- | ----- |
| `tick`     | een rechte lijn met één scherpe piek omhoog (een korte tik)   | geel  |
| `shake`    | een lijn die snel op en neer gaat (schudden, trillen)         | roze  |
| `stop`     | een pijl omlaag naar een gestippelde lijn (vast aan de bodem) | lila  |
| `check`    | een vinkje (goed, zo doe je het)                              | geel  |
| `cross`    | een kruis (fout, zo niet)                                     | roze  |
| `question` | een vraagteken (twijfel, zelf nadenken)                       | lila  |
| `idea`     | een gloeilamp (slim idee, handigheidje)                       | geel  |
| `warning`  | een driehoek met een uitroepteken (pas op, gevaar)            | roze  |

- `figure.src` wijst naar een `.svg` in de map `assets/` van de cursus (of een submap), met alleen kleine letters, cijfers en streepjes in de namen (bijv. `assets/vissen/snoek.svg`), zonder `..` en zonder symlink. `alt` beschrijft wat je ziet en is nooit leeg. De svg laadt niets van buiten (alleen de XML-namespaces van w3.org mogen erin staan) en gebruikt `currentColor` in plaats van vaste kleuren.

## Opmaak in tekst

In alle tekstvelden mag een kleine subset van Markdown, alleen binnen een regel:

| Schrijf                   | Je krijgt                                           |
| ------------------------- | --------------------------------------------------- |
| `**vet**`                 | **vet**                                             |
| `*cursief*`               | _cursief_                                           |
| `[label](https://…)`      | een link (alleen `https://`)                        |
| `[[aanslaan]]`            | de term, met de uitleg uit de `glossary` van de les |
| `[[aanslaan\|slaat aan]]` | dezelfde term, getoond als "slaat aan"              |

- Geen HTML, koppen, lijsten of afbeeldingen in tekst.
- Een losse `*` (zoals in `3 * 4`) blijft gewoon tekst, net als `**` zonder sluiting.
- Elke `[[term]]` moet in de `glossary` van dezelfde les staan.
- In `course.json` mag geen `[[term]]` staan: een cursus heeft geen `glossary` (`course-term-not-allowed`). Schrijf de term daar als gewone tekst. Links in `course.json` (bijvoorbeeld in `goal` of `sources[].note`) worden net zo gecontroleerd als in een les.
- Alle gevallen staan in `inline-markup.cases.json`; de tools en de app worden daartegen getest.

## Zo toont de app een les

Een les staat in de app op `/leren/<cursus-id>/<les-id>`, voor wie ingelogd is (kind en ouder). Het is één doorlopende pagina; `#stap-<stap-id>` achter het adres opent hem bij die stap.

- **Kop:** een link "Naar de start", de `sticker`, "Ongeveer `estimatedMinutes` minuten", de `title` (het laatste woord op een paarse band), Ted (`ted.intro.mood`) met `ted.intro.text` in een ballon, en het `objective` op een papieren kader.
- **Stappen-navigatie:** een genummerd rondje per stap met een kort label: `explain` "Uitleg", `trace-game` "Spel", `stepped-exercise` "Oefenen", `quiz` "Quiz", `at-the-water` "Aan het water", `do-it-yourself` "Zelf doen". Een tik springt naar de stap.
- **Stap:** de `title` als kop met een roze rondje met het nummer.
- **Blokken:** `text` is een alinea; `example` staat in een kaart; `signal-cards` zijn kaarten met het icoon, de titel en de tekst; `rule` is een roze blok met de titel groot; `tip` is een kaart met de titel (zonder titel: "Tip"); `figure` is de afbeelding met het onderschrift eronder; `ted-says` is een kleine Ted in de gekozen stemming met een ballon.
- **Bronnen:** onder elk blok en elke kaart met `sourceRefs` staat "Bron:" met per bron de uitgever als link. Een blok zonder bronnen toont niets. Bij quizvragen, praktijkpunten en de interactiestap toont de app (nog) geen bronnen.
- **Vaktermen:** een `[[term]]` is een woord met een stippellijn eronder. Tikken toont de `definition` uit de `glossary` direct onder de term; nog eens tikken of Escape sluit hem. Onderaan de les staat de woordenlijst met alle termen op alfabet.
- **Links:** elke link naar buiten opent in een nieuw tabblad. Alleen `https://` wordt een link.
- **Afbeeldingen:** een `figure` staat op een vaste lichte achtergrond, ook in de donkere modus, want een svg in een afbeelding volgt de kleuren van de app niet. Teken dus met `currentColor` (wordt zwart) of met donkere lijnen.
- **Einde:** Ted (blij) met `ted.finished`, dan "Woordenlijst", "Verder lezen" (titel van de bron als link, de uitgever en `why`) en "Vragen" (elke vraag met het antwoord eronder). Een lege lijst geeft geen kopje.
- **Wat nog komt:** tot M8 is een `quiz` een voorbeeld om te lezen: alle vragen met de opties A, B, C, D als tekst, zonder knoppen, uitleg, hints of het goede antwoord. Een interactie (`trace-game`, `stepped-exercise`) is tot M9 en M10 een donker paneel met Ted: "Dit spel komt binnenkort." of "Deze oefening komt binnenkort." Een `practice`-stap is tot M8 een plakbriefje met de punten als lijst, zonder vinkjes, met `successCriterion` vet eronder. `ted.correct` en `ted.incorrect` worden nog niet getoond.

## Interacties

Een interactie is data voor een bestaand onderdeel van de app. Alleen deze twee soorten bestaan; een nieuwe soort vraagt code (skill `spelcomponent-bouwen`). Elke interactiestap telt **2 minuten** in de berekende tijd.

### `trace-game` (het voel-spel)

Een lijn die over de tijd getekend wordt, met een buigende hengeltop. Het kind kiest wat het "voelt". Bij "beweging beperken" staat de lijn meteen helemaal getekend.

| Veld         | Wat                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `choices`    | 2 tot 6 keuzes: `id`, `label`, `color` (een tokennaam: `yellow`, `pink`, `purple`, `blue`, `green`, `orange`; nooit een kleurwaarde) |
| `patterns`   | minstens 2 patronen: `id`, `answer` (het id van een keuze), `shape` (bouwstenen), `explanation`                                      |
| `rounds`     | aantal rondes, 1 tot 12                                                                                                              |
| `durationMs` | hoe lang het tekenen van één lijn duurt, 1000 tot 10000                                                                              |

De lijn is de som van de bouwstenen. Tijd en hoogte lopen van 0 tot 1.

| Bouwsteen | Velden                                          | Wat                                                                   |
| --------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| `base`    | `level`                                         | vaste hoogte                                                          |
| `pulse`   | `at`, `width`, `height`                         | één piek op tijdstip `at`                                             |
| `pulses`  | `start`, `interval`, `count`, `width`, `height` | `count` pieken om de `interval`, vanaf `start`                        |
| `ramp`    | `from`, `to`, `height`                          | geleidelijk `height` zwaarder tussen `from` en `to`                   |
| `wobble`  | `amplitude`, `frequency`, `from` en `to` mogen  | trillen; `frequency` is het aantal golven over de hele lijn (tot 100) |

```json
{
  "id": "voel-spel",
  "kind": "trace-game",
  "config": {
    "choices": [
      { "id": "vis", "label": "Vis!", "color": "yellow" },
      { "id": "vast", "label": "Vast", "color": "purple" }
    ],
    "patterns": [
      {
        "id": "tik",
        "answer": "vis",
        "shape": [
          { "type": "base", "level": 0.22 },
          { "type": "pulse", "at": 0.5, "width": 0.012, "height": 0.62 }
        ],
        "explanation": "Eén korte, scherpe tik: een vis pakte het aas."
      },
      {
        "id": "vast",
        "answer": "vast",
        "shape": [
          { "type": "base", "level": 0.22 },
          { "type": "ramp", "from": 0.32, "to": 0.42, "height": 0.63 }
        ],
        "explanation": "Zwaar en daarna vlak: je zit vast."
      }
    ],
    "rounds": 8,
    "durationMs": 3200
  }
}
```

### `stepped-exercise` (huiswerk-oefenles)

Opgaven met een eigen antwoord van het kind, oplopende hints, tussenstappen die het kind kan openen, herkende foute antwoorden met gerichte uitleg, en een uitwerking die pas verschijnt na een eigen poging én alle hints. Het formaat bestaat al in v1; in de app is het pas vanaf M10 te zien.

| Veld per opgave  | Wat                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `prompt`   | id en de opgave                                                                                                                                                                 |
| `answer`         | `{ "type": "number", "value", "tolerance", "unit" (mag) }`, `{ "type": "text", "accepted": [...] }` of `{ "type": "choice", "options": [{ "id", "text" }], "correctOptionId" }` |
| `hints`          | oplopende hints, één voor één te openen                                                                                                                                         |
| `steps`          | tussenstappen: `id`, `title`, `text`                                                                                                                                            |
| `commonMistakes` | `answer` (een fout antwoord zoals een kind het geeft) en `feedback`                                                                                                             |
| `workedSolution` | de uitwerking                                                                                                                                                                   |

```json
{
  "id": "breuken",
  "kind": "stepped-exercise",
  "config": {
    "exercises": [
      {
        "id": "som-1",
        "prompt": "Hoeveel is 1/2 + 1/4?",
        "answer": { "type": "number", "value": 0.75, "tolerance": 0.001 },
        "hints": ["Maak de noemers gelijk."],
        "steps": [{ "id": "noemers", "title": "Noemers gelijk", "text": "1/2 = 2/4" }],
        "commonMistakes": [
          { "answer": "2/6", "feedback": "Tellers en noemers tel je niet los op." }
        ],
        "workedSolution": "1/2 = 2/4, en 2/4 + 1/4 = 3/4."
      }
    ]
  }
}
```

## Vaktermen (`content/terms.json`)

```json
{ "schemaVersion": 1, "terms": [{ "term": "aanslaan", "forms": ["slaat aan", "aangeslagen"] }] }
```

Komt een term of een van zijn vormen voor in de tekst van een les (hele woorden, hoofdletters tellen niet), dan moet de term in de `glossary` van die les staan. Samenstellingen (`aanslaanmoment`) en vormen die niet in `forms` staan, vindt de check niet; voeg ze toe als je ze tegenkomt. Of een term ook in de tekst zelf wordt uitgelegd, beoordeelt de reviewer.

## Checks (`npm run content:check`)

Elke fout heeft een vaste code. De melding is Nederlands, met het bestand en de plek in het bestand (het JSON-pad):

```
content:check: 1 fout
FOUT content/fixtures/courses/proefcursus/lessons/01-proefles.json
  steps[0].blocks[1].cards[0].sourceRefs[0]: bron "svnl-roofvis-9303" staat niet in de bronnen van course.json [source-ref-missing]
```

Zijn er schemafouten in een cursus, dan worden eerst alleen die gemeld; de andere checks lopen pas als het schema klopt.

| Code                          | Wanneer                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `json-invalid`                | het bestand is geen geldige JSON (met regel en kolom)                                            |
| `schema`                      | het bestand past niet bij het schema (ontbrekend of onbekend veld, verkeerde waarde, fout id)    |
| `course-file-missing`         | een cursusmap zonder `course.json`                                                               |
| `terms-file-missing`          | `content/terms.json` ontbreekt                                                                   |
| `course-id-mismatch`          | het cursus-id is niet gelijk aan de mapnaam                                                      |
| `lesson-file-missing`         | een `published` les zonder bestand                                                               |
| `lesson-id-mismatch`          | het id in het lesbestand is anders dan in `course.json`                                          |
| `lesson-file-orphan`          | een lesbestand dat niet als `published` les in `course.json` staat                               |
| `id-duplicate`                | een id komt dubbel voor (zie "Id's"), met beide plekken                                          |
| `interaction-answer-unknown`  | een antwoord in een interactie verwijst naar een keuze of optie die niet bestaat                 |
| `source-ref-missing`          | een `sourceRef` (ook in `furtherReading`) staat niet in `sources`                                |
| `source-only-low`             | een niet-lege `sourceRefs` met alleen `low`-bronnen                                              |
| `source-date-invalid`         | `accessedOn` is geen bestaande datum (bijv. `2026-02-30`)                                        |
| `source-date-future`          | `accessedOn` ligt na vandaag                                                                     |
| `glossary-term-unknown`       | een `[[term]]` die niet in de `glossary` van de les staat                                        |
| `term-not-in-glossary`        | een vakterm uit `terms.json` staat in de tekst, maar niet in de `glossary`                       |
| `quiz-step-count`             | een leertrajectles zonder of met meer dan één quizstap (oefenles: meer dan één)                  |
| `quiz-question-count`         | een quiz met minder dan 3 of meer dan 5 vragen                                                   |
| `quiz-option-count`           | een vraag met minder dan 3 of meer dan 4 opties                                                  |
| `quiz-correct-option-missing` | `correctOptionId` is geen van de opties                                                          |
| `quiz-option-length`          | de langste optie is meer dan 1,5 × de kortste (in tekens, zonder opmaak en spaties eromheen)     |
| `duration-out-of-range`       | de berekende tijd ligt niet tussen 8 en 12 minuten                                               |
| `duration-mismatch`           | `estimatedMinutes` ligt meer dan 2 minuten naast de berekende tijd                               |
| `sentence-length`             | gemiddeld meer dan 15 woorden per zin                                                            |
| `link-not-https`              | een link die niet met `https://` begint (ook `http:`, `javascript:`, `data:` en relatieve links) |
| `link-tracker`                | een link naar een tracker of linkverkorter, of met een trackingparameter                         |
| `markup-html`                 | HTML in tekst                                                                                    |
| `course-term-not-allowed`     | een `[[term]]` in `course.json` (een cursus heeft geen `glossary`)                               |
| `asset-path-invalid`          | `figure.src` is geen `.svg` onder `assets/`, bevat `..`, of is (of ligt in) een symlink          |
| `asset-missing`               | de afbeelding bestaat niet                                                                       |
| `asset-external-ref`          | de svg verwijst naar een andere site                                                             |
| `figure-alt-missing`          | `alt` is leeg of alleen spaties                                                                  |
| `id-removed`                  | een gepubliceerd id (cursus, les, stap, vraag, optie, interactie, item) is weg                   |
| `id-moved`                    | een gepubliceerd id staat onder een andere ouder, of is hergebruikt voor iets anders             |
| `lesson-unpublished`          | een les die op `main` `published` is, is dat niet meer                                           |
| `version-not-bumped`          | een gepubliceerde les is gewijzigd zonder hogere `version` (of `version` is lager)               |
| `base-not-found`              | de ref van `--base` bestaat niet                                                                 |

### Hoe de tijd wordt berekend

`woorden / 130` + 2 minuten per interactiestap + 1 minuut per quizvraag, afgerond op één decimaal.

Woorden tellen in de tekst die een kind sowieso leest: `objective`, Teds intro, de titels van stappen en blokken, alle bloktekst en kaarten (ook het onderschrift van een afbeelding), de intro van een quiz-, interactie- of practice-stap, vragen en opties, checklist-items en `successCriterion`. Feedback, hints, Teds reacties, de teksten binnen een interactie, de woordenlijst, de FAQ en "verder lezen" tellen niet mee. Opmaak en losse webadressen tellen niet als woorden.

### Hoe zinnen worden geteld

Over dezelfde tekst als bij de tijd. Een zin eindigt op `.`, `!`, `?` of `…` gevolgd door een spatie of het einde van de tekst (een aanhalingsteken of haakje erna mag). Een titel, optie of item zonder leesteken is één zin. Deze afkortingen breken geen zin: `bijv.`, `bv.`, `o.a.`, `d.w.z.`, `enz.`, `ca.`, `m.`, `cm.`. Getallen zoals `1,5` of `3.2` ook niet.

### Trackers

De lijst staat in `tools/content/trackers.mjs`: o.a. `doubleclick.net`, `google-analytics.com`, `googletagmanager.com`, `facebook.com/tr`, `bit.ly`, `t.co`, `tinyurl.com` (ook subdomeinen), en de parameters `utm_*`, `fbclid`, `gclid`, `mc_eid`.

## Wat een script niet kan zien

De checks zijn een vangnet. Of een lege `sourceRefs` terecht is, of een bron de bewering echt dekt, of een vakterm in de tekst wordt uitgelegd en of de les klopt voor een kind: dat beoordeelt de reviewer.
