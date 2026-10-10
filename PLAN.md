# Tripagent — Plan d'implémentation v1

## Contexte
Projet d'apprentissage : refaire l'app d'un tuto, un planificateur de voyages par IA, sur Android uniquement. La spec a été validée à l'issue de l'interview, avec les corrections suivantes :
- Authentification : Google + code à usage unique envoyé par email (sans mot de passe). Apple viendra avec iOS.
- Modèle Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), id centralisé dans la config.
- Quotas lus depuis des variables d'environnement, avec des limites hautes en développement.
- Couverture : Unsplash affiché en direct, avec crédit au photographe. Leurs conditions interdisent le proxy via ImageKit. La couverture personnalisée téléversée par l'utilisateur passe par ImageKit.
- Google Places : seul le `place_id` est stocké, conformément aux Places Policies. L'adresse, les coordonnées, la photo et le lien Maps sont récupérés **à l'affichage** via Place Details et ne sont jamais persistés. Les noms de lieux stockés sont ceux écrits par Claude, pas ceux de Places. L'auteur de chaque photo Places est crédité à l'affichage.
- Builds : **en local pour l'instant**, sans compte Expo. `npx expo prebuild --platform android` génère `android/` (ignoré par git, jamais modifié à la main), puis `npx expo run:android` compile un development build signé avec le **certificat de debug**. EAS (compte Expo, Build, Hosting, Submit) arrive au déploiement. Chaque certificat de signature (debug maintenant, EAS ou Play Store plus tard) doit avoir son **SHA-1 enregistré chez Google** (client OAuth Android) et son **SHA-256 dans Clerk** (Native applications), sinon la connexion Google native échoue avec ce build.
- Ordre : le setup, puis une vérification de R2 (durée maximale d'un appel Claude dans Inngest sur EAS Hosting) avant tout le reste. La carte expo-maps, encore en **alpha** dans SDK 57, passe en dernière phase UI.

Point de départ : Expo SDK 57 (expo ~57.0.27), RN 0.86.3, React 19.2.3, expo-router 57, React Compiler et typedRoutes activés, npm. Le repo ne contient que `src/app/_layout.tsx` et `src/app/index.tsx`.

**Règle permanente** : avant chaque installation ou utilisation d'une API Expo, lire la doc v57 (`docs.expo.dev/versions/v57.0.0/`), installer avec `npx expo install`, et lancer `npx expo lint` puis `npx tsc --noEmit` à la fin de chaque phase. Avant d'écrire du code qui appelle Claude, charger le skill `claude-api`.

## Architecture (rappel)
```
src/
  app/                 routes Expo Router uniquement
    (auth)/sign-in.tsx, verify.tsx
    (app)/_layout.tsx, index.tsx, new-trip.tsx, settings.tsx
    (app)/trips/[id]/index.tsx, progress.tsx, chat.tsx, versions.tsx
    legal/privacy.tsx, legal/terms.tsx            (pages web publiques)
    api/**/+api.ts                                (serveur, EAS Hosting)
  components/  hooks/  lib/ (client: api, i18n, theme)
  server/      config.ts, auth.ts, db/, ai/, places/, unsplash/, imagekit/, inngest/
  locales/fr.json, en.json
```

---

## Phase 0 — Setup et fondations
- [ ] Créer la structure de dossiers ci-dessus et l'alias `@/` dans tsconfig.
  - Alias `@/` présent depuis le modèle Expo (`13ea033`) et utilisé par le code (`10153bd`, `2130510`). Dossiers présents : `app/`, `components/`, `lib/`, et `server/` (avec `db/` et `inngest/`) depuis `c6091e2`. Reste : `hooks/` et `locales/`.
- [x] `app.json` : `android.package` = `com.brainditech.tripagent`, `web.output: "server"` (obligatoire pour les API routes), schéma de deep link `tripagent` conservé.
  - `android.package` fait (`a7a43c2`), schéma `tripagent` présent depuis le modèle (`13ea033`). `web.output` est passé à `"server"` (`c6091e2`), ce que prouvent les API routes servies en local le 10/10/2026 (heure de Paris) : webhook Clerk en 200 à 15:01:25, 15:17:12 et 15:17:50, et `/api/inngest` exécuté par le Dev Server Inngest (run `01M4JZCX3PSQDRXDBJFVCHDWAJ` terminé à 15:17:51).
- [ ] NativeWind **4.2.7** + `tailwindcss@^3.4.17` (doc nativewind.dev) : `babel.config.js` (jsxImportSource), `metro.config.js` (`withNativeWind`), `global.css`, `nativewind-env.d.ts`, tokens clair/sombre dans `tailwind.config.js`.
  - Installation faite (`abfd5be`) : `nativewind@4.2.7`, `tailwindcss@^3.4.17`, `babel.config.js`, `metro.config.js`, `global.css`, `nativewind-env.d.ts`, vérifiée sur l'émulateur Android (exemple « Try it out »). Reste : les tokens clair/sombre, `tailwind.config.js` ne définit que les familles de police.
- [ ] `src/server/config.ts` : `AI_MODEL` (env `ANTHROPIC_MODEL`, défaut `claude-haiku-4-5-20251001`), `QUOTA_TRIPS_PER_MONTH`, `QUOTA_ADJUSTMENTS_PER_TRIP` (lus depuis l'env, validés par Zod, avec des valeurs par défaut prudentes : 3 et 5).
  - Pas commencé : `src/server/config.ts` n'existe pas (le dossier `src/server/` existe depuis `c6091e2`).
- [ ] `.env.example` + `.env.local` (non commité). En développement, quotas hauts (par ex. 1000/100). Variables EAS par environnement (`development` / `production`).
  - `.env.example` fait (`bc48ee4`), puis complété dans `c6091e2` (où trouver le secret du webhook Clerk, clés Inngest de production laissées vides). Le fichier local est `.env` (ignoré par git). Reste : les quotas (`QUOTA_TRIPS_PER_MONTH`, `QUOTA_ADJUSTMENTS_PER_TRIP`, hauts en développement) et les variables EAS, qui arrivent avec EAS au déploiement (Phase 12).
- [ ] ~~`eas.json`~~ : reporté au déploiement (Phase 12), les builds sont locaux pour l'instant.
- [x] Installer `expo-dev-client`, `npx expo prebuild --platform android`, puis premier development build **local** : `npx expo run:android` (certificat de debug, sans compte Expo).
  - `expo-dev-client` installé (`a7a43c2`), `android/` généré par prebuild (ignoré par git). Premier `npx expo run:android` fait le 09/10/2026 à 03:21 (heure de Paris), APK de debug produit. Certificat de debug (keystore générique du modèle, identique à chaque prebuild) : SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`.
- [x] Vérification : l'app s'ouvre dans le dev build, un écran stylé avec NativeWind s'affiche, lint et tsc passent.
  - Dev build du 09/10/2026 ouvert sur l'émulateur (connexion Google validée dedans à 03:26, voir Phase 3), écrans de connexion et d'accueil stylés avec NativeWind (`10153bd`, `2130510`). `npx expo lint` et `npx tsc --noEmit` passent sur `2e653bc` le 10/10/2026.

## Phase 1 — Vérification de R2 (spike, avant tout le reste)
But : prouver qu'une step Inngest qui fait un long appel Claude fonctionne sur EAS Hosting.
- [ ] Installer `inngest` et `@anthropic-ai/sdk`.
  - `inngest` installé (v4) avec la synchro des utilisateurs (Phase 3), avant le spike. `@anthropic-ai/sdk` pas encore.
- [ ] `src/server/inngest/client.ts` + `src/app/api/inngest+api.ts` : handler `serve` compatible Request/Response (vérifier dans la doc Inngest l'adaptateur adapté aux Workers / fetch standard), avec `streaming` activé si c'est supporté.
  - Les deux fichiers sont faits avec l'adaptateur `inngest/edge` (Request/Response standard). En local, le Dev Server Inngest a exécuté la fonction `user-deleted` : deux runs « Delete a user's data » terminés le 10/10/2026 à 14:59:44 et 14:59:49 (heure de Paris), puis le run `01M4JZCX3PSQDRXDBJFVCHDWAJ`, terminé à 15:17:51, qui a supprimé une vraie ligne. `streaming` n'est pas encore activé, et rien n'a encore été testé sur EAS Hosting.
- [ ] Fonction `spike/long-claude` : une step qui demande à Haiku un itinéraire de 10 jours (sortie longue, environ 4–8k tokens), mesure la durée et renvoie le nombre de tokens. Une 2ᵉ variante appelle Claude en mode streaming côté SDK.
- [ ] Route de déclenchement temporaire `api/spike+api.ts`, protégée par un secret d'env.
- [ ] Déployer : `npx expo export --platform web` puis `npx eas-cli@latest deploy`. Synchroniser l'app dans Inngest Cloud (URL `/api/inngest`, clés `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`).
- [ ] Mesurer sur environ 5 exécutions : durée, réussite ou échec, timeouts, retries. Noter les résultats dans `docs/r2-spike.md`.
- [ ] **Point de décision** :
  - Si OK, continuer.
  - Sinon, choisir parmi : découpage en une step par jour d'itinéraire, streaming Claude, réduction de `max_tokens`, ou déplacement des fonctions Inngest vers un Worker séparé.
  - Mettre à jour la Phase 5 en conséquence.
- [ ] Supprimer la route `spike`. La fonction peut rester désactivée comme référence.

## Phase 2 — Base de données (Neon + Drizzle)
- [ ] Projet Neon avec deux branches, `main` (prod) et `dev`. Installer `drizzle-orm`, `@neondatabase/serverless` et `drizzle-kit` (dev).
  - Les trois paquets sont installés (`drizzle-kit` en dépendance de dev). La branche `dev` est `ep-spring-resonance-bagn5jhd` (confirmé le 10/10/2026). La branche `main` n'a pas encore été vérifiée.
- [ ] `src/server/db/schema.ts` :
  - `users` est fait. `trips`, `trip_versions`, `trip_messages` et `jobs` restent à faire.
  - `users` : id = Clerk user id, email, name (nullable : un compte créé par code email n'a pas forcément de nom), locale, created_at.
  - `trips` : id uuid, user_id FK cascade, destination_name (texte saisi ou Claude), destination_place_id, days, travelers enum, budget enum, locale, status enum (`queued|generating|ready|failed`), current_version_id, adjustments_used, `cover_unsplash` jsonb (id, urls hotlinkées, nom et lien du photographe, html link), `cover_custom` jsonb (ImageKit fileId, filePath), timestamps.
  - `trip_versions` : trip_id FK cascade, version_number, content jsonb, source enum. UNIQUE(trip_id, version_number).
  - `trip_messages` : trip_id FK cascade, role, content, resulting_version_id.
  - `jobs` : trip_id FK cascade, kind, status, current_step, error, inngest_event_id UNIQUE, input_tokens, output_tokens, timestamps.
- [ ] Aucune colonne d'adresse ou de coordonnées Places, nulle part. Seuls des `placeId` peuvent apparaître dans le JSON du contenu.
- [ ] `drizzle.config.ts`, migrations générées et appliquées sur `dev`, client `src/server/db/index.ts` (driver HTTP).
  - Migration `0000_users` (table `users` seule) appliquée sur la branche `dev` (`ep-spring-resonance-bagn5jhd`) le 10/10/2026 à 12:34 (heure de Paris) : 5 colonnes conformes, table vide. Le client `src/server/db/index.ts` (driver HTTP `neon-http`) a écrit sa première ligne par le webhook Clerk le 10/10/2026 à 15:01:25 (heure de Paris). Le même client l'a ensuite mise à jour à 15:17:12 et supprimée à 15:17:51. Les autres tables restent à faire.
- [ ] Vérification : un script de seed dev insère puis relit un voyage factice.

## Phase 3 — Authentification (Clerk : Google + code par email)
- [x] Lire la doc Expo « Using Clerk ». Installer `@clerk/expo` et `expo-secure-store` (`2130510`), puis `expo-auth-session` pour Google.
  - Google par OAuth dans le navigateur (`useSSO`), avec les identifiants partagés de Clerk : pas de `@clerk/expo-google-signin`, pas de Google Cloud Console ni de SHA-1 pour l'instant. Voir [ADR 0002](docs/decisions/0002-google-browser-oauth.md).
- [x] Dashboard Clerk : ajouter `tripagent://sso-callback` aux redirections mobiles autorisées (Native applications).
  - Fait le 10/10/2026 par l'API Backend (`POST /v1/redirect_urls`). Google avait déjà fonctionné sans, voir le constat dans l'ADR 0002.
- [x] Dashboard Clerk : activer l'identifiant « email address » avec la stratégie **email verification code**, désactiver le mot de passe. Pas de magic link.
  - Vérifié via la configuration de l'instance : e-mail requis, `email_code` seul facteur, pas de mot de passe.
- [x] `ClerkProvider` + token cache (`@clerk/expo/token-cache`) dans `src/app/_layout.tsx`. Protéger les groupes `(auth)` et `(app)` selon la méthode recommandée par la doc (`<Show>` / redirections).
  - `useAuth` + `Redirect` dans les layouts de groupe (`2130510`).
- [x] Écran `sign-in.tsx` : bouton « Continuer avec Google » (`useSSO` + `oauth_google`, ADR 0002) et bouton « Continuer avec mon adresse e-mail » vers l'écran `email.tsx` (maquette `design/auth-ui-design.png`, sans séparateur « ou »). Gestion des erreurs et de l'annulation.
  - Écran et e-mail faits (`10153bd`, `2130510`). Google validé sur l'émulateur le 09/10/2026 à 03:26 et le 10/10/2026 à 02:04 (heure de Paris). Annulation validée le 10/10/2026 à 02:22 (heure de Paris) : fermeture de l'onglet Google par la croix et par le bouton retour, retour sur l'écran de connexion sans message, bouton de nouveau actif.
- [x] Flux email unifié, sans mot de passe, avec les hooks sign-in / sign-up de Clerk (API exacte à vérifier dans la doc) : on tente une connexion par `email_code`. Si le compte n'existe pas, on crée une inscription avec le même email et on envoie le code de vérification.
  - Remplacé par `signUpIfMissing` (`2130510`) : le code est envoyé dans tous les cas, et le compte est créé après vérification, sans révéler s'il existait. La première version a été testée avec une vraie adresse. Création d'un nouveau compte par code e-mail avec `signUpIfMissing` validée le 10/10/2026 à 09:46:11 (heure de Paris) : utilisateur créé chez Clerk, e-mail vérifié par `email_code`, aucun compte externe, pas de mot de passe, arrivée sur l'accueil connecté.
- [x] Écran `verify.tsx` : saisie du code à 6 chiffres (autofill), « Renvoyer le code » avec délai d'attente, « Modifier l'email », erreurs (code invalide, expiré, trop de tentatives).
  - `2130510`. Codes d'erreur `form_code_incorrect` et `sign_up_if_missing_transfer` vérifiés sur l'API Clerk.
- [ ] `src/server/auth.ts` : `requireUser(request)`, qui vérifie le Bearer token via `@clerk/backend` et renvoie `userId`, sinon 401.
- [ ] `api/webhooks/clerk+api.ts` : vérification de la signature, `user.created` fait un upsert dans `users`, `user.deleted` envoie l'événement Inngest `user/deleted`. Upsert de secours dans `requireUser`.
  - Route faite (`c6091e2`) : la signature Svix est vérifiée par `verifyWebhook` (`@clerk/backend`), et l'endpoint Clerk atteint le serveur local par ngrok.
  - Refus d'une signature invalide validé par ngrok le 10/10/2026 (heure de Paris) : réponse 400 à 13:51:16 pour une requête sans en-têtes `svix-*`, et à 13:51:55 pour une signature forgée.
  - `user.created` validé le 10/10/2026 à 15:01:25 (heure de Paris) : réponse 200, ligne du compte de test dans `users` avec le nom du compte Google et `locale` à `fr`. Son `created_at` correspond à la création chez Clerk.
  - `user.deleted` validé le même jour à 14:59:44 et 14:59:49 : la suppression de deux anciens comptes (créés avant la table) a produit deux runs « Delete a user's data » terminés dans le Dev Server Inngest. Suppression d'une ligne existante validée à 15:17:50 : `user.deleted` reçu, réponse 200, run `01M4JZCX3PSQDRXDBJFVCHDWAJ` terminé à 15:17:51, table `users` vide ensuite (relevé par MindOS et dans le journal ngrok, table relue en base).
  - `user.updated` ajouté avec le même upsert, pour qu'un nom ou un e-mail changé chez Clerk suive dans `users`. Validé le 10/10/2026 à 15:17:12 (heure de Paris) : `user.updated` reçu, réponse 200. La route répond 500 si l'écriture échoue, donc l'upsert a réussi. La ligne n'a pas été relue entre la mise à jour et la suppression.
  - Reste : l'upsert de secours dans `requireUser`, qui n'existe pas encore.
- [ ] Vérification : login et logout avec Google, puis avec un code email (nouveau compte et compte existant). La ligne `users` est créée dans les deux cas, et un appel API sans token renvoie 401.
  - Nouveau compte Google validé le 10/10/2026 à 15:01:25 (heure de Paris) : ligne `users` créée. L'API Backend Clerk confirme un compte `oauth_google` sans mot de passe. Restent : le logout, un compte Google existant, le code e-mail (nouveau compte et compte existant), et le 401 sans token.

## Phase 4 — API de base
- [ ] `src/lib/api.ts` (client) : fetch avec token Clerk, erreurs typées. Mettre en place TanStack Query (`QueryClientProvider`).
- [ ] `api/me+api.ts` : profil et quotas restants.
- [ ] `api/places/autocomplete+api.ts` : proxy Places Autocomplete (New), restreint aux régions et villes, avec session token transmis par le client. La clé reste côté serveur.
- [ ] `api/trips+api.ts` : GET liste. POST valide le corps (Zod), vérifie le quota (jobs `generate` du mois en cours, hors `failed`), insère le voyage et le job, envoie `trip/generate` (id d'événement = id du job), renvoie `{ tripId }`.
- [ ] `api/trips/[id]+api.ts` (GET, DELETE, contrôle de propriété) et `api/trips/[id]/status+api.ts` (statut et `current_step`).
- [ ] Vérification : appels avec un token valide, 403 sur le voyage d'un autre utilisateur, 429 au-delà du quota (quota mis à 1 en env pour le test).

## Phase 5 — Pipeline de génération (Inngest)
- [ ] `src/server/ai/schema.ts` : schéma Zod du contenu (days/activities/hotels/budget/tips, `place: { query, placeId?, resolved }`) et schéma JSON dérivé pour l'outil Claude.
- [ ] `src/server/ai/prompts.ts` : prompts de génération et d'ajustement (langue = locale, budget en devise locale, contraintes de réalisme).
- [ ] `src/server/places/` : `resolvePlaceId(query, near)` via Text Search (New), avec un field mask réduit à `places.id` (SKU le moins cher). `getPlaceDetails(placeIds)` pour l'affichage (adresse, location, photo, googleMapsUri, attributions).
- [ ] `src/server/unsplash/` : recherche de la couverture et déclenchement de `download_location` à la sélection, comme l'exigent leurs guidelines. On stocke les URLs hotlinkées et les infos du photographe.
- [ ] Fonction `trip/generate` :
  1. `generate-itinerary` : Claude avec `tool_choice` forcé, puis validation Zod (une erreur de validation fait échouer la step, donc retry).
  2. `resolve-places` : lots parallèles qui renseignent `placeId` ; `resolved=false` si le lieu est introuvable.
  3. `pick-cover` : Unsplash.
  4. `save` : version 1, statut `ready`, tokens enregistrés.
  - Mise à jour de `current_step` à chaque étape.
  - Concurrence : 1 job par utilisateur, plus un throttle global.
  - `onFailure` : voyage et job passent en `failed` (le quota n'est pas consommé), erreur envoyée à Sentry (branché en Phase 10).
- [ ] Tests : schéma Zod (cas valide et invalide), quota, mapping de la résolution Places (fetch mocké), fonction avec `@inngest/test`.
- [ ] Vérification : génération de bout en bout en local (Inngest Dev Server), puis sur EAS Hosting.

## Phase 6 — UI principale
- [ ] i18n : `expo-localization` + i18next, `locales/fr.json` et `en.json`. Aucune chaîne en dur.
- [ ] Composants de base NativeWind : Button, Card, Screen, EmptyState, ErrorState, Skeleton.
- [ ] Accueil : liste « Mes voyages » (couverture, statut, badge « en cours »), quota restant, bouton « Nouveau voyage », état vide, pull-to-refresh, suppression avec confirmation.
- [ ] Nouveau voyage : autocomplete de destination, jours (1–10), presets de voyageurs, 3 niveaux de budget, puis redirection vers la progression.
- [ ] Progression : polling toutes les 2–3 s (`refetchInterval`), étapes animées, `router.replace` vers le détail quand le voyage est prêt, état d'échec avec bouton « Réessayer ».
- [ ] Détail : en-tête avec la couverture (Unsplash et crédit « Photo by X on Unsplash » avec liens UTM, ou couverture perso), sections Itinéraire par jour, Hôtels, Budget, Conseils.
- [ ] `api/trips/[id]/places+api.ts` : Place Details en direct pour les `placeId` d'un jour, chargés à la demande au déroulé du jour. L'URL de la photo est générée à la volée et n'est jamais stockée. Crédit de l'auteur de la photo sous chaque photo Places.
- [ ] Bouton « Ouvrir dans Google Maps » : deep link `https://www.google.com/maps/search/?api=1&query=…&query_place_id=…` via `Linking`.
- [ ] Vérification : parcours complet sur l'appareil, en FR et en EN (langue de l'appareil), en mode clair et sombre, sur un réseau lent (throttling).

## Phase 7 — Chat d'ajustement et versions
- [ ] `api/trips/[id]/adjust+api.ts` : vérifie `adjustments_used < QUOTA_ADJUSTMENTS_PER_TRIP` et qu'aucun job n'est en cours, enregistre le message et envoie `trip/adjust`.
- [ ] Fonction `trip/adjust` : Claude reçoit la version courante et le message, puis renvoie le contenu complet. Seuls les `placeId` des lieux nouveaux ou modifiés sont résolus (réutilisation par `query`). On crée la version N+1, `adjustments_used++` uniquement en cas de succès, et le message assistant résume les changements.
- [ ] `api/trips/[id]/versions+api.ts` (liste) et `versions/[v]/restore+api.ts` (crée une version `restore`).
- [ ] Écrans : chat (historique et saisie, réutilise l'écran de progression), liste des versions avec bouton « Restaurer ».
- [ ] Vérification : 2 ajustements suivis d'une restauration, refus du 6ᵉ ajustement, refus pendant qu'un job est en cours.

## Phase 8 — Couverture personnalisée (ImageKit)
- [ ] `api/imagekit/auth+api.ts` : paramètres d'upload signés (token, expire, signature) avec la clé privée côté serveur.
- [ ] `expo-image-picker` (sélecteur de photos Android, sans permission sur les versions récentes) : choix d'une image, upload direct vers ImageKit dans le dossier `/users/{userId}/trips/{tripId}/`, puis `PATCH api/trips/[id]` (cover_custom).
- [ ] Affichage via `expo-image` avec transformations ImageKit (`tr=w-…,q-auto,f-auto`). Bouton « Revenir à la photo Unsplash ».
- [ ] Au remplacement ou à la suppression du voyage, l'ancien fichier ImageKit est supprimé (step Inngest).
- [ ] Vérification : upload, affichage optimisé, remplacement (l'ancien fichier disparaît du dashboard ImageKit).

## Phase 9 — Compte et pages légales
- [ ] Écran Réglages : langue (en lecture seule, celle de l'appareil), liens légaux (`expo-web-browser`), déconnexion, « Supprimer mon compte » avec double confirmation.
- [ ] `api/account+api.ts` DELETE : supprime l'utilisateur via le Clerk Backend. Le webhook `user.deleted` déclenche la fonction `user/deleted`, qui liste et supprime les fichiers ImageKit de l'utilisateur, puis la ligne `users` (cascade sur trips, versions, messages et jobs). Une ré-exécution ne doit pas poser de problème.
  - Fait côté webhook (Phase 3) : la chaîne `user.deleted` → `user/deleted` → suppression de la ligne `users` a été validée le 10/10/2026 à 15:17:51 (heure de Paris), run `01M4JZCX3PSQDRXDBJFVCHDWAJ`, compte supprimé depuis le dashboard Clerk. Restent : la route `api/account`, les fichiers ImageKit, les tables en cascade (pas encore créées) et le test d'une ré-exécution.
- [ ] `src/app/legal/privacy.tsx` et `terms.tsx` : contenu FR/EN (données collectées, sous-traitants Clerk/Neon/Anthropic/Google/Unsplash/ImageKit/Sentry/Inngest, conservation, suppression du compte), rendu web public. Leur URL sert pour la fiche Play Store.
- [ ] Vérification : suppression d'un compte de test, plus aucune ligne en base ni fichier ImageKit, pages légales accessibles sans connexion.
  - Compte supprimé depuis le dashboard Clerk le 10/10/2026 à 15:17:50 (heure de Paris) : plus aucune ligne dans `users`. Restent : la suppression depuis l'app, ImageKit et les pages légales.

## Phase 10 — Observabilité (Sentry)
- [ ] Lire la doc Expo « Using Sentry ». Installer `@sentry/react-native` avec son plugin, envelopper le layout racine, configurer l'upload des source maps via EAS.
  - Fait : `@sentry/react-native` ~7.11.0, plugin `@sentry/react-native/expo` (org `mindaios`, projet `tripagent`, région DE), `getSentryExpoConfig` + `withNativeWind` dans `metro.config.js`, `Sentry.init` + `Sentry.wrap` dans `_layout.tsx`. L'app démarre sur l'émulateur. `sendDefaultPii: false`. Erreur de test côté client reçue dans Sentry (TRIPAGENT-1), bouton de test retiré. Reste : `SENTRY_AUTH_TOKEN` en variable EAS (visibilité secrète) pour l'upload des source maps au build.
- [ ] Côté serveur : vérifier quel SDK Sentry est compatible avec le runtime EAS Hosting (sinon, wrapper minimal). Capture dans les API routes et dans `onFailure` d'Inngest, avec tags `tripId`, `jobId` et `step`.
- [ ] Vérification : une erreur volontaire côté client et une côté serveur apparaissent dans Sentry, avec la stack symbolisée.

## Phase 11 — Carte intégrée (expo-maps, dernière phase UI)
- [ ] Relire la doc v57 de expo-maps (alpha). Activer Maps SDK for Android, créer une clé restreinte (package + SHA-1) dans `android.config.googleMaps.apiKey`, puis refaire un dev build.
- [ ] Onglet ou section Carte du détail : `GoogleMaps.View`, marqueurs du jour sélectionné (coordonnées issues de Place Details en direct, jamais stockées), un tap ouvre la fiche du lieu.
- [ ] Repli : si la carte plante ou si aucun lieu n'a été résolu, afficher la liste avec les liens Google Maps.
- [ ] Vérification : marqueurs corrects pour un voyage à Tokyo, changement de jour, mode sombre.

## Phase 12 — Finition et validation finale
- [ ] `npx expo-doctor`, `npx expo install --fix`, `npx expo lint`, `npx tsc --noEmit`, tous les tests au vert.
- [ ] Revue des états vides, des erreurs et du réseau lent sur chaque écran. Accessibilité de base (labels, tailles de police).
- [ ] Créer le compte et le projet EAS (`npx eas-cli@latest init`), `eas.json` (profils `development`, `preview`, `production`). Enregistrer le SHA-1 du certificat EAS (et plus tard celui de la clé de signature Play Store) dans un client OAuth Android chez Google, et le SHA-256 dans Clerk.
- [ ] Passer `QUOTA_*` aux valeurs de prod dans l'env EAS `production`. Déployer l'API et produire un build `preview` (APK).
- [ ] Alertes budget sur Google Cloud et sur la console Anthropic.

---

## Hypothèses retenues
Voyageurs en 4 presets · durée de 1 à 10 jours · mois de quota calendaire UTC · TanStack Query + i18next · pas d'analytics produit · lieu non résolu affiché sans carte ni photo · déclenchement Unsplash `download_location` à la sélection automatique.

## Risques ouverts
- **R2** : traité par la Phase 1.
- **Coût de Place Details à l'affichage** (photos = SKU plus cher) : chargement à la demande par jour, field mask minimal, cache de TanStack Query uniquement en mémoire pendant la session.
- **expo-maps en alpha** : changements cassants possibles, d'où le repli sous forme de liste.
- **Sentry serveur sur EAS Hosting** : compatibilité à confirmer en Phase 10.
- **Quota non atomique** (driver HTTP) : dépassement possible de 1 sur un double envoi, accepté pour ce projet.
- **Unsplash en mode démo** : 50 requêtes/h, suffisant pour l'apprentissage.

## Vérification de bout en bout
Sur un appareil Android avec un dev build, puis avec un APK `preview` pointant sur la prod EAS Hosting :
1. Se connecter avec Google, puis (avec un autre compte) avec un code reçu par email.
2. Générer un voyage « Tokyo, Japon », 4 jours, Couple, Modéré : les étapes s'affichent pendant la génération, puis le détail.
3. Vérifier la couverture Unsplash et son crédit, les adresses et photos Places avec leur crédit, les liens Google Maps, le budget.
4. Faire 2 ajustements par le chat, puis restaurer la version 1.
5. Téléverser une couverture personnalisée.
6. Quitter l'app pendant une génération, puis la reprendre depuis l'accueil.
7. Atteindre le quota et voir le message.
8. Supprimer le compte : plus aucune donnée en base ni dans ImageKit.
9. Vérifier les erreurs dans Sentry et les runs dans le dashboard Inngest.
10. Lint, tsc et tests au vert.

## Après validation
1. **Seule action immédiate** : créer `plan.md` à la racine du repo avec ce plan. Pas de code, pas d'installation.
2. Ensuite, on démarre la Phase 0 sur ton feu vert. Après chaque étape terminée et vérifiée, je coche sa case (`- [x]`) dans `plan.md`, et j'y note un résultat court quand c'est utile (par ex. les mesures de la Phase 1).
