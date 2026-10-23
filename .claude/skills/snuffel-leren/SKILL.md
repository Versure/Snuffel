---
name: snuffel-leren
description: Maakt van een korte wens van Jop een Snuffel-les (leertraject of huiswerk-oefenles) als alleen inhoud in content/ - intake, echte bronnen via source-researcher, leerpad, les schrijven volgens de catalogus, content:check, review door content-reviewer, eigen branch en pull request. Gebruik bij "/snuffel-leren <wens>", "nieuwe les", "maak een les over …", "leertraject", of "huiswerkhulp voor …". Met --voorbeeld een voorbeeldles als fixture, zonder branch of PR.
argument-hint: '<korte wens> [--voorbeeld]'
---

# Snuffel leren: een les maken

Argument: een korte wens in gewone taal, bijv. _"Ik wil dat mijn kind leert hoe je een snoek onthaakt."_ Met `--voorbeeld` achter de wens (`/snuffel-leren <wens> --voorbeeld`) draait de skill in de **voorbeeldmodus** (zie onderaan).

Je maakt **alleen inhoud**: bestanden onder `content/`. Geen app-code, geen schema, geen tools. Is er iets anders nodig, stop dan en zeg wat (zie "Grenzen"). De app roept nooit een AI-API of andere dienst aan; hints, uitleg en Ted-teksten zijn statische inhoud die jij nu schrijft.

## Vooraf

1. Lees `CLAUDE.md`, `content/schema/v1/catalogus.md` (bij twijfel het schema in `content/schema/v1/`) en `content/terms.json`.
2. Bekijk de bestaande cursussen in `content/courses/` en `content/fixtures/courses/`. Past de wens in een bestaande cursus, vul die dan aan in plaats van een dubbele te maken. Cursus-id's zijn uniek; les-id's zijn uniek over **alle** cursussen samen, ook de fixtures. Id's beginnend met `voorbeeld-` zijn alleen voor de voorbeeldmodus.
3. `git status`: de werkmap moet schoon zijn. Behalve in de voorbeeldmodus: `git switch main && git pull --ff-only`.
4. `node tools/check-node.mjs`; is Node te oud, gebruik de versie uit `.nvmrc`.

## 1. Intake

Stel alleen de vragen die de wens nog niet beantwoordt, **in één bericht, maximaal zes**:

- wie leert: kind, ouder of samen; leeftijd (alleen voor niveau en toon);
- waarom: waar komt de wens vandaan;
- wat kan diegene al: stel een paar korte controlevragen;
- wat is "gelukt": iets concreets en zichtbaars;
- hoeveel tijd per week;
- context: de vijver; bij huiswerk vak, niveau, methode en hoofdstuk.

Kies daarna `kind`: `course` (leertraject) of `practice` (huiswerk-oefenles; dan zijn `subject`, `schoolLevel`, `method` en `chapter` verplicht).

**Privacy van de kinderen:** namen, leeftijden van een bepaald kind, school, woonplaats of andere persoonsgegevens komen **nooit** in inhoud, commits, branchnamen of de PR. De intake bepaalt alleen niveau en toon (bijv. `"audience": "Kinderen vanaf 12, zelfstandig of samen met een ouder"`).

## 2. Bronnen eerst

Zet de agent `source-researcher` in met: onderwerp, doelgroep, het leerdoel (of het voorlopige leerpad) en de beweringen waar de les een bron voor nodig heeft; bij huiswerk ook vak, niveau, methode en hoofdstuk.

Controleer zijn lijst voor je verdergaat:

- minstens drie bronnen, elk echt geopend (bronnen onder "Niet geopend" tellen niet);
- elke `url` begint met `https://`, zonder trackingparameters;
- `type` en `reliability` volgens de tabel in de catalogus;
- geen bewering steunt alleen op `low`-bronnen.

Te weinig betrouwbare bronnen: **stop** en zeg Jop wat er ontbreekt. Verzin nooit een bron, en vul nooit iets aan uit je geheugen.

## 3. Leerpad

Maak een leerpad: lessen met elk **één nieuw begrip**, in volgorde van voorkennis, met per les het leerdoel ("Na deze les …"). Schrijf `course.json` (zie de catalogus) met alle lessen als `planned` en de bronnen van `source-researcher` onder `sources`.

Maak de branch vanaf `main`: `git switch -c content/<cursus-id>-<les-id>` (de eerste les die je gaat maken).

**Stop: Jop keurt het leerpad goed.** Laat het leerpad zien (lessen, begrip, leerdoel) met de bronnen in een tabel. Ga pas verder na zijn akkoord; past hij iets aan, verwerk het eerst.

## 4. Les maken

Bestand `content/courses/<cursus-id>/lessons/NN-<les-id>.json` (`NN` is het volgnummer in de cursus). Zet de les in `course.json` op `published` met `file` en begin met `"version": 1`. Regels:

- **Ongeveer 10 minuten:** `estimatedMinutes` volgens "Hoe de tijd wordt berekend" in de catalogus (8 tot 12, hoogstens 2 naast de berekende tijd).
- **Eén nieuw begrip** (`concept`), en een `objective` dat begint met "Na deze les …".
- **Eenvoudige taal:** korte zinnen, gemiddeld hoogstens 15 woorden per zin. Toon voor 12+, niet kinderachtig voor een volwassene.
- **Vaktermen:** elke vakterm in de `glossary` van de les en als `[[term]]` in de tekst, en ook in de tekst zelf uitgelegd.
- **Eerst een herkenbaar voorbeeld** (blok `example`), dan de uitleg.
- **Quiz:** één `quiz`-stap met 3 tot 5 vragen die het leerdoel toetsen; per vraag 3 of 4 opties die even aannemelijk en ongeveer even lang zijn (de langste hoogstens 1,5 × de kortste); feedback bij **elke** optie die uitlegt waarom; statische `hints` die het antwoord niet verklappen.
- **Praktijkopdracht:** een `practice`-stap (`at-the-water` of `do-it-yourself`) met een `successCriterion` dat begint met "Gelukt als …", concreet en zichtbaar.
- **Bronnen:** `sourceRefs` bij elke bewering (blok, kaart, quizvraag, checklist-item, interactiestap). Een lege lijst alleen bij tekst zonder feitelijke bewering.
- **Ted:** `ted.intro` (met `mood`), `ted.correct`, `ted.incorrect`, `ted.finished`; kort, in Teds toon (stoer, vrolijk, nooit betuttelend).
- **Interacties alleen uit de catalogus** (`trace-game`, `stepped-exercise`, of wat daar later bij komt).
- **Afbeeldingen:** alleen als een afbeelding iets uitlegt wat tekst niet goed kan. Maak dan zelf een eenvoudige svg in `assets/` van de cursus: alleen `currentColor`, niets van buiten, een `alt` die beschrijft wat je ziet. Geen foto's, geen afbeeldingen van internet.
- **Parafraseren, nooit kopiëren** uit een bron.
- **Nieuwe vaktermen** (met hun `forms`) voeg je toe aan `content/terms.json`, in dezelfde PR als de les, zodat de check ze daarna in elke les afdwingt.
- **Id's van een gepubliceerde les nooit wijzigen** (zie "Nooit wijzigen" in de catalogus). Een les aanpassen die al op `main` staat: `version` één omhoog.

## 5. Huiswerkmodus (`kind: practice`)

- Begin met een uitgewerkt voorbeeld (`explain` met een `example`), daarna `stepped-exercise`-opgaven (zie de catalogus) die **lijken op** het huiswerk maar het niet overnemen.
- Hints en tussenstappen gaan vóór het antwoord; de uitwerking (`workedSolution`) komt pas na een eigen poging.
- Neem nooit opgaven letterlijk over uit het huiswerk of de methode.
- Meld Jop dat de oefening pas na M10 in de app werkt (tot dan staat er een plaatshouder).

## 6. Valideren

`npm run content:check`. Los elke fout op; de codes en wat ze betekenen staan in de catalogus onder "Checks". Herhaal tot hij groen is. Versoepel nooit een check; past een les echt niet binnen een regel, zeg het Jop.

## 7. Review

Zet de agent `content-reviewer` in met het pad van `course.json` en van de les. Blokkerende punten: oplossen, opnieuw `npm run content:check`, opnieuw `content-reviewer`. **Maximaal twee rondes.** Bewaar elk rapport voor de PR.

## 8. Toevoegen

1. `git add content/` en commit: `feat(content): add <cursus-id>/<les-id>`.
2. `npm run verify` moet groen zijn.
3. `git push -u origin content/<cursus-id>-<les-id>`.
4. Maak een PR tegen `main` (`gh pr create --base main`, of de GitHub-tool van de omgeving) met deze beschrijving in het Nederlands:

```markdown
## Wat

<cursus en les in 1–3 zinnen>

## Leerdoel

<objective en concept>

## Bronnen

| Bron | Uitgever | Type | Betrouwbaarheid | Geopend op |
| ---- | -------- | ---- | --------------- | ---------- |

## Review door content-reviewer

<het laatste rapport, en per ronde wat er veranderd is>

## content:check

<uitvoer>

## Lokaal lezen

1. `git switch content/<cursus-id>-<les-id>`, `npm start` (een draaiende dev-server eerst stoppen).
2. Log in op http://localhost:4200 als `kind-a` (wachtwoord `snuffel-test`).
3. Open http://localhost:4200/leren/<cursus-id>/<les-id>.

## Nog niet te zien

Tot M8 is de quiz een voorbeeld zonder knoppen en de praktijkopdracht een lijst zonder vinkjes; het voel-spel komt in M9, `stepped-exercise` in M10. Een cursuspagina komt in M11.
```

Zijn er na twee reviewrondes nog blokkerende punten: open de PR toch, maar als **draft**, met die punten bovenaan.

**Stop: Jop leest de les lokaal en merget zelf.** Merge nooit zelf.

## Voorbeeldmodus (`--voorbeeld`)

Voor een voorbeeld dat nooit echte inhoud wordt:

- schrijf naar `content/fixtures/courses/<cursus-id>/` in plaats van `content/courses/`; fixtures gaan nooit mee in de image;
- alle id's (cursus, les) beginnen met `voorbeeld-`;
- wijzig `content/terms.json` **niet**; vaktermen staan alleen in de `glossary` van de les;
- geen `content/…`-branch, geen commit, geen push en geen PR: de les blijft als **ongecommitte bestanden** in `content/fixtures/courses/<cursus-id>/` in de werkmap van de branch waarop je draait. Draai daarom op een eigen branch, niet op `main` of een `content/…`-branch: sta je op `main`, maak dan eerst `git switch -c sample/<cursus-id>` (werkmap schoon, zie "Vooraf");
- geen vragen aan Jop: de intake-antwoorden staan in de wens; het leerpad komt in het verslag in plaats van een stop;
- alle andere stappen (bronnen, les maken, `npm run content:check`, review) gelden gewoon.

Geef aan het eind een verslag terug, met daarin hoe Jop de voorbeeldles weer weghaalt (de map `content/fixtures/courses/<cursus-id>/` verwijderen, of `git clean -fd content/fixtures/courses/<cursus-id>/`): de wens, de intake, de bronnen (geopend ja/nee), het leerpad, de uitvoer van `npm run content:check` en het volledige rapport van `content-reviewer` per ronde.

## Grenzen

- Past een les niet in de catalogus (er is een nieuwe interactiesoort nodig): **stop** en stel een mijlpaal voor via de skill `spelcomponent-bouwen`. Dat is codewerk, geen inhoud.
- Geen app-code, geen schemawijziging (daarvoor is er `schema-wijzigen`), geen AI-API's of andere diensten in de app.
- Nooit een bron verzinnen, nooit tekst kopiëren, nooit persoonsgegevens van de kinderen.
