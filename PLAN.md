# Tripagent — Plan d'implémentation v1

## Contexte
Projet d'apprentissage : refaire l'app d'un tuto, un planificateur de voyages par IA, sur Android uniquement. La spec a été validée à l'issue de l'interview, avec les corrections suivantes :
- Authentification : Google + code à usage unique envoyé par email (sans mot de passe). Apple viendra avec iOS.
- Modèle Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), id centralisé dans la config.
- Quotas lus depuis des variables d'environnement, avec des limites hautes en développement.
- Couverture : Unsplash affiché en direct, avec crédit au photographe. Leurs conditions interdisent le proxy via ImageKit. La couverture personnalisée téléversée par l'utilisateur passe par ImageKit.
- Google Places : seul le `place_id` est stocké, conformément aux Places Policies. L'adresse, les coordonnées, la photo et le lien Maps sont récupérés **à l'affichage** via Place Details et ne sont jamais persistés. Les noms de lieux stockés sont ceux écrits par Claude, pas ceux de Places. L'auteur de chaque photo Places est crédité à l'affichage.
- Builds : **en local pour l'instant**, sans compte Expo. `npx expo prebuild --platform android` génère `android/` (ignoré par git, jamais modifié à la main), puis `npx expo run:android` compile un development build signé avec le **certificat de debug**. EAS (compte Expo, Build, Hosting, Submit) arrive au déploiement. Chaque certificat de signature (debug maintenant, EAS ou Play Store plus tard) doit avoir son **SHA-1 enregistré chez Google** (client OAuth Android) et son **SHA-256 dans Clerk** (Native applications), sinon la connexion Google native échoue avec ce build.
- Ordre : le setup, puis une vérification de R2 (durée maximale d'un appel Claude dans Inngest sur EAS Hosting) avant tout le reste (reportée le 11/10/2026, voir ci-dessous). La carte expo-maps, encore en **alpha** dans SDK 57, passe en dernière phase UI.
- Décisions du 11/10/2026 (création de voyage, branche `feat/create-trip`) :
  - Le formulaire garde les champs des maquettes : destination, dates exactes (début et fin), budget en 3 niveaux, voyageurs, centres d'intérêt, rythme. Le nombre de jours se déduit des dates.
  - Un voyage dure 10 jours au plus : le calendrier l'empêche (une touche au-delà de la limite repart sur une nouvelle plage), et le serveur le refuse aussi (Zod, réponse 400).
  - La Phase 1 (spike sur EAS Hosting) est reportée au premier déploiement : on génère d'abord en local, et la vérification sur EAS Hosting prévue en Phase 5 tranchera le risque R2.
  - Google Places est reporté à l'écran de détail et à sa carte : pour l'instant, la destination est un texte libre, et l'étape `resolve-places` n'est pas implémentée (tous les lieux restent `resolved=false`, affichés sans carte ni photo, comme le plan le prévoit déjà).

Point de départ : Expo SDK 57 (expo ~57.0.27), RN 0.86.3, React 19.2.3, expo-router 57, React Compiler et typedRoutes activés, npm. Le repo ne contient que `src/app/_layout.tsx` et `src/app/index.tsx`.

**Règle permanente** : avant chaque installation ou utilisation d'une API Expo, lire la doc v57 (`docs.expo.dev/versions/v57.0.0/`), installer avec `npx expo install`, et lancer `npx expo lint` puis `npx tsc --noEmit` à la fin de chaque phase. Avant d'écrire du code qui appelle Claude, charger le skill `claude-api`.

## Architecture (rappel)
```
src/
  app/                 routes Expo Router uniquement
    (auth)/sign-in.tsx, verify.tsx
    (app)/_layout.tsx                             (garde de session, Stack)
    (app)/(tabs)/_layout.tsx                      (NativeTabs : Accueil, Assistant, Voyages, Profil)
    (app)/(tabs)/index.tsx, assistant.tsx, trips.tsx, profile.tsx
    (app)/new-trip.tsx, settings.tsx
    (app)/trips/[id]/index.tsx, progress.tsx, chat.tsx, versions.tsx
    legal/privacy.tsx, legal/terms.tsx            (pages web publiques)
    api/**/+api.ts                                (serveur, EAS Hosting)
  components/  hooks/  lib/ (client: api, i18n, theme)
  server/      config.ts, http.ts, auth.ts, users.ts, db/, ai/, trips/, places/, unsplash/, imagekit/, inngest/
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
- [x] `src/server/config.ts` : `AI_MODEL` (env `ANTHROPIC_MODEL`, défaut `claude-haiku-4-5-20251001`), `QUOTA_TRIPS_PER_MONTH`, `QUOTA_ADJUSTMENTS_PER_TRIP` (lus depuis l'env, validés par Zod, avec des valeurs par défaut prudentes : 3 et 5).
  - Fait le 11/10/2026 sur `feat/create-trip` : `config.aiModel` et `config.quotas` validés par Zod au démarrage (une valeur vide compte comme absente, donc défauts 3 et 5). Les secrets passent par `requireEnv(nom)`, lu à la première utilisation et jamais journalisé, pour qu'une route qui n'en a pas besoin fonctionne même si `.env` est incomplet.
- [ ] `.env.example` + `.env.local` (non commité). En développement, quotas hauts (par ex. 1000/100). Variables EAS par environnement (`development` / `production`).
  - `.env.example` fait (`bc48ee4`), puis complété dans `c6091e2` (où trouver le secret du webhook Clerk, clés Inngest de production laissées vides). Le fichier local est `.env` (ignoré par git). Quotas ajoutés le 11/10/2026 à `.env.example` et à `.env` (1000 / 100), avec `ANTHROPIC_MODEL` optionnel. Le serveur Expo charge `.env` au démarrage seulement : à redémarrer après chaque changement. Reste : les variables EAS, qui arrivent avec EAS au déploiement (Phase 12).
- [ ] ~~`eas.json`~~ : reporté au déploiement (Phase 12), les builds sont locaux pour l'instant.
- [x] Installer `expo-dev-client`, `npx expo prebuild --platform android`, puis premier development build **local** : `npx expo run:android` (certificat de debug, sans compte Expo).
  - `expo-dev-client` installé (`a7a43c2`), `android/` généré par prebuild (ignoré par git). Premier `npx expo run:android` fait le 09/10/2026 à 03:21 (heure de Paris), APK de debug produit. Certificat de debug (keystore générique du modèle, identique à chaque prebuild) : SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`, SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`.
- [x] Vérification : l'app s'ouvre dans le dev build, un écran stylé avec NativeWind s'affiche, lint et tsc passent.
  - Dev build du 09/10/2026 ouvert sur l'émulateur (connexion Google validée dedans à 03:26, voir Phase 3), écrans de connexion et d'accueil stylés avec NativeWind (`10153bd`, `2130510`). `npx expo lint` et `npx tsc --noEmit` passent sur `2e653bc` le 10/10/2026.

## Phase 1 — Vérification de R2 (spike, avant tout le reste)
But : prouver qu'une step Inngest qui fait un long appel Claude fonctionne sur EAS Hosting.

**Reportée au premier déploiement (décision du 11/10/2026)** : la génération est d'abord faite et vérifiée en local (Phases 4 et 5, Dev Server Inngest), et c'est la vérification sur EAS Hosting de la Phase 5 qui tranchera R2. Les étapes ci-dessous restent valables pour ce moment-là.
- [x] Installer `inngest` et `@anthropic-ai/sdk`.
  - `inngest` installé (v4) avec la synchro des utilisateurs (Phase 3), avant le spike. `@anthropic-ai/sdk` (0.133.0) installé le 11/10/2026 avec la génération (Phase 5), ainsi que `zod` (4.6) pour les schémas.
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
- [x] `src/server/db/schema.ts` :
  - `users` est fait, avec en plus `clerk_updated_at` et la table `deleted_users` pour l'ordre des événements Clerk (ADR 0003, `2ff4e85`). `trips`, `trip_versions`, `trip_messages` et `jobs` faits le 11/10/2026 (`feat/create-trip`), avec les enums Postgres `trip_status`, `budget_level`, `trip_pace`, `version_source`, `message_role`, `job_kind` et `job_status`.
  - `users` : id = Clerk user id, email, name (nullable : un compte créé par code email n'a pas forcément de nom), locale, created_at.
  - `trips` (mise à jour du 11/10/2026) : id uuid, user_id FK cascade, destination_name (texte libre saisi ; pas de `destination_place_id` tant que Google Places n'est pas branché, il viendra avec l'écran de détail), start_date et end_date (`date` ; le nombre de jours en découle, 10 au plus, pas de colonne `days`), travelers (entier de 1 à 10, le compteur de la maquette), budget enum (`budget|comfort|luxury`), interests (`text[]`), pace enum (`relaxed|balanced|intense`), locale, status enum (`queued|generating|ready|failed`), current_version_id (FK `trip_versions`, set null), adjustments_used, `cover_unsplash` jsonb (id, urls hotlinkées, nom, username et lien du photographe, page de la photo), `cover_custom` jsonb (ImageKit fileId, filePath), timestamps.
  - `trip_versions` : trip_id FK cascade, version_number, content jsonb, source enum. UNIQUE(trip_id, version_number).
  - `trip_messages` : trip_id FK cascade, role, content, resulting_version_id.
  - `jobs` : trip_id FK cascade, kind, status, current_step, error, inngest_event_id UNIQUE, input_tokens, output_tokens, timestamps (created, updated, finished).
- [x] Aucune colonne d'adresse ou de coordonnées Places, nulle part. Seuls des `placeId` peuvent apparaître dans le JSON du contenu.
  - Vérifié dans la migration `0002` : aucune colonne d'adresse ni de coordonnées. Le contenu stocké porte `place: { query, placeId, resolved }`.
- [x] `drizzle.config.ts`, migrations générées et appliquées sur `dev`, client `src/server/db/index.ts` (driver HTTP).
  - Migration `0000_users` (table `users` seule) appliquée sur la branche `dev` (`ep-spring-resonance-bagn5jhd`) le 10/10/2026 à 12:34 (heure de Paris) : 5 colonnes conformes, table vide. Le client `src/server/db/index.ts` (driver HTTP `neon-http`) a écrit sa première ligne par le webhook Clerk le 10/10/2026 à 15:01:25 (heure de Paris). Le même client l'a ensuite mise à jour à 15:17:12 et supprimée à 15:17:51. Migration `0001_users_event_ordering` (colonne `users.clerk_updated_at`, table `deleted_users`) générée par drizzle-kit et appliquée sur `dev` le 10/10/2026 vers 21:15 (heure de Paris), `users` vide au moment d'ajouter la colonne NOT NULL (`2ff4e85`, ADR 0003). Migration `0002_trips_versions_messages_jobs` (7 enums, 4 tables, index et clés étrangères) générée par drizzle-kit et appliquée sur `dev` le 11/10/2026 vers 11:08 (heure de Paris).
- [ ] Vérification : un script de seed dev insère puis relit un voyage factice.
  - Pas de script de seed pour l'instant : la première génération réelle (Phase 5) a inséré puis relu un voyage complet le 11/10/2026.

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
- [x] `src/server/auth.ts` : `requireUser(request)`, qui vérifie le Bearer token via `@clerk/backend` et renvoie `userId`, sinon 401.
  - Fait le 11/10/2026 : `requireUser` (`authenticateRequest` de `@clerk/backend`, `acceptsToken: session_token`) et `authedRoute`, qui enveloppe chaque route : JWT vérifié avant tout, `HttpError` traduite en réponse JSON `{ error: { code, message } }`, toute autre erreur journalisée et répondue 500 sans détail. Sans jeton, `GET /api/me`, `GET /api/trips`, `GET /api/trips/[id]/status` et `POST /api/trips` ont répondu 401 le 11/10/2026 vers 11:12 (heure de Paris).
- [ ] `api/webhooks/clerk+api.ts` : vérification de la signature, `user.created` fait un upsert dans `users`, `user.deleted` envoie l'événement Inngest `user/deleted`. Upsert de secours dans `requireUser`.
  - Route faite (`c6091e2`) : la signature Svix est vérifiée par `verifyWebhook` (`@clerk/backend`), et l'endpoint Clerk atteint le serveur local par ngrok.
  - Refus d'une signature invalide validé par ngrok le 10/10/2026 (heure de Paris) : réponse 400 à 13:51:16 pour une requête sans en-têtes `svix-*`, et à 13:51:55 pour une signature forgée.
  - `user.created` validé le 10/10/2026 à 15:01:25 (heure de Paris) : réponse 200, ligne du compte de test dans `users` avec le nom du compte Google et `locale` à `fr`. Son `created_at` correspond à la création chez Clerk.
  - `user.deleted` validé le même jour à 14:59:44 et 14:59:49 : la suppression de deux anciens comptes (créés avant la table) a produit deux runs « Delete a user's data » terminés dans le Dev Server Inngest. Suppression d'une ligne existante validée à 15:17:50 : `user.deleted` reçu, réponse 200, run `01M4JZCX3PSQDRXDBJFVCHDWAJ` terminé à 15:17:51, table `users` vide ensuite (relevé par MindOS et dans le journal ngrok, table relue en base).
  - `user.updated` ajouté avec le même upsert, pour qu'un nom ou un e-mail changé chez Clerk suive dans `users`. Validé le 10/10/2026 à 15:17:12 (heure de Paris) : `user.updated` reçu, réponse 200. La route répond 500 si l'écriture échoue, donc l'upsert a réussi. La ligne n'a pas été relue entre la mise à jour et la suppression.
  - Ordre des événements (ADR 0003, `2ff4e85`) : Clerk ne garantit pas l'ordre de livraison. `user.created` et `user.updated` n'écrivent que si leur `updated_at` est plus récent que `users.clerk_updated_at` et que la trace de suppression, en une seule requête SQL ; sinon réponse 200 `ignored: stale`. `user.deleted` écrit d'abord l'id et le `timestamp` de l'événement dans `deleted_users`, puis envoie `user/deleted`. Prouvé par rejeu d'événements signés vers la route locale le 10/10/2026 de 21:15:35 à 21:15:39 (heure de Paris) : un `user.updated` plus ancien qu'un autre déjà appliqué ne change rien, un rejeu du même événement non plus, un `user.updated` arrivé avant le `user.created` crée la ligne et le `user.created` tardif ne la touche pas, et après un `user.deleted` (trace écrite, ligne supprimée par Inngest en une seconde), ni `user.created` ni `user.updated` ne recréent la ligne. Détail dans l'ADR.
  - Upsert de secours fait le 11/10/2026 : `ensureUser(userId)` (`src/server/users.ts`), appelé par `api/me` et `POST api/trips`, relit le compte chez Clerk quand la ligne manque et applique le même upsert que le webhook (`upsertClerkAccount`, partagé, même règle de fraîcheur). Prouvé à 11:15 (heure de Paris) : la ligne du compte de test, supprimée le 10/10, a été recréée par `GET /api/me`.
  - Revue CodeRabbit du 11/10/2026 au soir : `ensureUser` répond 403 `account_deleted` quand Clerk ne connaît plus le compte (404) ou quand l'upsert n'écrit rien (trace de suppression plus récente, ADR 0003), au lieu de laisser les routes lire une ligne absente (500). Testé (`src/server/users.test.ts`). Deuxième revue : quand l'upsert n'écrit rien parce que le webhook a inséré la ligne (aussi récente que la réponse de Clerk) entre la lecture et l'upsert, la ligne est relue et la requête continue au lieu de répondre 403 ; seul un compte toujours absent est refusé.
- [ ] Vérification : login et logout avec Google, puis avec un code email (nouveau compte et compte existant). La ligne `users` est créée dans les deux cas, et un appel API sans token renvoie 401.
  - Nouveau compte Google validé le 10/10/2026 à 15:01:25 (heure de Paris) : ligne `users` créée. L'API Backend Clerk confirme un compte `oauth_google` sans mot de passe. Le 401 sans jeton est validé le 11/10/2026 (voir `requireUser`). Restent : le logout, un compte Google existant, le code e-mail (nouveau compte et compte existant).

## Phase 4 — API de base
- [x] `src/lib/api.ts` (client) : fetch avec token Clerk, erreurs typées. Mettre en place TanStack Query (`QueryClientProvider`).
  - Fait le 11/10/2026 : `createApi(getToken)` et `useApi()` (requêtes relatives `/api/...`, jeton de session Clerk en `Authorization: Bearer`, `ApiError` avec statut et code), `QueryClientProvider` dans le layout racine (`src/lib/query.ts`).
- [x] `api/me+api.ts` : profil et quotas restants.
  - Fait : profil (après `ensureUser`) et quotas `tripsPerMonth`, `tripsUsedThisMonth`, `tripsRemaining`, `adjustmentsPerTrip`.
- [ ] ~~`api/places/autocomplete+api.ts`~~ : reporté avec Google Places à l'écran de détail (décision du 11/10/2026), la destination est un texte libre.
- [x] `api/trips+api.ts` : GET liste. POST valide le corps (Zod), réserve une place du quota mensuel (`monthly_generations`, ADR 0004), insère le voyage et le job, envoie `trip/generate` (id d'événement = id du job), renvoie `{ tripId }`.
  - Fait : GET liste avec `days` calculé ; POST validé par `newTripSchema` (`src/server/trips/schema.ts`, règles partagées avec le client dans `src/lib/trip-rules.ts`), quota réservé en une requête dans `monthly_generations` (ADR 0004 ; remplace le comptage des jobs du matin, que la suppression d'un voyage remettait à zéro), id du job généré côté serveur et réutilisé comme id d'événement, réponse 202 `{ tripId }`. Si l'envoi à Inngest échoue, voyage et job passent en `failed` et la route répond 503.
- [x] `api/trips/[id]+api.ts` (GET, DELETE, contrôle de propriété) et `api/trips/[id]/status+api.ts` (statut et `current_step`).
  - Fait : `loadOwnedTrip` (404 si l'id n'est pas un uuid ou n'existe pas, 403 si le voyage est à un autre compte), GET avec le contenu de la version courante, DELETE 204 (cascade), status avec le dernier job (`status`, `currentStep`, `error`).
- [x] Vérification : appels avec un token valide, 403 sur le voyage d'un autre utilisateur, 429 au-delà du quota (quota mis à 1 en env pour le test).
  - Faite le 11/10/2026 vers 11:17 (heure de Paris), en curl avec un jeton de session réel du compte de test (sign-in token créé par l'API Backend Clerk), sur un serveur de test `expo start --port 8082` lancé avec `QUOTA_TRIPS_PER_MONTH=1` : `GET /api/me` 200 ; GET, DELETE et status du voyage d'un autre compte (ligne insérée en base pour l'occasion, puis retirée) 403 ; uuid inconnu et id mal formé 404 ; corps de 11 jours 400 `invalid_trip` ; et à 11:22, après la première génération, `POST /api/trips` 429 `quota_exceeded`.

## Phase 5 — Pipeline de génération (Inngest)
- [x] `src/server/ai/schema.ts` : schéma Zod du contenu (days/activities/hotels/budget/tips, `place: { query, placeId?, resolved }`) et schéma JSON dérivé pour l'outil Claude.
  - Fait le 11/10/2026 : `itinerarySchema` (ce que Claude renvoie, lieux en `{ query }`), `tripContentSchema` (ce qui est stocké, lieux en `{ query, placeId, resolved }`), `toUnresolvedContent`, et `itineraryToolSchema` dérivé par `z.toJSONSchema` puis réduit à ce que le mode `strict` de Claude accepte (`minimum`, `minLength`, `maxItems`… retirés ; Zod continue de les vérifier sur la réponse).
- [x] `src/server/ai/prompts.ts` : prompts de génération et d'ajustement (langue = locale, budget en devise locale, contraintes de réalisme).
  - Fait pour la génération : `SYSTEM_PROMPT` stable et `itineraryPrompt`. Langue d'après la locale de l'utilisateur, montants dans la devise de la destination avec son code ISO 4217 (lecture retenue de « devise locale »), rythme = 2, 3 ou 4-5 activités par jour, lieux réels nommés avec ville et pays, hôtels existants. Le prompt d'ajustement vient en Phase 7.
- [ ] ~~`src/server/places/`~~ : reporté à l'écran de détail et à sa carte (décision du 11/10/2026).
- [x] `src/server/unsplash/` : recherche de la couverture et déclenchement de `download_location` à la sélection, comme l'exigent leurs guidelines. On stocke les URLs hotlinkées et les infos du photographe.
  - Fait : `pickCover(query)` (première photo paysage, `content_filter=high`), `download_location` déclenché à la sélection, stockage des URLs hotlinkées, du crédit (nom, username, lien) et de la page de la photo. Un échec Unsplash donne un voyage sans couverture plutôt qu'un voyage en échec (quota démo de 50 requêtes par heure).
- [x] Fonction `trip/generate` :
  1. `generate-itinerary` : Claude avec `tool_choice` forcé, puis validation Zod (une erreur de validation fait échouer la step, donc retry).
  2. `resolve-places` : lots parallèles qui renseignent `placeId` ; `resolved=false` si le lieu est introuvable.
  3. `pick-cover` : Unsplash.
  4. `save` : version 1, statut `ready`, tokens enregistrés.
  - Mise à jour de `current_step` à chaque étape.
  - Concurrence : 1 job par utilisateur, plus un throttle global.
  - `onFailure` : voyage et job passent en `failed` (la place du quota est rendue au mois de création du job, ADR 0004), erreur envoyée à Sentry (branché en Phase 10).
  - Faite le 11/10/2026 (`src/server/inngest/functions/trip-generate.ts`) : step `load-trip` (voyage en `generating`, job en `running`), `generate-itinerary` (Claude Haiku 4.5 en streaming, outil `save_itinerary` forcé et `strict`, puis validation Zod ; clé refusée, requête rejetée ou refus du modèle → `NonRetriableError`, validation ou réponse tronquée → retry), `resolve-places` (marque tout `resolved=false`, Places étant reporté), `pick-cover` (Unsplash), `save` (version 1, statut `ready`, couverture, tokens). `current_step` mis à jour à chaque step. Concurrence 1 par utilisateur et 5 au total, throttle de 10 départs par minute. `onFailure` passe voyage et job en `failed` (Sentry en Phase 10).
- [x] Tests : schéma Zod (cas valide et invalide), quota, mapping de la résolution Places (fetch mocké), fonction avec `@inngest/test`.
  - Faits avec Vitest (`npm test` : 27 tests, 5 fichiers, 11/10/2026) : schéma du contenu et schéma JSON strict, appel Claude avec un client factice (validation, `max_tokens`, refus, 401, 500), corps de `POST /api/trips` (10 jours acceptés, 11 refusés), quota (mois UTC, 429), fonction avec `@inngest/test` (ordre des steps, voyage sans couverture, options de concurrence). Le mapping Places attendra Places.
- [ ] Vérification : génération de bout en bout en local (Inngest Dev Server), puis sur EAS Hosting.
  - En local, faite le 11/10/2026 (heure de Paris) depuis l'émulateur : « Lisbonne, Portugal », du 11 au 14 octobre (4 jours), Confort, 2 voyageurs, Plages + Gastronomie, Tranquille. `POST /api/trips` à 11:20:20, run Inngest `01M4N46WGBFV93JE5KN0B803ZW` (« Generate a trip ») démarré à 11:20:25 et terminé à 11:21:01 dans le Dev Server, voyage `8054d94c-3d74-4dfb-9be4-702a19d32365` relu dans Neon en `ready` avec la couverture Unsplash `ljhCEaHYWJ8` (Aayush Gupta), version 1 « 4 jours à Lisbonne » (EUR, 4 jours à 2 activités, toutes `resolved=false`, 1 hôtel, 8 conseils, budget par personne 550 € dont la somme est juste), job `succeeded` avec 1 975 tokens en entrée et 1 944 en sortie. Reste EAS Hosting (premier déploiement, tranche R2).

## Phase 6 — UI principale
- [ ] i18n : `expo-localization` + i18next, `locales/fr.json` et `en.json`. Aucune chaîne en dur.
- [ ] Composants de base NativeWind : Button, Card, Screen, EmptyState, ErrorState, Skeleton.
- [ ] Onglets natifs (`NativeTabs`, import `expo-router/unstable-native-tabs` en SDK 57) : Accueil (`index`), Assistant (`assistant`), Voyages (`trips`), Profil (`profile`), libellés en français, icônes Material Symbols fournies par expo-symbols.
  - Pourquoi ces quatre onglets : un par écran principal du plan. Accueil porte la vue d'ensemble de la maquette `design/home-screen-ui-design.jpg` (planificateur IA, « Mes voyages », inspirations de destinations) ; Assistant portera le chat d'ajustement (Phase 7) ; Voyages, la liste complète « Mes voyages » avec suppression (Phase 6) ; Profil, les réglages, la déconnexion et la suppression du compte (Phase 9). La barre d'onglets de la maquette (Accueil, Explorer, Mes Plans, Mon Profil) n'est pas reprise en v1, par choix du propriétaire : les quatre onglets suivent les quatre écrans principaux du plan. Quatre onglets restent sous la limite de cinq de la barre Android.
  - Fait sur la branche `feat/create-trip` : onglets et écran Accueil en données en dur d'après la maquette. Assistant, Voyages et Profil sont des écrans d'attente ; Profil garde la déconnexion.
- [ ] Accueil : liste « Mes voyages » (couverture, statut, badge « en cours »), quota restant, bouton « Nouveau voyage », état vide, pull-to-refresh, suppression avec confirmation.
  - Interface refaite le 11/10/2026 d'après la nouvelle maquette `design/home-screen-ui-design.jpg` sur `feat/create-trip` (données en dur : « Brainditech », trois voyages, cinq inspirations ; photos découpées dans la maquette, texte incrusté effacé). Cette maquette ne montre plus le quota ni le statut des voyages : à replacer (badge sur la carte, écran Nouveau voyage) en branchant `api/me` et `api/trips` (disponibles depuis le 11/10/2026 ; l'accueil est encore en données en dur). Reste aussi : état vide, pull-to-refresh, suppression.
- [ ] Nouveau voyage : destination en texte libre (autocomplete reportée avec Places), dates exactes (10 jours au plus), voyageurs (1–10), 3 niveaux de budget, centres d'intérêt, rythme, puis redirection vers la progression.
  - Interface faite le 11/10/2026 d'après les maquettes `design/new-trip-ui-design-1-top.jpg` et `-2-scrolled.jpg` (un seul écran, défilé) dans `(app)/new-trip.tsx`, ouverte par le bouton « Nouveau voyage » de l'accueil : assistant, destination, calendrier, budget, voyageurs, centres d'intérêt, rythme, bouton « Générer ». Le calendrier est fonctionnel : mois courant, jour du jour sélectionné à l'arrivée, jours et mois passés désactivés, plage choisie en deux touches (début puis fin, toute autre touche repart de zéro), libellé « Du 23 au 26 juin · 4 jours ». Le reste est en état local seulement, rien n'est envoyé. Les maquettes ajoutent au plan des dates (le nombre de jours en découlera), des centres d'intérêt et un rythme ; le calendrier ne plafonnait pas la plage, alors que le plan limite un voyage à 10 jours. Tranché le 11/10/2026 (voir les décisions dans le Contexte). La seconde maquette est en anglais et plus sombre ; la palette de la première a été gardée pour tout l'écran.
  - Branché le 11/10/2026 : le calendrier plafonne la plage à `MAX_TRIP_DAYS` (une touche au-delà repart sur une nouvelle plage), les choix ont des clés stables partagées avec le serveur (`src/lib/trip-rules.ts`), et le bouton « Générer » envoie `POST /api/trips` (`useMutation`, spinner, bouton inactif sans destination), puis ouvre `trips/[id]/progress`. Erreurs affichées sous le bouton (quota, saisie, réseau). Restent pour la Phase 6 : i18n, et les éléments des maquettes à replacer.
- [x] Progression : polling toutes les 2–3 s (`refetchInterval`), étapes animées, `router.replace` vers le détail quand le voyage est prêt, état d'échec avec bouton « Réessayer ».
  - Version simple faite le 11/10/2026 (`(app)/trips/[id]/progress.tsx`) : polling de `api/trips/[id]/status` toutes les 2,5 s (`refetchInterval`, arrêté à `ready` ou `failed`), liste des quatre étapes (faite, en cours, à venir), état prêt avec couverture, titre, résumé et crédit photo (le détail n'existe pas encore : bouton vers l'accueil), état d'échec avec « Réessayer » (retour au formulaire) et message de réseau. Étapes animées faites le 11/10/2026 au soir (voir ci-dessous).
  - `router.replace` vers le détail fait le 11/10/2026 : au statut `ready`, l'écran charge le voyage (`tripQueryOptions` dans `src/lib/trips.ts`, partagé avec le détail pour que le cache serve l'écran suivant) puis remplace la route par `trips/[id]`. Vérifié sur l'émulateur le 11/10/2026 de 14:34:32 à 14:35:20 (heure de Paris) : « Kyoto, Japon », du 11 au 13 octobre, 2 voyageurs, Confort, bouton « Générer mon itinéraire » → étapes affichées, « Votre voyage est prêt ! », puis le détail s'ouvre seul ; son bouton Retour ramène à l'accueil.
  - Écran refait le 11/10/2026 au soir d'après la maquette `design/trip-generating-ui-design.jpg` et l'illustration `design/trip-generating-illustration.png` (PNG transparent de 3072×2048, 4,6 Mo, réduit en `assets/images/trip-generating-illustration.webp` de 1200×816, 192 Ko) : illustration, titre « Création de votre voyage », sous-titre « Cap sur {destination} » (le nom vient désormais de `GET api/trips/[id]/status`), trois étapes à l'écran pour les cinq steps du job (`src/lib/trip-progress.ts`, testé : itinéraire ← `load-trip` + `generate-itinerary`, lieux ← `resolve-places`, finalisation ← `pick-cover` + `save`), disque de l'étape en cours qui pulse (Reanimated), barre dégradée qui avance par paliers vers la part de chaque step et continue d'avancer doucement pendant le step Claude (45 s) pour ne jamais sembler bloquée, message par step, états échec et réseau conservés (barre figée en rouge). Composants dans `src/components/trip-progress-ui.tsx`. Titre en Google Sans (pas de police serif ajoutée). Vérifié sur l'émulateur le 11/10/2026 de 21:34:16 à 21:34:53 (heure de Paris) : « Lisbonne, Portugal », 11–13 octobre → étape 1 en surbrillance, barre à 45 % après 15 s, détail ouvert seul avant 35 s ; état réseau vérifié à 21:36 avec un id inconnu (message rouge, « Réessayer »). Les steps lieux et finalisation durent moins que l'intervalle de polling : on les voit rarement en cours.
- [ ] Détail : en-tête avec la couverture (Unsplash et crédit « Photo by X on Unsplash » avec liens UTM, ou couverture perso), sections Itinéraire par jour, Hôtels, Budget, Conseils.
  - Fait le 11/10/2026 d'après la maquette `design/trip-detail-ui-design.jpg` (`(app)/trips/[id]/index.tsx`, composants dans `src/components/trip-detail-ui.tsx`, formats dans `src/lib/format.ts`) : couverture Unsplash terminée par une courbe, titre, crédit « Photo de X sur Unsplash » (le nom et « Unsplash » ouvrent leurs pages avec `utm_source=tripagent&utm_medium=referral`), boutons Retour et « … », trois chiffres (durée, voyageurs, budget par personne dans la devise du contenu via `Intl.NumberFormat`), Itinéraire (résumé, une carte par jour avec sa date, activités par moment de la journée avec durée, coût et lien Google Maps), Hébergement (prix par nuit, lien Google Maps), Budget (quatre postes, total, notes), Conseils, bouton assistant flottant ; barre d'état claire sur la photo puis sombre au défilement. Vérifié sur l'émulateur le 11/10/2026 vers 14:31 (Bora Bora, lien profond) et 14:35 (Kyoto, après génération, heure de Paris). Restent : le bouton assistant (Phase 7) ne fait rien encore ; la section Carte de la maquette attend Google Places et expo-maps (Phase 11) ; i18n.
  - Bouton « … » branché le 11/10/2026 : un menu en superposition (`CoverMenu`, `Modal` transparent) propose « Supprimer le voyage » ; la confirmation passe par la boîte de dialogue native (`Alert.alert`, Annuler / Supprimer), puis `DELETE /api/trips/[id]` (`useMutation`, cache du voyage vidé) et retour à l'accueil ; une erreur réseau est annoncée par une seconde boîte de dialogue. Vérifié sur l'émulateur le 11/10/2026 à 19:30 (heure de Paris) sur le voyage Madagascar du matin : menu, boîte de dialogue, puis accueil, et la ligne a disparu de la base (les versions et jobs suivent par cascade). Le menu accueillera « Versions » en Phase 7.
  - Le 11/10/2026 au soir, le bouton « … » et son menu (`CoverMenu`) ont été retirés : deux boutons ronds en haut à droite, caméra (couverture personnalisée, Phase 8) et corbeille, qui ouvre directement la confirmation native ; le reste de la suppression est inchangé. Vérifié sur l'émulateur à 20:25 (heure de Paris). « Versions » (Phase 7) trouvera une autre place.
  - À corriger côté génération (Phase 5) : les voyages Bora Bora et Madagascar du 11/10/2026 au matin ont 4 entrées de jour pour 3 jours demandés (la 4e reprend la date de la 3e) ; le détail affiche la durée demandée dans les chiffres et toutes les entrées reçues dans l'itinéraire. Le prompt devra imposer exactement une entrée par date.
- [ ] `api/trips/[id]/places+api.ts` : Place Details en direct pour les `placeId` d'un jour, chargés à la demande au déroulé du jour. L'URL de la photo est générée à la volée et n'est jamais stockée. Crédit de l'auteur de la photo sous chaque photo Places.
- [x] Bouton « Ouvrir dans Google Maps » : deep link `https://www.google.com/maps/search/?api=1&query=…&query_place_id=…` via `Linking`.
  - Fait le 11/10/2026 dans le détail : lien « Google Maps » sous chaque activité et chaque hôtel (`googleMapsUrl` dans `src/lib/trips.ts`, `expo-linking`) ; `query_place_id` est ajouté dès qu'un `placeId` existe, la recherche par nom suffit tant que les lieux ne sont pas résolus.
- [ ] Vérification : parcours complet sur l'appareil, en FR et en EN (langue de l'appareil), en mode clair et sombre, sur un réseau lent (throttling).

## Phase 7 — Chat d'ajustement et versions
- [ ] `api/trips/[id]/adjust+api.ts` : vérifie `adjustments_used < QUOTA_ADJUSTMENTS_PER_TRIP` et qu'aucun job n'est en cours, enregistre le message et envoie `trip/adjust`.
- [ ] Fonction `trip/adjust` : Claude reçoit la version courante et le message, puis renvoie le contenu complet. Seuls les `placeId` des lieux nouveaux ou modifiés sont résolus (réutilisation par `query`). On crée la version N+1, `adjustments_used++` uniquement en cas de succès, et le message assistant résume les changements.
- [ ] `api/trips/[id]/versions+api.ts` (liste) et `versions/[v]/restore+api.ts` (crée une version `restore`).
- [ ] Écrans : chat (historique et saisie, réutilise l'écran de progression), liste des versions avec bouton « Restaurer ».
- [ ] Vérification : 2 ajustements suivis d'une restauration, refus du 6ᵉ ajustement, refus pendant qu'un job est en cours.

## Phase 8 — Couverture personnalisée (ImageKit)
- [x] `api/trips/[id]/cover+api.ts` POST : paramètres d'upload signés (token, expire, signature) avec la clé privée côté serveur ; le dossier, le nom du fichier et la pré-transformation sont fixés par le serveur. (Prévu d'abord comme `api/imagekit/auth`, rangé sous le voyage pour profiter du contrôle de propriété.)
  - Fait le 11/10/2026 (`src/server/imagekit/index.ts`) : signature HMAC-SHA1 de `token + expire` calculée avec Web Crypto (Node et EAS Hosting), token uuid à chaque demande, validité 10 min ; la clé publique et l'endpoint restent côté serveur (`IMAGEKIT_URL_ENDPOINT`, à renseigner dans `.env`, aucune variable `EXPO_PUBLIC_`). L'API v1 d'ImageKit ne lie pas la signature au dossier : c'est le `PUT` qui refuse un fichier hors du dossier du voyage (`isCoverPath`). L'API v2, encore en bêta, signerait tout le corps en JWT ; à reconsidérer. Tests Vitest (`src/server/imagekit/index.test.ts`, 8 tests) : signature identique à `crypto.createHmac`, champs signés, chemins acceptés et refusés, URL.
- [x] `expo-image-picker` (sélecteur de photos Android, sans permission sur les versions récentes) : choix d'une image, upload direct vers ImageKit dans le dossier `/tripagent/covers/{userId}/{tripId}/` (un dossier au nom de l'app en tête, la médiathèque ImageKit étant partagée), puis `PUT api/trips/[id]/cover` (cover_custom).
  - Fait le 11/10/2026 : `expo-image-picker` 57.0.20 (plugin dans `app.json` : message photos en français, permissions caméra et micro retirées du manifeste Android), `quality: 0.8`, bouton caméra à côté de la corbeille sur le détail, `uploadTripCover` (`src/lib/trips.ts`) : POST signé → multipart vers ImageKit → PUT ; pré-transformation `w-2000,h-2000,c-at_max` à l'upload pour ne jamais stocker de gros fichiers ; nom unique par upload (jamais deux fois la même URL, donc pas de cache périmé). Le `fetch` d'Expo refuse la partie `{ uri, name, type }` de React Native : le fichier part en `File` d'`expo-file-system` (ajouté à `package.json`). Rebuild du dev client nécessaire (`prebuild --clean` puis `run:android --no-bundler`, fait à 20:20, heure de Paris).
- [ ] Affichage via `expo-image` avec transformations ImageKit (`tr=w-…,q-auto,f-auto`). Bouton « Revenir à la photo Unsplash ».
  - Affichage fait le 11/10/2026 : `customCoverUrl` demande `tr=w-<largeur en px arrondie au pas de 360>,c-at_max,q-80,f-auto` (pas de `q-auto` chez ImageKit, 80 est sa qualité par défaut) ; la couverture perso remplace la photo Unsplash et son crédit, `cover_unsplash` est conservé. Reste : le bouton « Revenir à la photo Unsplash ».
- [x] Au remplacement ou à la suppression du voyage, l'ancien fichier ImageKit est supprimé (step Inngest).
  - Fait le 11/10/2026 au soir (ADR 0005, détail sous la vérification) : l'ancien fichier part au remplacement et avec le voyage (routes), le dossier de l'utilisateur avec le compte (step Inngest). Deuxième revue CodeRabbit : deux `PUT` simultanés sur le même voyage pouvaient supprimer la couverture finalement retenue, chacun effaçant celle lue avant d'écrire. L'écriture renvoie désormais la couverture qu'elle remplace (`update … returning old.cover_custom`, PostgreSQL 18, `src/server/trips/cover.ts`), et c'est celle-là qui est supprimée ; un voyage disparu entre-temps répond 404. Prouvé sur Neon par deux écritures concurrentes (voir l'ADR).
- [ ] Vérification : upload, affichage optimisé, remplacement (l'ancien fichier disparaît du dashboard ImageKit).
  - Upload et affichage vérifiés le 11/10/2026 à 20:34:11 (heure de Paris) sur l'émulateur (API 36, serveur de test 8082, voyage Bora Bora `75dc8981`) : sélecteur système ouvert sans permission, photo de 784 Ko envoyée, fichier `/covers/user_…/75dc8981-…/cover_cPl_c4m92.jpg` de 169 Ko (768×1364) chez ImageKit, `cover_custom` écrit en base, couverture affichée sans le crédit Unsplash. Servi en WebP : 123 Ko pour `w-1080` (pas d'agrandissement), 40 Ko pour `w-360`. Remplacement et suppression faits le 11/10/2026 au soir (ADR 0005) : le `PUT` relit le fichier chez ImageKit par son `fileId` (image, dans le dossier du voyage) au lieu de croire le chemin déclaré, l'ancien fichier est supprimé au remplacement, le fichier avec le voyage, le dossier `/tripagent/covers/{userId}` avec le compte (step Inngest). Reste : une purge périodique des uploads jamais déclarés.

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
Voyageurs : un nombre de 1 à 10 (compteur de la maquette, décision du 11/10/2026) · durée de 1 à 10 jours, déduite des dates exactes · budget en devise de la destination (code ISO 4217 stocké avec le contenu) · mois de quota calendaire UTC · TanStack Query + i18next · pas d'analytics produit · lieu non résolu affiché sans carte ni photo · déclenchement Unsplash `download_location` à la sélection automatique.

## Risques ouverts
- **R2** : la Phase 1 est reportée au premier déploiement (décision du 11/10/2026) ; la vérification sur EAS Hosting de la Phase 5 tranchera. Repère local : la génération d'un voyage de 4 jours a pris 36 s dans Inngest le 11/10/2026 (step Claude comprise, 1 944 tokens en sortie).
- **Coût de Place Details à l'affichage** (photos = SKU plus cher) : chargement à la demande par jour, field mask minimal, cache de TanStack Query uniquement en mémoire pendant la session.
- **expo-maps en alpha** : changements cassants possibles, d'où le repli sous forme de liste.
- **Sentry serveur sur EAS Hosting** : compatibilité à confirmer en Phase 10.
- **Quota** : une place réservée dans `monthly_generations` puis jamais rendue (serveur arrêté entre la réservation et l'insertion du voyage, ADR 0004) resterait perdue pour le mois. Accepté : fenêtre de quelques millisecondes, et la place revient le mois suivant.
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
