# NovaLauncher

Un launcher personnel pour regrouper tes jeux Windows, tes plateformes (Steam, Epic Games), tes émulateurs et tes applications classiques (LibreOffice, etc.) dans une seule interface sombre façon "Big Picture".

## Fonctionnalités

- Ajout manuel de n'importe quel exécutable (`.exe`, `.bat`, `.lnk`) ou lien de lancement (`steam://...`, `com.epicgames.launcher://...`)
- Catégories : Steam, Epic Games, Émulateurs, Applications, Autres
- Favoris, recherche instantanée, bannière "hero" avec la jaquette du jeu survolé
- Glisser-déposer d'un `.exe` directement sur la fenêtre pour l'ajouter
- Jaquettes personnalisées (image) ou tuile générée automatiquement si tu n'en mets pas
- Menu clic-droit : lancer, favoris, modifier, ouvrir le dossier, supprimer
- Réduction automatique de la fenêtre au lancement d'un jeu (désactivable dans les paramètres)
- Couleur d'accent personnalisable
- **Émulation (RetroArch)** : configure le chemin de RetroArch, NovaLauncher détecte automatiquement tes cœurs installés, et scanne tes dossiers de ROMs par console pour ajouter tous tes jeux émulés d'un coup (voir section dédiée plus bas)
- **Recherche automatique de jaquettes** : un bouton "🖼️ Chercher les jaquettes manquantes" télécharge automatiquement les jaquettes de tes jeux Steam et de tes jeux émulés reconnus (voir section dédiée plus bas)
- Toutes les données restent en local sur ta machine (fichier JSON + dossier d'images dans ton dossier utilisateur), rien n'est envoyé en ligne (sauf la recherche de jaquettes, qui interroge deux sources publiques précises — détail ci-dessous)

## Installation (pour tester / développer)

Prérequis : [Node.js](https://nodejs.org/) (version LTS, 18 ou plus récent) installé sur ton PC Windows.

1. Décompresse ce dossier où tu veux (ex: `C:\Projets\NovaLauncher`)
2. Ouvre un terminal (PowerShell) dans ce dossier
3. Installe les dépendances :

   ```powershell
   npm install
   ```

4. Lance l'application en mode développement :

   ```powershell
   npm start
   ```

## Générer un vrai `.exe` installable

Une fois que tu es content du résultat, tu peux générer un installeur Windows (NSIS) et une version portable :

```powershell
npm run dist
```

Le résultat apparaît dans le dossier `dist/` :
- `NovaLauncher Setup x.x.x.exe` → installeur classique (raccourci bureau + menu démarrer)
- `NovaLauncher x.x.x.exe` (portable) → un seul fichier exécutable, sans installation

## Où sont stockées tes données

NovaLauncher stocke ta bibliothèque dans ton dossier utilisateur Windows :

```
%APPDATA%\novalauncher\games.json
%APPDATA%\novalauncher\covers\   (tes images de jaquette copiées)
```

Tu peux sauvegarder ce dossier pour ne pas perdre ta bibliothèque, ou le copier sur un autre PC.

## Configurer l'émulation (RetroArch)

NovaLauncher ne fournit ni émulateur ni cœur : tu installes toi-même [RetroArch](https://www.retroarch.com/) et tu télécharges les cœurs qui t'intéressent depuis son propre menu (Menu principal → Cœurs → Télécharger un cœur). Une fois ça fait :

1. Ouvre **🕹️ Émulation (RetroArch)** dans la sidebar de NovaLauncher.
2. Indique le chemin de `retroarch.exe` (bouton "Parcourir"). NovaLauncher va automatiquement lister les cœurs trouvés dans son dossier `cores`.
3. Clique sur **+ Ajouter une console** pour chaque système que tu veux configurer (ex : "SNES", "PS1", "Mega Drive"...).
4. Pour chaque console :
   - choisis le **cœur** correspondant dans le menu déroulant (ou choisis-en un manuellement avec le bouton "…" si RetroArch ne l'a pas listé automatiquement) ;
   - indique les **extensions** de fichiers de tes ROMs pour cette console, séparées par une virgule (ex : `.sfc,.smc` pour la SNES, `.nes` pour la NES, `.cue,.bin,.chd` pour la PS1) ;
   - choisis ton **dossier de ROMs** pour cette console (le scan est récursif, il regarde aussi dans les sous-dossiers) ;
   - clique sur **🔍 Scanner**.

NovaLauncher ajoute alors automatiquement un jeu par ROM trouvée dans la catégorie "Émulateurs", avec un nom nettoyé (les tags comme `(USA)` ou `(Rev 1)` sont retirés). Relancer un scan plus tard n'ajoute que les nouvelles ROMs, sans dupliquer celles déjà présentes.

Quelques extensions courantes pour t'aider à démarrer :

| Console | Extensions typiques |
|---|---|
| NES | `.nes` |
| SNES | `.sfc,.smc` |
| N64 | `.n64,.z64` |
| Game Boy / Color | `.gb,.gbc` |
| Game Boy Advance | `.gba` |
| Mega Drive / Genesis | `.md,.gen,.bin` |
| PlayStation 1 | `.cue,.bin,.chd,.pbp` |
| Dreamcast | `.chd,.gdi,.cdi` |
| Arcade (MAME) | `.zip,.7z` |

## Recherche automatique de jaquettes

Le bouton **🖼️ Chercher les jaquettes manquantes** (en haut de la bibliothèque) et l'option **🖼️ Chercher une jaquette** du clic-droit vont chercher une image de couverture automatiquement pour tes jeux, mais uniquement sur deux sources publiques fiables et gratuites :

- **Jeux Steam** : via l'appid contenu dans le lien `steam://rungameid/APPID`, récupère la jaquette officielle directement sur le CDN public de Steam.
- **Jeux émulés** : via le dépôt public [thumbnails.libretro.com](https://thumbnails.libretro.com) (celui qu'utilise RetroArch lui-même), en te basant sur la console renseignée et le nom exact du fichier ROM scanné. Ça fonctionne pour les consoles les plus courantes (NES, SNES, N64, Game Boy/Color/Advance, Mega Drive, PlayStation 1/2/PSP, Dreamcast, Saturn, GameCube, Wii, DS, MAME...) et à condition que ta ROM porte un nom standard (type No-Intro/Redump, avec le tag de région, ex : `Super Mario World (USA).sfc`).

**Ce qui n'est pas couvert**, faute de source publique fiable sans clé d'API payante : les jeux **Epic Games**, les **applications classiques**, et les consoles non reconnues. Pour ceux-là, ajoute une image manuellement (bouton "Choisir une image" dans la fenêtre d'ajout/modification).

Un message récapitulatif s'affiche après chaque recherche automatique (jaquettes trouvées / reconnues mais introuvables / non couvertes) pour savoir où tu en es.

## Comment récupérer les liens Steam / Epic

- **Steam** : clic droit sur un jeu dans ta bibliothèque Steam → "Gérer" → "Créer un raccourci sur le bureau", puis clic droit sur le raccourci créé → "Propriétés" pour voir la cible, ou utilise directement `steam://rungameid/APPID` (l'APPID se trouve dans l'URL de la page du jeu sur la boutique Steam).
- **Epic Games** : le plus simple est de pointer directement vers l'exécutable du jeu (dans son dossier d'installation), ou d'utiliser un lien du type `com.epicgames.launcher://apps/NOM_INTERNE?action=launch&silent=true`.
- **Émulateurs** : pointe directement vers l'exécutable de l'émulateur (ex: `RetroArch.exe`), et ajoute la ROM en argument de lancement si besoin (champ "Arguments").
- **Applications classiques (LibreOffice, etc.)** : pointe simplement vers leur `.exe` habituel (ex: `C:\Program Files\LibreOffice\program\soffice.exe`).

## Personnalisation

Envie d'aller plus loin (icône de l'appli, nouvelle catégorie, détection automatique de ta bibliothèque Steam, thèmes supplémentaires...) ? Le code est volontairement simple et commenté pour être facile à reprendre :

- `main.js` → logique côté "système" (stockage, lancement des jeux, dialogues de fichiers)
- `preload.js` → pont sécurisé entre l'interface et `main.js`
- `src/index.html`, `src/style.css`, `src/renderer.js` → toute l'interface
