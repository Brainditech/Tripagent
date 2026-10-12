# 0012 — Liste des voyages : une requête partagée par l'accueil et l'onglet Voyages, titre et coût lus en SQL dans la version courante

- **Date** : 2026-10-12
- **Statut** : acceptée

## Contexte
L'accueil montrait trois voyages en dur depuis la maquette (`feat/create-trip`, 11/10/2026) et l'onglet Voyages un écran d'attente. Le plan demande « Mes voyages » sur l'accueil (couverture, statut, badge « en cours », état vide, pull-to-refresh, suppression avec confirmation) et la liste complète sur l'onglet Voyages. `GET /api/trips` existait (champs du formulaire, statut, couvertures, `days`), mais sans le titre généré ni le coût estimé que la carte de la maquette met en avant (« 5 jours à Istanbul », « Coût estimé : 525 € / p.p. ») : ces deux valeurs sont dans le contenu JSON de la version courante (`trip_versions.content`, plusieurs Ko par voyage).

## Options comparées
Titre et coût de la carte :

| Option | Pour | Contre |
|--------|------|--------|
| A — Renvoyer le contenu entier de la version courante dans la liste | Rien à écrire côté SQL | Plusieurs Ko par voyage pour deux champs ; la liste grossit avec chaque voyage |
| B — Les lire en SQL (`content ->> 'title'`, `content ->> 'currency'`, `content #>> '{budget,perPerson,total}'`) par un `left join` sur `current_version_id` | Deux chaînes et un nombre par ligne ; nuls tant que la génération n'a pas produit de version, ce qui dit l'état de la carte | Une jointure de plus |
| C — Ne pas les montrer (destination et durée seulement) | Rien à changer côté serveur | La carte perd ce que la maquette montre |

Sous-décisions, avec les options écartées :
- **Une seule requête pour les deux écrans** (`tripsQueryOptions`, clé `["trips"]`, `src/lib/trips.ts`) plutôt qu'une par écran : le cache sert l'autre onglet aussitôt, une suppression retire la carte des deux. L'accueil n'en montre que les trois derniers, avec le compte total et « Voir tout » vers l'onglet Voyages (la maquette en montre trois ; une longue liste repousserait les inspirations hors de l'écran) ; l'onglet Voyages les montre tous (`FlatList`).
- **Fraîcheur** : les onglets restent montés, donc `useQuery` seul ne relit rien. La liste est relue au retour sur l'écran (`useFocusEffect` dans le hook `useRefreshOnFocus`, première mise au point sautée puisque `useQuery` charge déjà), en tirant la liste (`RefreshControl`), toutes les 5 s tant qu'un voyage de la liste est `queued` ou `generating` (le badge et la couverture finissent justes même si l'écran de progression a été quitté), et par invalidation après les mutations : création (`new-trip`), fin de génération vue par l'écran de progression, changement de couverture et suppression (détail). Écartés : `refetchOnWindowFocus` (React Native n'a pas de gestionnaire de focus sans l'ajouter) et un polling permanent.
- **Suppression depuis les listes** : appui long sur la carte, boîte native (`Alert.alert`), puis `DELETE`, dans un hook partagé avec le détail (`useTripDeletion`, `src/hooks/`) : mêmes textes, mêmes caches vidés, et la carte quitte la liste en cache sans attendre une relecture. Écarté : un bouton corbeille sur chaque carte (la maquette n'en a pas, la carte est déjà dense). Le geste est indiqué sous la liste de l'onglet Voyages.
- **Carte** (`TripCard`, `src/components/home-ui.tsx`) : la photo est positionnée en absolu dans un cadre étiré à la hauteur du texte, parce qu'un `height: 100%` dans un enfant étiré n'est pas résolu par Yoga (la première version étirait la photo sur toute la hauteur de l'écran) ; photo Unsplash en taille `regular`, celle que charge le détail, pour partager le cache ; couverture personnalisée par `customCoverUrl` pour 180 dp ; cadre à icône sans photo (génération en cours, rien sur Unsplash) ou quand la photo ne charge plus (`onError`) ; coût sur deux lignes au besoin (« 613 000 ₩ / p.p. ») ; badge « En cours » ou « Échec » sur la photo ; la touche ouvre la progression tant que la génération court, le détail sinon (il explique un échec).

## Décision
**Option B** pour le titre et le coût, avec les sous-décisions ci-dessus : `GET /api/trips` renvoie `title` et `estimatedCost: { perPerson, currency }` (nuls sans version), et les deux écrans lisent la même requête.

## Conséquences
- Le contenu d'un voyage ne transite jamais par la liste ; `GET /api/trips` coûte une jointure.
- `src/hooks/` existe (prévu par le plan) : `useRefreshOnFocus`, `useTripDeletion`. Le détail utilise le même hook de suppression que les listes.
- Le quota restant, que le plan place sur l'accueil, reste à placer : la maquette ne le montre plus.
- Pendant qu'une génération court, l'écran de progression (2,5 s) et la liste (5 s) interrogent tous deux le serveur ; accepté, une génération dure une minute environ.
- Restent : i18n ; le badge « En cours » et l'état vide n'ont pas été vus en conditions réelles (aucune génération en cours ni compte vide sous la main : couverts par le code et par les tests des helpers, pas par une capture).

## Commit
`270b245` (`feat(trips): list the user's trips on the home and the Voyages tab`, branche `feat/trips-list`, empilée sur `feat/sentry-server`).

Preuve, le 12/10/2026 de 16:28 à 16:36 (heure de Paris), serveur de dev 8081 de l'utilisateur (la route est réévaluée à chaque requête), émulateur Android (API 36), compte de test avec 9 voyages :
- Onglet Voyages : « Mes voyages », « 9 voyages », neuf cartes avec photo, titre généré (« 3 jours en Corée du Sud », « 7 jours de luxe à Dubaï »…), destination telle que saisie, durée, coût estimé dans la devise du contenu (₩, €, FCFP, IDR, MGA, AED, JPY), les montants longs sur deux lignes, indication de l'appui long sous la liste.
- Accueil : « Mes voyages (9) », « Voir tout » (ouvre l'onglet Voyages), les trois derniers voyages, puis les inspirations.
- Appui long sur une carte : boîte « Supprimer ce voyage ? », Annuler / Supprimer ; annulée, rien n'est supprimé.
- Touche sur la carte Kyoto : le détail s'ouvre avec sa couverture, son crédit et ses boutons caméra et corbeille (ce dernier passe désormais par `useTripDeletion`) ; lien profond `tripagent://trips/<id>` (Dubaï) : le détail s'ouvre (capturé pendant son chargement). Tirer la liste vers le bas : l'indicateur de rafraîchissement apparaît.
- Première version : la photo s'étirait sur toute la hauteur de l'écran, corrigée par le positionnement absolu. La photo de Dubaï a mis une minute à apparaître la première fois sur l'émulateur (chargement seulement : l'URL répond 200, 157 Ko), d'où le repli `onError` pour une photo qui ne chargerait plus.
- `npm test` : 116 tests dans 17 fichiers, dont `isGenerating`, `tripHref` (progression ou détail) et `tripCoverUri` (couverture perso, Unsplash, aucune) ; `tsc --noEmit` et `expo lint` passent.
