# 0008 — L'onglet Assistant est un chat de voyage généraliste : conversation envoyée à chaque requête, réponse structurée par un outil strict, photos Unsplash en cache côté serveur

- **Date** : 2026-10-12
- **Statut** : acceptée

## Contexte
PLAN.md prévoit deux écrans de conversation : l'onglet `(tabs)/assistant.tsx` et `trips/[id]/chat.tsx`. La note des onglets du 11/10/2026 disait que l'onglet Assistant « portera le chat d'ajustement (Phase 7) ». La maquette reçue le 12/10/2026, `design/assistant-ui-design.png`, montre autre chose : un compagnon de voyage généraliste (« où aller, quand partir, quoi emporter »), avec des cartes de destinations illustrées dans ses réponses et des suggestions de questions à toucher. Rien n'y concerne un voyage donné.

Le chat d'ajustement de la Phase 7 a besoin d'un voyage, de sa version courante, d'un job Inngest et des versions : c'est une autre fonctionnalité, qui n'a pas de sens sans voyage généré.

Objectif : donner à l'onglet Assistant le rôle de la maquette avec la plus petite surface serveur possible, dans les règles du projet (JWT Clerk sur chaque route, modèle Claude pris dans `config.aiModel`, Unsplash affiché en direct et crédité, aucune donnée personnelle dans les logs), sans gêner la Phase 7.

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — L'onglet Assistant = le chat d'ajustement (note du 11/10) | Aucune route de plus | Il faut choisir un voyage avant de parler ; onglet vide sans voyage ; rien de la maquette |
| B — L'onglet Assistant = le chat généraliste de la maquette ; le chat d'ajustement reste dans `trips/[id]/chat.tsx`, ouvert depuis le bouton assistant du détail (Phase 7) | Suit la maquette ; indépendant des voyages ; la Phase 7 garde son écran | Une route Claude de plus, un coût par message sans quota pour l'instant |
| C — Un seul écran qui mêle les deux, avec un sélecteur de voyage | Un seul chat | Complexe, absent de la maquette, mélange deux usages |

Sous-décisions, avec les options écartées :
- **État de la conversation** : sans état côté serveur (l'app envoie toute la conversation à chaque requête, bornée à 30 tours et 2 000 caractères par message, `src/lib/assistant-rules.ts`) plutôt qu'une table `conversations` (schéma, migration, reprise entre appareils). La conversation vit dans l'écran et disparaît quand l'app redémarre : accepté pour la v1.
- **Forme de la réponse** : outil `answer` forcé et `strict` (texte, destinations, suggestions), dérivé d'un schéma Zod par `toStrictJsonSchema` et revalidé par Zod, comme `save_itinerary` dans `src/server/ai/generate.ts`, plutôt que du texte libre à découper ou `output_config.format`. Le motif est déjà prouvé avec Haiku 4.5 dans ce projet. Les modèles de la génération 5 refusent `tool_choice` forcé : si `ANTHROPIC_MODEL` change de génération, passer à `output_config.format`.
- **Streaming vers l'app** : non. Un tour fait deux à cinq phrases, 5 à 15 s avec Haiku ; un indicateur d'écriture suffit. Le SDK streame côté serveur (`messages.stream().finalMessage()`) pour rester à l'abri des délais HTTP, comme la génération. **Remplacée par l'ADR 0010 (12/10/2026)** : le texte de la réponse est diffusé à l'app au fil de l'écriture.
- **Photos des cartes** : côté serveur, par `pickCover` (première photo paysage, `download_location` déclenché comme l'exigent les guidelines), dans un cache par processus indexé par la requête en minuscules (`cachedPhoto`, 200 entrées, les échecs ne sont pas gardés), avec repli sur le nom de la ville seul quand « ville, pays » en français ne trouve rien. L'app affiche la photo en direct (`urls.small`), crédite le photographe avec les liens UTM (`unsplashReferralUrl`), et montre une épingle sur fond bleu sans photo.
- **Erreurs** : refus de Claude → 422 `assistant_refused` ; limite de débit → 429 `assistant_busy` ; panne, coupure ou réponse inutilisable (tronquée, sans outil, invalide) → 503 `assistant_unavailable` ; requête rejetée (clé, modèle) → 500 par `authedRoute`, donc journalisée. L'écran explique chacune et propose « Réessayer ».
- **Logs (ADR 0006)** : une ligne `info` par réponse (`turns`, `destinations`, `suggestions`, `duration_ms`), jamais le texte des messages, qui est personnel ; les échecs d'appel sont déjà journalisés par le client API.
- **Écarts avec la maquette** : pas de bouton « + » ni de loupe, rien ne les motive encore ; le bouton « … » propose « Nouvelle conversation » ; la palette garde le bleu de l'app (`#4C97F7`) et les proportions de la maquette sont suivies sans mesure, son téléphone étant plus large que l'émulateur.

## Décision
**Option B** avec les sous-décisions ci-dessus. L'onglet Assistant est le compagnon de voyage de la maquette ; `POST /api/assistant` (`src/app/api/assistant+api.ts`, `src/server/ai/assistant.ts`) reçoit la conversation et répond `{ message, destinations[], suggestions[] }` dans la langue de `users.locale` ; le chat d'ajustement reste en Phase 7, dans `trips/[id]/chat.tsx`.

## Conséquences
- La Phase 7 ne change pas : `api/trips/[id]/adjust`, la fonction `trip/adjust`, `trips/[id]/chat.tsx` ouvert par le bouton assistant du détail. Les composants de `src/components/assistant-ui.tsx` (bulles, indicateur, champ) y resserviront. La note des onglets de PLAN.md est corrigée.
- Pas de quota sur l'assistant : chaque message est un appel Haiku (environ 1 200 tokens en entrée, 300 en sortie, de l'ordre de 0,3 centime). À ajouter (`QUOTA_ASSISTANT_MESSAGES_PER_DAY`, même mécanique que le quota mensuel) si l'usage ou la facture le demandent, au plus tard au déploiement.
- Le quota démo d'Unsplash (50 requêtes/h) absorbe jusqu'à 4 recherches par réponse à cartes (8 avec le repli), moins le cache ; une photo introuvable donne une carte sans photo, pas une erreur.
- La conversation est perdue au redémarrage de l'app et quand l'onglet est remonté (lien profond) : une table `conversations` ou un stockage local plus tard, si on la veut durable.
- Clavier : `softwareKeyboardLayoutMode` reste à sa valeur par défaut (`resize`), sans `KeyboardAvoidingView` ; à confirmer sur un appareil, l'émulateur de développement ayant un clavier matériel.
- i18n : les textes de l'écran attendent la Phase 6 dans `TEXTS` ; le serveur répond dans la langue de `users.locale`, « fr » par défaut tant que l'app ne remonte pas la langue de l'appareil.

## Commit
`32e58c3` (`feat(assistant): travel companion chat on the Assistant tab`, branche `feat/assistant`, empilée sur `feat/sentry-tracing`).

Preuve, le 12/10/2026 (heure de Paris), émulateur Android (API 36, clavier matériel), serveur de dev 8081 de l'utilisateur, app rechargée par le lien profond du dev client :
- `POST /api/assistant` sans jeton → 401 dès que la route existe (curl à 01:33), avant toute validation du corps.
- 01:33:53 : onglet ouvert par `tripagent://assistant` : en-tête (mascotte, titre, sous-titre, « … »), message d'accueil, trois suggestions de départ, champ et bouton d'envoi inactif.
- 01:34:08 : touche sur « Où partir en avril ? » → bulle bleue avec l'heure et la coche, indicateur d'écriture ; 01:34:21 : réponse en français avec quatre destinations (Lisbonne, Kyoto, Chiang Mai, Marrakech) en cartes défilantes, photos Unsplash chargées 1,4 à 1,5 s après la réponse (Glide dans logcat ; Chiang Mai sans photo, d'où le repli sur le nom de la ville ajouté ensuite), crédits « Photo : Aayush Gupta · Unsplash », trois suggestions de suite.
- 01:35:11 : « Que mettre dans ma valise pour Tokyo ? » saisi dans le champ et envoyé par la touche Entrée (`returnKeyType="send"`) ; 01:35:25 : réponse sans carte, suggestions renouvelées (« Faut-il un visa pour Tokyo ? », « Quel budget pour Tokyo ? »), liste défilée en bas, champ vidé.
- `npm test` : 76 tests dans 14 fichiers, dont 11 pour le schéma de la requête, `answerTraveller` (réponse valide, en-têtes envoyés, listes coupées, validation, coupure, refus, erreurs SDK) et `assistantHttpError`, 2 pour `cachedPhoto`, 2 pour `toHistory` ; `tsc --noEmit` et `expo lint` passent.
- Non vérifié : le clavier logiciel (Gboard n'affiche qu'une barre flottante avec le clavier matériel de l'émulateur, même avec `show_ime_with_hard_keyboard`), les réponses 422, 429 et 503 en conditions réelles (couvertes par les tests unitaires), la réception des logs dans Sentry (jeton limité, voir ADR 0006).

Revue CodeRabbit de la PR, corrigée le 12/10/2026 en trois commits, chacun vérifié contre le code avant d'être retenu :
- `4f27e66` : « Nouvelle conversation » appelait `reset()` sur la mutation, qui détache l'écran d'une requête en cours mais ne l'arrête pas et n'empêche pas le `onSuccess` des options de s'exécuter (TanStack Query l'appelle sur la mutation elle-même, `mutation.js`, `this.options.onSuccess`) : une réponse à une question posée avant l'effacement atterrissait dans la conversation neuve, sous l'accueil, sans sa question. Chaque requête porte désormais la génération de la conversation (`useRef`), l'effacement l'incrémente, et une réponse d'une génération passée est ignorée.
- `084c330` : `pickCover` lisait `UNSPLASH_ACCESS_KEY` avant son `try` ; sans clé, la promesse rejetait au lieu de rendre `null`, chaque réponse à cartes finissait en 500 et `cachedPhoto` gardait la promesse rejetée, alors qu'une mauvaise clé donnait déjà « pas de photo » avec un avertissement. La lecture passe dans le `try` : une clé absente est une panne Unsplash comme une autre, pour les cartes de l'assistant comme pour la couverture d'un voyage. Test ajouté.
- `178d108` : rien ne tenait la réponse de Claude dans les bornes d'un tour (`turnSchema`, 2 000 caractères non vides) alors que l'app la renvoie comme tour assistant : une réponse longue ou vide aurait fait échouer en 400 toutes les requêtes suivantes, sans autre issue que « Nouvelle conversation ». `fitMessage` coupe la réponse après la dernière phrase qui tient (ou au milieu avec des points de suspension), et une réponse vide devient une `AssistantAnswerError` (503, « Réessayer »). Tests ajoutés, dont l'aller-retour par le schéma de la requête.

`npm test` : 82 tests ; `tsc --noEmit` et `expo lint` passent ; l'onglet rechargé sur l'émulateur répond toujours (« Où partir en avril ? » à 10:28:39, réponse à cartes à 10:28:53, heure de Paris).
