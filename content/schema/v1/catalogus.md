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
- `content/courses/roofvissen/` is de eerste echte cursus ("Roofvissen met kunstaas", les 1 `aanbeet-of-vastzitten`). Sinds de merge van M13 liggen zijn id's vast (zie "Nooit wijzigen"). Het voorbeeld van `course.json` hieronder is dezelfde cursus, ingekort; de bron en de geplande les in het voorbeeld zijn ter illustratie, de echte staan in het bestand.
- Elk bestand begint met `"schemaVersion": 1`.
- `npm run content:build` zet alles klaar in `web/public/content/` (niet in git): `manifest.json`, `<cursus-id>/course.json`, `<cursus-id>/lessons/<les-id>.json` en de gebruikte afbeeldingen. In de uitvoer heet een lesbestand naar het les-id, niet naar het nummer, zodat een adres nooit verandert als de volgorde wijzigt. Het manifest noemt per cursus elke gebruikte afbeelding met de hash van de bytes (`assets`), zodat de app een gewijzigde svg nooit uit de cache van de browser haalt. Bij elke gepubliceerde les staan ook de stap-id's (`stepIds`, in de volgorde van de les); daarmee weten de startpagina en het cursusoverzicht wanneer een les klaar is, zonder elk lesbestand op te halen.
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
- `access` (optioneel): voor wie de cursus is.
  - `all-children` (standaard als het veld ontbreekt): elk kind ziet de cursus.
  - `selected-children`: alleen de kinderen die de ouder op `/ouder` aanvinkt bij "Wie ziet welke cursus?". Welke kinderen dat zijn, staat in de app (PocketBase), nooit in de inhoud: zet geen namen of accounts van kinderen in `course.json`.
  - Een kind dat een cursus niet mag zien, krijgt hem niet op de startpagina en via een directe link de pagina "niet gevonden". De ouder ziet altijd alle cursussen.
  - `audience` gaat over niveau en toon ("Ouder en kind, beginners") en zegt niets over wie de cursus ziet.

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

De ouder ziet in het ouderoverzicht (`/ouder/<kind>`) per stap de `title` met wat het kind deed ("Quiz: 3 van 4 goed", "Aan het water: 2 van 4 afgevinkt", "Voel de lijn: 7 van 8 goed"). Geef quiz-, interactie- en praktijkstappen dus een titel die ook zonder de les duidelijk is. De quizscore telt per vraag het **laatste** antwoord met de huidige `version` van de les (zoals de quiz na herladen), en alleen opties die de vraag nu nog heeft.

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

- `figure.src` wijst naar een `.svg` in de map `assets/` van de cursus (of een submap), met alleen kleine letters, cijfers en streepjes in de namen (bijv. `assets/vissen/snoek.svg`), zonder `..` en zonder symlink. `alt` beschrijft wat je ziet en is nooit leeg. De svg laadt niets van buiten (alleen de XML-namespaces van w3.org mogen erin staan) en volgt de stijlgids `content/illustrations/README.md`: alleen kleuren uit `content/illustrations/palette.json` (of `currentColor`, `none`, `transparent`), geen verloop of doorzichtigheid, een `viewBox` (liefst 400 breed), geen code of ingepakte bestanden, labels van hoogstens 24 tekens met `font-family="Atkinson Hyperlegible, Verdana, sans-serif"`, en hoogstens 40 kB. Begin met een sjabloon uit `content/illustrations/templates/` en bekijk het resultaat met `npm run content:figures -- <cursus-id>` (png's in `tmp/figures/`).
- **Wanneer een `figure`:** bij elke uitleg van een plek, vorm, volgorde, vergelijking of beweging (de beeldlijst van `snuffel-leren`). `content-reviewer` keurt een les af die zoiets alleen in tekst uitlegt. Er is geen check die een afbeelding afdwingt. Alles wat in de tekening ertoe doet, staat ook in `alt`; `sourceRefs` zijn de bronnen van wat de tekening laat zien.

## Opmaak in tekst

In alle tekstvelden mag een kleine subset van Markdown, alleen binnen een regel:

| Schrijf                   | Je krijgt                                           |
| ------------------------- | --------------------------------------------------- |
| `**vet**`                 | **vet**                                             |
| `*cursief*`               | _cursief_                                           |
| `[label](https://…)`      | een link (alleen `https://`)                        |
| `[[aanslaan]]`            | de term, met de uitleg uit de `glossary` van de les |
| `[[aanslaan\|slaat aan]]` | dezelfde term, getoond als "slaat aan"              |
| `{{3/4}}`                 | een gestapelde breuk: 3 boven de streep, 4 eronder  |
| `{{1 1/4}}`               | een gemengd getal: 1 met de gestapelde breuk 1/4    |

- Geen HTML, koppen, lijsten of afbeeldingen in tekst.
- Een losse `*` (zoals in `3 * 4`) blijft gewoon tekst, net als `**` zonder sluiting.
- Elke `[[term]]` moet in de `glossary` van dezelfde les staan.
- In `course.json` mag geen `[[term]]` staan: een cursus heeft geen `glossary` (`course-term-not-allowed`). Schrijf de term daar als gewone tekst. Links in `course.json` (bijvoorbeeld in `goal` of `sources[].note`) worden net zo gecontroleerd als in een les.
- **Breuken** (sinds M14): `{{teller/noemer}}` of `{{geheel teller/noemer}}`.
  - Alleen hele getallen zonder voorloopnul (`0` mag als teller): geen komma of punt, geen letters, geen breuk in een breuk.
  - Geen spaties binnen de haken, behalve precies één tussen het gehele getal en de breuk (`{{1 1/4}}`); geen spaties rond `/`.
  - De noemer is nooit 0. In een gemengd getal is het gehele getal minstens 1 en de breuk echt (teller minstens 1 en kleiner dan de noemer): schrijf `{{2 1/4}}` of `{{9/4}}`, niet `{{1 5/4}}`. Een onechte breuk zonder geheel getal mag wel (`{{5/4}}`).
  - **Geen min binnen de haken:** een negatieve breuk is `−{{1/2}}` (het minteken als gewone tekst ervoor).
  - Een breuk mag in `**vet**` en `*cursief*` staan, niet in het label van een link of in `[[term|…]]` (dat is platte tekst). Binnen de haken geen andere opmaak.
  - De app toont de breuk gestapeld, in het font en de kleur van de tekst eromheen. Een schermlezer zegt hem in woorden: `{{1/5}}` "1 vijfde", `{{3/4}}` "3 vierde", `{{1/2}}` "1 half", `{{3/2}}` "3 halve", `{{1 1/4}}` "1 en 1 vierde", `{{3/1}}` "3 hele"; een ongewone noemer (bijv. 37) als "3 gedeeld door 37".
  - Op plekken waar de app platte tekst toont (titel van de pagina, startpagina, ouderoverzicht) staat de breuk met een schuine streep: `1/5`, `1 1/4`. Tijd en zinslengte tellen hem net als `1/5`.
  - **Een gewone `3/4` (zonder haken) blijft `3/4`**, met een schuine streep. Welke van de twee je gebruikt, volgt de notatie van de school (zie "Notatie").
  - `content:check` weigert elke `{{` of `}}` die geen geldige breuk vormt (`markup-fraction-invalid`), met wat er mis is en hoe het wel moet, en ook een losse `{` of `}` direct naast een breuk (`{{1/2}}}`, `{{{1/2}}`). In de app blijft zo'n ongeldige breuk gewone tekst, met haken en al.
  - Mag in elk tekstveld, ook in `course.json`. In `accepted` en `commonMistakes[].answer` schrijf je wat het kind typt (`3/5`), geen `{{…}}`.
- Alle gevallen staan in `inline-markup.cases.json`; de tools en de app worden daartegen getest.

## Notatie

Een les schrijft getallen, breuken en bewerkingen **zoals de school het doet**: volg de foto's van het werkboek (of wat Jop zegt als er geen foto's zijn). Kies per les en houd het de hele les gelijk, ook in hints, tussenstappen, feedback en uitwerkingen.

**Wat de app kan tonen:**

| Op de foto                                  | Schrijf                                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| een breuk boven elkaar (teller over noemer) | `{{3/4}}`, een gemengd getal `{{1 1/4}}`                                                               |
| een breuk met een schuine streep            | `3/4`, `1 1/4`                                                                                         |
| een kommagetal met een komma of een punt    | `0,75` of `0.75`, zoals op de foto                                                                     |
| delen met `:` of `÷`                        | `12 : 4` of `12 ÷ 4`                                                                                   |
| keer met `×` of `·`                         | `3 × 4` of `3 · 4`; **nooit `*`** (dat is opmaak: `3*4*5` wordt cursief)                               |
| een tussenstap of uitwerking                | als zin ("{{1/2}} is hetzelfde als {{2/4}}.") of als `=`-reeks ("{{1/2}} = {{2/4}}"), zoals op de foto |

**Wat de app (nog) niet kan tonen:** een staartdeling, een macht, een wortel, een breuk in een breuk, cijfers onder elkaar (optellen of vermenigvuldigen in kolommen). Schrijf zo'n opgave **niet** met een benadering (zoals `2^3` of "de wortel uit 9"): het kind ziet dan iets anders dan in het boek. Het is een **ontbrekende notatie**, net als een ontbrekende interactiesoort: meld het (wat, bij welk soort opgave) met een voorstel voor een kleine mijlpaal via `schema-wijzigen`.

## Startpagina en cursusoverzicht

Na het inloggen opent de **startpagina** (`/`): Ted zegt "Hoi, <naam>!" en daaronder staat per cursus een kaart, in twee groepen: "Leertrajecten" (`kind: course`) en "Huiswerk oefenen" (`kind: practice`), elk op titel. Een kaart toont de `title`, een voortgangsbalk en "<klaar> van <totaal> lessen klaar" (of "Alle lessen klaar!"); `totaal` telt **alle** lessen in `lessons`, ook de geplande. Een tik op de kaart opent het **cursusoverzicht** (`/leren/<cursus-id>`).

Het overzicht toont uit `course.json`: de `title`, Ted (blij) met `ted.greeting`, bij `practice` een regel met `subject` · `schoolLevel` · `chapter`, "Doel: `goal`" en "Gelukt als: `successCriterion`". Daaronder de balk, een knop naar de eerste gepubliceerde les die nog niet klaar is ("Begin met: …" of "Verder met: …"; alles klaar: Ted stoer met "Alles klaar! Goed gesnuffeld.") en alle lessen **in de volgorde van `lessons`**, genummerd, met "Ongeveer `estimatedMinutes` minuten" en een label:

| Label                                   | Wanneer                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| "Klaar ✓"                               | elke stap die de les **nu** heeft, is klaar (welke `version` er toen ook was) |
| "Bezig: <n> van <totaal> stappen klaar" | minstens één stap is begonnen of klaar, maar niet alle                        |
| "Nieuw"                                 | nog geen enkele stap van de les begonnen                                      |
| "Komt nog"                              | de les is `planned` (geen link)                                               |

Alleen de stappen die de les nu heeft tellen; voortgang van een stap of les die niet meer bestaat, telt niet. Let op: **voeg je een stap toe aan een gepubliceerde les, dan staat hij voor iedereen die hem af had weer op "Bezig"** (met één stap te gaan). Maak voor nieuwe stof liever een nieuwe les.

## Zo toont de app een les

Een les staat in de app op `/leren/<cursus-id>/<les-id>`, voor wie ingelogd is (kind en ouder). Het is één doorlopende pagina; `#stap-<stap-id>` achter het adres opent hem bij die stap.

- **Kop:** een link "Naar de lessen" (naar het overzicht van de cursus), de `sticker`, "Ongeveer `estimatedMinutes` minuten", de `title` (het laatste woord op een paarse band), Ted (`ted.intro.mood`) met `ted.intro.text` in een ballon, en het `objective` op een papieren kader.
- **Stappen-navigatie:** een genummerd rondje per stap met een kort label: `explain` "Uitleg", `trace-game` "Spel", `stepped-exercise` "Oefenen", `typing-drill` "Typen", `quiz` "Quiz", `at-the-water` "Aan het water", `do-it-yourself` "Zelf doen". Een tik springt naar de stap.
- **Stap:** de `title` als kop met een roze rondje met het nummer.
- **Blokken:** `text` is een alinea; `example` staat in een kaart; `signal-cards` zijn kaarten met het icoon, de titel en de tekst; `rule` is een roze blok met de titel groot; `tip` is een kaart met de titel (zonder titel: "Tip"); `figure` is de afbeelding met het onderschrift eronder; `ted-says` is een kleine Ted in de gekozen stemming met een ballon.
- **Bronnen:** onder elk blok en elke kaart met `sourceRefs` staat "Bron:" met per bron de uitgever als link. Een blok zonder bronnen toont niets. Bij quizvragen, praktijkpunten en de interactiestap toont de app (nog) geen bronnen.
- **Vaktermen:** een `[[term]]` is een woord met een stippellijn eronder. Tikken toont de `definition` uit de `glossary` direct onder de term; nog eens tikken of Escape sluit hem. Onderaan de les staat de woordenlijst met alle termen op alfabet.
- **Links:** elke link naar buiten opent in een nieuw tabblad. Alleen `https://` wordt een link.
- **Afbeeldingen:** een `figure` staat op een vaste lichte achtergrond, ook in de donkere modus, want een svg in een afbeelding volgt de kleuren van de app niet. Teken dus met de kleuren van het palet (die zijn gemaakt voor die lichte kaart) en zwarte lijnen; `currentColor` wordt zwart. De kaart is zo breed als de les; een tekening van 400 breed schaalt mee.
- **Einde:** Ted (blij) met `ted.finished`, dan "Woordenlijst", "Verder lezen" (titel van de bron als link, de uitgever en `why`) en "Vragen" (elke vraag met het antwoord eronder). Een lege lijst geeft geen kopje.
- **Quiz:** alle vragen onder elkaar, genummerd, met de opties als knoppen in een **gehusselde volgorde** (elke ronde anders). Per ronde mag een vraag **één keer** beantwoord worden: na een tik gaan de opties dicht, de gekozen optie wordt groen (goed) of rood (fout) met "Jouw antwoord" erbij, en bij een fout antwoord wordt ook de goede optie groen met "Goede antwoord". Daaronder staat een kleine Ted (blij bij goed, geschrokken bij fout) met een willekeurige regel uit `ted.correct` of `ted.incorrect`, en de `feedback` van de **gekozen** optie. Schrijf dus bij elke optie een `feedback` die zonder de andere opties te begrijpen is. `hints` verschijnen alleen op verzoek, één voor één ("Hint", "Nog een hint"), zolang de vraag open is; hoeveel hints iemand vroeg, wordt bewaard. Na de laatste vraag: "<goed> van <totaal> goed." met Ted (stoer met een regel uit `ted.correct` als alles goed is, anders blij met "Lees de uitleg bij de rode vragen nog eens.") en een knop "Opnieuw" voor een nieuwe ronde.
- **Praktijk:** een plakbriefje met per `item` een vinkje; de hele regel is het tikvlak, een link in een item staat ernaast (een tik op de link vinkt niets aan). `successCriterion` staat vet onder de lijst, zonder vinkje. Vinkjes worden bewaard, per kind.
- **Wanneer een stap klaar is** (een gevuld rondje in de stappen-navigatie): een `explain`-stap als het einde van de stap een seconde in beeld is geweest (lezen tot het eind; wie met de navigatie over de uitleg heen springt, heeft hem niet gelezen); een `quiz` als elke vraag beantwoord is, goed of fout; een `practice`-stap als alle items aangevinkt zijn; een `trace-game` als een spel **uitgespeeld** is (alle rondes, welke score ook); een `stepped-exercise` als een reeks **afgerond** is ("Klaar" na de laatste opgave, welke score ook); een `typing-drill` als een oefening **afgerond** is (alle regels getypt, welke score ook). Een stap die klaar is, blijft klaar, ook als je daarna een vinkje weghaalt. Een les openen bewaart niets.
- **`version` en bewaarde antwoorden:** bij elk antwoord bewaart de app de `version` van de les. Na herladen toont de quiz alleen antwoorden met dezelfde `version` als de les nu. Verander je een quizvraag of een optie zonder `version` op te hogen, dan ziet een kind zijn oude antwoord bij een veranderde vraag. Daarom moet `version` omhoog bij elke wijziging (`content:check` dwingt dat af).
- **Spel:** zie `trace-game` hieronder. Elk uitgespeeld spel wordt bewaard (score, aantal rondes en per ronde patroon en keuze); na herladen staat onder het spel "Vorige keer: <goed> van <totaal> goed." (alleen met dezelfde `version`). Een half gespeeld spel wordt niet onthouden.
- **Oefening:** zie `stepped-exercise` hieronder. Elke afgeronde reeks wordt bewaard; na herladen staat eronder "Vorige keer: <zelf goed> van <totaal> goed.". Een half gemaakte reeks wordt niet onthouden.
- **Typoefening:** zie `typing-drill` hieronder. Elke afgeronde oefening wordt bewaard (goede en alle aanslagen, snelheid en de vaakst foute toetsen, nooit de getypte tekst); na herladen staat eronder "Vorige keer: <n>% goed.". Een half getypte oefening wordt niet onthouden.
- **Wat nog komt:** bronnen bij een quizvraag, een praktijkpunt of een interactiestap toont de app (nog) niet.

## Interacties

Een interactie is data voor een bestaand onderdeel van de app. Alleen deze drie soorten bestaan; een nieuwe soort vraagt code (skill `spelcomponent-bouwen`). Een `trace-game` of `stepped-exercise` telt **2 minuten** in de berekende tijd, een `typing-drill` 1 minuut plus 1 minuut per 60 tekens.

### `trace-game` (het voel-spel)

Een lijn die over de tijd getekend wordt, met een buigende hengeltop. Het kind kiest wat het "voelt". Bij "beweging beperken" staat de lijn meteen helemaal getekend.

**Wanneer past het:** als het kind een signaal moet leren herkennen dat over de tijd verloopt (een beet, een trilling, een ritme) en de verschillen tussen een paar soorten wil leren voelen. Niet voor iets dat je in één beeld kunt laten zien; dan is een `figure` of een quizvraag beter.

**Zo werkt het in de app:**

- Een donker paneel "Voel-spel" met "<rounds> rondes", een scherm met water, een gele lijn en een roze hengel, en de keuzes als gekleurde knoppen in twee kolommen. De knoppen zijn dicht tot er een lijn getekend is.
- "Start" maakt de rondes: elk patroon minstens één keer (als er genoeg rondes zijn), de rest willekeurig maar nooit een patroon twee keer vaker dan een ander, gehusseld, en nooit twee keer hetzelfde patroon achter elkaar als dat kan. Met minder rondes dan patronen komen er verschillende, willekeurige patronen.
- Per ronde tekent de lijn zich in `durationMs` en buigt de hengeltop mee; Ted denkt na: "Voel mee… wat gebeurt er aan je lijn?". Daarna gaan de keuzes open ("Wat was het?") en kan het kind "Bekijk nog eens" kiezen.
- Goed: Ted blij met een willekeurige regel uit `ted.correct` en de `explanation` van het patroon, en er komt een visje bij in de vangst. Fout: Ted geschrokken met een regel uit `ted.incorrect`, "Het was: <label van het goede antwoord>." en de `explanation`. De gekozen knop krijgt een rand en "Jouw keuze".
- Na de laatste ronde: "<goed> van <totaal> goed." met Ted stoer en "Jij voelt het verschil al!" bij hooguit één fout, anders Ted blij met "Speel nog een keer, dan voel je het verschil steeds beter.", en een knop "Nog een potje". Deze teksten zijn vast in de app; de config heeft geen eigen Ted-teksten. Schrijf `ted.correct` en `ted.incorrect` dus zo dat ze ook bij het spel passen.

| Veld         | Wat                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `choices`    | 2 tot 6 keuzes: `id`, `label`, `color` (een tokennaam: `yellow`, `pink`, `purple`, `blue`, `green`, `orange`; nooit een kleurwaarde) |
| `patterns`   | minstens 2 patronen: `id`, `answer` (het id van een keuze), `shape` (bouwstenen), `explanation`                                      |
| `rounds`     | aantal rondes, 1 tot 12                                                                                                              |
| `durationMs` | hoe lang het tekenen van één lijn duurt, 1000 tot 10000                                                                              |

De lijn is de som van de bouwstenen op tijdstip `t`. Tijd en hoogte lopen van 0 tot 1; de rustlijn ligt meestal rond 0,22. Wat boven 1,27 of onder −0,09 uitkomt, valt buiten het scherm (de lijn zakt nooit in het water).

| Bouwsteen | Velden                                                                          | Wat                                                                                                                                                                                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`    | `level`                                                                         | vaste hoogte: `level`                                                                                                                                                                                                                                                                                                                          |
| `pulse`   | `at`, `width`, `height`                                                         | één piek (een klokvorm) op tijdstip `at`: `height · e^(−(t − at)² / (2 · width²))`; `width` is de standaardafwijking, dus de piek is ongeveer `4 · width` breed                                                                                                                                                                                |
| `pulses`  | `start`, `interval`, `count`, `width`, `height`                                 | `count` pieken zoals `pulse`, op `start`, `start + interval`, …                                                                                                                                                                                                                                                                                |
| `ramp`    | `from`, `to`, `height`                                                          | vloeiend van 0 naar `height` tussen `from` en `to` (smoothstep: `height · s² · (3 − 2s)` met `s = (t − from) / (to − from)`); daarna blijft hij op `height`                                                                                                                                                                                    |
| `wobble`  | `amplitude`, `frequency`; mogen: `from`, `to`, `phase`, `fadeIn` (alle 0 tot 1) | trillen: `amplitude · sin(2π · (frequency · t + phase))`, alleen tussen `from` en `to` (standaard 0 en 1). `frequency` is het aantal golven over de hele lijn (tot 100); `phase` schuift de golf een deel van een golf op; met `fadeIn` groeit het trillen na `from` vloeiend aan (zoals `ramp`) en is het na `from + fadeIn` op volle sterkte |

Zo is "zwaar met schudden" (de `zwaar` uit de proefles) gebouwd: eerst rustig, dan in korte tijd zwaar, en vanaf dat moment groeit een onregelmatig schudden aan (drie trillingen door elkaar):

```json
[
  { "type": "base", "level": 0.22 },
  { "type": "ramp", "from": 0.32, "to": 0.4, "height": 0.42 },
  {
    "type": "wobble",
    "amplitude": 0.085,
    "frequency": 6.6845,
    "phase": 0.0908,
    "from": 0.32,
    "fadeIn": 0.08
  },
  {
    "type": "wobble",
    "amplitude": 0.085,
    "frequency": 10.8225,
    "phase": 0.9092,
    "from": 0.32,
    "fadeIn": 0.08
  },
  { "type": "wobble", "amplitude": 0.05, "frequency": 14.3239, "from": 0.32, "fadeIn": 0.08 }
]
```

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

**Valkuilen:**

- **Patronen die op elkaar lijken.** Als twee patronen met een ander antwoord bijna dezelfde lijn geven, is het spel gokken. Maak het verschil zichtbaar in vorm (één tik tegenover regelmatige tikjes, zwaar en schudden tegenover zwaar en vlak), niet alleen in kleine getallen.
- **Te korte `durationMs`.** Onder de 2500 ms is een lijn nauwelijks te volgen; 3000 tot 4000 ms werkt goed. Langer dan 5000 ms wordt saai bij 8 rondes.
- **Te veel of te weinig rondes.** Neem minstens zoveel rondes als patronen, zodat elk patroon langskomt; 8 tot 10 is genoeg.
- **`version` omhoog bij een gewijzigd patroon.** Bewaarde scores horen bij één `version`; verander je een patroon, een keuze of het aantal rondes, hoog dan `version` op (`content:check` dwingt dat af), anders klopt "Vorige keer" niet meer met het spel.
- **Een kleur twee keer.** Elke keuze een eigen `color`; de knoppen hebben ook hun tekst, maar twee gelijke kleuren verwarren.

### `stepped-exercise` (huiswerk-oefenles)

Opgaven met een eigen antwoord van het kind, oplopende hints, tussenstappen die het kind zelf opent, herkende foute antwoorden met gerichte uitleg, en een uitwerking die pas verschijnt na een eigen poging én alle hints. Werkt in de app sinds M10.

**Wanneer past het:** bij huiswerk en oefenen, als elke opgave **één eigen antwoord** heeft dat de app kan controleren: een getal (`number`), een kort antwoord in woorden of een breuk (`text`), of een keuze uit een paar opties (`choice`). Niet voor open vragen, een uitleg in eigen woorden of iets met meer goede antwoorden dan je in `accepted` kunt zetten; daarvoor is een `practice`-stap (`do-it-yourself`) of een quizvraag beter.

**Zo werkt het in de app:**

- Een licht kaartje (zoals de quiz, geen donker paneel) met de opgaven **één voor één**: "Opgave <n> van <totaal>", de `prompt` groot, en een invoervak met "Controleer" (Enter werkt ook). Heeft het antwoord een `unit`, dan staat die achter het vak. Bij `choice` zijn de opties knoppen in een gehusselde volgorde (elke reeks anders); een tik is het antwoord.
- **Onbeperkt proberen.** Goed: Ted blij met een regel uit `ted.correct`, het vak gaat dicht. Een herkende fout (`commonMistakes`): Ted nadenkend met de `feedback` van die fout. Een andere fout: Ted geschrokken met een regel uit `ted.incorrect` en "Probeer het nog eens, of vraag een hint.". Bij `choice` gaat een fout gekozen optie dicht met "Jouw antwoord".
- **Zo lees ik jouw antwoord.** Gebruikt de oefening de gestapelde notatie (in minstens één tekst van een van haar opgaven staat een geldige `{{…}}`: opgave, hints, tussenstappen, feedback, uitwerking of keuzeopties), dan staat onder het invoervak, zodra wat het kind typt een breuk is, "Zo lees ik jouw antwoord:" met die breuk gestapeld, precies zoals de app hem leest: `3/5`, `3 / 5`, `1 1/4` (een gemengd getal) of `11/4` (elf vierde); bij `number` zonder de `unit` en met een min (`-1/2`). Bij een kommagetal, woorden, een leeg vak of iets onleesbaars staat er niets; niet bij `choice`. Een schermlezer leest de regel bij het invoervak ("Zo lees ik jouw antwoord: 3 vijfde"), maar niet bij elke toets. De regel blijft staan als het antwoord goed is. Goed of fout rekenen verandert er niet door.
- **Leeg of onleesbaar telt niet** als poging: "Vul eerst een antwoord in." of (bij `number`) "Dat kan ik niet lezen als getal. Schrijf bijvoorbeeld 0,75 of 3/4.".
- **Hints** op verzoek, één voor één ("Hint", "Nog een hint"). **Tussenstappen** zijn knoppen met de `title`; een tik klapt de `text` open en weer dicht, ook al vóór een poging.
- **De uitwerking** ("Bekijk de uitwerking", daarna de `workedSolution` in een kader "Uitwerking") komt pas na **minstens één leesbare poging én alle hints** (zonder hints: na één poging), of meteen na een goed antwoord. Tot dan staat er: "De uitwerking kun je zien als je het zelf geprobeerd hebt en alle hints hebt bekeken.".
- Een opgave is **afgerond** als hij goed is of als de uitwerking open is; dan komt "Volgende opgave" (na de laatste "Klaar"). Na de uitwerking mag het kind nog antwoorden, maar dan telt de opgave niet meer als "zelf goed".
- Na de laatste opgave: "<zelf goed> van <totaal> zelf goed." met Ted stoer en een regel uit `ted.correct` als alles zelf goed was, anders Ted blij met "Kijk de uitwerkingen nog eens rustig na. Morgen gaat het nog beter.", en "Nog een keer" voor een nieuwe reeks. Deze teksten zijn vast in de app.

**Hoe antwoorden vergeleken worden** (app en `content:check` op precies dezelfde manier; de gevallen staan in `content/schema/v1/answer-matching.cases.json`):

- **`number`:** wat het kind typt wordt gelezen als getal: spaties eromheen tellen niet; komma **of** punt als decimaalteken (`0,75`, `0.75`); een min (`-` of `−`); een breuk (`3/4`, ook `3 / 4`) of een gemengd getal (`1 1/4`). Er is **geen duizendtallen-scheiding**: `1.000` is één. Een `unit` mag het kind erachter typen (`0,75 liter`, hoofdletters tellen niet); een andere eenheid, letters, twee decimaaltekens of `/0` is onleesbaar. Goed als het getal hoogstens `tolerance` van `value` ligt (de grens telt mee, plus een heel kleine marge tegen afrondingsfouten van de computer).
- **`text`:** het antwoord en elke vorm in `accepted` worden eerst gelijk gemaakt: opmaak weg, spaties aan begin en eind weg, meer spaties worden één, geen spaties rond `/` (`5 / 6` = `5/6`), hoofdletters tellen niet, gekrulde aanhalingstekens en apostrofs tellen als rechte, één punt aan het eind telt niet. Ook opmaak die het kind zelf typt telt niet (`*3/5*` is `3/5`). **Accenten tellen wel** (`café` is niet `cafe`), en typefouten worden niet goed gerekend: wat goed is, staat in `accepted`.
- **`choice`:** goed als het kind `correctOptionId` kiest.
- **`commonMistakes`:** eerst wordt "goed" gecontroleerd, daarna geeft de eerste passende fout zijn `feedback`. Bij `number` wordt `answer` gelezen als getal en past hij als het getal van het kind er binnen dezelfde `tolerance` bij ligt (`2/6` herkent dus ook `1/3`); bij `text` na dezelfde gelijkmaking als `accepted`; bij `choice` is `answer` het **id van een optie** (niet de tekst).
- `content:check` meldt een fout antwoord dat als goed zou tellen (`exercise-mistake-accepted`), een fout antwoord bij `number` dat geen getal is (`exercise-mistake-unreadable`) en een fout antwoord bij `choice` dat geen optie-id is (`interaction-answer-unknown`).

| Veld per opgave  | Wat                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `prompt`   | id en de opgave                                                                                                                                                                 |
| `answer`         | `{ "type": "number", "value", "tolerance", "unit" (mag) }`, `{ "type": "text", "accepted": [...] }` of `{ "type": "choice", "options": [{ "id", "text" }], "correctOptionId" }` |
| `hints`          | oplopende hints, één voor één te openen                                                                                                                                         |
| `steps`          | tussenstappen: `id`, `title`, `text`                                                                                                                                            |
| `commonMistakes` | `answer` (een fout antwoord zoals een kind het typt, dus `3/5` en geen `{{…}}`; bij `choice` het id van een optie) en `feedback`                                                |
| `workedSolution` | de uitwerking                                                                                                                                                                   |

Hoogstens **10 opgaven** per oefening (`maxItems`); 4 tot 6 is voor een les van 10 minuten meestal genoeg. `hints` en `steps` mogen leeg zijn.

**Wat er bewaard wordt:** één resultaat per **afgeronde reeks** (alle opgaven afgerond en "Klaar" getikt; een half gemaakte reeks wordt niet onthouden): `score` is het aantal opgaven dat het kind **zelf goed** had (vóór de uitwerking), `total` het aantal opgaven, en per opgave het id, of hij zelf goed was, het aantal pogingen, getoonde hints, geopende tussenstappen en of de uitwerking open is geweest. Wat het kind typte wordt niet bewaard. De oefenstap is klaar na een afgeronde reeks; na herladen begint de reeks opnieuw, met "Vorige keer: <score> van <totaal> goed." eronder (alleen met dezelfde `version`).

Voorbeeld (uit `content/fixtures/courses/proefhuiswerk/`, ingekort):

```json
{
  "id": "breuken",
  "kind": "stepped-exercise",
  "config": {
    "exercises": [
      {
        "id": "gelijke-noemers",
        "prompt": "Hoeveel is {{1/5}} + {{2/5}}?",
        "answer": { "type": "text", "accepted": ["3/5", "drie vijfde"] },
        "hints": [
          "Kijk naar de noemers. Zijn ze gelijk?",
          "De noemers zijn gelijk. Tel alleen de tellers op."
        ],
        "steps": [
          {
            "id": "noemer-blijft",
            "title": "Wat doe je met de noemer?",
            "text": "De noemer zegt in hoeveel stukken de pizza is verdeeld. Dat verandert niet als je stukken bij elkaar legt."
          }
        ],
        "commonMistakes": [
          {
            "answer": "3/10",
            "feedback": "Je telde de noemers ook op. Dat mag niet: de pizza blijft in vijf stukken verdeeld."
          }
        ],
        "workedSolution": "De noemers zijn gelijk: allebei 5. Tel de tellers op: 1 + 2 = 3. De noemer blijft 5. Het antwoord is {{3/5}}."
      },
      {
        "id": "recept",
        "prompt": "Voor een saus doe je {{1/2}} liter melk en {{1/4}} liter room in een pan. Hoeveel liter is dat samen? Een kommagetal of een breuk mag allebei.",
        "answer": { "type": "number", "value": 0.75, "tolerance": 0.01, "unit": "liter" },
        "hints": ["Maak eerst van {{1/2}} liter een aantal kwarten."],
        "steps": [],
        "commonMistakes": [
          { "answer": "0,5", "feedback": "Je vergat de room. Tel de melk en de room allebei mee." }
        ],
        "workedSolution": "{{1/2}} liter is {{2/4}} liter. Samen is dat {{3/4}} liter, en dat is 0,75 liter."
      },
      {
        "id": "kies-de-som",
        "prompt": "Welke som is samen {{3/4}}?",
        "answer": {
          "type": "choice",
          "options": [
            { "id": "half-en-kwart", "text": "{{1/2}} + {{1/4}}" },
            { "id": "los-opgeteld", "text": "{{1/1}} + {{2/3}}" },
            { "id": "twee-kwart", "text": "{{1/4}} + {{1/4}}" }
          ],
          "correctOptionId": "half-en-kwart"
        },
        "hints": ["Reken elke som uit in kwarten, of kijk of hij groter is dan een hele."],
        "steps": [],
        "commonMistakes": [
          {
            "answer": "los-opgeteld",
            "feedback": "Tel je de tellers en de noemers los op, dan krijg je {{3/4}}. Maar {{1/1}} is al een hele pizza."
          }
        ],
        "workedSolution": "{{1/2}} + {{1/4}} = {{2/4}} + {{1/4}} = {{3/4}}."
      }
    ]
  }
}
```

**Valkuilen:**

- **Een tussenstap of hint die het antwoord voorzegt.** Tussenstappen zijn altijd te openen, ook vóór een poging; zet het eindantwoord er dus niet in. De laatste hint mag dichtbij komen, het antwoord zelf staat alleen in de `workedSolution`.
- **`{{…}}` in `accepted` of `commonMistakes[].answer`.** Daar staat wat het kind typt (`3/5`), geen `{{3/5}}`. Een geldige `{{3/5}}` werkt wel (hij wordt `3/5`), maar is verwarrend.
- **Te weinig vormen in `accepted`.** Het kind typt wat het denkt: `5/6`, `vijf zesde`, misschien `vijf-zesde`. Zet elke vorm die goed is in `accepted`; hoofdletters, spaties, een punt aan het eind en spaties rond `/` hoef je niet apart te noemen. Moet een breuk ook als kommagetal goed zijn, gebruik dan `number`.
- **`tolerance` 0 bij een afgerond antwoord.** Is het antwoord `1/3` en mag het kind `0,33` typen, zet dan `tolerance` op `0.01`; met 0 is alleen `1/3` zelf goed. Bij een getal dat precies is (`0,75`) mag `tolerance` 0 blijven.
- **Grote getallen met een punt.** `1.000` leest de app als één, niet als duizend. Vraag om grote getallen zonder punt ("schrijf het getal zonder punt"), of gebruik `text`.
- **Een `commonMistake` die eigenlijk goed is.** Ligt een fout antwoord binnen `tolerance` of is het een vorm uit `accepted`, dan zou het kind een "fout" krijgen voor een goed antwoord. `content:check` vangt dat (`exercise-mistake-accepted`).
- **`version` omhoog bij een gewijzigde opgave.** Bewaarde resultaten horen bij één `version`; verander je een opgave, een antwoord of het aantal opgaven, hoog dan `version` op (`content:check` dwingt dat af).

### `typing-drill` (blind typen)

Blind typen met tien vingers op een laptop of computer: het kind typt korte regels over, met een toetsenbord eronder dat laat zien welke toets en welke vinger aan de beurt is. Werkt in de app sinds M15.

**Wanneer past het:** om **blind typen** te leren en te oefenen op een echt toetsenbord: de thuisrij, nieuwe toetsen, hoofdletters en leestekens. Niet om spelling of woordjes te leren (daarvoor is `stepped-exercise` met een `text`-antwoord beter) en niet voor een les op een telefoon of tablet: zonder toetsenbord ziet een kind alleen een melding.

**Zo werkt het in de app:**

- **Begin:** een licht kaartje met "<n> regels", "Nieuw: g en h" (de `newKeys`, met een ster), Ted stoer met "Zet je vingers klaar en kijk naar het scherm, niet naar je handen." en een knop "Start".
- **Typen:** "Regel <n> van <totaal>", de regel groot, de volgende regel klein eronder ("Daarna: …"). Elk teken dat het kind typt is **één aanslag** op de plek van de cursor (het gele teken): goed wordt groen; fout wordt rood met een golvende streep en een `✗`, en de cursor gaat **gewoon door** (doortypen, het kind gaat niet terug). Een spatie staat er als een kleine `·`. Aan het eind van een regel komt vanzelf de volgende, zonder Enter. **Backspace, Delete, Enter, pijltjes, plakken en sneltoetsen** doen niets en tellen niet; Tab en Escape werken gewoon. Staat Caps Lock aan, dan staat er "Caps Lock staat aan". Klikt het kind ergens anders, dan staat er "Klik op de regel om verder te typen.". "Opnieuw beginnen" begint bij regel 1 en bewaart niets.
- **Toetsenbord en vingergids:** een Amerikaans QWERTY-toetsenbord (de indeling die in Nederland standaard is; US-International heeft dezelfde toetsen) op een vaste lichte achtergrond, ook in de donkere modus. Elke toets heeft de kleur van zijn vinger (links en rechts dezelfde kleur): pink roze, ringvinger oranje, middelvinger groen, wijsvinger geel, duim (spatiebalk) paars. De toets voor het volgende teken heeft een dikke paarse rand en springt iets omhoog (niet bij "beweging beperken"); bij een hoofdletter of een Shift-teken ook de Shift aan de **andere** hand. Nieuwe toetsen hebben een ster en een gestippelde rand. Eronder een legenda (de vinger die nu moet staat vet met "← nu") en de regel "Volgende toets: f, linkerwijsvinger" (bij een hoofdletter: "Volgende toets: Shift rechts + a, rechterpink en linkerpink"). Niets hangt af van de muis.
- **Klaar:** "Nauwkeurigheid: 92% goed (442 van 480 aanslagen)" (goede aanslagen van alle aanslagen, **naar beneden** afgerond: 100% alleen zonder fouten), "Snelheid: 85 aanslagen per minuut" en "Vaakst fout: f (3×), j (2×) en spatie (1×)" (hoogstens drie toetsen) of "Geen fouten!". Ted reageert op de `goals`: doel gehaald, Ted stoer met een regel uit `ted.correct` en "Doel gehaald: 90% goed."; niet gehaald, Ted nadenkend met een regel uit `ted.incorrect` en "Je doel is 90% goed. Typ rustig; snelheid komt vanzelf."; zonder `goals` Ted blij met een regel uit `ted.correct`. Daarna "Nog een keer". De stap is klaar na elke afgeronde oefening, **welke score ook**; de doelen veranderen alleen wat Ted zegt.
- **Snelheid** is het aantal **goede** aanslagen per minuut. De tijd loopt van de eerste tot de laatste aanslag (lezen vóór de eerste toets telt niet); een pauze tussen twee aanslagen telt hoogstens 5 seconden.
- **Telefoon of tablet zonder toetsenbord:** in plaats van de oefening staat Ted nadenkend met "Voor deze oefening heb je een toetsenbord nodig. Doe hem op een laptop of computer." Een laptop met aanraakscherm of een tablet met trackpad krijgt gewoon de oefening. Drukt iemand toch een echte toets in (een los toetsenbord), dan verschijnt de oefening.
- **Schermlezer:** het typvak heet "Typvak"; bij het begin van elke regel zegt de app "Regel 2 van 6: jjj fff", en aan het eind de uitslag. Niet bij elke aanslag. Het getekende toetsenbord is verborgen; de regel "Volgende toets: …" is het tekstalternatief.
- Alle teksten hierboven zijn vast in de app; de config heeft geen lestekst.

**Velden** (`typingDrillConfig`, voorbeeld uit de proefcursus typen):

```json
{
  "id": "thuisrij",
  "kind": "typing-drill",
  "config": {
    "lines": ["asdf jkl;", "fdsa ;lkj", "ff jj dd kk", "als las kas", "jas dak sla", "alfa kaal"],
    "newKeys": ["a", "s", "d", "f", "j", "k", "l", ";", "space"],
    "goals": { "accuracy": 90 }
  }
}
```

| Veld      | Wat                                                                                                                                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lines`   | 1 tot **12** regels, na elkaar in één oefening. Elke regel 1 tot **40** tekens, alleen tekens van het toetsenbord (`!` tot `~` en de spatie), niet beginnend of eindigend met een spatie en zonder twee spaties naast elkaar. Geen accenten (`é`, `ë`), geen `€`, geen tab of nieuwe regel.                  |
| `newKeys` | de toetsen die in deze les **nieuw** zijn (mag leeg, hoogstens 10, elk één keer): `a`–`z`, `0`–`9`, `` ` ``, `-`, `=`, `[`, `]`, `\`, `;`, `'`, `,`, `.`, `/`, `space`, `shift`. Een **toets**, geen teken: `A` is de toets `a` met `shift`, `:` is `;` met `shift`. Elke toets moet in een regel voorkomen. |
| `goals`   | mag; `{ "accuracy": 90 }` (heel getal 50–100, procent goed) en/of `{ "keysPerMinute": 60 }` (heel getal 10–300); minstens één van de twee.                                                                                                                                                                   |

De regels zijn wat het kind typt, geen lestekst: geen opmaak, geen `[[term]]`, en ze tellen niet als woorden in de leestijd.

**Toetsen en vingers** (standaard tien-vingersysteem; Shift altijd met de **andere** hand dan de letter: `A` is rechter-Shift, `L` linker-Shift):

| Vinger              | Toetsen                                                  |
| ------------------- | -------------------------------------------------------- |
| linkerpink          | `` ` `` `1` `q` `a` `z` en linker-Shift                  |
| linkerringvinger    | `2` `w` `s` `x`                                          |
| linkermiddelvinger  | `3` `e` `d` `c`                                          |
| linkerwijsvinger    | `4` `5` `r` `t` `f` `g` `v` `b`                          |
| rechterwijsvinger   | `6` `7` `y` `u` `h` `j` `n` `m`                          |
| rechtermiddelvinger | `8` `i` `k` `,`                                          |
| rechterringvinger   | `9` `o` `l` `.`                                          |
| rechterpink         | `0` `-` `=` `p` `[` `]` `\` `;` `'` `/` en rechter-Shift |
| duimen              | spatiebalk                                               |

De kaart staat in `content/schema/v1/typing-keyboard.cases.json`; app en `content:check` gebruiken dezelfde.

**Dode toetsen (belangrijk voor leestekenlessen):** op een US-International-toetsenbord (veel gebruikt in Nederland) zijn `'`, `"`, `` ` ``, `~` en `^` **dode toetsen**: het teken verschijnt pas na de volgende toets, en met een klinker wordt het één letter met een accent (`'` + `e` wordt `é`). Een spatie na de dode toets geeft het teken zelf; een letter die geen accent krijgt geeft beide tekens (`'` + `t` wordt `'t`). Daarom:

- zet een dode toets in een regel **nooit direct voor** een letter die hij samenstelt: `'` voor `a e i o u y c`, `"` voor `a e i o u y`, `` ` `` voor `a e i o u`, `~` voor `a o n`, `^` voor `a e i o u` (ook hoofdletters). `auto's`, `zo'n` en `'t` mogen; `'en`, `"oei"` en `l'Avenue` niet. Dat geldt ook **over de regelgrens**: de regels worden zonder Enter na elkaar getypt, dus eindigt een regel op `"` en begint de volgende met `a`, dan wordt het `ä`. `content:check` meldt het (`typing-dead-key-sequence`);
- laat de **laatste regel niet eindigen** op een dode toets: die verschijnt pas na nog een toets, dus de oefening blijft wachten. `content:check` meldt het (`typing-dead-key-at-end`);
- **Linux** (indeling "US international with dead keys") stelt meer samen dan Windows en macOS: `'` + `s` wordt `ś` en `'` + `n` wordt `ń`, dus `auto's` en `zo'n` gaan daar mis. `content:check` volgt Windows en macOS; zet in een les over `'` een tip voor wie op Linux typt;
- leg in een leestekenles uit dat je na `'` of `"` soms een spatie typt om het teken zelf te krijgen;
- geen accenten in regels: die vragen twee toetsen na elkaar en komen later, als een les ze nodig heeft.

**Wat er bewaard wordt** (één record in `interaction_results` per afgeronde oefening): `score` = goede aanslagen, `total` = alle aanslagen (precies het aantal tekens van alle regels), en `detail` = `{ "keysPerMinute", "durationMs", "mistakes": [{ "key", "count" }] }` met hoogstens 10 toetsen, de vaakst foute eerst. Een fout telt bij de toets die het kind **had moeten** indrukken. De getypte tekst wordt **nooit** bewaard. In `/ouder` staat "92% goed, 85 aanslagen per minuut", "Vaakst fout: f, j en spatie" en "3 keer gedaan".

**Tijd:** een `typing-drill`-stap telt 1 minuut plus 1 minuut per 60 tekens van alle regels samen (afgerond op één decimaal): een beginner typt ongeveer 60 aanslagen per minuut, plus een minuut voor start en uitslag. Een les van 10 minuten heeft dus ruimte voor ongeveer 300 tot 400 tekens typen met wat uitleg en een quiz.

**Valkuilen:**

- **Lange regels.** Typt het kind één teken te veel (twee spaties), dan schuift alles één plek en is de rest van de regel fout. Houd regels kort (rond 10 tot 25 tekens is prettig).
- **Te veel nieuwe toetsen per les.** 2 tot 4 nieuwe toetsen per les is genoeg; de rest van de regels herhaalt wat al geleerd is.
- **Regels met toetsen die nog niet geleerd zijn.** Gebruik alleen toetsen uit deze les en de lessen ervoor in de cursus. `content:check` ziet dat niet; de reviewer wel.
- **`newKeys` die geen regel gebruikt.** `content:check` meldt het (`typing-new-key-unused`); `shift` telt als gebruikt bij een hoofdletter of een Shift-teken.
- **Een dode toets voor een klinker** (`'en`): zie hierboven.
- **`version` omhoog bij een gewijzigde regel.** Bewaarde resultaten horen bij één `version`; verander je een regel of het aantal regels, hoog dan `version` op (`content:check` dwingt dat af).

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

| Code                          | Wanneer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `json-invalid`                | het bestand is geen geldige JSON (met regel en kolom)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `schema`                      | het bestand past niet bij het schema (ontbrekend of onbekend veld, verkeerde waarde, fout id)                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `course-file-missing`         | een cursusmap zonder `course.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `terms-file-missing`          | `content/terms.json` ontbreekt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `course-id-mismatch`          | het cursus-id is niet gelijk aan de mapnaam                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lesson-file-missing`         | een `published` les zonder bestand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `lesson-id-mismatch`          | het id in het lesbestand is anders dan in `course.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `lesson-file-orphan`          | een lesbestand dat niet als `published` les in `course.json` staat                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `id-duplicate`                | een id komt dubbel voor (zie "Id's"), met beide plekken                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `interaction-answer-unknown`  | een antwoord in een interactie (ook een fout antwoord bij `choice`) is geen keuze of optie                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `exercise-mistake-unreadable` | een fout antwoord bij een `number`-opgave is geen getal: de app herkent het nooit                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `exercise-mistake-accepted`   | een fout antwoord telt als goed (binnen `tolerance`, in `accepted` of de juiste optie)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `typing-new-key-unused`       | een toets in `newKeys` van een `typing-drill` komt in geen enkele regel voor (`shift` telt bij een hoofdletter of een Shift-teken)                                                                                                                                                                                                                                                                                                                                                                                    |
| `typing-dead-key-sequence`    | een regel van een `typing-drill` heeft een dode toets (`'`, `"`, `` ` ``, `~`, `^`) direct voor een letter die US-International samenstelt (`'e` wordt `é`), ook van het eind van een regel naar het begin van de volgende                                                                                                                                                                                                                                                                                            |
| `typing-dead-key-at-end`      | de laatste regel van een `typing-drill` eindigt op een dode toets (`'`, `"`, `` ` ``, `~`, `^`), die pas na nog een toets verschijnt                                                                                                                                                                                                                                                                                                                                                                                  |
| `source-ref-missing`          | een `sourceRef` (ook in `furtherReading`) staat niet in `sources`                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `source-only-low`             | een niet-lege `sourceRefs` met alleen `low`-bronnen                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `source-date-invalid`         | `accessedOn` is geen bestaande datum (bijv. `2026-02-30`)                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `source-date-future`          | `accessedOn` ligt na vandaag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `glossary-term-unknown`       | een `[[term]]` die niet in de `glossary` van de les staat                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `term-not-in-glossary`        | een vakterm uit `terms.json` staat in de tekst, maar niet in de `glossary`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `quiz-step-count`             | een leertrajectles zonder of met meer dan één quizstap (oefenles: meer dan één)                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `quiz-question-count`         | een quiz met minder dan 3 of meer dan 5 vragen                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `quiz-option-count`           | een vraag met minder dan 3 of meer dan 4 opties                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `quiz-correct-option-missing` | `correctOptionId` is geen van de opties                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `quiz-option-length`          | de langste optie is meer dan 1,5 × de kortste (in tekens, zonder opmaak en spaties eromheen)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `duration-out-of-range`       | de berekende tijd ligt niet tussen 8 en 12 minuten                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `duration-mismatch`           | `estimatedMinutes` ligt meer dan 2 minuten naast de berekende tijd                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `sentence-length`             | gemiddeld meer dan 15 woorden per zin                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `link-not-https`              | een link die niet met `https://` begint (ook `http:`, `javascript:`, `data:` en relatieve links)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `link-tracker`                | een link naar een tracker of linkverkorter, of met een trackingparameter                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `markup-html`                 | HTML in tekst                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `markup-fraction-invalid`     | een `{{` of `}}` die geen geldige breuk vormt (bijv. `{{1/0}}`, `{{1,5/2}}`, `{{-1/2}}`)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `course-term-not-allowed`     | een `[[term]]` in `course.json` (een cursus heeft geen `glossary`)                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `asset-path-invalid`          | `figure.src` is geen `.svg` onder `assets/`, bevat `..`, of is (of ligt in) een symlink                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `asset-missing`               | de afbeelding bestaat niet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `asset-external-ref`          | de svg verwijst naar een andere site                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `asset-color-off-palette`     | een kleur in de svg (`fill`, `stroke`, `stop-color`, `color`, ook in `style`) staat niet in `content/illustrations/palette.json`, of de svg heeft een verloop, een filter, `mix-blend-mode` of doorzichtigheid tussen 0 en 1                                                                                                                                                                                                                                                                                          |
| `asset-unsafe-content`        | de svg bevat een element dat geen tekenelement is (zie de stijlgids: o.a. `<script>`, `<foreignObject>`, `<image>`, `<a>`, HTML), een element met een voorvoegsel of een andere `xmlns` dan SVG en xlink, een `<!DOCTYPE>`, een `<?xml-stylesheet?>`, een `on…`-attribuut, `src`, `srcset`, `poster` of `xml:base`, `javascript:`, `data:`, een `href` of `url(…)` naar een ander bestand, `@import`, `@font-face`, `\`, `image-set()`, `image()` of `src()` in CSS, of animatie (`<set>`, `<animate…>`, `<discard>`) |
| `asset-viewbox-missing`       | de svg heeft geen geldige `viewBox` (vier getallen, breedte en hoogte groter dan 0)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `asset-text-invalid`          | een `<text>` is langer dan 24 tekens, heeft geen `font-family`, of een ander font of gewicht dan `Atkinson Hyperlegible, Verdana, sans-serif` met 400 of 700                                                                                                                                                                                                                                                                                                                                                          |
| `asset-too-large`             | de svg is groter dan 40 kB                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `asset-unused`                | **waarschuwing**, geen fout: een svg in `assets/` die geen les gebruikt                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `figure-alt-missing`          | `alt` is leeg of alleen spaties                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `id-removed`                  | een gepubliceerd id (cursus, les, stap, vraag, optie, interactie, item) is weg                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `id-moved`                    | een gepubliceerd id staat onder een andere ouder, of is hergebruikt voor iets anders                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `lesson-unpublished`          | een les die op `main` `published` is, is dat niet meer                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `version-not-bumped`          | een gepubliceerde les is gewijzigd zonder hogere `version` (of `version` is lager)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `base-not-found`              | de ref van `--base` bestaat niet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Hoe de tijd wordt berekend

`woorden / 130` + 2 minuten per interactiestap (een `typing-drill`: 1 minuut + 1 minuut per 60 tekens van alle regels samen, afgerond op één decimaal) + 1 minuut per quizvraag, afgerond op één decimaal.

Woorden tellen in de tekst die een kind sowieso leest: `objective`, Teds intro, de titels van stappen en blokken, alle bloktekst en kaarten (ook het onderschrift van een afbeelding), de intro van een quiz-, interactie- of practice-stap, vragen en opties, checklist-items en `successCriterion`. Feedback, hints, Teds reacties, de teksten binnen een interactie, de woordenlijst, de FAQ en "verder lezen" tellen niet mee. Opmaak en losse webadressen tellen niet als woorden.

### Hoe zinnen worden geteld

Over dezelfde tekst als bij de tijd. Een zin eindigt op `.`, `!`, `?` of `…` gevolgd door een spatie of het einde van de tekst (een aanhalingsteken of haakje erna mag). Een titel, optie of item zonder leesteken is één zin. Deze afkortingen breken geen zin: `bijv.`, `bv.`, `o.a.`, `d.w.z.`, `enz.`, `ca.`, `m.`, `cm.`. Getallen zoals `1,5` of `3.2` ook niet.

### Trackers

De lijst staat in `tools/content/trackers.mjs`: o.a. `doubleclick.net`, `google-analytics.com`, `googletagmanager.com`, `facebook.com/tr`, `bit.ly`, `t.co`, `tinyurl.com` (ook subdomeinen), en de parameters `utm_*`, `fbclid`, `gclid`, `mc_eid`.

## Wat een script niet kan zien

De checks zijn een vangnet. Of een lege `sourceRefs` terecht is, of een bron de bewering echt dekt, of een vakterm in de tekst wordt uitgelegd en of de les klopt voor een kind: dat beoordeelt de reviewer.
