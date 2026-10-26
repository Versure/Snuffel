---
name: snuffel-leren
description: Maakt van een korte wens van Jop een Snuffel-les (leertraject of huiswerk-oefenles) als alleen inhoud in content/ - intake, echte bronnen via source-researcher, leerpad, les schrijven volgens de catalogus, content:check, review door content-reviewer, eigen branch en pull request. Gebruik bij "/snuffel-leren <wens>", "nieuwe les", "maak een les over …", "leertraject", of "huiswerkhulp voor …". Bij huiswerk kan Jop foto's van werkboekpagina's geven (in huiswerk-fotos/, buiten git). Met --voorbeeld een voorbeeldles als fixture, zonder commit of PR.
argument-hint: '<korte wens> [--voorbeeld]'
---

# Snuffel leren: een les maken

Argument: een korte wens in gewone taal, bijv. _"Ik wil dat mijn kind leert hoe je een snoek onthaakt."_ Met `--voorbeeld` achter de wens (`/snuffel-leren <wens> --voorbeeld`) draait de skill in de **voorbeeldmodus** (zie onderaan).

Je maakt **alleen inhoud**: bestanden onder `content/`. Geen app-code, geen schema, geen tools. Is er iets anders nodig, stop dan en zeg wat (zie "Grenzen"). De app roept nooit een AI-API of andere dienst aan; hints, uitleg en Ted-teksten zijn statische inhoud die jij nu schrijft.

## Vooraf

1. Lees `CLAUDE.md`, `content/schema/v1/catalogus.md` (bij twijfel het schema in `content/schema/v1/`) en `content/terms.json`.
2. Bekijk de bestaande cursussen in `content/courses/` en `content/fixtures/courses/`. Past de wens in een bestaande cursus, vul die dan aan in plaats van een dubbele te maken. Cursus-id's zijn uniek; les-id's zijn uniek over **alle** cursussen samen, ook de fixtures. Id's beginnend met `voorbeeld-` zijn alleen voor de voorbeeldmodus. De cursus `roofvissen` ("Roofvissen met kunstaas") bestaat al: een nieuwe les over roofvissen hoort daarin, als volgende in `lessons`.
3. `git status`: de werkmap moet schoon zijn. Behalve in de voorbeeldmodus: `git switch main && git pull --ff-only`.
4. `node tools/check-node.mjs`; is Node te oud, gebruik de versie uit `.nvmrc`.

## 1. Intake

Stel alleen de vragen die de wens nog niet beantwoordt, **in één bericht, maximaal zes**:

- wie leert: kind, ouder of samen; leeftijd (alleen voor niveau en toon);
- waarom: waar komt de wens vandaan;
- wat kan diegene al: stel een paar korte controlevragen;
- wat is "gelukt": iets concreets en zichtbaars;
- hoeveel tijd per week;
- context: de vijver; bij huiswerk vak, niveau, methode en hoofdstuk, of liever foto's van de pagina's (zie hieronder). Gaat het huiswerk over getallen of rekenen en zijn er **geen foto's**, vraag dan in dezelfde vraag naar de notatie: "Hoe schrijft de school breuken: boven elkaar of met een schuine streep? Komma of punt bij kommagetallen? Delen met : of ÷, keer met × of ·?" Kies de notatie nooit zelf; komen de foto's alsnog, dan gelden de foto's.

Kies daarna `kind`: `course` (leertraject) of `practice` (huiswerk-oefenles; dan zijn `subject`, `schoolLevel`, `method` en `chapter` verplicht).

### Huiswerk met foto's van het werkboek

Gaat de wens over huiswerk (`kind: practice`), vraag dan in hetzelfde intakebericht om **foto's van de pagina's** uit het werkboek: het pad naar de bestanden of een map, bij voorkeur onder `huiswerk-fotos/` in de repo (die map staat in `.gitignore`); slepen in het gesprek mag ook. Dat telt als één van de zes vragen. Zeg er in dat bericht bij: "Maak de foto zonder naam, klas, cijfers of ander persoonlijks erop (afdekken of bijsnijden); de foto's blijven buiten git en de image, maar Claude stuurt ze wel naar Anthropic om ze te lezen." Heeft Jop geen foto's, dan werkt de huiswerkmodus zoals hieronder zonder foto's.

**Gesleepte foto's:** de agents krijgen alleen paden, dus een foto die alleen in het gesprek staat, kan `content-reviewer` niet zien. Sleept Jop foto's in het gesprek, vraag hem dan ze ook in `huiswerk-fotos/` te zetten en geef de agents die paden. Lukt dat niet, ga dan door met de foto's uit het gesprek en meld in je verslag en in de PR (sectie "Review door content-reviewer") dat de reviewer de foto's niet gezien heeft en de les dus niet tegen het boek kon controleren.

Lees elke foto met `Read` (een map: eerst `Glob` op de afbeeldingen erin). Haal eruit:

- vak, niveau, methode en hoofdstuk; vraag alleen wat er niet op staat (in hetzelfde bericht of, als de foto's pas na de intake komen, in één vervolgbericht; samen nooit meer dan zes vragen);
- de uitleg van het boek: welk begrip, in welke volgorde, met welke voorbeelden;
- de **notatie en werkwijze** van het boek (bijv. hoe een breuk, een tussenstap, een eenheid of een tabel genoteerd wordt); de les gebruikt precies die notatie. Kies hem **per les** uit de foto's, per soort (zie "Notatie" in de catalogus):
  - een breuk boven elkaar (teller over noemer) wordt `{{a/b}}`, een gemengd getal `{{n a/b}}`; een breuk met een schuine streep blijft `a/b`;
  - een kommagetal met een komma of met een punt, zoals in het boek;
  - delen met `:` of `÷`, keer met `×` of `·`, zoals in het boek; **nooit `*` voor keer** (dat is opmaak: `3*4*5` wordt cursief);
  - de vorm van een tussenstap of uitwerking (bijv. "{{1/2}} = {{2/4}}" als één `=`-reeks, of als losse zinnen), zoals in het boek;
  - de hele les gebruikt dezelfde notatie. Schrijf je keuze op (per soort: wat je op de foto's zag en wat je schrijft); die gaat mee naar `content-reviewer` en in de PR onder "Notatie".
  - Staat er een notatie op de foto's die de app niet kan tonen (zie "Grenzen"), maak die opgaven dan niet.
- het niveau en het **soort opgaven** (wat er gevraagd wordt, hoeveel stappen, met of zonder context).

**Persoonsgegevens op foto's:** naam, klas, school, handschrift, behaalde cijfers of iets anders dat naar een kind wijst, negeer je. Ze komen nergens: niet in inhoud, commits, branchnaam of PR, en niet in je opdrachten aan de agents (die krijgen alleen de paden). **Kopieer nooit een foto** naar `content/` of elders in de repo (een test faalt op foto's onder `content/`), en noem in de PR geen bestandsnamen of mapnamen van foto's (die kunnen een naam bevatten); schrijf "eigen foto's van het hoofdstuk".

**Privacy van de kinderen:** namen, leeftijden van een bepaald kind, school, woonplaats of andere persoonsgegevens komen **nooit** in inhoud, commits, branchnamen of de PR. De intake bepaalt alleen niveau en toon (bijv. `"audience": "Kinderen vanaf 12, zelfstandig of samen met een ouder"`).

## 2. Bronnen eerst

Zet de agent `source-researcher` in met: onderwerp, doelgroep, het leerdoel (of het voorlopige leerpad) en de beweringen waar de les een bron voor nodig heeft; bij huiswerk ook vak, niveau, methode en hoofdstuk, en de paden van de foto's als die er zijn (zodat hij weet wat het hoofdstuk behandelt).

Controleer zijn lijst voor je verdergaat:

- minstens drie bronnen, elk echt geopend (bronnen onder "Niet geopend" tellen niet);
- elke `url` begint met `https://`, zonder trackingparameters;
- `type` en `reliability` volgens de tabel in de catalogus;
- geen bewering steunt alleen op `low`-bronnen;
- bij huiswerk: de methode staat erin als `type: "method"`, `reliability: "medium"`, met als `url` de `https://`-pagina van de methode bij de uitgever (door `source-researcher` echt geopend) en als `note` "hoofdstuk <X>, eigen foto's (niet in de repo)" (zonder foto's: "hoofdstuk <X>"). Kon hij die pagina niet openen, dan komt er **geen** methodebron in `course.sources`; meld dat aan Jop (en in de PR). De foto's zelf zijn nooit een bron. Verdere bronnen (kerndoelen SLO, uitleg van de stof) komen gewoon van het web.

Te weinig betrouwbare bronnen: **stop** en zeg Jop wat er ontbreekt. Verzin nooit een bron, en vul nooit iets aan uit je geheugen.

## 3. Leerpad

Maak een leerpad: lessen met elk **één nieuw begrip**, in volgorde van voorkennis, met per les het leerdoel ("Na deze les …").

Maak eerst de branch vanaf `main`: `git switch -c content/<cursus-id>-<les-id>` (de eerste les die je gaat maken). Schrijf daarna pas `course.json` (zie de catalogus) met alle lessen als `planned` en de bronnen van `source-researcher` onder `sources`, zodat er nooit een bestand op `main` ontstaat.

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
- **Interacties alleen uit de catalogus** (`trace-game`, `stepped-exercise`, `typing-drill`, of wat daar later bij komt).
- **Afbeeldingen:** alleen als een afbeelding iets uitlegt wat tekst niet goed kan. Maak dan zelf een eenvoudige svg in `assets/` van de cursus: alleen `currentColor`, niets van buiten, een `alt` die beschrijft wat je ziet. Geen foto's, geen afbeeldingen van internet.
- **Parafraseren, nooit kopiëren** uit een bron.
- **Nieuwe vaktermen** (met hun `forms`) voeg je toe aan `content/terms.json`, in dezelfde PR als de les, zodat de check ze daarna in elke les afdwingt.
- **Id's van een gepubliceerde les nooit wijzigen** (zie "Nooit wijzigen" in de catalogus). Een les aanpassen die al op `main` staat: `version` één omhoog.

**Typlessen** (blind typen met `typing-drill`, details en valkuilen in de catalogus, sectie `typing-drill`):

- Een leerpad van de thuisrij (`asdf jkl;`) via de andere letters naar hoofdletters (Shift met de **andere** hand) en leestekens; elke les 2 tot 4 nieuwe toetsen in `newKeys`.
- Regels alleen met toetsen die in deze les of de lessen ervoor geleerd zijn; korte regels (een teken te veel maakt de rest van de regel fout).
- Dode toetsen (`'`, `"`, `` ` ``, `~`, `^`) nooit direct voor een letter die US-International samenstelt (`'en` wordt `én`); zie de catalogus. Geen accenten.
- De quiz gaat over vingers en houding; de praktijkopdracht is typen op een echt toetsenbord zonder te kijken (bijv. "typ een berichtje aan opa").
- `content:check` meldt `typing-new-key-unused` (een toets in `newKeys` die geen regel gebruikt) en `typing-dead-key-sequence`. Een typoefening telt 1 minuut plus 1 minuut per 60 tekens.

## 5. Huiswerkmodus (`kind: practice`)

- Begin met een uitgewerkt voorbeeld (`explain` met een `example`), daarna `stepped-exercise`-opgaven (zie de catalogus) die **lijken op** het huiswerk maar het niet overnemen.
- Hints en tussenstappen gaan vóór het antwoord; de uitwerking (`workedSolution`) komt pas na een eigen poging.
- Neem nooit opgaven letterlijk over uit het huiswerk of de methode.
- **Met foto's:** volg de stof, de volgorde en de **notatie** van het boek, op hetzelfde niveau. **Parafraseer** de uitleg in je eigen woorden. De opgaven lijken op die in het boek (zelfde soort, zelfde niveau, zelfde notatie), maar zijn nooit letterlijk overgenomen, en ook niet dezelfde zin met alleen andere getallen: bedenk een eigen context (bij voorkeur iets herkenbaars, zoals de vijver of vissen).
- **Notatie:** de notatie van de foto's (of uit de intake) geldt overal in de les: uitleg, opgaven, hints, tussenstappen, `feedback` van `commonMistakes`, `workedSolution`, keuzeopties en quiz. Alleen in `accepted` en `commonMistakes[].answer` staat wat het kind **typt** (`3/5`, `1 1/4`, `0,75`), nooit `{{…}}`. Gebruikt de oefening `{{a/b}}`, dan laat de app onder het invoervak zien hoe hij een getypte breuk leest ("Zo lees ik jouw antwoord:").
- De oefening werkt in de app sinds M10. Kort (details en valkuilen in de catalogus, sectie `stepped-exercise`):
  - `accepted`: zet elke vorm die goed is erin (`5/6`, `vijf zesde`); hoofdletters, extra spaties, spaties rond `/` en een punt aan het eind tellen niet mee, accenten en typefouten wel.
  - `number`: het kind mag een komma, een punt, een breuk (`3/4`) of een gemengd getal (`1 1/4`) typen, en de `unit` erachter. Zet `tolerance` boven 0 als een afgerond antwoord goed moet zijn (`0,33` bij `1/3`). Grote getallen zonder punt (`1.000` is één).
  - `commonMistakes`: een fout antwoord zoals een kind het typt; bij `choice` het id van een optie. Een fout antwoord dat als goed zou tellen of (bij `number`) geen getal is, weigert `content:check`.
  - Hoogstens 10 opgaven per oefening; tussenstappen zijn ook vóór een poging te openen, dus zet het eindantwoord er niet in.

## 6. Valideren

`npm run content:check`. Los elke fout op; de codes en wat ze betekenen staan in de catalogus onder "Checks". Herhaal tot hij groen is. Versoepel nooit een check; past een les echt niet binnen een regel, zeg het Jop.

## 7. Review

Zet de agent `content-reviewer` in met het pad van `course.json` en van de les; bij huiswerk ook vak, niveau, methode en hoofdstuk, de paden van de foto's als die er zijn (hij controleert dan dat de les de stof en notatie van het boek volgt, dat niets (bijna) letterlijk van de foto's komt en dat er geen persoonsgegevens van de foto's in staan), en **de notatie die je gekozen hebt**: per soort wat je schrijft en waarom (van de foto's, of zonder foto's: wat Jop in de intake zei). Hij controleert elke breuk, elk getal en elke bewerking daartegen. Blokkerende punten: oplossen, opnieuw `npm run content:check`, opnieuw `content-reviewer`. **Maximaal twee rondes.** Bewaar elk rapport voor de PR.

## 8. Toevoegen

1. `git add content/` en commit: `feat(content): add <cursus-id>/<les-id>`. Controleer vooraf met `git status` dat er geen foto's of andere bestanden buiten de les meegaan.
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

## Notatie

<alleen bij huiswerk: per soort (breuk, kommagetal, delen, keer, tussenstap en uitwerking) wat de les schrijft en waarom: "zo staat het op de eigen foto's van het hoofdstuk" of "zo zei Jop het in de intake">

## Ontbrekende notatie

<alleen als het voorkomt: welke notatie de app nog niet kan tonen, bij welk soort opgave, wat er daarom niet in de les staat, en een voorstel voor een kleine mijlpaal via `schema-wijzigen`>

## Review door content-reviewer

<het laatste rapport, en per ronde wat er veranderd is>

## content:check

<uitvoer>

## Lokaal lezen

1. `git switch content/<cursus-id>-<les-id>`, `npm start` (een draaiende dev-server eerst stoppen).
2. Log in op http://localhost:4200 als `kind-a` (wachtwoord `snuffel-test`).
3. Open http://localhost:4200/leren/<cursus-id>/<les-id>.

## Nog niet te zien

De quiz (gehusseld, hints op verzoek, feedback per gekozen optie, score met Ted) en de checklist met vinkjes werken sinds M8 en bewaren de voortgang per kind; het voel-spel (`trace-game`) werkt sinds M9 en bewaart elk uitgespeeld spel; de oefening (`stepped-exercise`) werkt sinds M10 en bewaart elke afgeronde reeks; de typoefening (`typing-drill`) werkt sinds M15 en bewaart elke afgeronde oefening (zonder de getypte tekst). Sinds M11 staat elke cursus als kaart op de startpagina en heeft hij een cursusoverzicht (`/leren/<cursus-id>`) met het doel en de status van elke les (klaar, bezig, nieuw, komt nog). Een stap toevoegen aan een gepubliceerde les zet hem voor wie hem af had weer op "bezig"; maak voor nieuwe stof liever een nieuwe les.
```

Zijn er na twee reviewrondes nog blokkerende punten: open de PR toch, maar als **draft**, met die punten bovenaan.

**Stop: Jop leest de les lokaal en merget zelf.** Merge nooit zelf.

## Voorbeeldmodus (`--voorbeeld`)

Voor een voorbeeld dat nooit echte inhoud wordt:

- schrijf naar `content/fixtures/courses/<cursus-id>/` in plaats van `content/courses/`; fixtures gaan nooit mee in de image;
- alle id's (cursus, les) beginnen met `voorbeeld-`;
- wijzig `content/terms.json` **niet**; vaktermen staan alleen in de `glossary` van de les;
- geen `content/…`-branch, geen commit, geen push en geen PR: de les blijft als **ongecommitte bestanden** in `content/fixtures/courses/<cursus-id>/` in de werkmap van de branch waarop je draait. Draai daarom op een eigen branch, niet op `main` of een `content/…`-branch: sta je op `main`, maak dan eerst `git switch -c sample/<cursus-id>` (werkmap schoon, zie "Vooraf");
- geen vragen aan Jop: de intake-antwoorden staan in de wens; het leerpad komt in het verslag in plaats van een stop. Gaat het over rekenen en staat de notatie niet in de wens, gebruik dan de schuine streep (`a/b`) en de komma, geef die aan `content-reviewer` mee als notatie met de reden "voorbeeldmodus, niet door Jop gegeven", en zeg in het verslag dat de notatie niet gegeven was;
- alle andere stappen (bronnen, les maken, `npm run content:check`, review) gelden gewoon.

Geef aan het eind een verslag terug, met daarin hoe Jop de voorbeeldles weer weghaalt (de map `content/fixtures/courses/<cursus-id>/` verwijderen, of `git clean -fd content/fixtures/courses/<cursus-id>/`): de wens, de intake, de bronnen (geopend ja/nee), het leerpad, de uitvoer van `npm run content:check` en het volledige rapport van `content-reviewer` per ronde.

## Grenzen

- Past een les niet in de catalogus (er is een nieuwe interactiesoort nodig): **stop** en stel een mijlpaal voor via de skill `spelcomponent-bouwen`. Dat is codewerk, geen inhoud.
- **Een notatie die de app niet kan tonen** (zie "Notatie" in de catalogus: bijv. een staartdeling, een macht, een wortel, een breuk in een breuk, cijfers onder elkaar): maak die les of die opgaven **niet** met een benadering (geen `2^3`, geen "de wortel uit 9" als het boek √9 schrijft). **Stop**, net als bij een ontbrekende interactiesoort, en meld het als **ontbrekende notatie**: wat, bij welk soort opgave, en een voorstel voor een kleine mijlpaal via `schema-wijzigen`. Komt er voor de rest wel een PR (bijv. andere lessen), dan staat het daarin onder "Ontbrekende notatie"; anders in je bericht aan Jop.
- Geen app-code, geen schemawijziging (daarvoor is er `schema-wijzigen`), geen AI-API's of andere diensten in de app.
- Nooit een bron verzinnen, nooit tekst kopiëren, nooit persoonsgegevens van de kinderen.
- Foto's van het werkboek blijven in `huiswerk-fotos/` (buiten git) of in het gesprek; nooit in de repo, nooit in de PR.
