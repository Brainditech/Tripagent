# 0004 — Quota mensuel réservé dans une table dédiée, en une seule requête

- **Date** : 2026-10-11
- **Statut** : acceptée

## Contexte
`POST /api/trips` (commit `41e755f`, branche `feat/create-trip`) limitait les générations par mois en comptant les jobs `generate` non `failed` du mois UTC, puis en insérant le voyage et le job. Deux failles, relevées par CodeRabbit sur la PR :

- **Les jobs partent avec leur voyage** (`jobs.trip_id` en `ON DELETE CASCADE`). Générer, supprimer le voyage, générer à nouveau : le compte repart de zéro. Le quota ne protège donc pas la dépense Claude, ce qui est son seul rôle.
- **Compter puis insérer sont deux requêtes** : des requêtes concurrentes lisent toutes un compte sous la limite et passent toutes. Le commentaire de `quota.ts` acceptait « un dépassement de un » pour un double envoi ; en réalité rien ne borne le nombre de requêtes simultanées. La concurrence Inngest (1 par utilisateur, 5 au total) ralentit l'exécution mais ne refuse rien.

Objectif : une limite mensuelle qu'aucune suppression ni aucune concurrence ne contourne, sans transaction interactive (le driver Neon HTTP n'en a pas), et qui rend toujours sa place à une génération échouée.

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — Table `monthly_generations (user_id, month, used)` : un `INSERT … ON CONFLICT (user_id, month) DO UPDATE SET used = used + 1 WHERE used < limite RETURNING used` réserve une place avant d'insérer le voyage ; aucune ligne renvoyée = 429. Un job qui échoue décrémente la ligne du mois où il a été créé | Atomique par construction : Postgres verrouille la ligne au conflit et réévalue le `WHERE` sur sa version la plus récente, donc deux requêtes ne prennent jamais la même dernière place. La ligne survit aux voyages et aux jobs. Une requête, pas de transaction | Une table de plus (migration `0003`), et un compteur à tenir à jour (réserver, rendre) au lieu d'une valeur dérivée. Une place réservée puis jamais rendue (panne entre la réservation et l'insertion) serait perdue : la route la rend elle-même en cas d'échec de l'insertion |
| B — Garder les jobs comme source : ajouter `jobs.user_id`, passer `trip_id` en `ON DELETE SET NULL`, et sérialiser compte + insertion avec `pg_advisory_xact_lock` dans un `db.batch` (une transaction chez Neon HTTP) | Une seule source de vérité, lisible dans l'historique des jobs | Migration plus lourde (colonne à remplir, contrainte modifiée, jobs orphelins à gérer partout). Repose sur le verrou consultatif et sur la transactionnalité du batch, moins évidents à relire qu'un `ON CONFLICT`. L'insertion conditionnelle reste une sous-requête de comptage |
| C — Garder le comptage actuel, interdire la suppression d'un voyage généré dans le mois | Aucun changement de schéma | Casse une fonction attendue (supprimer son voyage) et ne traite pas la concurrence |

## Décision
**Option A.** L'atomicité tient dans une seule instruction SQL lisible, la place réservée ne dépend plus de l'existence du voyage, et le coût est une petite table.

Règles appliquées (`src/server/trips/quota.ts`) :
- `reserveTripQuota(userId, limite, mois)` avant toute insertion ; `limite ≤ 0` refuse sans requête.
- `releaseTripQuota(userId, mois)` ramène `used` à `greatest(used - 1, 0)`. Appelé si l'insertion du voyage ou du job échoue (route), et par `markGenerationFailed` quand un job passe à `failed` ; ce passage ne se fait qu'une fois (`WHERE status <> 'failed' RETURNING created_at`), et la place revient au mois de création du job, pas au mois courant.
- `GET /api/me` lit `used` dans la table.
- `month` est le premier jour du mois UTC (`YYYY-MM-01`), règle inchangée (PLAN.md).

## Conséquences
- Migration `0003_monthly_generations` : table, clé primaire `(user_id, month)`, cascade depuis `users`, et une reprise des jobs `generate` non `failed` déjà présents, groupés par utilisateur et mois UTC.
- Supprimer un voyage ne rend plus sa place. C'est voulu : le quota borne la dépense, pas le nombre de voyages conservés.
- Une génération échouée rend sa place, comme avant.
- Les jobs restent en cascade avec leur voyage : ils ne portent plus le quota, seulement l'avancement et les tokens.

## Commit
`1c041cb` (`fix(quota): reserve the monthly generation quota atomically in a table that survives trip deletion`, branche `feat/create-trip`) : table, migration `0003`, `quota.ts`, routes `api/me` et `api/trips`, `markGenerationFailed`.

Preuve, le 11/10/2026 (heure de Paris), serveur de test `expo start --port 8082` lancé avec `QUOTA_TRIPS_PER_MONTH=10`, les 9 générations du mois reprises par la migration, jeton de session réel du compte de test :

| Heure | Appel | Résultat |
|-------|-------|----------|
| 22:29:24 | `GET /api/me` | 200, `tripsUsedThisMonth` 9, `tripsRemaining` 1 |
| 22:29:25.523 | 3 × `POST /api/trips` envoyés en même temps | un 202 (`tripId` `b19089c0`), deux 429 `quota_exceeded`, les trois réponses dans la même milliseconde |
| 22:29:25 | `GET /api/me` | 200, 10 utilisés, 0 restant |
| 22:30:34 | `GET /api/trips/[id]/status`, puis `DELETE /api/trips/[id]` | `ready` / `succeeded`, puis 204 |
| 22:30:34 | `GET /api/me` après la suppression | 200, toujours 10 utilisés |

Tests unitaires : `tripQuotaReservation` rend `insert … on conflict ("user_id","month") do update set "used" = "monthly_generations"."used" + 1 … where "monthly_generations"."used" < $n returning "used"` ; `reserveTripQuota` répond 429 sans requête pour une limite à 0. `npm test` : 54 tests ; `tsc --noEmit` et `expo lint` passent.
