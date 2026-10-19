---
name: mijlpaal-uitvoeren
description: Voert een Snuffel-mijlpaal van begin tot eind uit (branch, plan, bouwen, testen, review, pull request) en stopt voor de review van Jop. Gebruik bij "/mijlpaal-uitvoeren M7", "doe mijlpaal 7", "volgende mijlpaal", of "/mijlpaal-uitvoeren afronden" na een merge.
argument-hint: 'MNN | volgende | afronden'
---

# Mijlpaal uitvoeren

Argument: een mijlpaal (`M7`), `volgende` (eerste mijlpaal in `docs/plan/implementatieplan.md` zonder status "gemerged") of `afronden`.

Houd Jop op de hoogte met korte regels: welke fase je start en wat eruit kwam.

## 1. Voorbereiden

1. `git status`: werkmap moet schoon zijn. Zo niet: stop en meld wat er openstaat.
2. `git switch main && git pull --ff-only`.
3. Controleer dat de vorige mijlpaal gemerged is (status in `docs/plan/mijlpalen/`). Zo niet: stop.
4. `git switch -c feat/mNN-<slug>` (slug uit de titel, Engels, kebab-case).

## 2. Plannen

1. Zet de agent `planner` in met het mijlpaalnummer.
2. Lees het plan zelf na: kloppen stappen en definition of done met het implementatieplan?
3. Commit het plan: `docs(plan): add MNN plan`.
4. **Mijlpaal met ⚑ of open vragen bovenaan het plan: stop hier.** Vat het plan in een paar regels samen voor Jop, stel de open vragen, en ga pas verder na zijn akkoord.

## 3. Bouwen

Zet de agent `implementer` in met het plan. Controleer na afloop: `git log main..HEAD --oneline` toont de verwachte commits en `npm run check` is groen.

## 4. Testen

Zet de agent `tester` in. Meldt die fouten in de app, geef ze aan de `implementer` en laat daarna de `tester` opnieuw draaien.

## 5. Review

1. Zet de agent `reviewer` in.
2. Blokkerende punten → `implementer` lost ze op → `tester` draait `npm run verify` → `reviewer` opnieuw.
3. **Na twee rondes nog blokkerend: stop** en leg de resterende punten aan Jop voor.

## 6. Pull request

1. `npm run verify` moet groen zijn. Zo niet: niet pushen, terug naar stap 3.
2. Zet de status in het mijlpaalplan op "klaar voor review" en commit.
3. `git push -u origin feat/mNN-<slug>` (de pre-push-hook draait `verify` nogmaals).
4. `gh pr create --base main --title "<type>: MNN <titel>" --body-file <tijdelijk bestand>` met deze beschrijving (Nederlands):

```markdown
## Wat

<2–4 zinnen>

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

5. **Stop.** Geef Jop de link naar de PR en de handmatige check. Merge nooit zelf.

## Afronden (`/mijlpaal-uitvoeren afronden`)

1. `gh pr view --json state` op de branch: moet `MERGED` zijn, anders stop.
2. `git switch main && git pull --ff-only`. Verwijder de lokale branch: `git branch -d feat/mNN-<slug>`; weigert git omdat de PR als squash gemerged is, gebruik dan `-D` (de PR-status is net als `MERGED` bevestigd).
3. De statuswijziging (mijlpaalplan op "gemerged", ✅ achter de mijlpaal in de tabel van het implementatieplan) wordt de eerste commit op de branch van de volgende mijlpaal (`docs(plan): mark MNN as merged`). Geen losse PR.
