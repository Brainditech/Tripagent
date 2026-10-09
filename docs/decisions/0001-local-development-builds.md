# 0001 — Development builds locaux (certificat de debug)

- **Date** : 2026-10-09
- **Statut** : acceptée

## Contexte
Expo Go ne contient qu'un ensemble fixe de modules natifs. La connexion Google native (Phase 3) en demande un autre, donc il faut un development build : une vraie app Android, avec `expo-dev-client`.

Tripagent est un projet d'apprentissage. L'objectif de référence est d'**apprendre toute la chaîne** : projet natif, compilation, signature, installation. Pas de compte Expo pour l'instant : il arrivera au déploiement (EAS Hosting, Play Store).

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — Build local : `npx expo prebuild --platform android` puis `npx expo run:android`, signé avec le certificat de debug | Montre toute la chaîne : projet `android/` généré, Gradle, SDK Android, JDK, keystore, signature. Pas de compte. Pas d'attente de file. Recompilation rapide après le premier build | Outillage à installer et à configurer (Android Studio, SDK, JDK, `ANDROID_HOME`, `JAVA_HOME`). Premier build long. Sur Windows, la compilation C++ peut être sensible aux chemins longs ou avec espaces |
| B — EAS Build (cloud) | Rien à installer en local. Certificats gérés par EAS. Mêmes builds que pour la production | Demande un compte Expo. La compilation et la signature se passent hors de vue, donc on apprend moins la chaîne. Attente et limites selon l'offre |

## Décision
**Option A.** Elle sert directement l'objectif « apprendre toute la chaîne » et n'exige pas de compte. EAS sera adopté au déploiement (Phase 12).

## Conséquences
- `android/` est généré par `prebuild` et ignoré par git (Continuous Native Generation). On ne le modifie jamais à la main : tout réglage natif passe par `app.json` et les plugins.
- **Chaque certificat de signature** (debug maintenant, EAS ou clé Play Store plus tard) doit avoir son **SHA-1 enregistré chez Google** (client OAuth Android) et son **SHA-256 dans Clerk** (Native applications). Sinon, la connexion Google native échoue avec le build signé par ce certificat.
- Le certificat de debug est le keystore générique du modèle React Native, identique pour tous les projets et après chaque `prebuild`. Il convient au développement, jamais à une version publiée.
  - SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
  - SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
- Le poste de dev doit définir `ANDROID_HOME` et `JAVA_HOME`.
- **Point ouvert** : la Phase 1 (spike R2) prévoit un déploiement sur EAS Hosting, ce qui demande un compte Expo avant le déploiement final. À trancher : créer le compte plus tôt pour ce test, ou faire le spike d'abord en local (Inngest Dev Server).

## Commit
`a7a43c2` (`chore: android package and dev client (local builds)`) : `android.package`, `expo-dev-client`, `prebuild`, PLAN.md.
Preuve attendue : le premier `npx expo run:android` réussi, avec l'app ouverte dans le dev client et non dans Expo Go.
