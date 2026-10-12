# 0013 — Onglet Profil : identité lue dans Clerk, chiffres calculés depuis la liste des voyages, quota à la place des paiements, lignes de la maquette gardées en attente

- **Date** : 2026-10-12
- **Statut** : acceptée

## Contexte
L'onglet Profil était un écran d'attente (adresse e-mail et bouton de déconnexion). Les maquettes `design/profile-ui-design-1-top.png` et `design/profile-ui-design-2-scrolled.png` (l'app du tutoriel) montrent une carte d'identité (avatar, nom, e-mail), trois chiffres (« Trips », « Countries », « Days away »), trois groupes de lignes (« Account » : Travel preferences, Notifications, Payment methods ; « Preferences » : Settings, Appearance, Language ; « Support » : Help & support, Privacy policy, Terms of service, Rate, Invite friends), un bouton « Log out », un bouton rouge « Delete account » et la version. Le plan prévoit en Phase 9 un écran Réglages (langue en lecture seule, liens légaux, déconnexion, suppression du compte avec double confirmation et route `api/account`), et l'ADR 0012 note que le quota restant « reste à placer ». Tripagent n'a ni paiements, ni notifications, ni pays stocké : la destination est un texte libre et le contenu généré n'a pas de champ pays.

## Options comparées
Source de l'identité :

| Option | Pour | Contre |
|--------|------|--------|
| A — Clerk dans l'app (`useUser` : `fullName`, e-mail principale, `imageUrl`, `hasImage`) | Aucune requête ; la photo Google est là ; un nom changé dans Clerk se voit sans attendre le webhook | Deux sources sur l'écran, avec `/api/me` pour le quota |
| B — `/api/me` seul | Une source | Pas de photo ; nom tel que le webhook l'a écrit |

Chiffres de la carte :

| Option | Pour | Contre |
|--------|------|--------|
| A — Calculés dans l'app depuis la liste `["trips"]` partagée avec l'accueil et l'onglet Voyages | Rien côté serveur, le cache est déjà là, même compte que « Mes voyages (n) » | « Pays » impossible : destinations distinctes à la place |
| B — Nouvelle route, ou champs dans `/api/me` (compte, distinct, somme en SQL) | Juste même sans la liste | Une requête de plus, et « pays » impossible aussi |
| C — Demander un champ `country` à Claude pour compter les pays | Le chiffre de la maquette | Change le schéma du contenu et le prompt ; rien pour les voyages déjà générés |

Lignes sans fonctionnalité derrière elles :

| Option | Pour | Contre |
|--------|------|--------|
| A — Garder toutes les lignes de la maquette, inactives (sans action, sans ondulation, `disabled`) | Fidèle à la maquette ; la place de la Phase 9 est prise | Des chevrons qui ne mènent nulle part pour l'instant |
| B — Ne montrer que les lignes qui font quelque chose | Rien de trompeur | Quatre lignes, loin de la maquette |

« Payment methods » :

| Option | Pour | Contre |
|--------|------|--------|
| A — « Moyens de paiement », inactif | Fidèle | Aucun paiement n'est prévu |
| B — « Quota mensuel », valeur lue dans `/api/me` | Place le quota restant (ADR 0012), chiffre vrai | S'écarte d'un libellé de la maquette |

## Décision
Identité **A**, chiffres **A**, lignes **A**, paiements **B**, avec ces sous-décisions :
- **Photo** : `user.imageUrl` seulement quand `hasImage` (une vraie photo, copiée de Google), sinon l'initiale (du nom, sinon de l'e-mail) sur un disque bleu ; nom absent (compte créé par code e-mail) → « Voyageur ». Helpers purs dans `src/lib/profile.ts` (`profileIdentity`, `tripStats`, `localeLabel`), testés.
- **Chiffres** : tous les voyages de la liste (comme l'accueil), destinations distinctes après normalisation (espaces, casse), somme des jours ; un tiret tant que la liste n'est pas chargée (un zéro dirait « aucun voyage »).
- **Langue** : celle de l'appareil, lue par `Intl.DateTimeFormat().resolvedOptions().locale` (Hermes), nommée dans sa langue pour sept langues et montrée telle quelle sinon. Écarté : `expo-localization` (module natif, donc un dev build à refaire ; il viendra avec i18n en Phase 6) et `users.locale` (toujours `fr`, le webhook Clerk n'envoie rien).
- **Actions** : Réglages → `Linking.openSettings()` (la page Android de l'app) ; Inviter des amis → `Share.share` (message sans lien tant que l'app n'est pas publiée) ; Se déconnecter → `signOut()`, échec journalisé ; Supprimer le compte → boîte native « arrive dans une prochaine version » (la suppression réelle, double confirmation et `api/account`, reste en Phase 9). Les sept autres lignes sont inactives.
- **Fraîcheur** : la liste et `/api/me` (`meQueryOptions`, clé `["me"]`, `src/lib/me.ts`) sont relues au retour sur l'onglet (`useRefreshOnFocus`) ; `["me"]` n'est pas invalidée à la création d'un voyage, le retour sur l'onglet suffit.
- **Version** : `Constants.expoConfig.version` (`app.json`).

## Conséquences
- L'écran Réglages de la Phase 9 est l'onglet Profil : y restent à brancher les liens légaux (lignes « Politique de confidentialité » et « Conditions d'utilisation »), la suppression du compte (ligne en place) et `api/account`.
- Sept lignes inactives à brancher ou à retirer plus tard : Préférences de voyage, Notifications, Apparence (mode sombre), Aide et support, Politique de confidentialité, Conditions d'utilisation, Noter Tripagent (fiche Play Store).
- Douze icônes de plus dans `src/components/icons.tsx` (SVG, comme les autres ; `BellIcon` prend `dot={false}`), les briques de l'écran dans `src/components/profile-ui.tsx`.
- Restent : i18n (textes groupés dans `TEXTS`) ; le mode sombre ; un compte sans vraie photo n'a pas été vu à l'écran (le compte de test a une photo Google), couvert par le test de `profileIdentity`.

## Commit
`d6845ca` (`feat(profile): profile tab after the mockup`, branche `feat/profile`).

Preuve, le 12/10/2026 de 19:38 à 19:41 (heure de Paris), serveur de dev 8081 de l'utilisateur, émulateur Android (API 36, langue en-US), compte de test Google avec 9 voyages :
- Onglet Profil : « Profil », carte d'identité avec la photo du compte Google (son avatar par défaut, un « l » sur fond rose, `hasImage` vrai), le nom et l'e-mail ; chiffres « 9 Voyages », « 7 Destinations », « 33 Jours » ; « Quota mensuel : 990 restants sur 1000 » (quota de développement) ; « Langue : English » (langue de l'émulateur) ; les trois groupes, « Se déconnecter », « Supprimer le compte » en rouge sur fond rosé, « Tripagent v1.0.0 ».
- « Inviter des amis » : la feuille de partage Android s'ouvre avec le message (« Je prépare mes voyages avec Tripagent… », Quick Share, Chrome, Drive, Messages).
- « Réglages » : l'activité `com.android.settings` passe au premier plan (`dumpsys window`) ; sa page se capture vide sur cet émulateur.
- « Supprimer le compte » : boîte native « Supprimer le compte — La suppression du compte arrive dans une prochaine version. », bouton OK.
- « Se déconnecter » non touché pendant la preuve (même appel `signOut()` que l'écran précédent, vérifié le 10/10/2026), pour garder la session de test.
- `npm test` : 122 tests dans 18 fichiers, dont `tripStats`, `profileIdentity` et `localeLabel` ; `tsc --noEmit` et `expo lint` passent.
