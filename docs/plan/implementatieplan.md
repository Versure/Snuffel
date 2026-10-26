# Snuffel: implementatieplan

Status: goedgekeurd door Jop op 19-10-2026. Bouwt voort op `docs/start/HANDOFF.md`.

Gemaakte keuzes na de intake (19-10-2026):

- Uitrollen via een container-image op `ghcr.io`, gebouwd door GitHub Actions bij een merge naar `main`.
- Kwaliteitschecks (lint, tests, build) draaien **alleen lokaal**. GitHub Actions bouwt en publiceert alleen de image.
- Fase 1 krijgt een eenvoudig ouderoverzicht in de app.
- Huiswerkhulp = oefenlessen per schoolonderwerp, met stapsgewijze hints en een eigen antwoord van het kind.

---

## 1. Architectuur

### 1.1 Mappenstructuur

Eén repo met npm-workspaces. Eén commando (`npm run check`) controleert alles.

```
/
├─ CLAUDE.md                     conventies voor Claude Code
├─ README.md                     lokaal draaien, uitrollen op de NAS
├─ package.json                  workspaces + scripts check / verify / content:*
├─ web/                          Angular-app
│  ├─ src/app/core/              pocketbase-client, auth, guards, content-loader, progress-service
│  ├─ src/app/shared/ui/         ted, speech-bubble, button, card, sticker, sticky-note, step-nav
│  ├─ src/app/shared/blocks/     renderers per inhoudsblok (text, example, signal-cards, rule, figure, tip, ted-says)
│  ├─ src/app/shared/quiz/       quiz-question, quiz (score + Ted)
│  ├─ src/app/shared/practice/   checklist ("aan het water" / "zelf doen")
│  ├─ src/app/interactions/      registry + trace-game (voel-spel) + stepped-exercise
│  ├─ src/app/features/          login, home, course, lesson, parent, not-found
│  ├─ src/styles/                tokens.css, base.css, fonts.css
│  ├─ public/fonts/              Bangers, Atkinson Hyperlegible (woff2, zelf gehost)
│  ├─ public/assets/ted.svg      sprite uit docs/start/assets
│  └─ e2e/                       Playwright-tests
├─ content/
│  ├─ schema/v1/                 course.schema.json, lesson.schema.json, catalogus.md (bloktypen en interacties)
│  └─ courses/<course-id>/       course.json, lessons/<nn>-<slug>.json, assets/
├─ pocketbase/
│  ├─ pb_migrations/             JS-migraties (collecties + regels)
│  ├─ pb_hooks/                  security headers (CSP)
│  ├─ seed/                      dev-seed: testkinderen + ouder (nooit op de NAS)
│  └─ tests/                     integratietests van de toegangsregels
├─ tools/                        content-check, content-build, fetch-pocketbase (TypeScript via tsx)
├─ deploy/
│  ├─ Dockerfile
│  ├─ compose.dev.yml            lokaal, bouwt de image zelf
│  ├─ compose.nas.yml            Container Manager, gebruikt ghcr.io-image
│  └─ .env.example
├─ .github/workflows/release.yml alleen: image bouwen en naar ghcr.io pushen
├─ .claude/                      agents/, skills/, hooks/, settings.json
└─ docs/                         start/ (handoff), plan/ (dit plan, plannen per mijlpaal)
```

### 1.2 Angular-opbouw

- Angular 22 (nieuwste stabiele op moment van M1), standalone components, signals, zoneless, `OnPush` overal. Unit-tests met de standaard Angular-testrunner (Vitest), e2e met Playwright, lint met angular-eslint + Prettier.
- Selector-prefix `snf-`. Code, bestands- en componentnamen Engels; alle UI-tekst Nederlands. Geen i18n-framework: de app is eentalig.
- Data ophalen met `httpResource` / `resource` (signals); PocketBase via de officiële `pocketbase` JS SDK in één `PocketBaseService`.

**Routes**

| Route                        | Wie          | Inhoud                                                                |
| ---------------------------- | ------------ | --------------------------------------------------------------------- |
| `/login`                     | iedereen     | gebruikersnaam + wachtwoord, Ted begroet                              |
| `/`                          | kind, ouder  | Ted begroet met naam, leertrajecten met voortgangsbalk                |
| `/leren/:courseId`           | kind, ouder  | lessenlijst met status per les                                        |
| `/leren/:courseId/:lessonId` | kind, ouder  | les met stappen (uitleg, interactie, quiz, praktijk), ankers per stap |
| `/ouder`                     | alleen ouder | per kind: lessen af, quizscores, checklists, laatste activiteit       |
| `**`                         |              | niet gevonden, met Ted "oeps"                                         |

Guards: `authGuard` (ingelogd), `roleGuard('parent')`. Features worden lazy geladen.

**Gedeelde componenten**

- `snf-ted`: input `mood: 'cool' | 'happy' | 'thinking' | 'oops'` (stoer, blij, nadenkend, oeps), optioneel `size`. Zet de CSS-variabelen uit `ted.svg`. Wiebel-animatie alleen zonder `prefers-reduced-motion`. _Afwijking van de handoff:_ de input heet `mood` in plaats van `stemming`, omdat code Engels is.
- `snf-speech-bubble`: tekstballon, input `tail: 'left' | 'bottom'`, content via `<ng-content>`.
- `snf-ted-says`: Ted + ballon samen; gebruikt door blokken, quiz en interacties.
- `snf-quiz`, `snf-quiz-question`: opties gehusseld, uitleg per gekozen optie, hints op verzoek, score met Ted.
- `snf-checklist`: plakbriefje, opgeslagen per kind.
- `snf-step-nav`: de vier rondjes bovenaan, gevuld als een stap klaar is.
- Interacties via een **registry**: `kind` uit de inhoud → component (lazy met `@defer`). Nieuwe interactie = nieuwe component + schema-definitie, niets anders.

**Stijl**: design tokens als CSS-variabelen in `tokens.css` (namen Engels, waarden exact uit de handoff), donkere modus via `prefers-color-scheme` en `data-theme`. Knoppen en tikvlakken ≥ 44 px, zichtbare focus (roze outline), harde offset-schaduwen. Fonts als woff2 in `public/fonts` (beide OFL-licentie, via `@fontsource`-pakketten bij de build gekopieerd).

### 1.3 PocketBase: collecties en toegangsregels

Eén `users`-authcollectie met een rol. De superuser (beheer op `/_/`) is een apart account en wordt niet in de app gebruikt. Voortgang verwijst naar inhoud via vaste tekst-id's uit de JSON (`course_id`, `lesson_id`, …), niet via relaties: inhoud staat niet in PocketBase.

| Collectie                                             | Velden                                                                                                                                                                                                                                                                                                            | list / view                                                  | create                                                                                                          | update                                                                                                                                                                                                                                                                                                          | delete |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `users` (auth, login op `username`, e-mail optioneel) | `name`, `username`, `role` (`child` \| `parent`)                                                                                                                                                                                                                                                                  | `id = @request.auth.id \|\| @request.auth.role = "parent"`   | `@request.auth.role = "parent"`                                                                                 | `(id = @request.auth.id && @request.body.role:isset = false && @request.body.username:isset = false && @request.body.email:isset = false && @request.body.verified:isset = false) \|\| @request.auth.role = "parent"` (een kind wijzigt alleen `name` en, met het oude wachtwoord, `password`); manageRule leeg | ouder  |
| `lesson_progress`                                     | `user` (relatie, `cascadeDelete`), `course_id`, `lesson_id`, `step_id`, `status` (`started` \| `completed`), `content_version` (≥ 1), `created`, `updated`; uniek op (user, lesson_id, step_id)                                                                                                                   | `user = @request.auth.id \|\| @request.auth.role = "parent"` | `@request.auth.id != "" && @request.body.user = @request.auth.id`                                               | `user = @request.auth.id && @request.body.user:isset = false && @request.body.course_id:isset = false && @request.body.lesson_id:isset = false && @request.body.step_id:isset = false` (alleen `status` en `content_version`)                                                                                   | ouder  |
| `quiz_attempts`                                       | `user` (relatie, `cascadeDelete`), `lesson_id`, `question_id`, `option_id`, `correct`, `hints_used` (≥ 0), `content_version` (≥ 1), `created`, `updated`; gewone index op (user, lesson_id)                                                                                                                       | idem                                                         | idem                                                                                                            | niemand (alleen toevoegen)                                                                                                                                                                                                                                                                                      | ouder  |
| `checklist_states`                                    | `user` (relatie, `cascadeDelete`), `lesson_id`, `checklist_id`, `checked` (json: lijst item-id's, max. 2 kB), `created`, `updated`; uniek op (user, lesson_id, checklist_id)                                                                                                                                      | idem                                                         | idem                                                                                                            | `user = @request.auth.id && @request.body.user:isset = false && @request.body.lesson_id:isset = false && @request.body.checklist_id:isset = false` (alleen `checked`)                                                                                                                                           | ouder  |
| `interaction_results`                                 | `user` (relatie, `cascadeDelete`), `lesson_id`, `interaction_id`, `kind` (tekst met id-patroon, geen select), `score` (≥ 0, niet hoger dan `total`), `total` (≥ 1), `detail` (json, max. 4 kB), `content_version` (≥ 1), `created`, `updated`; gewone index op (user, lesson_id); één record per uitgespeeld spel | idem                                                         | `@request.auth.id != "" && @request.body.user = @request.auth.id && @request.body.score <= @request.body.total` | niemand (alleen toevoegen)                                                                                                                                                                                                                                                                                      | ouder  |

- Een kind ziet en schrijft alleen eigen records en kan het `user`-veld niet omzetten. De ouder leest alles en kan voortgang wissen (reset), maar schrijft niet namens een kind. Bij `lesson_progress` en `checklist_states` kan een kind ook de sleutelvelden (welke les, stap of checklist) van een eigen record niet wijzigen. De ouder kan wel eigen voortgang opslaan als hij zelf een les doet.
- Migraties als JS in `pb_migrations/` (één bestand per wijziging, nooit een oud bestand aanpassen). PocketBase past ze automatisch toe bij `serve`.
- `pb_hooks/security.pb.js` zet een Content-Security-Policy op de app-routes (`default-src 'self'`; `style-src 'self' 'unsafe-inline'` voor Angular-componentstijlen; `img-src 'self' data:`), plus `Referrer-Policy: no-referrer`. Dat dwingt "geen externe calls" af in de browser zelf. Het beheerscherm `/_/` en `/api/` vallen er buiten.
- Integratietests (`pocketbase/tests`) starten een echte PocketBase met lege data, draaien de migraties en bewijzen met kind A, kind B en ouder dat elke regel doet wat hierboven staat.

### 1.4 Container en uitrollen

**Dockerfile** (multi-stage): stap 1 Node bouwt `content` en `web`; stap 2 `alpine` met een vastgepinde PocketBase-versie (checksum gecontroleerd), `pb_migrations`, `pb_hooks`, en de gebouwde app in `pb_public`. Platform `linux/amd64` (de DS920+ heeft een Intel-processor). Draait als niet-root gebruiker. Healthcheck op `/api/health`.

**`deploy/compose.nas.yml`**

```yaml
services:
  snuffel:
    image: ghcr.io/versure/snuffel:latest
    container_name: snuffel
    restart: unless-stopped
    ports:
      - '8090:8090' # alleen LAN; geen port forwarding op de router
    volumes:
      - /volume1/docker/snuffel/pb_data:/pb/pb_data
    environment:
      - TZ=Europe/Amsterdam
```

**Uitrolstroom**

1. Pull request gemerged naar `main` → `release.yml` bouwt de image en pusht `ghcr.io/versure/snuffel:latest` en `:sha-<kort>`.
2. Op de NAS: Container Manager → Project `snuffel` → image bijwerken en herstarten (eenmalig: registry `ghcr.io` toevoegen met een token met alleen `read:packages`).
3. PocketBase past nieuwe migraties toe bij de start. Terug naar een vorige versie: tag `:sha-<kort>` in de compose zetten.
4. Eerste keer: superuser aanmaken via de terminal van de container (`pocketbase superuser upsert`), daarna ouder- en kindaccounts via `/ouder` of `/_/`.
5. Back-up: map `/volume1/docker/snuffel/pb_data` meenemen in Hyper Backup; daarnaast de ingebouwde PocketBase-back-ups (dagelijks, 7 bewaren).

Lokaal: `npm start` (Angular dev-server + PocketBase-binary met dev-seed, proxy `/api`) of `docker compose -f deploy/compose.dev.yml up` voor de echte image.

---

## 2. Inhoudsformaat

### 2.1 Keuze: JSON-bestanden in de repo, bij de build gecontroleerd en meegeleverd

Inhoud staat als JSON in `content/`. `npm run content:build` valideert alles en schrijft `web/public/content/` (in `.gitignore`) met een `manifest.json`. De app haalt lessen op als statische bestanden van dezelfde server.

Waarom niet als records in PocketBase:

- **Reviewbaar.** Een les is een diff in een pull request; Jop en de review-agent lezen precies wat er verandert. Records in een database hebben geen diff en geen geschiedenis.
- **Valideerbaar vóór de app het ziet.** Schema- en didactiekchecks draaien als gewone check en in git-hooks. Bij PocketBase zou dezelfde validatie dubbel gebouwd moeten worden.
- **Werkt met de skill.** `snuffel-leren` schrijft bestanden; geen admin-tokens of API-calls naar de NAS nodig.
- **Veilig.** Inhoud is alleen-lezen voor de app; een kindaccount kan er niets aan veranderen. De database bevat alleen voortgang.
- **Geen code nodig.** Een nieuwe les is een nieuw JSON-bestand; de app leest het manifest.

Nadeel: een nieuwe les vraagt een nieuwe image. Met de ghcr-stroom is dat één merge en één klik op de NAS. Omdat de app de inhoud bij het draaien ophaalt (niet meecompileert), kan `content/` later als volume worden gekoppeld als dat sneller moet; dan verandert er niets aan de app.

### 2.2 Schema (versie 1)

JSON Schema (draft 2020-12) in `content/schema/v1/`. TypeScript-types worden uit het schema gegenereerd (`json-schema-to-typescript`), zodat app en inhoud niet uit elkaar lopen. Elk bestand heeft `schemaVersion`; de app ondersteunt een vaste lijst versies. Een nieuwe schemaversie krijgt een migratiescript dat alle bestaande inhoud omzet.

Sleutels zijn Engels, teksten Nederlands. Id's zijn kebab-case en **veranderen nooit** zodra een les gepubliceerd is (voortgang hangt eraan). `content:check` vergelijkt met `main` en weigert verdwenen of hergebruikte id's.

**`course.json`**

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
      "file": "lessons/01-aanbeet-of-vastzitten.json",
      "status": "published"
    }
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

`kind` is `course` (leertraject) of `practice` (huiswerk-oefenles per schoolonderwerp; dan ook `subject`, `schoolLevel`, `method`, `chapter`). Een les in `lessons` heeft `id`, `title` en `status`: `planned` (komt nog; alleen id en titel, geen bestand) of `published` (af; `file` verplicht). Er is geen `draft`: een les die niet af is, staat op een `content/…`-branch. In de uitvoer van `content:build` (`web/public/content/`) heet een lesbestand naar het les-id (`<cursus-id>/lessons/<les-id>.json`), niet naar het volgnummer, zodat een adres niet verandert als de volgorde wijzigt. `reliability`: `high` (overheid, vakbond, onderwijsinstelling, wetenschap), `medium` (gerenommeerde media, encyclopedie, fabrikant over eigen product), `low` (winkel, blog, forum). Een bewering mag nooit alleen op een `low`-bron steunen.

**Les** (ingekort en niet volledig geldig, bijv. ontbreken `sourceRefs` bij het voorbeeldblok; het volledige schema staat sinds M6 in `content/schema/v1/lesson.schema.json`)

```json
{
  "schemaVersion": 1,
  "id": "aanbeet-of-vastzitten",
  "version": 1,
  "title": "Aanbeet of vastzitten?",
  "sticker": "Roofvissen · les 1",
  "objective": "Na deze les weet je hoe een aanbeet van een roofvis voelt, hoe je die onderscheidt van vastzitten, en wat je dan doet.",
  "concept": "aanbeet herkennen",
  "estimatedMinutes": 10,
  "glossary": [
    {
      "term": "aanslaan",
      "definition": "kort en stevig de hengel omhoog of opzij halen, zodat de haak vast komt te zitten"
    }
  ],
  "ted": {
    "intro": { "mood": "cool", "text": "Yo! Ik ben Ted. Bij kunstaas is je hand de beetmelder." },
    "correct": ["Goed gevoeld!", "Strak!"],
    "incorrect": ["Bijna.", "Oeps, kijk nog eens."],
    "finished": "Tijd voor het echte werk aan de waterkant."
  },
  "steps": [
    {
      "id": "uitleg",
      "type": "explain",
      "title": "Wachten kost je de vis",
      "blocks": [
        { "type": "example", "text": "Je draait een shad binnen. Ineens wordt het zwaar. …" },
        {
          "type": "signal-cards",
          "cards": [
            {
              "icon": "pulse",
              "title": "Een tik",
              "text": "Een korte, scherpe ruk in de lijn. …",
              "sourceRefs": ["svnl-roofvis-9303"]
            }
          ]
        },
        { "type": "rule", "title": "Twijfel? Sla aan!", "text": "…", "sourceRefs": [] },
        {
          "type": "text",
          "text": "**Tip:** gevlochten lijn rekt bijna niet. …",
          "sourceRefs": ["…"]
        }
      ]
    },
    {
      "id": "spel",
      "type": "interaction",
      "title": "Voel de lijn",
      "interaction": { "id": "voel-spel", "kind": "trace-game", "config": { "…": "zie 2.3" } }
    },
    {
      "id": "quiz",
      "type": "quiz",
      "title": "Quiz",
      "questions": [
        {
          "id": "schokken-terug",
          "prompt": "Je draait een shad binnen. Ineens wordt het zwaar, en je voelt een paar korte schokken terug. Wat doe je?",
          "options": [
            {
              "id": "a",
              "text": "Direct aanslaan en lijn strak houden",
              "feedback": "Klopt. Schokken die terugtrekken betekenen …"
            },
            {
              "id": "b",
              "text": "Wachten tot de vis gaat lopen",
              "feedback": "Dat werkt bij karper, maar een roofvis spuugt kunstaas binnen een paar tellen uit."
            }
          ],
          "correctOptionId": "a",
          "hints": ["Denk aan hoe snel een roofvis merkt dat het aas nep is."],
          "sourceRefs": ["…"]
        }
      ]
    },
    {
      "id": "water",
      "type": "practice",
      "practiceKind": "at-the-water",
      "title": "Aan het water",
      "intro": "De volgende keer bij de vijver: …",
      "items": [
        {
          "id": "vispas",
          "text": "Mee: jouw VISpas en een JeugdVISpas …",
          "links": [{ "label": "VISpas-check", "url": "https://…" }]
        }
      ],
      "successCriterion": "Gelukt als je zonder te kijken kunt zeggen: bodem, plant, vast of vis."
    }
  ],
  "furtherReading": [
    {
      "sourceRef": "svnl-visblad-streetfishing",
      "why": "Over roofvissen met kunstaas in stadswater …"
    }
  ],
  "faq": [{ "q": "Wat als ik twijfel?", "a": "Sla aan. …" }]
}
```

- **Bloktypen**: `text` (beperkte opmaak: vet, cursief, link, `[[term]]` naar de woordenlijst, `{{breuk}}`), `example`, `signal-cards`, `rule`, `tip`, `figure` (svg uit `assets/` + verplichte `alt`), `ted-says`.
- **Staptypen**: `explain`, `interaction`, `quiz`, `practice` (`practiceKind`: `at-the-water` \| `do-it-yourself`).
- **Bronnen**: `sourceRefs` is verplicht op elk blok (bij `signal-cards` op elke kaart), elke quizvraag (geldt voor vraag, opties en feedback samen), elk checklist-item en elke interactiestap, en verwijst naar `course.sources`. Een lege lijst mag alleen bij tekst zonder feitelijke bewering, en de reviewer controleert dat.
- **Vaktermen**: één lijst voor alle cursussen in `content/terms.json` (`term` en optioneel `forms`). Staat een term of vorm in de tekst van een les, dan hoort hij in de `glossary` van die les.
- Het volledige formaat, alle checks en hun foutcodes staan in `content/schema/v1/catalogus.md` (M6).
- De "Vragen? Vraag het in de chat"-sectie en de footer met het leerdossier uit de referentieles vervallen; daarvoor komt de statische `faq`.

### 2.3 Interacties (vaste catalogus)

Een interactie is data voor een bestaande component. De catalogus staat in `content/schema/v1/catalogus.md`; de skill `snuffel-leren` mag alleen deze soorten gebruiken.

- **`trace-game`** (het voel-spel, algemeen gemaakt): een lijn die over tijd wordt getekend, plus een buigende hengeltop of een andere "meter". De vormen worden opgebouwd uit vaste bouwstenen in plaats van code: `base`, `pulse` (piek op tijdstip t met breedte), `ramp` (geleidelijk zwaarder), `wobble` (trillen), `pulses` (regelmatige tikjes). Config: `choices` (id, label, kleur), `patterns` (id, `answer`, bouwstenen, `explanation`), `rounds`, `durationMs`. Bij `prefers-reduced-motion` wordt de lijn meteen volledig getekend.
- **`stepped-exercise`** (huiswerk-oefenles): opgave, verwacht antwoord (`number` met tolerantie, `text` met toegestane vormen, of `choice`), oplopende hints, tussenstappen die het kind kan openen, `commonMistakes` (herkende foute antwoorden met gerichte feedback) en een uitwerking die pas zichtbaar wordt na een eigen poging én alle hints.
- Nieuwe soorten (bijvoorbeeld sorteren of volgorde leggen) vragen code en lopen via de skill `spelcomponent-bouwen`, als eigen mijlpaal.

### 2.4 Inhoudschecks (`npm run content:check`)

Naast het JSON Schema:

- elke `sourceRef` bestaat; elke bron heeft `reliability` en `accessedOn`; geen bewering alleen op `low`;
- quiz: 3 tot 5 vragen, 3 of 4 opties, langste optie ≤ 1,5 × de kortste (in tekens), feedback bij elke optie;
- geschatte tijd 8 tot 12 minuten (woorden / 130 per minuut + interactie + 1 minuut per vraag);
- gemiddelde zinslengte ≤ 15 woorden; woorden uit een lijst met vaktermen moeten in `glossary` staan of uitgelegd worden;
- id's stabiel ten opzichte van `main`; afbeeldingen bestaan en hebben `alt`;
- alleen `https`-links; geen links naar bekende trackers.

---

## 3. Mijlpalen fase 1

Elke mijlpaal: eigen branch `feat/mNN-<slug>`, één pull request, door Jop gemerged. Standaard definition of done voor **elke** mijlpaal, plus wat er per mijlpaal bij staat:

- `npm run check` groen (format, lint, typecheck, unit-tests, content-check, build);
- `npm run e2e` groen;
- PR-beschrijving met wat er veranderd is en de handmatige check.

⚑ = mijlpaal met beslissingen die later duur zijn om terug te draaien. De planner kiest per beslissing een standaard, er wordt meteen gebouwd, en de PR zet de keuzes bovenaan onder "Beslissingen voor Jop". Jop beoordeelt ze bij de PR; zolang er niet gemerged is, kost een andere keuze alleen een extra commit.

| #      | Mijlpaal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Extra definition of done                                                                                                                                                                                                                 | Handmatige check voor Jop                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M1 ✅  | **Repo-opzet en werkwijze** (interactief met Jop, niet via de mijlpaal-skill): workspaces, Angular-skelet, ESLint/Prettier, Vitest, Playwright, husky + commitlint, `.gitattributes`, `CLAUDE.md`, `.claude/` (agents, skills, hooks, settings), README                                                                                                                                                                                                                                                                                                | hooks blokkeren commit op `main`, `--no-verify` en push met rode checks (aangetoond)                                                                                                                                                     | `npm install && npm start` toont een placeholderpagina; een commit op `main` wordt geweigerd                                  |
| M2 ✅  | **Huisstijl** ⚑: tokens, fonts zelf gehost, base-stijl, donkere modus, knop/kaart/sticker/plakbriefje, dev-pagina `/stijl`                                                                                                                                                                                                                                                                                                                                                                                                                             | e2e: geen enkel verzoek naar een ander domein; axe zonder fouten; tikvlakken ≥ 44 px                                                                                                                                                     | `/stijl` naast de referentieles: zelfde look, licht en donker                                                                 |
| M3 ✅  | **Ted en tekstballon**: `snf-ted`, `snf-speech-bubble`, `snf-ted-says`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | unit-test per stemming; geen animatie bij reduced motion                                                                                                                                                                                 | vier stemmingen op `/stijl`                                                                                                   |
| M4 ✅  | **Container en uitrollen**: Dockerfile, compose dev + NAS, CSP-hook, `release.yml`, README-uitrolhoofdstuk                                                                                                                                                                                                                                                                                                                                                                                                                                             | `docker compose -f deploy/compose.dev.yml up` serveert de app; CSP-header aanwezig (e2e)                                                                                                                                                 | eerste uitrol op de NAS volgens README; app bereikbaar op `http://<nas>:8090` vanaf telefoon op wifi                          |
| M5 ✅  | **Accounts en toegangsregels** ⚑: `users` met rol, migratie, dev-seed, loginpagina, guards, uitloggen                                                                                                                                                                                                                                                                                                                                                                                                                                                  | integratietests: kind A kan B niet lezen of wijzigen, kind kan eigen rol niet wijzigen, ouder leest alles                                                                                                                                | inloggen als testkind en testouder; `/ouder` geweigerd voor kind                                                              |
| M6 ✅  | **Inhoudsformaat v1** ⚑: schema's, catalogus, gegenereerde types, `content:check`, `content:build`, content-loader, testles als fixture                                                                                                                                                                                                                                                                                                                                                                                                                | elke check uit 2.4 heeft een test met een foute fixture                                                                                                                                                                                  | een fout in de fixture (bijv. ontbrekende bron) geeft een duidelijke melding                                                  |
| M7 ✅  | **Lesweergave**: lespagina, stappen-navigatie, alle bloktypen, woordenlijst, verder lezen, FAQ                                                                                                                                                                                                                                                                                                                                                                                                                                                         | e2e rendert de fixture-les volledig                                                                                                                                                                                                      | fixture-les lezen op telefoon en laptop                                                                                       |
| M7b ✅ | **Skill `snuffel-leren`** (naar voren gehaald uit fase 2, zie hoofdstuk 5): skill met intake, bronnen, leerpad en les schrijven; agents `source-researcher` en `content-reviewer`; branch en PR per les                                                                                                                                                                                                                                                                                                                                                | de skill maakt van een korte wens een les die `content:check` doorstaat en door `content-reviewer` komt (aangetoond met een voorbeeldles in de PR, niet gemerged als echte inhoud)                                                       | met de skill een les laten maken naar eigen wens en die lokaal lezen (`npm start`)                                            |
| M8 ✅  | **Voortgang, quiz en checklist**: `lesson_progress`, `quiz_attempts`, `checklist_states`; quiz met hints, feedback per optie, score + Ted; checklist onthouden                                                                                                                                                                                                                                                                                                                                                                                         | e2e: na herladen staan vinkjes en stapstatus er nog; integratietests op de nieuwe regels                                                                                                                                                 | quiz maken, uitloggen, inloggen: voortgang is bewaard                                                                         |
| M9 ✅  | **Interactie-framework + `trace-game`**: registry, `interaction_results`, voel-spel volledig data-gedreven                                                                                                                                                                                                                                                                                                                                                                                                                                             | unit-tests op de bouwstenen (zelfde curves als de referentie); reduced motion getest                                                                                                                                                     | voel-spel uit de fixture spelen, Ted reageert goed/fout                                                                       |
| M10 ✅ | **`stepped-exercise`** (nodig voor huiswerk in fase 2): invoer, hints, tussenstappen, `commonMistakes`, uitwerking pas na poging                                                                                                                                                                                                                                                                                                                                                                                                                       | tests voor tolerantie en toegestane vormen                                                                                                                                                                                               | voorbeeldopgave "breuken optellen" in de fixture doorlopen                                                                    |
| M11 ✅ | **Startpagina en cursusoverzicht**: Ted begroet met naam, leertrajecten met voortgang                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | e2e met twee kinderen: elk ziet alleen eigen voortgang                                                                                                                                                                                   | als beide testkinderen inloggen en vergelijken                                                                                |
| M12 ✅ | **Ouderoverzicht** `/ouder`: per kind lessen, quizscores, checklists, laatste activiteit; voortgang van een les wissen                                                                                                                                                                                                                                                                                                                                                                                                                                 | e2e als ouder                                                                                                                                                                                                                            | overzicht klopt met wat je als testkind deed                                                                                  |
| M13 ✅ | **Les 1 volledig in het nieuwe formaat**: referentieles omgezet, bronnen nagelopen, uitgerold op de NAS                                                                                                                                                                                                                                                                                                                                                                                                                                                | content-check groen; e2e doorloopt de hele les; visuele vergelijking met de referentie                                                                                                                                                   | les 1 doorlopen op de NAS                                                                                                     |
| M14 ✅ | **Breuknotatie in lessen** ⚑: inline `{{1/5}}` en `{{1 1/4}}` in lestekst als gestapelde breuk (fonts en kleuren van Snuffel, leesbaar voor een schermlezer); `content:check` weigert ongeldige breuken; `stepped-exercise` laat zien hoe een getypte breuk gelezen wordt; skill `snuffel-leren` kiest de notatie per les uit de foto's en meldt ontbrekende notatie; `content-reviewer` controleert de notatie                                                                                                                                        | gevallen in `inline-markup.cases.json` (tools en app); elke nieuwe check een test met een foute fixture; e2e: het proefhuiswerk toont gestapelde breuken (licht, donker, telefoon, axe, schermlezertekst) en hoe de invoer gelezen wordt | proefhuiswerk "breuken optellen" doorlopen op telefoon en laptop, licht en donker; breuken vergelijken met een werkboekpagina |
| M15    | **Interactie `typing-drill` (blind typen)** ⚑: regels overtypen op een fysiek toetsenbord, met de huidige letter gemarkeerd, een QWERTY-toetsenbord met de juiste toets en vinger plus vingerlegenda, foute toets rood met teken en tekst en doortypen; na afloop nauwkeurigheid, aanslagen per minuut en de vaakst foute toetsen; melding op een touchapparaat zonder toetsenbord; dode toetsen (US-International) bewust afgehandeld; resultaat in `interaction_results` zonder de getypte tekst; catalogus en skill `snuffel-leren` kennen de soort | unit-tests op scoring en dode toetsen; e2e op een thuisrij-fixture: goed typen, fout typen en doorgaan, resultaat in `/ouder`, touchmelding, reduced motion, axe (licht en donker)                                                       | thuisrij-oefening doorlopen op een laptop (ook met US-International), en op een telefoon de melding zien                      |

---

## 4. AI-workflow fase 1

### 4.1 `CLAUDE.md` (inhoud)

- **Taal**: code, identifiers, commits, branchnamen, codecommentaar Engels. UI-teksten, lesinhoud en docs voor Jop Nederlands.
- **Angular**: standalone, signals (`input()`, `output()`, `computed`, `effect` spaarzaam), zoneless, `OnPush`, nieuwe control flow (`@if`, `@for`), `inject()` in plaats van constructor-injectie, geen `any`, strict TypeScript. Prefix `snf-`. Eén component per map met `.ts`, `.html`, `.css`, `.spec.ts`.
- **Naamgeving**: bestanden kebab-case, klassen PascalCase, PocketBase-collecties en -velden snake_case, inhoud-id's kebab-case.
- **Stijl**: alleen tokens uit `tokens.css`, geen losse kleurwaarden; tikvlakken ≥ 44 px; focus zichtbaar; elke animatie respecteert reduced motion.
- **Privacy**: nooit een externe URL in code, CSS of `index.html` (fonts, CDN's, analytics). Externe links alleen in lesinhoud, met `rel="noopener noreferrer"`.
- **PocketBase**: elke collectiewijziging via een nieuwe migratie; nooit een bestaande migratie aanpassen; elke regel heeft een integratietest.
- **Tests**: elke component en service een unit-test; elke definition of done een e2e-test; geen tests overslaan of uitzetten om groen te krijgen.
- **Commits**: Conventional Commits (`feat(lesson): …`), klein en per logische stap. Nooit op `main`, nooit `--no-verify`, nooit force-push.
- **Inhoud**: id's nooit wijzigen na publicatie; geen tekst kopiëren uit bronnen, wel parafraseren met bronvermelding.
- **Werkwijze**: werk vanuit het mijlpaalplan in `docs/plan/mijlpalen/`; wijk je af, schrijf het op in het plan en meld het in de PR.

### 4.2 Subagents (`.claude/agents/`)

| Agent         | Verantwoordelijkheid                                                                                                                                                                                  | Tools                                                                                    | Wanneer                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| `planner`     | maakt van een mijlpaal een stappenplan: bestanden, tests, koppeling aan de definition of done, risico's. Schrijft `docs/plan/mijlpalen/mNN.md`                                                        | Read, Glob, Grep, Write (alleen `docs/plan/`)                                            | begin van elke mijlpaal               |
| `implementer` | bouwt het plan stap voor stap met unit-tests, draait `npm run check`, commit per stap                                                                                                                 | Read, Edit, Write, Glob, Grep, Bash                                                      | na het plan (en na goedkeuring bij ⚑) |
| `tester`      | schrijft e2e-tests voor de definition of done, draait alles, controleert in de browser (Playwright): geen externe verzoeken, axe, 44 px, reduced motion, donkere modus. Past alleen testbestanden aan | Read, Write/Edit (alleen `*.spec.ts`, `e2e/`, `pocketbase/tests/`), Bash, Playwright-MCP | na de implementer                     |
| `reviewer`    | leest de diff tegen `main` en toetst aan `CLAUDE.md`, de toegangsregels, privacy en het mijlpaalplan. Levert bevindingen als "blokkerend" of "suggestie" en verandert zelf niets                      | Read, Glob, Grep, Bash (alleen `git diff`/`git log`)                                     | na de tester, en opnieuw na fixes     |

### 4.3 Skills (`.claude/skills/`)

- **`mijlpaal-uitvoeren`** (`/mijlpaal-uitvoeren M7`)
  1. Controleer: `main` schoon en bijgewerkt; maak `feat/mNN-<slug>`.
  2. `planner` maakt het plan, met een standaard voor elke open vraag. Geen stop, ook niet bij ⚑.
  3. `implementer` bouwt per stap, commit per stap.
  4. `tester` vult tests aan en draait `npm run verify` (= check + e2e).
  5. `reviewer` beoordeelt; blokkerende punten gaan terug naar de `implementer`. Na twee rondes nog blokkerend: toch een PR, maar als draft met de resterende punten bovenaan.
  6. Alles groen → `git push -u origin` → `gh pr create` met beschrijving, afgevinkte definition of done en de handmatige check. **Stop: review door Jop.**
  7. Na merge door Jop (`/mijlpaal-uitvoeren afronden`): `main` bijwerken, branch opruimen, status in dit plan bijwerken.
- **`pb-collectie-toevoegen`**: migratie met velden, indexen en regels; TypeScript-type; methoden in de juiste service; integratietests voor kind A/kind B/ouder; README-tabel bijwerken.
- **`spelcomponent-bouwen`**: schemadefinitie voor de nieuwe `kind`, component met reduced-motion-variant, registratie in de registry, opslag via `interaction_results`, tests, voorbeeld in de fixture, en uitleg in `catalogus.md` zodat `snuffel-leren` de nieuwe soort kent.
- **`schema-wijzigen`**: nieuwe schemaversie, migratiescript voor bestaande inhoud, types opnieuw genereren, app ondersteunt oude en nieuwe versie tot alle inhoud omgezet is.

### 4.4 Kwaliteitspoorten

**Automatisch (git-hooks via husky)**

- `pre-commit`: Prettier + ESLint op gewijzigde bestanden; `content:check` als `content/` gewijzigd is; weigert commit op `main`.
- `commit-msg`: commitlint (Conventional Commits).
- `pre-push`: `npm run verify` (check + e2e); weigert push naar `main`.

**Automatisch (Claude Code-hooks in `.claude/settings.json`)**

- `PreToolUse` op Bash: `.claude/hooks/guard-git.mjs` blokkeert `git push` naar `main`, `--force`, `--no-verify`, `git commit` op `main` en `git reset --hard`.
- `PostToolUse` op Edit/Write: Prettier op het gewijzigde bestand.
- Permissies: `npm run *`, `npm install`/`npm ci`, `node tools/*`, `git status/diff/log/add/commit/switch`, `git push` naar `feat/*` en `content/*` (de pre-push-hook draait `verify`) en het aanmaken en lezen van een PR toegestaan; andere pushes en losse `docker`-commando's vragen bevestiging; mergen, force-push, `git reset --hard` en lezen van `.env` geweigerd.

**Vaste reviewmomenten voor Jop**

1. Dit plan (nu).
2. Elke pull request: lezen, "Beslissingen voor Jop" (bij ⚑) beoordelen, handmatige check, zelf mergen. Claude merget nooit.
3. Tussendoor alleen als `verify` niet groen te krijgen is, de vorige mijlpaal niet gemerged is, of er een gat in toegangsregels of privacy zit dat niet binnen de mijlpaal te dichten is. Een mijlpaal loopt verder autonoom tot de PR.

GitHub Actions draait geen checks (keuze van Jop); `release.yml` bouwt alleen de image. Omdat de pre-push-hook `verify` draait, komt er niets op GitHub dat lokaal rood was.

---

## 5. Skill `snuffel-leren` (mijlpaal M7b)

Doel: een leertraject of huiswerk-oefenles toevoegen als alleen inhoud, zonder app-code te wijzigen.

Oorspronkelijk fase 2; op verzoek van Jop naar voren gehaald als M7b, direct na de lesweergave (M7), zodat een gemaakte les meteen te lezen is. Tot M8 tot en met M10 klaar zijn, worden voortgang, quiz-scores, het voel-spel (`trace-game`) en `stepped-exercise` nog niet (volledig) getoond; de skill mag ze wel al schrijven, want het schema staat sinds M6. De huiswerkmodus (stap 5) is dus pas echt te gebruiken na M10.

**Stappen**

1. **Intake** (kort, maximaal zes vragen): wie leert (kind, ouder of samen; leeftijd), waarom, wat kan diegene al (een paar controlevragen), wat is "gelukt" (concreet en zichtbaar), hoeveel tijd per week, context (de vijver; of bij huiswerk: vak, niveau, methode en hoofdstuk). Kiest `kind`: `course` of `practice`.
2. **Bronnen eerst**: agent `source-researcher` zoekt minimaal drie betrouwbare bronnen, opent elke bron echt en legt titel, uitgever, type, betrouwbaarheid en datum vast. Bij huiswerk: de lesstof van de methode en de kerndoelen (SLO) als richtlijn.
3. **Leerpad**: lessen met elk één nieuw begrip, in volgorde van voorkennis, met per les het leerdoel. Schrijft `course.json` met lessen als `planned`. **Stop: Jop keurt het leerpad goed.**
4. **Les maken** volgens de regels: ongeveer 10 minuten; één nieuw begrip; eenvoudige taal, elke vakterm in de woordenlijst; eerst een herkenbaar voorbeeld, dan de uitleg; 3 tot 5 quizvragen met even lange opties en feedback bij elke optie; statische hints; een praktijkopdracht (`at-the-water` of `do-it-yourself`) met een "gelukt als"; elke bewering met een bron; Ted-reacties (intro, goed, fout, klaar). Interacties alleen uit de catalogus. Toon geschikt voor 12+ en niet kinderachtig voor volwassenen.
5. **Huiswerkmodus**: uitgewerkt voorbeeld, daarna `stepped-exercise`-opgaven die lijken op het huiswerk maar het niet letterlijk overnemen. Hints en tussenstappen gaan vóór het antwoord; de uitwerking komt pas na een eigen poging.
6. **Valideren**: `npm run content:check`. Fouten eerst oplossen.
7. **Review** door de aparte agent `content-reviewer` (alleen lezen, plus web-fetch om bronnen te openen): didactiek (één begrip, voorbeeld vóór theorie, quiz toetst het leerdoel), juistheid (elke bewering terug te vinden in de bron), geschiktheid voor kinderen (taal, veiligheid, geen enge of ongepaste inhoud), en bij huiswerk: geen voorgezegde antwoorden. Blokkerende punten → terug naar stap 4, maximaal twee rondes.
8. **Toevoegen**: branch `content/<course-id>-<lesson-id>`, commit, `npm run verify`, pull request met samenvatting, bronnenlijst en de reviewbevindingen. **Stop: Jop leest de les lokaal (`npm start`) en merget.** Daarna uitrollen zoals in 1.4.

Past een les niet in de catalogus (er is een nieuwe interactiesoort nodig), dan stopt de skill en stelt een mijlpaal voor via `spelcomponent-bouwen`. Dat is dan wél codewerk.

---

## 6. Risico's, open vragen en wat ik nodig heb

**Risico's**

- **"Zonder code" heeft een grens**: alleen de interactiesoorten uit de catalogus zijn zonder code te gebruiken. Een nieuwe soort is een kleine mijlpaal.
- **Bronnen en juistheid**: AI kan bronnen verzinnen of verkeerd samenvatten. Daarom: elke bron moet echt geopend zijn, de reviewer controleert beweringen tegen de bron, en Jop leest elke les vóór publicatie. Les 1 citeert nu een webwinkel (Decathlon); die wordt `low` en krijgt een tweede bron.
- **PocketBase is nog voor versie 1.0**: updates kunnen dingen breken. Versie vastpinnen en alleen bewust bijwerken, met de integratietests als vangnet.
- **Inhoud wijzigen breekt voortgang**: opgevangen met vaste id's, `version` per les en de id-check tegen `main`.
- **Geen https op het thuisnetwerk**: wachtwoorden gaan onversleuteld over je wifi. Klein risico thuis; op te lossen met Tailscale (geeft https) of de reverse proxy van DSM met een eigen certificaat, zonder wijziging aan de app.
- **Geen checks op GitHub**: wie de lokale hooks omzeilt, kan iets kapots pushen. De Claude-hooks blokkeren dat voor Claude; voor jezelf blijft het discipline.
- **Agents die blijven proberen**: maximaal twee fixrondes per review, daarna stopt de workflow.

**Open vragen (niet blokkerend, standaard tussen haakjes)**

1. Release bij elke merge naar `main`, of alleen bij een versietag `v*`? (elke merge)
2. Inloggen voor kinderen met gebruikersnaam + wachtwoord, of eenvoudiger (bijv. naam kiezen + pincode)? (gebruikersnaam + wachtwoord; pincode kan later)
3. Akkoord met de Engelse input `mood` in plaats van `stemming`? (ja)

**Wat ik nodig heb van jou**

- Namen en gebruikersnamen van de kinderen en jezelf (de echte accounts maak je zelf aan op de NAS; ik gebruik alleen testaccounts uit de dev-seed).
- Of de GitHub-repo `Versure/Snuffel` privé is, en of Actions en ghcr.io aan staan. Een token met alleen `read:packages` voor de NAS maak je zelf aan.
- NAS: DSM-versie, of Container Manager werkt, de map voor Docker (standaard `/volume1/docker`), IP-adres of naam van de NAS, en of poort 8090 vrij is. Ik heb geen toegang tot de NAS nodig: de uitrolstappen doe jij, ik schrijf ze uit in de README.
- Tijd voor review: per mijlpaal ongeveer 15 tot 30 minuten.
