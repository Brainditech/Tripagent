# 0003 — Ordre des événements du webhook Clerk

- **Date** : 2026-10-10
- **Statut** : acceptée

## Contexte
Le webhook Clerk (`src/app/api/webhooks/clerk+api.ts`, `c6091e2`) écrivait `user.created` et `user.updated` dans `users` par un upsert sans condition, et `user.deleted` envoyait `user/deleted` à Inngest, qui supprime la ligne.

La doc de Clerk ([Webhooks overview](https://clerk.com/docs/guides/development/webhooks/overview), section « No ordering guarantee ») dit : « Events aren't guaranteed to arrive in the order they occurred. » Un `user.updated` peut arriver avant le `user.created` du même compte, deux `user.updated` peuvent se croiser, et un événement en échec est renvoyé après ceux livrés entre-temps. Chaque livraison du même événement porte le même `svix-id`, mais un retry peut atteindre la route plus d'une fois. La règle qu'elle donne : « skip an incoming event if its `data.updated_at` is older than the stored value ». Les objets supprimés n'ont pas de `updated_at` ; l'événement porte un `timestamp` en millisecondes.

Avec l'upsert sans condition, un `user.updated` en retard écrasait un nom ou un e-mail plus récent, et un `user.created` ou `user.updated` livré après `user.deleted` recréait la ligne d'un compte qui n'existe plus. Remarque CodeRabbit sur la PR de `feat/user-sync`.

Objectif : le même état en base quel que soit l'ordre d'arrivée, sans appel réseau supplémentaire dans le webhook, et sans fenêtre entre une lecture et une écriture.

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — Comparer les horodatages de Clerk : `users.clerk_updated_at` reçoit le `updated_at` de l'événement, et `user.created` / `user.updated` n'écrivent que s'il est plus récent, dans la même requête SQL. À la suppression, `deleted_users` garde l'id et le `timestamp` de l'événement, et tout `user.created` / `user.updated` qui n'est pas plus récent que cette trace est refusé | C'est la règle de la doc de Clerk. Aucun appel réseau. La condition est dans la requête d'écriture : rien ne peut se glisser entre une lecture et l'écriture. Idempotent : un rejeu ne change rien et répond 200, donc Svix ne le renvoie pas | Une colonne et une table de plus, donc une migration. Deux événements avec le même `updated_at` : seul le premier arrivé est écrit. La trace des comptes supprimés n'est jamais purgée |
| B — Relire l'utilisateur par l'API Backend de Clerk à chaque événement (l'événement n'est qu'un signal, l'état vient de l'API) | Toujours l'état courant, quel que soit l'ordre des événements. Pas de colonne supplémentaire | Ajoute un appel réseau au webhook, avec sa latence et ses échecs (le temps de réponse compte pour les retries Svix). Laisse un message se glisser entre la lecture et l'écriture : un autre événement peut écrire entre les deux, et la lecture déjà faite écrase ensuite un état plus récent. Pour `user.deleted`, l'API répond 404, il faut quand même une trace pour refuser un événement tardif |

## Décision
**Option A.** Elle suit la règle de Clerk, ne coûte aucun appel réseau et tient dans la requête d'écriture.

La règle appliquée :
- `users.clerk_updated_at` (`timestamptz`, NOT NULL) reçoit `data.updated_at` de l'événement. `user.created` et `user.updated` font le même `INSERT … SELECT … WHERE NOT EXISTS (trace de suppression ≥ updated_at) ON CONFLICT (id) DO UPDATE … WHERE users.clerk_updated_at < excluded.clerk_updated_at RETURNING id`. Aucune ligne renvoyée : l'événement n'est pas plus récent, la route répond 200 avec `ignored: "stale"`.
- `deleted_users (id, deleted_at)` reçoit l'id et le `timestamp` de `user.deleted` **avant** l'envoi de `user/deleted` à Inngest : une fois la route en 200, un événement tardif ne peut plus recréer le compte. Un rejeu garde la date la plus récente.
- « Plus récent » est strict : un événement dont le `updated_at` est égal à la valeur stockée ou à la trace ne s'écrit pas.

## Conséquences
- Migration `0001_users_event_ordering` : colonne `clerk_updated_at` NOT NULL sans valeur par défaut, ajoutée alors que `users` était vide, et table `deleted_users`. Appliquée sur la branche Neon `dev`. En production, les deux migrations partiront ensemble, avant la première écriture.
- L'upsert est écrit en SQL avec le template `sql` de Drizzle : le query builder ne combine pas un `INSERT … SELECT … WHERE NOT EXISTS` limité aux colonnes utiles avec un `DO UPDATE … WHERE`. Le `deleted_users` passe par le builder (`onConflictDoUpdate` avec `setWhere`).
- Pas de départage par le `timestamp` de l'événement, que la doc propose en plus : on suppose que Clerk change `updated_at` à chaque `user.updated`, et deux changements du même compte dans la même milliseconde sont improbables. À revoir si un `user.updated` légitime est un jour ignoré (log « ignored: not newer than the stored account or its deletion »).
- La trace des suppressions n'est pas purgée : Clerk ne réutilise jamais un id, donc une ligne par compte supprimé, sans effet sur les écritures des autres comptes.
- Le `svix-id` n'est pas stocké : la règle sur `updated_at` suffit à rendre un rejeu sans effet. Il reste la clé d'idempotence de l'événement Inngest `user/deleted`.
- L'upsert de secours prévu dans `requireUser` (PLAN.md, Phase 3) devra appliquer la même règle, par exemple en réutilisant cette fonction.

## Commit
`2ff4e85` (`fix(users): apply Clerk webhook events only when newer than the stored account`, branche `feat/user-sync`) : route, schéma, migration `0001`.

Preuve : rejeu d'événements signés (HMAC Svix avec le secret de `.env`) vers `http://localhost:8081/api/webhooks/clerk`, serveur Expo et Dev Server Inngest locaux, base Neon `dev`, le 10/10/2026 de 21:15:35 à 21:15:39 (heure de Paris). Les horodatages portés par les événements (T1 < T2 < T3 < T4) vont de 21:05:34 à 21:08:34, une minute entre chacun.

| Étape | Événement | Résultat |
|-------|-----------|----------|
| A1 | `user.created` T1 | 200, ligne créée (nom « Un Rejeu », `clerk_updated_at` T1) |
| A2 | `user.updated` T3 | 200, ligne mise à jour (« Trois Rejeu », T3) |
| A3 | `user.updated` T2, plus ancien que T3 déjà appliqué | 200 `ignored: stale`, ligne inchangée |
| A4 | `user.updated` T3 rejoué (retry) | 200 `ignored: stale`, ligne inchangée |
| A5 | `user.deleted`, timestamp T4 | 200, trace `deleted_users` à T4, ligne supprimée par le run Inngest en une seconde |
| A6 | `user.created` T1 rejoué après la suppression | 200 `ignored: stale`, pas de ligne |
| A7 | `user.updated` T3 rejoué après la suppression | 200 `ignored: stale`, pas de ligne |
| B1 | `user.updated` T2 avant tout `user.created` | 200, ligne créée (« Deux Rejeu », T2) |
| B2 | `user.created` T1 en retard | 200 `ignored: stale`, ligne inchangée |
| B3 | `user.deleted` timestamp T3, puis `user.updated` T2 en retard | 200, ligne supprimée par Inngest, puis 200 `ignored: stale`, pas de ligne |

Les lignes et traces de test ont été effacées ensuite. `npx tsc --noEmit` et `npx expo lint` passent.
