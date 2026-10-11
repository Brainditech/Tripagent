# 0006 — Logs Sentry côté app : les échecs d'appels API journalisés une fois dans le client, l'issue des opérations dans les écrans

- **Date** : 2026-10-11
- **Statut** : acceptée

## Contexte
Sentry est initialisé dans `src/app/_layout.tsx` avec `enableLogs: true` depuis la Phase 10, mais l'app n'envoyait aucun log. Côté téléphone, les échecs sont absorbés par TanStack Query et traduits en message français pour l'utilisateur ; Sentry ne les voit jamais, faute de `captureException` : 401, 404 ou 429 de l'API, refus d'ImageKit, erreur Clerk sans message connu, connexion Google qui revient sans session. Deux `console.warn` existaient, visibles seulement dans le terminal Metro.

Objectif : comprendre un problème de production avec Sentry seul, sans accès à la base ni au terminal, en restant simple : `Sentry.logger` du paquet déjà installé, pas de wrapper, et seulement dans les fonctions où un log aide vraiment.

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — Un log dans chaque écran, à chaque `onError` de mutation ou de query | Le contexte métier est sous la main | Un log par appel, des doublons entre écrans, et chaque nouvel écran doit y penser |
| B — Les échecs d'appels API journalisés une fois dans le client (`createApi`) ; les écrans et `src/lib` ne journalisent que l'issue d'une opération, ou ce qui ne passe pas par l'API | Un seul endroit couvre tous les appels présents et futurs ; les écrans n'ajoutent que ce qu'eux seuls savent (identifiant du voyage, étape, paramètres) | Le log du client API n'a pas le contexte métier ; un échec d'envoi de couverture produit deux logs (celui de l'API et celui de l'opération) |
| C — `consoleLoggingIntegration` : transformer les `console.*` existants en logs | Aucun code | Logs non structurés, sans attribut filtrable, qui captent aussi le bruit des bibliothèques |

## Décision
**Option B.** Règles appliquées :
- `src/lib/api.ts` : une requête sans réponse (hors ligne, DNS) → `warn` « API request got no answer » ; une réponse non 2xx → « API request rejected », `warn` pour un refus (4xx), `error` pour une faute serveur (5xx). Attributs `method`, `route`, `status`, `code`, `message`, `has_token`, `duration_ms` ; `route` est le chemin avec l'id de voyage masqué (`/api/trips/[id]/cover`), parce que cet id vient des paramètres de route, donc de n'importe quel lien profond.
- Opérations : `info` « Trip generation requested » (`new-trip.tsx`, avec `days`, `travelers`, `budget`, `pace`, `interests`, lus dans le corps envoyé et non dans l'état du formulaire) ; `info` « Trip generation finished » ou `error` « Trip generation failed » avec `step` et `job_error` (`progress.tsx`, un effet sur le statut terminal ; `markGenerationFailed` efface `current_step`, donc `step` est la dernière step vue pendant le polling, `queued` si l'écran n'en a vu aucune) ; `info` « Trip cover uploaded » ou `error` « Trip cover upload failed » avec l'étape fautive `sign`, `upload` ou `record` (`uploadTripCover`) ; `info` « Trip deleted » ; `warn` « Link could not be opened » avec l'hôte du lien seulement (détail du voyage).
- Authentification : `authErrorMessage` journalise chaque erreur Clerk (`code`, `known`, `message`, `status`, `clerk_trace_id`), en `info` quand un message français existe et en `warn` sinon : la liste `MESSAGES` se complète à partir des logs `known: false`. Écran de connexion : `warn` « Google SSO ended without a session » avec le diagnostic (jusqu'ici réservé aux builds de développement, désormais journalisé partout et affiché à l'écran en développement seulement) et `warn` « Google sign-up needs fields the app does not collect » avec `missing_fields`.
- Conventions : messages en anglais, attributs en `snake_case` (recommandation de la doc Sentry), valeurs `string`, `number` ou `boolean` seulement (le SDK sérialise le reste en JSON), un log par opération plutôt qu'un par étape. Aucune donnée personnelle : ni adresse e-mail, ni nom de destination, ni URL de callback ou de lien ; les identifiants de voyage sont des UUID.
- Ni `beforeSendLog`, ni `Sentry.setUser` : `sendDefaultPii: false` reste tel quel.

## Conséquences
- Les development builds envoient aussi leurs logs, avec `environment: development` (posé par le SDK d'après `__DEV__`) : filtrer sur `environment` dans Sentry.
- Sans utilisateur sur le scope, les logs d'une même personne ne se relient que par `trip_id`. Poser l'id Clerk (opaque) avec `Sentry.setUser({ id })` est à décider avec le volet serveur de la Phase 10.
- Un échec de chargement des polices laisse l'écran vide sans rien envoyer : c'est une exception, affaire de `captureException`, hors de cette décision.
- Le côté serveur (API routes, `onFailure` d'Inngest) reste à faire en Phase 10.
- Volume contenu : seuls les échecs d'appels API et quelques événements par voyage ; les durées des requêtes réussies sont dans le tracing (`tracesSampleRate: 1.0`), pas dans les logs.

## Commit
`9fd4341` (`feat(observability): send structured Sentry logs from the app`, branche `feat/sentry-logs`).

Preuve, le 11/10/2026 à 23:49 (heure de Paris) : `tsc --noEmit`, `expo lint` et `npm test` (56 tests) passent. Sur l'émulateur, dev build rechargé par Metro, ouverture du lien `tripagent://trips/00000000-0000-0000-0000-000000000000/progress` : l'écran affiche « Impossible de suivre la génération » après le 404 et sa relance par TanStack Query, soit deux passages par le log « API request rejected » (`status` 404, `has_token` vrai). La réception dans Sentry n'a pas pu être vérifiée depuis le poste : le jeton de `.env` ne sert qu'à l'envoi des source maps (403 sur l'API de l'organisation) et le SDK n'écrit rien dans logcat sans `debug: true`. À confirmer dans Explore → Logs du projet `tripagent`.

Revue CodeRabbit de la PR, corrigée le 12/10/2026 en trois commits : `21f5763` (`days` calculé par `tripDays` sur les dates du corps envoyé, l'état du formulaire pouvant changer entre l'envoi et la réponse), `fbc0c1c` (hôte du lien à la place de l'URL complète), `5dec0a4` (dernière step observée conservée dans une ref, puisque le serveur efface `current_step` à l'échec). `tsc`, `expo lint` et les 56 tests passent ; l'écran de progression du voyage inconnu s'affiche toujours (état d'erreur après le 404).

Deuxième passe, `035e564` : le log « Link could not be opened » ne garde que `host`. Le message de rejet de `Linking.openURL` sur Android (« Could not open URL '…' : No Activity found to handle Intent ») répétait l'URL complète que `fbc0c1c` venait de retirer. `tsc`, `expo lint` et les 56 tests passent.

Troisième passe, `06794cb` : les deux logs du client API portaient `path` tel quel, avec l'id de voyage issu des paramètres de route (donc de n'importe quel lien profond). CodeRabbit proposait une valeur fixe ; retenu à la place : `route`, le chemin avec l'id masqué (`/api/trips/[id]/status`), qui garde l'information utile (quelle route a échoué) sans la partie contrôlée par la requête. Test unitaire `src/lib/api.test.ts` (2xx sans log, 4xx en `warn` avec la route masquée, 5xx en `error`, absence de réponse en `warn`) ; 60 tests, `tsc` et `expo lint` passent.
