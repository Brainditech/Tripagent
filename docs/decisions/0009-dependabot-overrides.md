# 0009 — Alertes Dependabot : overrides npm pour les quatre paquets corrigés en amont, les deux sans correctif restent ouvertes

- **Date** : 2026-10-12
- **Statut** : acceptée

## Contexte
GitHub signale six alertes Dependabot sur `main` (deux hautes, quatre modérées), toutes dans des dépendances transitives du `package-lock.json` ; `npm audit` montre les mêmes six avis, ses 42 entrées étant les chaînes de dépendances. Aucune dépendance directe n'a publié de version qui embarque le correctif :

| Alerte | Paquet (chaîne) | Correctif en amont |
|--------|-----------------|--------------------|
| #4 haute, GHSA-vfj7-8cjw-p6xm | braces 3.0.3 (tailwindcss → chokidar, micromatch) | **aucune version corrigée** |
| #3 haute, GHSA-86w9-cpqp-85rv | node-forge 1.4.0 (expo → @expo/cli, @expo/code-signing-certificates) | **aucune version corrigée** |
| #2 modérée, GHSA-vcc3-ghjq-m6fr | decode-uri-component 0.2.2 (expo-router 57 → query-string 7.1.3) | 0.5.0, en ESM seulement ; expo-router 58 a retiré query-string |
| #1 modérée, GHSA-w5hq-g745-h8pq | uuid 7.0.3 (@expo/config-plugins → xcode 3.0.1) | 11.1.1 (`v3`/`v5`/`v6` avec un `buf` fourni ; xcode n'appelle que `v4`) |
| #5 modérée, GHSA-rj75-hqrm-r3gf | postcss-selector-parser 6.1.4 (tailwindcss 3.4.19, postcss-nested 6.2.0) | 7.1.6 ; la branche 6.x n'a pas reçu le correctif |
| #6 modérée, GHSA-67mh-4wv8-2f99 | esbuild 0.18.20 (drizzle-kit → @esbuild-kit/esm-loader → core-utils) | 0.25.0 ; drizzle-kit ne charge jamais ce loader (seule mention : son `package.json`) |

Objectif : fermer ce qui peut l'être sans changer de version d'Expo, de React Native, de NativeWind ni de Tailwind, et savoir quoi faire des alertes qu'aucune version ne corrige. Triage du 2026-10-11 : aucune n'est exploitable à distance dans l'app ; la seule embarquée dans le bundle est decode-uri-component (analyse des liens profonds, blocage CPU par un lien forgé).

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — `npm audit fix --force` | Une commande | Rétrograde react-native, Sentry et NativeWind, ou passe à Tailwind 4 : bien pire que les alertes |
| B — Passer à Expo SDK 58 maintenant | Règle decode-uri-component à la source (expo-router 58 n'a plus query-string) | Ne touche pas aux cinq autres ; migration de SDK à part entière (natif, NativeWind, Reanimated), hors du périmètre d'un correctif de dépendances |
| C — `overrides` npm sur les quatre paquets qui ont un correctif, alertes sans correctif laissées ouvertes et rejetées sur GitHub avec leur raison | Lockfile propre pour Dependabot et `npm audit` ; chaque override est restreint au paquet consommateur, donc révocable un par un | Dette à suivre : chaque override doit être retiré quand la dépendance directe aura bougé ; braces et node-forge restent affichées tant qu'aucune version corrigée n'existe |

## Décision
**Option C.** Dans `package.json` :
- `"postcss-selector-parser": "^7.1.6"` **global** : l'override imbriqué sous `tailwindcss` n'a changé que l'arête de tailwindcss lui-même, postcss-nested (hissé à la racine) gardait 6.1.4 et l'alerte restait. Les seuls consommateurs sont tailwindcss et postcss-nested, et la seule rupture de 7.0.0 (insertions pendant une itération) ne les concerne pas.
- `"xcode": { "uuid": "^11.1.1" }` : uuid 11 garde un export CommonJS pour Node (`exports.node.require`) et `xcode` n'appelle que `uuid.v4()`.
- `"@esbuild-kit/core-utils": { "esbuild": "^0.25.0" }` : la version de drizzle-kit lui-même (0.25.12) ; le loader n'est de toute façon jamais chargé.
- `"expo-router": { "query-string": "^9.5.1" }` : query-string 9 dépend de decode-uri-component 0.5.0. expo-router importe le paquet par `__importStar(require("query-string"))` et n'utilise que `parse` et `stringify`, exports nommés présents en 9.x ; Metro transpile l'ESM de node_modules en CommonJS, donc l'interop tient. Aucun code Node (CLI Expo, tests) ne charge ces fichiers d'expo-router.

braces et node-forge : aucune version corrigée n'existe (`npm audit` propose de rétrograder react-native en 0.72, c'est-à-dire rien). Elles sont à rejeter dans GitHub (Dependabot → alerte → *Dismiss alert*) avec la raison « Vulnerable code is not actually used » : braces ne voit que nos globs `content` de Tailwind à la compilation, node-forge ne signe et ne vérifie que les certificats que @expo/cli génère localement pour le dev client.

## Conséquences
- Chaque override est un rappel à lever :
  - `expo-router.query-string` au passage à Expo SDK 58 (expo-router ≥ 58 n'a plus query-string) ;
  - `postcss-selector-parser` quand tailwindcss et postcss-nested dépendront de 7.x (NativeWind 5 / Tailwind 4) ;
  - `xcode.uuid` quand @expo/config-plugins dépendra d'un xcode à jour ;
  - `@esbuild-kit/core-utils.esbuild` quand drizzle-kit abandonnera `@esbuild-kit/esm-loader`.
- `npm audit` affiche encore « 25 high » : ce sont les chaînes de braces et node-forge, à relire à chaque mise à jour de dépendances (`npm audit --json`, clé `via` des entrées) jusqu'à ce qu'une version corrigée paraisse.
- Les overrides imbriqués de npm ne s'appliquent pas de façon fiable aux dépendances hissées d'un paquet : vérifier avec `npm ls <paquet> --all` que plus aucune version vulnérable ne subsiste avant de conclure.
- Les binaires `@esbuild/*` 0.25.12 sont dupliqués sous `@esbuild-kit/core-utils/node_modules` (le niveau racine garde esbuild 0.28.2 pour vitest et tsx) : coût d'installation seulement.
- La règle reste celle du 2026-10-11 : jamais `npm audit fix --force`.

## Commit
`2a3bf8d` (`fix(deps): override four transitive packages flagged by Dependabot`, branche `fix/dependabot-alerts`).

Preuve, le 12/10/2026 entre 11:30 et 11:38 (heure de Paris) :
- `npm audit` ne liste plus que braces et node-forge ; `npm ls` montre decode-uri-component 0.5.0 sous query-string 9.5.1 (la 0.2.2 vulnérable a disparu de l'arbre verrouillé), et une seule version de query-string (9.5.1), uuid (11.1.1) et postcss-selector-parser (7.1.6).
- CSS Tailwind (`npx tailwindcss -c tailwind.config.js -i global.css`) identique octet pour octet avant et après (même md5 `6dbfab2e…`).
- `require("xcode")` se charge et `uuid.v4()` résolu depuis xcode rend un UUID ; `@esbuild-kit/core-utils` résout esbuild 0.25.12 et `transformSync` compile un fichier TypeScript ; `drizzle-kit --version` répond.
- `tsc --noEmit`, `expo lint` et `npm test` (82 tests) passent ; `expo export --platform android` produit le bundle Hermes (7,4 Mo) avec query-string 9 dedans.
- Sur l'émulateur, dev build rechargé depuis le serveur Metro de développement, lien `tripagent://trips/00000000-0000-4000-8000-000000000000/progress?from=a%20b%26c&n=1` : l'écran de progression s'affiche, aucune erreur JavaScript dans logcat (les deux paramètres de requête passent par `queryString.parse` et `stringify` de la 9.5.1).
- Restent à faire par le propriétaire du dépôt, dans l'interface GitHub : rejeter #3 et #4 avec la raison ci-dessus.
