---
name: mijlpaal-uitvoeren
description: Voert een Snuffel-mijlpaal autonoom van begin tot eind uit (branch, plan, bouwen, testen, review, pull request) en haakt Jop pas in bij de pull request. Gebruik bij "/mijlpaal-uitvoeren M7", "doe mijlpaal 7", "volgende mijlpaal", of "/mijlpaal-uitvoeren afronden" na een merge.
argument-hint: 'MNN | volgende | afronden'
---

# Mijlpaal uitvoeren

Argument: een mijlpaal (`M7`), `volgende` (eerste mijlpaal in `docs/plan/implementatieplan.md` zonder status "gemerged") of `afronden`.

**Autonoom tot de pull request.** Vraag Jop onderweg niets: geen akkoord op het plan, geen keuze tussen opties, geen bevestiging. Neem bij elke open vraag de voorgestelde standaard, leg hem vast in het plan en zet hem bovenaan de PR. Jop beoordeelt alles in één keer bij de PR en kan daar nog alles terugdraaien, want er is dan nog niets gemerged. Meld alleen met korte regels welke fase je start en wat eruit kwam.

Stop vóór de PR alleen in deze gevallen (en zeg precies wat er nodig is):

- de werkmap is niet schoon of de vorige mijlpaal is niet gemerged;
- `npm run verify` is na drie gerichte pogingen niet groen te krijgen (rood pushen kan niet: de pre-push-hook draait `verify`);
- een agent vindt een gat in de toegangsregels of privacy dat niet binnen de mijlpaal te dichten is.

## 1. Voorbereiden

1. `git status`: werkmap moet schoon zijn. Zo niet: stop en meld wat er openstaat.
2. `node tools/check-node.mjs`; is de Node-versie te oud, schakel dan naar de versie uit `.nvmrc` (bijv. via nvm) voor alle volgende stappen, ook in de agents.
3. `git switch main && git pull --ff-only`.
4. Controleer dat de vorige mijlpaal gemerged is (status in `docs/plan/mijlpalen/`, of de PR-status). Zo niet: stop.
5. `git switch -c feat/mNN-<slug>` (slug uit de titel, Engels, kebab-case). Schrijft de omgeving een andere branch voor (bijv. een cloudsessie), gebruik die en noteer het onder "Afwijkingen".
6. Staat de vorige mijlpaal nog niet op "gemerged": eerste commit `docs(plan): mark MNN as merged` (zie "Afronden", stap 3).

## 2. Plannen

1. Zet de agent `planner` in met het mijlpaalnummer.
2. Lees het plan zelf na: kloppen stappen en definition of done met het implementatieplan? Heeft elke open vraag een standaard? Zo niet: laat de planner die aanvullen.
3. Commit het plan: `docs(plan): add MNN plan`. Ga direct door, ook bij ⚑ of open vragen: die gaan naar de PR (sectie "Beslissingen voor Jop").

## 3. Bouwen

Zet de agent `implementer` in met het plan; geef mee dat de standaarden uit "Open vragen" gelden. Controleer na afloop: `git log main..HEAD --oneline` toont de verwachte commits en `npm run check` is groen.

## 4. Testen

Zet de agent `tester` in. Meldt die fouten in de app, geef ze aan de `implementer` en laat daarna de `tester` opnieuw draaien.

Kan Playwright zijn eigen browser niet downloaden (bijv. een proxy), zet dan `PLAYWRIGHT_CHROMIUM_PATH` naar een geïnstalleerde Chromium. Kan iets in de omgeving echt niet (bijv. geen Docker voor `npm run e2e:container`): noteer het onder "Afwijkingen", ga door en zet het in de PR als open punt voor Jop.

## 5. Review

1. Zet de agent `reviewer` in.
2. Blokkerende punten → `implementer` lost ze op → `tester` draait `npm run verify` → `reviewer` opnieuw. Kleine suggesties binnen de scope gaan mee.
3. Na twee rondes nog blokkerend: ga toch door naar de PR als `verify` groen is, maar open hem als **draft** en zet de resterende punten bovenaan onder "Afwijkingen en open punten".

## 6. Pull request

1. `npm run verify` moet groen zijn. Zo niet: niet pushen, terug naar stap 3.
2. Zet de status in het mijlpaalplan op "klaar voor review" en commit.
3. `git push -u origin <branch>` (de pre-push-hook draait `verify` nogmaals).
4. Maak de PR tegen `main` (`gh pr create --base main --title "<type>: MNN <titel>" --body-file <tijdelijk bestand>`, of de GitHub-tool van de omgeving als `gh` er niet is) met deze beschrijving (Nederlands):

```markdown
## Wat

<2–4 zinnen>

## Beslissingen voor Jop

<Alleen bij ⚑ of open vragen: per vraag de gekozen standaard in één regel, en wat terugdraaien kost. Leeg: "Geen.">

## Definition of done

- [x] `npm run check` groen
- [x] `npm run e2e` groen
- [x] <elk punt uit het plan, met testnaam>

## Handmatige check

1. …

## Afwijkingen en open punten

…

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

5. **Stop.** Geef Jop de link naar de PR, de beslissingen en de handmatige check. Merge nooit zelf. Wil Jop een beslissing anders, dan pas je dat op dezelfde branch aan (nieuwe commit; bij een migratie de migratie van deze PR, want die is nog niet gemerged) en draai je stap 4 tot en met 6 opnieuw.

## Afronden (`/mijlpaal-uitvoeren afronden`)

1. `gh pr view --json state` (of de GitHub-tool) op de branch: moet `MERGED` zijn, anders stop.
2. `git switch main && git pull --ff-only`. Verwijder de lokale branch: `git branch -d feat/mNN-<slug>`; weigert git omdat de PR als squash gemerged is, gebruik dan `-D` (de PR-status is net als `MERGED` bevestigd).
3. De statuswijziging (mijlpaalplan op "gemerged", ✅ achter de mijlpaal in de tabel van het implementatieplan) wordt de eerste commit op de branch van de volgende mijlpaal (`docs(plan): mark MNN as merged`). Geen losse PR.
