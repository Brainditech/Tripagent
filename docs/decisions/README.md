# Décisions d'architecture

Chaque décision est écrite et reliée au commit qui la prouve. Les nouvelles décisions suivent [template.md](template.md) et sont numérotées (`NNNN-titre.md`).

## Décisions détaillées (ADR)
| N° | Décision | Commit |
|----|----------|--------|
| [0001](0001-local-development-builds.md) | Development builds locaux (certificat de debug), EAS au déploiement | `a7a43c2` |
| [0002](0002-google-browser-oauth.md) | Connexion Google par OAuth dans le navigateur (`useSSO`), avec les identifiants partagés de Clerk | `0106091` |
| [0003](0003-clerk-webhook-event-ordering.md) | Ordre des événements du webhook Clerk : écriture seulement si `updated_at` est plus récent, trace des comptes supprimés | `2ff4e85` |
| [0004](0004-monthly-quota-reservation.md) | Quota mensuel réservé dans `monthly_generations` par un seul `INSERT … ON CONFLICT … WHERE used < limite`, survit à la suppression des voyages | `1c041cb` |
| [0005](0005-imagekit-direct-upload-trust.md) | Upload direct ImageKit : le fichier est relu par son `fileId` avec la clé privée avant d'être enregistré ; suppression au remplacement, avec le voyage et avec le compte | `1125e88`, `89ce31f` |
| [0006](0006-app-sentry-logs.md) | Logs Sentry côté app : les échecs d'appels API journalisés une fois dans le client (`createApi`), l'issue des opérations et les erreurs Clerk dans les écrans et `src/lib`, attributs `snake_case` sans donnée personnelle | `9fd4341`, `21f5763`, `fbc0c1c`, `5dec0a4`, `035e564`, `06794cb`, `e7beb3e` |
| [0007](0007-app-sentry-tracing.md) | Tracing côté app : une transaction par écran (`reactNavigationIntegration` enregistré sur le conteneur d'Expo Router), `traceFetch` parce que le `fetch` global d'Expo n'est pas le polyfill XHR, en-têtes de trace limités aux routes `/api/` | `75fd545` |
| [0008](0008-assistant-tab-travel-chat.md) | Onglet Assistant : chat de voyage généraliste d'après la maquette, conversation envoyée à chaque requête (sans état serveur), réponse par outil strict forcé (texte, cartes de destinations, suggestions), photos Unsplash en cache côté serveur ; le chat d'ajustement reste en Phase 7 | `32e58c3`, `4f27e66`, `084c330`, `178d108` |
| [0009](0009-dependabot-overrides.md) | Alertes Dependabot : `overrides` npm pour les quatre paquets corrigés en amont (postcss-selector-parser 7, uuid 11 sous xcode, esbuild 0.25 sous @esbuild-kit, query-string 9 sous expo-router), braces et node-forge sans correctif laissées ouvertes et à rejeter comme « code vulnérable non utilisé » | `2a3bf8d` |
| [0010](0010-assistant-streamed-reply.md) | Réponse de l'assistant diffusée au fil de l'écriture : `POST /api/assistant` répond en lignes JSON (texte par fragments, puis la réponse entière, ou une ligne d'erreur), le texte étant lu dans le JSON partiel de l'outil strict (`eager_input_streaming`) ; les erreurs d'avant le premier octet gardent leurs statuts ; l'app lit le flux et montre la bulle en cours d'écriture | `a54d9d2` |
| [0011](0011-server-sentry-agent-tracing.md) | Sentry côté serveur : `@sentry/cloudflare` (EAS Hosting = Cloudflare Workers) enveloppe chaque route authentifiée (`wrapRequestHandler`, trace continuée depuis l'app, `runTask` d'expo-server comme `waitUntil`), les appels Claude de l'assistant sont des spans `gen_ai` sans les textes, la conversation est groupée par un identifiant créé par l'app, un log par tour, les 500 capturés | `4a480b8` |

## Décisions déjà prises avant les ADR
Une ligne par décision, avec la raison **telle qu'elle est écrite** dans PLAN.md, AGENTS.md ou un commit. Si rien n'est écrit, elle est marquée « raison non consignée ». « Pas encore implémentée » signifie que la décision figure dans PLAN.md (`e625881`) mais qu'aucun commit ne la réalise encore.

### Produit et périmètre
| Décision | Raison écrite | Commit |
|----------|---------------|--------|
| Android uniquement pour la v1 ; Apple viendra avec iOS | Raison non consignée | PLAN.md (`e625881`) |
| Expo SDK 57, Expo Router (écrans dans `src/app/`), React Compiler et typedRoutes activés, npm | Raison non consignée | `13ea033`, `e625881` |
| Ordre : setup, puis spike R2 avant tout le reste | Prouver qu'une step Inngest avec un long appel Claude fonctionne sur EAS Hosting (risque R2) | Pas encore implémentée |
| Carte expo-maps en dernière phase UI, avec repli en liste | expo-maps est « encore en alpha dans SDK 57 » | Pas encore implémentée |
| Hypothèses : voyageurs en 4 presets, durée de 1 à 10 jours, mois de quota calendaire UTC, TanStack Query + i18next, pas d'analytics produit | Raison non consignée | Pas encore implémentée |

### Interface
| Décision | Raison écrite | Commit |
|----------|---------------|--------|
| NativeWind 4.2.7 + Tailwind CSS 3 | Raison non consignée | `abfd5be` |
| Style avec `className`, pas `StyleSheet` ; onglets natifs (`NativeTabs`) | Raison non consignée | `4c5f8e1` (AGENTS.md) |
| Police Google Sans (`@expo-google-fonts`), une famille par graisse | Une famille par graisse : Android en a besoin (commentaire de `tailwind.config.js`). Choix de la police : raison non consignée | `10153bd` |
| Écran de connexion recréé d'après `design/auth-ui-design.png` | Raison non consignée | `10153bd` |
| Photo de fond `auth-bg-img-v2.jpg` et dégradé simple à deux points | Raison non consignée | `1c90900` |

### Authentification
| Décision | Raison écrite | Commit |
|----------|---------------|--------|
| Google + code à usage unique par e-mail, sans mot de passe | Raison non consignée | PLAN.md (`e625881`) ; e-mail : `2130510` ; Google : ADR 0002 |
| Clerk avec flux personnalisés (nos propres écrans) | Raison non consignée | `2130510` |
| `signUpIfMissing` | « Ne révèle pas si une adresse e-mail a déjà un compte » | `2130510` |
| Groupes `(auth)` et `(app)` protégés par `useAuth` + `Redirect` | Raison non consignée | `2130510` |
| Bouton « Continuer avec Google » inactif | Inactif jusqu'au development build. Remplacé par l'ADR 0002 | `2130510` |
| Identifiant Android `com.brainditech.tripagent` | Raison non consignée | `a7a43c2` |

### Données, serveur et services
| Décision | Raison écrite | Commit |
|----------|---------------|--------|
| Backend en Expo API Routes (`src/app/api/**/+api.ts`) sur EAS Hosting, `web.output: "server"` | `web.output: "server"` est « obligatoire pour les API routes ». Choix des API Routes : raison non consignée | `c6091e2` (en local ; EAS Hosting pas encore) |
| Neon + Drizzle (driver HTTP) | Driver HTTP : « one fetch per query, nothing to keep alive » (commentaire de `src/server/db/index.ts`). Choix de Neon + Drizzle : raison non consignée | `c6091e2` (table `users`) |
| Inngest pour la génération en arrière-plan | Raison non consignée | `c6091e2` (fonction `user/deleted`, en local) ; génération pas encore implémentée |
| Synchro des comptes Clerk : création et mise à jour (`user.created`, `user.updated`) écrites directement par le webhook, Inngest seulement pour la suppression (`user/deleted`) | Clerk (Svix) renvoie lui-même un webhook raté : « A failed write answers 500 so that Clerk (Svix) retries the delivery » (commentaire de `src/app/api/webhooks/clerk+api.ts`) | `c6091e2` ; ordre des événements : ADR 0003 |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), id centralisé dans la config serveur | Raison non consignée | Pas encore implémentée |
| Quotas lus depuis l'environnement, limites hautes en développement | Raison non consignée | Pas encore implémentée |
| Unsplash affiché en direct (hotlink), photographe crédité | « Leurs conditions interdisent le proxy via ImageKit » | Pas encore implémentée |
| ImageKit uniquement pour les couvertures téléversées par l'utilisateur | Conséquence de la ligne Unsplash ci-dessus | Pas encore implémentée |
| Google Places : seul le `place_id` est stocké, le reste est lu à l'affichage | « Conformément aux Places Policies » | Pas encore implémentée |

### Observabilité et sécurité
| Décision | Raison écrite | Commit |
|----------|---------------|--------|
| Sentry pour React Native, région DE, plugin Expo + `getSentryExpoConfig` combiné avec NativeWind | Raison non consignée | `f088843` |
| `sendDefaultPii: false` | Raison non consignée | `47af817` |
| Jeton Sentry et autres secrets dans `.env` (ignoré par git), jamais avec le préfixe `EXPO_PUBLIC_` | Raison non consignée | `f088843`, `4c5f8e1` (AGENTS.md) |
| Chaque route API vérifie le JWT Clerk ; les webhooks vérifient la signature svix | Signature svix : « No session protects this route. The Svix signature […] is the only authentication » (commentaire de `src/app/api/webhooks/clerk+api.ts`). JWT : raison non consignée | `4c5f8e1` (AGENTS.md) ; signature svix : `c6091e2` ; JWT : pas encore implémenté |
| `.env.example` versionné, avec la liste des variables requises | Raison non consignée | `bc48ee4` |

### Méthode de travail
| Décision | Raison écrite | Commit |
|----------|---------------|--------|
| PLAN.md est la source de vérité ; cocher une case seulement quand l'étape est vérifiée | Raison non consignée | `e625881`, `4c5f8e1` |
| Une fonctionnalité = un commit | Raison non consignée | `4c5f8e1` (AGENTS.md) |
| L'agent ne démarre jamais le serveur de dev | L'utilisateur le lance dans son propre terminal | `a120538` |
| Vérifications visuelles par captures `adb` sur l'émulateur Android (Windows) | Raison non consignée | `4c5f8e1` (AGENTS.md) |
