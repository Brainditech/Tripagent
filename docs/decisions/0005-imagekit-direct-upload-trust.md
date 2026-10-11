# 0005 — Upload direct vers ImageKit : ce que la signature garantit, ce que le serveur vérifie, ce qui est nettoyé

- **Date** : 2026-10-11
- **Statut** : acceptée

## Contexte
La couverture personnalisée (commits `c5a9143`, `41e755f`, `29dde14`, branche `feat/create-trip`) part du téléphone directement vers ImageKit : le serveur signe les paramètres (`POST /api/trips/[id]/cover`), l'app envoie le fichier à `upload.imagekit.io`, puis déclare le résultat (`PUT`). PLAN.md remettait à plus tard le remplacement et la suppression de l'ancien fichier.

La signature de l'API d'upload v1 d'ImageKit est un HMAC de `token + expire` seulement. Elle ne lie **ni le dossier, ni le nom, ni `useUniqueFileName`, ni la transformation**. Un client qui détient des paramètres signés (donc tout utilisateur connecté, pendant dix minutes) peut envoyer n'importe quel fichier dans n'importe quel dossier de la médiathèque du compte ImageKit, et le `PUT` ne vérifiait le chemin qu'après coup, sur la valeur **déclarée par l'app**. L'`fileId` déclaré n'était pas vérifié non plus. Trois constats de CodeRabbit (revue de sécurité de la PR) :

- l'autorité déléguée au client n'est pas bornée ;
- le `PUT` peut enregistrer un chemin et un `fileId` qui ne correspondent à aucun fichier de ce voyage (et, une fois la suppression implémentée, supprimer par ce `fileId` le fichier d'un autre) ;
- aucun cycle de vie : les photos remplacées, celles des voyages supprimés et celles des comptes supprimés restent chez ImageKit.

Objectif : qu'aucune valeur venue de l'app ne décide de ce qui est enregistré ou supprimé, et que la suppression d'un voyage ou d'un compte emporte ses photos, sans renoncer à l'upload direct (qui évite de faire transiter des photos de plusieurs Mo par les API Routes).

## Options comparées
| Option | Pour | Contre |
|--------|------|--------|
| A — Garder l'upload direct ; au `PUT`, relire le fichier chez ImageKit par son `fileId` avec la clé privée (`GET /v1/files/{id}/details`) et n'accepter qu'une image dont le `filePath` réel est dans le dossier du voyage ; supprimer l'ancien fichier au remplacement, le fichier à la suppression du voyage, le dossier de l'utilisateur à la suppression du compte | Rien de déclaré par l'app n'est cru : le chemin stocké et le `fileId` supprimé plus tard sont ceux qu'ImageKit connaît. Un appel API de plus au `PUT` seulement. Les suppressions sont des appels privés, idempotents (404 = déjà parti) | Un fichier envoyé hors du dossier du voyage, ou jamais déclaré, reste dans la médiathèque jusqu'à un nettoyage manuel ou périodique. Le client peut toujours stocker ce qu'il veut, dans la limite du compte ImageKit |
| B — Upload par le serveur : l'app envoie la photo à une API Route, qui l'envoie à ImageKit avec la clé privée et choisit dossier et nom | Autorité entièrement serveur : impossible d'écrire ailleurs | Chaque photo transite par EAS Hosting (taille de corps, temps de réponse, coût), ce que l'architecture voulait éviter. Changement du client et du serveur pour un risque qui reste borné au stockage du compte |
| C — Ne rien changer, documenter la limite | Aucun travail | Le `fileId` non vérifié deviendrait dangereux dès que la suppression existe ; les photos ne sont jamais effacées |

## Décision
**Option A.** Elle enlève toute confiance dans ce que l'app déclare, ajoute le cycle de vie manquant, et garde l'upload direct. La seule chose qu'un client malveillant garde est la capacité d'occuper de l'espace dans la médiathèque pendant la validité d'une signature ; c'est noté comme limite acceptée, à revoir si un abus apparaît (option B alors).

Règles appliquées (`src/server/imagekit/index.ts`, `src/app/api/trips/[id]/cover+api.ts`, `src/app/api/trips/[id]+api.ts`, `src/server/inngest/functions/user-deleted.ts`) :
- `PUT` : `customCoverSchema` n'exige plus que `fileId` ; `fileDetails(fileId)` relit le fichier ; refus en 400 si le fichier n'existe pas, n'est pas une image (`fileType !== "image"`) ou n'est pas directement dans `/tripagent/covers/{userId}/{tripId}/`. Le `filePath` enregistré est celui relu.
- Remplacement : l'enregistrement renvoie la couverture qu'il remplace, dans la même instruction (`update … returning old.cover_custom`, PostgreSQL 18, `src/server/trips/cover.ts`), et c'est ce `fileId` qui est supprimé (`tryDeleteFile`, échec journalisé, jamais fatal : la base est déjà juste). Deux `PUT` simultanés sur le même voyage suppriment ainsi chacun le fichier qu'ils ont réellement remplacé, jamais celui que le voyage garde ; un voyage supprimé entre la lecture et l'écriture répond 404. (Première version : suppression de la couverture lue avant l'écriture, corrigée après la deuxième revue CodeRabbit.)
- Suppression du voyage : la ligne d'abord, puis le fichier (même règle).
- Suppression du compte : step Inngest `delete-cover-folder` qui supprime `/tripagent/covers/{userId}` (404 = déjà absent, donc rejouable).

## Conséquences
- Un `PUT` coûte un appel à l'API ImageKit. Acceptable : une couverture par voyage, rarement changée.
- Fichiers non récupérés : upload réussi sans `PUT` (app fermée, réseau), ou envoyé hors du dossier attendu. À traiter plus tard par une purge périodique de `/tripagent/covers` sur les dossiers sans voyage correspondant ; noté dans PLAN.md.
- La couverture du voyage Bora Bora enregistrée avant le renommage du dossier (`/covers/…`) sera supprimée d'elle-même au prochain remplacement, par son `fileId`.
- Le client peut cesser d'envoyer `filePath` ; il reste toléré.
- `RETURNING old` exige PostgreSQL 18 : la branche Neon de développement est en 18.6, la production sera dans le même projet Neon.

## Commit
`1125e88` (`fix(covers): verify the uploaded file through ImageKit and delete superseded or orphaned files`, branche `feat/create-trip`).

Preuve, le 11/10/2026 (heure de Paris) :
- API ImageKit réelle, 22:25, script jetable avec la clé privée de `.env` : détails de la couverture du voyage Bora Bora 200 (`filePath`, `fileType` `image`, `size` 169 104) ; fichier inconnu 404 ; création puis suppression d'un dossier `/tripagent/_check` 201 puis 204 (chemin avec slash initial accepté) ; suppression répétée 404 `No folder found`.
- Serveur de test 8082, jeton de session réel, 22:29:26 : `PUT /api/trips/[id]/cover` avec un `fileId` inconnu → 400 `invalid_cover` ; avec le `fileId` réel de la couverture d'un autre voyage → 400 `invalid_cover`.
- Tests unitaires de `fileDetails`, `deleteFile`, `tryDeleteFile` et `deleteFolder` (en-tête Basic, 404 toléré, 500 refusé) et du schéma du `PUT`.

Non vérifiés en conditions réelles : la suppression du dossier à la suppression d'un compte (step Inngest, même appel que le test de dossier ci-dessus) et la suppression de l'ancien fichier au remplacement (même appel que `deleteFile`).

`89ce31f` (`fix(covers): delete the cover the swap statement displaced, not the one read before`) : la couverture supprimée est celle que l'instruction d'écriture renvoie, voir « Remplacement » ci-dessus.

Preuve, le 11/10/2026 (heure de Paris), script jetable sur la branche Neon de développement, voyage « bali » `f46c2742` (couverture `null`) : deux écritures concurrentes, A lente (`pg_sleep(2)` avant le verrou de ligne, lancée à 22:52:17.356) et B rapide (lancée 500 ms plus tard, terminée à 22:52:17.902 avec `previous = null`). A s'est terminée à 22:52:21.424 avec `previous = B`, et non la valeur `null` lue au départ ; la couverture finale est A. Un id de voyage inconnu renvoie 0 ligne (404 dans la route). Ligne remise à `null` ensuite. Test unitaire du rendu SQL (`src/server/trips/cover.test.ts`). `npm test` : 56 tests ; `tsc --noEmit` et `expo lint` passent.
