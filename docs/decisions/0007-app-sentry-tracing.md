# 0007 — Tracing Sentry côté app : une transaction par écran via Expo Router, le `fetch` d'Expo tracé, les en-têtes de trace limités à l'API

- **Date** : 2026-10-12
- **Statut** : acceptée

## Contexte
La page « Set Up Tracing for Expo » demande deux choses, déjà en place depuis la Phase 10 : `tracesSampleRate` et `Sentry.wrap` autour du layout racine. Pourtant, en lisant le SDK installé (`@sentry/react-native` 7.11.0 sur `@sentry/core` 10.37.0) et en sondant l'app sur l'émulateur, trois manques sont apparus :

- Aucune instrumentation de navigation : sans conteneur enregistré, pas de transaction par écran, et l'app start part seule, sans le reste.
- Le `fetch` global d'Expo (installé par `expo/src/winter/runtime.native.ts`) est natif ; ce n'est pas le polyfill XHR de React Native. Or l'intégration `ReactNativeTracing` n'instrumente que XHR sur mobile (`traceFetch: false`, parce que « RN's fetch is a whatwg polyfill over XHR »). Résultat : aucun span `http.client`, aucun en-tête de trace sur les appels à l'API ou à ImageKit.
- `tracePropagationTargets` vaut `[/.*/]` par défaut sur mobile : `sentry-trace` et `baggage` partiraient vers Clerk, ImageKit et tout autre hôte, ce que la page « Trace Propagation » déconseille (garder les cibles à ses propres services).

Détail de version : l'`expoRouterIntegration` de la documentation n'existe pas en 7.11 (elle arrive avec le SDK 8, que `npx expo install` ne propose pas pour le SDK Expo 57). Reste `reactNavigationIntegration`, à enregistrer soi-même sur le conteneur de navigation d'Expo Router.

Objectif : que Sentry dise combien de temps chaque écran met à s'afficher et ce que chaque chargement d'écran appelle, sans rien envoyer d'inutile aux services tiers, en restant simple (pas de span manuel, pas de wrapper).

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — Laisser l'init telle quelle | Rien à faire | Pas de transaction d'écran, pas de span d'appel : le tracing ne dit rien d'utile |
| B — `reactNavigationIntegration` enregistré sur le conteneur d'Expo Router, `traceFetch: true`, `tracePropagationTargets: [/^\/api\//]` | Une transaction par écran avec temps d'affichage initial, frames lentes ou gelées, stalls et app start en span ; un span par requête lancée pendant le chargement d'un écran ; en-têtes seulement vers nos routes | L'intégration `ReactNativeTracing` explicite remplace celle par défaut (`traceXHR` reste vrai, inoffensif : rien n'utilise XHR) ; quatre lignes de câblage dans le layout racine |
| C — Monter le SDK en 8.x pour `expoRouterIntegration` | Aucun câblage | Hors de la matrice de versions d'Expo 57, pour économiser un `useEffect` |
| D — Spans manuels (`Sentry.startSpan`) autour des opérations | Durées nommées | Les spans `http.client` couvrent déjà les étapes (API, ImageKit) ; à revoir si une opération purement locale devient lente |

Le tracing des interactions (`enableUserInteractionTracing`) est écarté : il demande un `sentry-label` sur chaque pressable.

## Décision
**Option B**, dans `src/app/_layout.tsx` :
- `reactNavigationIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() })` et `enableNativeFramesTracking: !isRunningInExpoGo()` ; le layout racine appelle `registerNavigationContainer` avec `useNavigationContainerRef()` d'Expo Router dans un effet. `ExpoRoot` monte le `NavigationContainer` au-dessus du layout, la ref est donc déjà posée quand l'effet tourne.
- `reactNativeTracingIntegration({ traceFetch: true })` : le SDK enveloppe `globalThis.fetch` (Expo l'expose par un accesseur paresseux doté d'un `set`, l'affectation du SDK passe et remplace la propriété).
- `tracePropagationTargets: [/^\/api\//]` : le SDK compare la chaîne brute passée à `fetch` (`handlerData.fetchData.url`), et le client API (`src/lib/api.ts`) appelle ses routes par chemin relatif, en développement comme en production.
- `tracesSampleRate` reste à 1.0 : un seul environnement, une poignée d'utilisateurs. À baisser, ou passer à `tracesSampler`, quand le trafic grandira.
- Les transactions portent le nom de la route (`index`, `new-trip`, `trips/[id]/progress`) ; `sendDefaultPii: false` garde les paramètres hors des événements.

## Conséquences
- Les requêtes ne sont tracées que pendant qu'une transaction d'écran est ouverte (modèle « idle » du SDK) : le polling de l'écran de progression, toutes les 2,5 s, n'y figure que par sa première requête. La durée d'une génération se lit dans les logs (ADR 0006) et, plus tard, côté serveur.
- En développement, le SDK supprime les spans vers l'URL absolue du dev server ; nos appels relatifs passent. En production, rien n'est filtré.
- La propagation ne produira une trace distribuée que lorsque le serveur aura Sentry (Phase 10) ; y prévoir `strictTraceContinuation` comme la documentation le recommande.
- Observé pendant la vérification : une navigation par lien profond après sortie de l'app a produit une transaction nommée d'après son span de traitement (« Navigation dispatch to screen trips/[id]/progress mounted », op `navigation.processing`, sans span). Cas marginal (lien profond au démarrage), à surveiller dans Sentry, pas corrigé.
- `profilesSampleRate` et le replay ne changent pas.
- Au passage au SDK Expo 58 et au SDK Sentry 8 : remplacer le câblage par `expoRouterIntegration`.

## Commit
`75fd545` (`feat(observability): trace screens and API calls in the app`, branche `feat/sentry-tracing`, empilée sur `feat/sentry-logs`).

Preuve, le 12/10/2026 de 00:21 à 00:27 (heure de Paris), émulateur Android, dev build rechargé par Metro, avec un `beforeSendTransaction` temporaire qui écrivait chaque transaction dans logcat (retiré avant le commit) et un serveur HTTP jetable sur le poste (port 8099) qui notait les en-têtes reçus :
- Démarrage : transaction `__root` (op `ui.load`) avec les spans `app.start.cold` (Cold Start, Process Initialization, JS Bundle Execution Before React Root), `ui.react.mount <Root>`, `ui.load.initial_display`, et des spans `http.client` pour les appels Clerk (`/v1/environment`, `/v1/client`) et la requête de sonde ; mesures `app_start_cold`, `time_to_initial_display`, `frames_total`, `frames_slow`, `frames_frozen`, `stall_count`, `stall_total_time`, `stall_longest_time`.
- Navigation : « Nouveau voyage » → transaction `new-trip` (op `navigation`, `route.name` `new-trip`, temps d'affichage initial) ; retour à l'accueil → `index`.
- Propagation : les deux requêtes de sonde vers le serveur jetable sont arrivées sans `sentry-trace` ni `baggage` (seulement `accept-encoding`, `host`, `connection`, `user-agent`, `if-modified-since`).
- `tsc --noEmit`, `expo lint` et `npm test` (56 tests) passent ; l'app redémarre sur l'accueil avec l'init finale.
- Non vérifié : la réception dans Sentry (jeton de `.env` limité aux source maps, voir ADR 0006), à confirmer dans Performance → Traces du projet `tripagent`. Non observé : un span `http.client` sur un appel `/api/…`, aucun écran à appel API n'étant atteignable sans lien profond ni génération ; c'est le même chemin d'instrumentation que les appels Clerk observés.
