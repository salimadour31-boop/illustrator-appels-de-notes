# Appels de notes — renvois ¹ ² ³, (1), * et † contrôlés et renumérotés dans Illustrator

**AppelsDeNotes.jsx** relie chaque **appel de note** d'une affiche, d'un flyer, d'un emballage ou d'un catalogue (« 999 DA¹ », « Livraison offerte* », « Prix TTC(2) ») à sa **mention** (« ¹ Offre valable jusqu'au 30/11. »). Il signale ce qui ne va pas et le corrige en un clic, plan de travail par plan de travail.

> ⚠️ **Non testé dans Illustrator.** Le code a été vérifié (syntaxe ES3/ES5) et testé sous Node.js sur des données, sur un DOM Illustrator simulé et sur des fenêtres ScriptUI simulées (voir « Tests »). Travaillez sur une copie de votre fichier.

## Le problème

Illustrator n'a **pas de notes de bas de page**. Les renvois et les mentions légales sont tapés à la main, souvent dans des blocs séparés. Sur une promo, un dépliant ou un emballage bilingue, il arrive souvent :

- qu'un appel n'ait pas de mention, ou qu'une mention ne soit plus appelée nulle part après une modification ;
- que deux mentions portent le même numéro ;
- qu'on ajoute un renvoi au milieu et que la numérotation ne suive plus l'ordre de lecture (³ avant ¹) ;
- que les mentions ne soient plus dans l'ordre ;
- qu'il reste une espace avant l'appel (« 999 DA * ») ou que l'appel soit après le point alors qu'en français il se place avant (« offerte¹. »).

Les règles publicitaires (par exemple l'ASA au Royaume-Uni) exigent qu'un astérisque soit clairement relié à sa mention. Dans InDesign, les notes se numérotent toutes seules. Dans Illustrator, tout se vérifie à l'œil, au moment du BAT.

## Pourquoi c'est nouveau (ce qui a été vérifié le 17/10/2026)

- **Adobe Community** : « footnotes solution? » ne parle que d'InDesign. « Script that auto-renumbers text? » (CarlosCanto) renumérote des blocs dans l'ordre des calques, sans appel, sans mention et sans ordre de lecture. Les réponses sur les astérisques expliquent seulement comment désactiver les puces automatiques.
- **Grands auteurs** : creold a `MakeNumbersSequence` et `NumeratesPoints`, qui numérotent des objets ou des points mais ne relient aucun renvoi à une mention. Rien de comparable chez Alexander Ladygin, Josh Duncan ou wckdtall.
- **GitHub** : 0 dépôt pour « illustrator footnote », « illustrator footnotes script », « illustrator asterisk disclaimer », « illustrator renumber footnotes » et « jsx footnote illustrator ». Les scripts de notes trouvés sont tous pour InDesign (Peter Kahrel, grefel…).
- **Outils de contrôle d'emballage** (Esko Preflight, ManageArtworks, Artwork Flow) : à notre connaissance, ils vérifient la présence des textes ou des mentions obligatoires, pas qu'à chaque appel corresponde une mention dans l'ordre.
- **Idée écartée cette fois-ci** parce qu'elle existe presque : un contrôle des kashidas (tatweel) tapées à la main. Kashida Pro (aescripts) les pose et les retire, Kashida Plus (outil web gratuit) ne les place qu'aux jonctions permises, et des outils en ligne les suppriment.

## Ce que fait le script

**Il reconnaît :**

- les chiffres en exposant Unicode (¹ ² ³ … ¹²) et les chiffres **mis en exposant** par la mise en forme (Exposant, position OpenType, ou décalage vers le haut), y compris les chiffres arabes-indiens ١ ٢ ٣ ;
- les numéros entre parenthèses collés au mot, comme « Prix TTC(1) » ;
- les symboles `*`, `**`, `***`, `†`, `‡`, `§`, `‖` et `¶`.

**Il distingue :**

- une **mention**, en début de paragraphe (« ¹ Offre… », « (1) Hors livraison », « *Sans frais ») ou en ligne après une fin de phrase (« *Offre valable. **Dans la limite des stocks. ») ;
- un **appel**, collé au mot qui le précède.

**Il n'est pas trompé par :**

- m², cm³, م², x², E=mc², 10³ ou 10⁻³ (la liste des unités se modifie) ;
- 2*3, f*ck ou § 12 ;
- les listes « 1. 2. 3. », qui ne comptent que si un appel ¹ existe vraiment ;
- les appels détachés « (1) », qui ne comptent que si une mention (1) existe.

**Il signale :**

- ✖ un appel sans mention ;
- ✖ une mention en double ;
- ⚠ une mention sans appel ;
- ⚠ une numérotation hors de l'ordre de lecture, avec le plan proposé (« ³ → ¹, ¹ → ² ») ;
- ⚠ des mentions qui ne sont pas dans l'ordre ;
- ⚠ une espace avant l'appel ;
- ⚠ un appel du mauvais côté de la ponctuation, selon la règle française (avant `. , ; : ! ?`) ou anglaise (après `. , ; :`). Le point d'abréviation est gardé (« etc.¹ ») et les paragraphes arabes ne sont pas touchés.

**L'ordre de lecture** va de haut en bas et de gauche à droite. Il va de droite à gauche quand le plan de travail est surtout en arabe, ou si vous le choisissez. Les blocs sur une même ligne sont lus côte à côte. Dans un bloc, c'est l'ordre du texte.

**Les corrections (cochables) :**

1. **Renuméroter** dans l'ordre de lecture. Les appels et leurs mentions changent ensemble, et un appel répété garde le même numéro. Les symboles suivent `* ** ***`, ou `* † ‡ § ‖ ¶` si le document utilise des dagues. Seuls les chiffres sont remplacés, si bien que l'exposant, la police et la couleur restent.
2. **Remettre les mentions dans l'ordre** : les paragraphes de mentions d'un même bloc sont recopiés avec toute leur mise en forme. Le script vérifie d'abord sur un bloc temporaire que la copie de paragraphes se comporte comme prévu, puis vérifie le texte après chaque copie. Sinon, il ne touche à rien.
3. **Supprimer l'espace** avant l'appel.
4. **Placer l'appel** selon la règle de ponctuation choisie.
5. **Créer les mentions manquantes** « Mention à compléter » (ou « نص الملاحظة للإكمال » en arabe), dans le bloc de mentions existant ou dans un nouveau bloc magenta en bas du plan de travail.
6. **Repères de contrôle** : des cadres rouges numérotés comme le rapport, sur un calque **non imprimable** « AppelsDeNotes – contrôle », remplacé à chaque relance.

Le rapport liste chaque problème avec un extrait du texte. Cliquez sur une ligne pour sélectionner le bloc concerné. Le bouton « Repères seulement » ne modifie aucun texte.

## Installation

- **Ponctuelle** : *Fichier > Scripts > Autre script…* (Ctrl/Cmd + F12), puis choisissez `AppelsDeNotes.jsx`.
- **Permanente** : copiez `AppelsDeNotes.jsx` dans le dossier des scripts d'Illustrator, puis relancez Illustrator. Le script apparaît dans *Fichier > Scripts*.
  - Windows : `C:\Program Files\Adobe\Adobe Illustrator <version>\Presets\fr_FR\Scripts\`
  - macOS : `/Applications/Adobe Illustrator <version>/Presets/fr_FR/Scripts/`

## Utilisation

1. Ouvrez le document (une copie, de préférence). Si besoin, sélectionnez des blocs de texte.
2. Lancez le script et choisissez :
   - la portée : la sélection, le plan de travail actif ou tous les plans ;
   - où chercher les mentions : sur le même plan de travail (par défaut) ou dans tout le document ;
   - le sens de lecture, les types de marques et la règle de ponctuation.
3. Cliquez sur **Analyser**. Lisez le rapport, cochez les corrections voulues, puis cliquez sur **Corriger**, sur **Repères seulement** ou sur **Fermer**.
4. Ctrl/Cmd + Z annule les corrections. Les blocs verrouillés ne sont jamais modifiés, et les calques masqués sont ignorés.

Les réglages sont gardés d'une fois sur l'autre, dans `AppelsDeNotes_settings.txt` dans le dossier de préférences de l'utilisateur. Le script ne fait aucun appel réseau et ne collecte aucune donnée.

## Version ciblée et limites

- **Cible** : Illustrator CC 2018 à 2026 (ExtendScript ES3), sous Windows et macOS. Interface en français, ou en anglais si Illustrator est en anglais.
- **Statut** : **non testé dans Illustrator.**
- **Limites** :
  - le texte curviligne est lu, mais pas le texte des symboles, des enveloppes ni des graphes ;
  - les mentions placées dans des blocs séparés (une mention par bloc) ne sont pas déplacées : leur ordre est seulement signalé ;
  - les mentions en ligne (plusieurs dans un même paragraphe) sont renumérotées mais pas réordonnées ;
  - un bloc qui contient des emoji ou d'autres caractères hors du plan de base Unicode n'est pas modifié, car les positions des caractères pourraient ne pas correspondre.

## Tests

Les tests se lancent avec `node tests/test-core.js`, `node tests/test-mock.js` et `node tests/test-ui.js`. Tous ces tests tournent sous Node.js, aucun dans Illustrator.

- **Syntaxe** : `acorn --ecma3` et `acorn --ecma5` passent sans erreur.
- **Moteur pur (48 vérifications)** :
  - reconnaissance de chaque type de marque ;
  - unités et exposants mathématiques écartés, listes numérotées, appels groupés « ¹,² » ;
  - texte arabe ;
  - diagnostics, renumérotation, réordonnancement ;
  - règles de ponctuation française et anglaise ;
  - 10 appels inversés (changement de longueur ¹⁰ → ¹) ;
  - ordre de lecture gauche → droite et droite → gauche, séquences de symboles, mentions manquantes, réglages ;
  - 400 documents aléatoires (exposants, parenthèses ou astérisques mélangés) : chaque appel renvoie toujours à la mention de son mot, et la numérotation finale suit l'ordre de lecture.
- **DOM Illustrator simulé (24 vérifications)** :
  - affiche avec chiffres mis en exposant (la mise en forme est conservée) ;
  - mentions dans un autre bloc ;
  - ponctuation et espace corrigées, mention manquante créée sur le bon plan de travail ;
  - repères seulement, sans aucun texte modifié, et un seul calque de repères après relance ;
  - copie de paragraphes au comportement inattendu : le réordonnancement est refusé proprement ;
  - bloc verrouillé, calque masqué, arabe lu de droite à gauche ;
  - messages sans appel et sans document ;
  - 150 documents aléatoires à plusieurs blocs.
- **Fenêtres ScriptUI simulées (7 vérifications)** : de `main()` jusqu'au message de fin.
- **Mutations volontaires** : 11 sur 12 sont détectées par les tests. La douzième retire une vérification intermédiaire qui est doublée par la vérification finale.

## Licence

MIT © 2026 Amirouche Amwanes. Code 100 % original.
