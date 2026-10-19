---
name: pb-collectie-toevoegen
description: Voegt een PocketBase-collectie toe aan Snuffel met migratie, toegangsregels, TypeScript-type, service-methoden en integratietests voor kind A, kind B en ouder. Gebruik bij elke nieuwe of gewijzigde collectie of toegangsregel.
argument-hint: '<collectienaam> <korte omschrijving>'
---

# PocketBase-collectie toevoegen

Lees eerst `CLAUDE.md` (sectie PocketBase) en hoofdstuk 1.3 van `docs/plan/implementatieplan.md`. Bestaat de collectie al, dan pas je hem aan met een nieuwe migratie; nooit een bestaande migratie wijzigen.

## Stappen

1. **Ontwerp** (in het mijlpaalplan of, buiten een mijlpaal, eerst aan Jop voorleggen):
   - naam en velden in snake_case, met type, verplicht ja/nee;
   - unieke indexen (bijv. `user, lesson_id, step_id`);
   - de vijf regels (list, view, create, update, delete). Standaard voor voortgangsgegevens:
     - list/view: `user = @request.auth.id || @request.auth.role = "parent"`
     - create: `@request.body.user = @request.auth.id`
     - update: `user = @request.auth.id && @request.body.user:isset = false` (of `null` voor alleen toevoegen)
     - delete: `@request.auth.role = "parent"`
2. **Migratie** `pocketbase/pb_migrations/<unix-timestamp>_create_<naam>.js` met `migrate(up, down)`. `down` maakt de wijziging ongedaan.
3. **Type** in `web/src/app/core/pocketbase/types.ts` (record-interface, velden zoals in PocketBase).
4. **Service**: methoden in de bestaande service van dat domein (bijv. `ProgressService`); alleen via `PocketBaseService`. Unit-tests met een gemockte client.
5. **Integratietest** in `pocketbase/tests/<naam>.rules.spec.ts`: start PocketBase met lege data, migraties toegepast, maak kind A, kind B en ouder, en bewijs per regel:
   - A kan eigen record maken, lezen en (indien toegestaan) wijzigen;
   - A kan het record van B niet lezen, wijzigen of verwijderen, en geen record maken met `user` = B;
   - A kan `user` van een eigen record niet omzetten;
   - de ouder kan alles lezen en (indien toegestaan) verwijderen;
   - zonder login: niets.
6. **Documentatie**: werk de collectietabel in hoofdstuk 1.3 van het implementatieplan bij.
7. `npm run verify` groen, commit `feat(pb): add <naam> collection`.
