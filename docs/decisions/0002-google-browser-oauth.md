# 0002 — Connexion Google par OAuth dans le navigateur (`useSSO`)

- **Date** : 2026-10-09
- **Statut** : acceptée

## Contexte
L'écran de connexion propose « Continuer avec Google » (PLAN.md, Phase 3). Le tutoriel que ce projet refait passe par une connexion OAuth dans le navigateur. Google est déjà activé sur l'instance Clerk de développement, avec les **identifiants partagés de Clerk**. Aucun projet Google Cloud n'existe encore.

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — OAuth dans le navigateur : `useSSO()` + `oauth_google` (`expo-auth-session`, `expo-web-browser`) | Ce que fait le tutoriel. Fonctionne dès maintenant avec les identifiants partagés de Clerk, sans Google Cloud Console | Passe par un onglet de navigateur et non par la feuille native de Google. La page Google affiche « Clerk » et non « Tripagent ». L'URL de retour doit être autorisée dans Clerk |
| B — Connexion Google native : `@clerk/expo-google-signin` (`useSignInWithGoogle`) | Feuille native Android (Credential Manager), sans navigateur | Demande tout de suite un projet Google Cloud (clients OAuth Web et Android, SHA-1 de chaque certificat), des identifiants personnalisés dans Clerk et des variables d'environnement. S'éloigne du tutoriel |

## Décision
**Option A**, comme le tutoriel. Elle fonctionne aujourd'hui sans configuration Google.

## Conséquences
- Dépendance ajoutée : `expo-auth-session`. Elle installe les modules natifs `expo-crypto` et `expo-application`, donc le dev client doit être recompilé (`npx expo run:android`).
- URL de retour : `tripagent://sso-callback`, construite avec `AuthSession.makeRedirectUri` sur le schéma existant `tripagent`. Ajoutée le 10/10/2026 à la liste « Allowlist for mobile SSO redirect » de l'instance de développement (Clerk > Native applications), par l'API Backend `POST /v1/redirect_urls`.
  - Constat : la connexion Google a fonctionné **sans** cette entrée le 09/10/2026 à 03:26 et le 10/10/2026 à 02:04 (heure de Paris), avec des sessions créées et visibles dans Clerk. Elle n'a donc pas été nécessaire en développement. Le commentaire du code de `useSSO` (@clerk/expo 4.10) dit seulement que l'URL doit être autorisée pour que Clerk ajoute le `rotating_token_nonce` au retour. L'exigence en production vient du [guide de déploiement Expo de Clerk](https://clerk.com/docs/guides/development/deployment/expo) : « For maximum security in your production instances, you need to allowlist your custom redirect URLs ».
- Pas de Google Cloud Console pour l'instant. Les SHA-1 et SHA-256 de l'ADR 0001 ne servent pas à cette option. Ils ne seront utiles que pour l'option B.
- **Pour plus tard seulement** : si l'app est publiée pour d'autres utilisateurs, ajouter notre propre client Google « Web » dans Clerk (identifiants personnalisés), pour que la page Google affiche « Tripagent » au lieu de « Clerk ».

## Commit
À compléter.
Validé sur l'émulateur : depuis le dev client, « Continuer avec Google » ouvre la page Google, et après le choix du compte, l'app arrive sur l'accueil connecté (sessions Clerk du 09/10/2026 à 03:26 et du 10/10/2026 à 02:04, heure de Paris). Annulation validée le 10/10/2026 à 02:22 : fermer l'onglet Google (croix ou bouton retour) ramène sur l'écran de connexion sans message, et le bouton est de nouveau actif.
