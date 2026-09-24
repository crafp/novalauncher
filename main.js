const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const crypto = require('crypto');

let mainWindow;

const DEFAULT_SETTINGS = { accent: 'violet', minimizeOnLaunch: true };
const DEFAULT_EMULATION = { retroarchPath: null, consoles: [] };

function userDataPath() {
  return app.getPath('userData');
}
function dataFile() {
  return path.join(userDataPath(), 'games.json');
}
function coversDir() {
  return path.join(userDataPath(), 'covers');
}

function ensureStore() {
  if (!fs.existsSync(coversDir())) fs.mkdirSync(coversDir(), { recursive: true });
  if (!fs.existsSync(dataFile())) {
    fs.writeFileSync(
      dataFile(),
      JSON.stringify({ games: [], settings: DEFAULT_SETTINGS, emulation: DEFAULT_EMULATION }, null, 2)
    );
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(), 'utf-8'));
    return {
      games: Array.isArray(raw.games) ? raw.games : [],
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
      emulation: {
        ...DEFAULT_EMULATION,
        ...(raw.emulation || {}),
        consoles: Array.isArray(raw.emulation && raw.emulation.consoles) ? raw.emulation.consoles : [],
      },
    };
  } catch (e) {
    return { games: [], settings: { ...DEFAULT_SETTINGS }, emulation: { ...DEFAULT_EMULATION } };
  }
}

function writeStore(store) {
  fs.writeFileSync(dataFile(), JSON.stringify(store, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1040,
    minHeight: 660,
    backgroundColor: '#0b0b12',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ensureStore();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------------------------------------------------------------------- */
/* IPC : bibliothèque                                                     */
/* ---------------------------------------------------------------------- */

ipcMain.handle('store:get', () => readStore());

ipcMain.handle('games:add', (event, payload) => {
  const store = readStore();
  const game = {
    id: crypto.randomUUID(),
    name: (payload.name || 'Sans nom').trim(),
    category: payload.category || 'other',
    target: payload.target || '',
    args: payload.args || '',
    cover: payload.cover || null,
    favorite: false,
    addedAt: Date.now(),
    lastPlayed: null,
    playCount: 0,
  };
  store.games.push(game);
  writeStore(store);
  return game;
});

ipcMain.handle('games:update', (event, id, updates) => {
  const store = readStore();
  const idx = store.games.findIndex((g) => g.id === id);
  if (idx === -1) return null;

  // Si la couverture change et que l'ancienne était gérée par l'appli, on la nettoie.
  const previous = store.games[idx];
  if (
    Object.prototype.hasOwnProperty.call(updates, 'cover') &&
    previous.cover &&
    previous.cover !== updates.cover &&
    previous.cover.startsWith(coversDir())
  ) {
    fs.unlink(previous.cover, () => {});
  }

  store.games[idx] = { ...previous, ...updates };
  writeStore(store);
  return store.games[idx];
});

ipcMain.handle('games:delete', (event, id) => {
  const store = readStore();
  const game = store.games.find((g) => g.id === id);
  store.games = store.games.filter((g) => g.id !== id);
  writeStore(store);
  if (game && game.cover && game.cover.startsWith(coversDir())) {
    fs.unlink(game.cover, () => {});
  }
  return true;
});

ipcMain.handle('games:launch', (event, id) => {
  const store = readStore();
  const game = store.games.find((g) => g.id === id);
  if (!game) return { ok: false, error: 'Jeu introuvable.' };
  if (!game.target) return { ok: false, error: "Aucun chemin ou lien n'est défini pour cet élément." };

  try {
    const isProtocolLink = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(game.target);

    if (isProtocolLink) {
      shell.openExternal(game.target);
    } else {
      if (!fs.existsSync(game.target)) {
        return { ok: false, error: "Le fichier ciblé n'existe plus à cet emplacement." };
      }
      const args = game.args ? game.args.match(/(?:[^\s"]+|"[^"]*")+/g) || [] : [];
      const cleanedArgs = args.map((a) => a.replace(/^"|"$/g, ''));
      const child = spawn(game.target, cleanedArgs, {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(game.target),
      });
      child.unref();
    }

    game.lastPlayed = Date.now();
    game.playCount = (game.playCount || 0) + 1;
    writeStore(store);

    if (store.settings.minimizeOnLaunch && mainWindow) {
      mainWindow.minimize();
    }

    return { ok: true, game };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('settings:update', (event, updates) => {
  const store = readStore();
  store.settings = { ...store.settings, ...updates };
  writeStore(store);
  return store.settings;
});

/* ---------------------------------------------------------------------- */
/* IPC : émulation (RetroArch)                                            */
/* ---------------------------------------------------------------------- */

ipcMain.handle('emulation:get', () => readStore().emulation);

ipcMain.handle('emulation:updateRetroarch', (event, retroarchPath) => {
  const store = readStore();
  store.emulation.retroarchPath = retroarchPath;
  writeStore(store);
  return store.emulation;
});

ipcMain.handle('emulation:saveConsoles', (event, consoles) => {
  const store = readStore();
  store.emulation.consoles = Array.isArray(consoles) ? consoles : [];
  writeStore(store);
  return store.emulation;
});

ipcMain.handle('emulation:listCores', () => {
  const store = readStore();
  const retroarchPath = store.emulation.retroarchPath;
  if (!retroarchPath) return [];
  const coresDirCandidate = path.join(path.dirname(retroarchPath), 'cores');
  if (!fs.existsSync(coresDirCandidate)) return [];

  try {
    return fs
      .readdirSync(coresDirCandidate)
      .filter((f) => /_libretro\.(dll|so|dylib)$/i.test(f))
      .map((f) => {
        const label = f
          .replace(/_libretro\.(dll|so|dylib)$/i, '')
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return { path: path.join(coresDirCandidate, f), label };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  } catch (e) {
    return [];
  }
});

function walkDirCollectFiles(dir, results, depth, maxDepth) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth < maxDepth) walkDirCollectFiles(full, results, depth + 1, maxDepth);
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
}

function cleanRomName(fileName) {
  let name = fileName.replace(/\.[^/.]+$/, '');
  name = name.replace(/[\(\[][^\)\]]*[\)\]]/g, '');
  name = name.replace(/[_.]+/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name || fileName;
}

ipcMain.handle('emulation:scanConsole', (event, profile) => {
  const store = readStore();
  const retroarchPath = store.emulation.retroarchPath;

  if (!retroarchPath) return { ok: false, error: "Configure d'abord le chemin de RetroArch." };
  if (!fs.existsSync(retroarchPath)) return { ok: false, error: 'Le chemin de RetroArch est introuvable.' };
  if (!profile || !profile.corePath) return { ok: false, error: 'Choisis un cœur pour cette console.' };
  if (!profile.romsFolder) return { ok: false, error: 'Indique un dossier de ROMs.' };
  if (!fs.existsSync(profile.romsFolder)) return { ok: false, error: 'Le dossier de ROMs est introuvable.' };

  const exts = (profile.extensions || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => (s.startsWith('.') ? s : '.' + s));
  if (!exts.length) return { ok: false, error: 'Indique au moins une extension (ex : .sfc,.smc).' };

  const allFiles = [];
  walkDirCollectFiles(profile.romsFolder, allFiles, 0, 6);
  const matched = allFiles.filter((f) => exts.includes(path.extname(f).toLowerCase()));

  let added = 0;
  matched.forEach((romPath) => {
    const args = `-L "${profile.corePath}" "${romPath}"`;
    const alreadyExists = store.games.some(
      (g) => g.category === 'emulator' && g.target === retroarchPath && g.args === args
    );
    if (alreadyExists) return;
    store.games.push({
      id: crypto.randomUUID(),
      name: cleanRomName(path.basename(romPath)),
      category: 'emulator',
      target: retroarchPath,
      args,
      cover: null,
      favorite: false,
      addedAt: Date.now(),
      lastPlayed: null,
      playCount: 0,
      system: profile.name || '',
      romFile: path.basename(romPath, path.extname(romPath)),
    });
    added++;
  });

  writeStore(store);
  return { ok: true, added, matchedTotal: matched.length, games: store.games };
});

/* ---------------------------------------------------------------------- */
/* IPC : recherche automatique de jaquettes                               */
/* ---------------------------------------------------------------------- */

// Noms de dossiers officiels du dépôt public thumbnails.libretro.com,
// indexés par variantes courantes du nom de console tapées par l'utilisateur.
const LIBRETRO_SYSTEM_MAP = {
  'nes': 'Nintendo - Nintendo Entertainment System',
  'nintendo': 'Nintendo - Nintendo Entertainment System',
  'famicom': 'Nintendo - Nintendo Entertainment System',
  'snes': 'Nintendo - Super Nintendo Entertainment System',
  'super nintendo': 'Nintendo - Super Nintendo Entertainment System',
  'super nes': 'Nintendo - Super Nintendo Entertainment System',
  'n64': 'Nintendo - Nintendo 64',
  'nintendo 64': 'Nintendo - Nintendo 64',
  'gb': 'Nintendo - Game Boy',
  'game boy': 'Nintendo - Game Boy',
  'gbc': 'Nintendo - Game Boy Color',
  'game boy color': 'Nintendo - Game Boy Color',
  'gba': 'Nintendo - Game Boy Advance',
  'game boy advance': 'Nintendo - Game Boy Advance',
  'gamecube': 'Nintendo - GameCube',
  'ngc': 'Nintendo - GameCube',
  'wii': 'Nintendo - Wii',
  'nds': 'Nintendo - Nintendo DS',
  'ds': 'Nintendo - Nintendo DS',
  'genesis': 'Sega - Mega Drive - Genesis',
  'mega drive': 'Sega - Mega Drive - Genesis',
  'megadrive': 'Sega - Mega Drive - Genesis',
  'master system': 'Sega - Master System - Mark III',
  'game gear': 'Sega - Game Gear',
  'saturn': 'Sega - Saturn',
  'dreamcast': 'Sega - Dreamcast',
  'ps1': 'Sony - PlayStation',
  'psx': 'Sony - PlayStation',
  'playstation': 'Sony - PlayStation',
  'ps2': 'Sony - PlayStation 2',
  'playstation 2': 'Sony - PlayStation 2',
  'psp': 'Sony - PlayStation Portable',
  'arcade': 'MAME',
  'mame': 'MAME',
  'atari 2600': 'Atari - 2600',
  '3do': 'The 3DO Company - 3DO',
};

function normalizeSystemName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ');
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 8000);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryDownloadCover(url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 300) return null; // écarte les mini-images d'erreur déguisées
    const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
    ensureStore();
    const dest = path.join(coversDir(), `${crypto.randomUUID()}${ext}`);
    fs.writeFileSync(dest, buffer);
    return dest;
  } catch (e) {
    return null;
  }
}

async function mapLimit(items, limit, mapper) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await mapper(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
}

ipcMain.handle('covers:autoFetch', async (event, payload) => {
  const store = readStore();
  const ids = payload && Array.isArray(payload.ids) ? payload.ids : null;
  const targets = ids ? store.games.filter((g) => ids.includes(g.id)) : store.games.filter((g) => !g.cover);

  let updated = 0;
  let notFound = 0;
  let unsupported = 0;

  await mapLimit(targets, 5, async (game) => {
    let coverPath = null;
    let supported = false;

    if (game.category === 'steam') {
      const m = (game.target || '').match(/rungameid\/(\d+)/i);
      if (m) {
        supported = true;
        const appid = m[1];
        coverPath =
          (await tryDownloadCover(`https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`)) ||
          (await tryDownloadCover(`https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`));
      }
    } else if (game.category === 'emulator' && game.system) {
      const folder = LIBRETRO_SYSTEM_MAP[normalizeSystemName(game.system)];
      const romFile = game.romFile || game.name;
      if (folder && romFile) {
        supported = true;
        const url = `https://thumbnails.libretro.com/${encodeURIComponent(folder)}/Named_Boxarts/${encodeURIComponent(romFile)}.png`;
        coverPath = await tryDownloadCover(url);
      }
    }

    if (coverPath) {
      game.cover = coverPath;
      updated++;
    } else if (supported) {
      notFound++;
    } else {
      unsupported++;
    }
  });

  writeStore(store);
  return { ok: true, updated, notFound, unsupported, games: store.games };
});

/* ---------------------------------------------------------------------- */
/* IPC : dialogues & fichiers                                             */
/* ---------------------------------------------------------------------- */

ipcMain.handle('dialog:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un dossier de ROMs',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:pickCoreFile', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un fichier de cœur libretro',
    properties: ['openFile'],
    filters: [{ name: 'Cœurs libretro', extensions: ['dll', 'so', 'dylib'] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:pickExecutable', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir un exécutable',
    properties: ['openFile'],
    filters: [
      { name: 'Exécutables et raccourcis', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
      { name: 'Tous les fichiers', extensions: ['*'] },
    ],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

ipcMain.handle('dialog:pickImage', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir une image de couverture',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (res.canceled || !res.filePaths.length) return null;

  const src = res.filePaths[0];
  ensureStore();
  const ext = path.extname(src) || '.png';
  const destName = `${crypto.randomUUID()}${ext}`;
  const dest = path.join(coversDir(), destName);
  fs.copyFileSync(src, dest);
  return dest;
});

ipcMain.handle('shell:showInFolder', (event, targetPath) => {
  if (targetPath && fs.existsSync(targetPath)) shell.showItemInFolder(targetPath);
  return true;
});

ipcMain.handle('fs:exists', (event, targetPath) => {
  return !!targetPath && fs.existsSync(targetPath);
});
