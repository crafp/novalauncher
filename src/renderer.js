(function () {
  'use strict';

  const CATEGORY_META = {
    steam: { label: 'Steam', icon: '🎮' },
    epic: { label: 'Epic Games', icon: '🚀' },
    emulator: { label: 'Émulateur', icon: '🕹️' },
    app: { label: 'Application', icon: '🖥️' },
    other: { label: 'Autre', icon: '📦' },
  };

  const SECTION_TITLES = {
    all: 'Tous',
    favorites: 'Favoris',
    steam: 'Steam',
    epic: 'Epic Games',
    emulator: 'Émulateurs',
    app: 'Applications',
    other: 'Autres',
  };

  const ACCENTS = {
    violet: { accent: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.18)', glow: 'rgba(139, 92, 246, 0.45)' },
    cyan: { accent: '#22d3ee', soft: 'rgba(34, 211, 238, 0.18)', glow: 'rgba(34, 211, 238, 0.45)' },
    rose: { accent: '#f472b6', soft: 'rgba(244, 114, 182, 0.18)', glow: 'rgba(244, 114, 182, 0.45)' },
    vert: { accent: '#34d399', soft: 'rgba(52, 211, 153, 0.18)', glow: 'rgba(52, 211, 153, 0.45)' },
    orange: { accent: '#fb923c', soft: 'rgba(251, 146, 60, 0.18)', glow: 'rgba(251, 146, 60, 0.45)' },
  };

  const EMULATOR_HINTS = [
    'retroarch', 'pcsx2', 'dolphin', 'cemu', 'yuzu', 'ryujinx', 'rpcs3',
    'duckstation', 'ppsspp', 'snes9x', 'project64', 'citra', 'xenia',
    'vita3k', 'flycast', 'mame', 'mgba', 'melonds', 'xemu',
  ];

  const state = {
    games: [],
    settings: { accent: 'violet', minimizeOnLaunch: true },
    category: 'all',
    query: '',
    activeId: null,
    editingId: null,
    pendingCover: null,
    contextGameId: null,
    emulation: { retroarchPath: null, consoles: [] },
    cores: [],
  };

  const el = (id) => document.getElementById(id);

  const grid = el('grid');
  const emptyState = el('emptyState');
  const sectionTitle = el('sectionTitle');
  const sectionCount = el('sectionCount');
  const searchInput = el('search');

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                        */
  /* ------------------------------------------------------------------ */

  function hashHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) % 360;
    }
    return h;
  }

  function fallbackGradient(name) {
    const hue = hashHue(name || 'NovaLauncher');
    return `linear-gradient(135deg, hsl(${hue}, 70%, 40%), hsl(${(hue + 50) % 360}, 70%, 22%))`;
  }

  function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function toFileUrl(p) {
    if (!p) return '';
    let clean = p.replace(/\\/g, '/');
    if (!clean.startsWith('/')) clean = '/' + clean;
    return 'file://' + encodeURI(clean);
  }

  function guessCategory(targetPath) {
    const lower = (targetPath || '').toLowerCase();
    if (lower.includes('steamapps') || lower.includes('\\steam\\') || lower.includes('/steam/')) return 'steam';
    if (lower.includes('epic games') || lower.includes('epicgames')) return 'epic';
    if (EMULATOR_HINTS.some((hint) => lower.includes(hint))) return 'emulator';
    return 'app';
  }

  function guessName(targetPath) {
    if (!targetPath) return '';
    const base = targetPath.replace(/\\/g, '/').split('/').pop() || '';
    return base.replace(/\.(exe|bat|cmd|lnk)$/i, '').replace(/[-_]+/g, ' ').trim();
  }

  function applyAccent(name) {
    const palette = ACCENTS[name] || ACCENTS.violet;
    document.documentElement.style.setProperty('--accent', palette.accent);
    document.documentElement.style.setProperty('--accent-soft', palette.soft);
    document.documentElement.style.setProperty('--accent-glow', palette.glow);
    document.querySelectorAll('#accentPicker button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.accent === name);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Chargement initial                                                 */
  /* ------------------------------------------------------------------ */

  async function init() {
    const store = await window.api.getStore();
    state.games = store.games || [];
    state.settings = store.settings || state.settings;
    applyAccent(state.settings.accent);
    el('toggleMinimize').checked = !!state.settings.minimizeOnLaunch;

    const lastPlayed = [...state.games].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
    state.activeId = lastPlayed ? lastPlayed.id : null;

    render();
  }

  /* ------------------------------------------------------------------ */
  /* Filtrage / rendu                                                   */
  /* ------------------------------------------------------------------ */

  function filteredGames() {
    let list = state.games;
    if (state.category === 'favorites') list = list.filter((g) => g.favorite);
    else if (state.category !== 'all') list = list.filter((g) => g.category === state.category);

    if (state.query.trim()) {
      const q = state.query.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      if (!!b.favorite !== !!a.favorite) return b.favorite ? 1 : -1;
      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });
  }

  function updateCounts() {
    const counters = { all: state.games.length, favorites: 0, steam: 0, epic: 0, emulator: 0, app: 0, other: 0 };
    state.games.forEach((g) => {
      if (g.favorite) counters.favorites++;
      if (counters[g.category] !== undefined) counters[g.category]++;
    });
    Object.keys(counters).forEach((key) => {
      const node = el(`count-${key}`);
      if (node) node.textContent = counters[key];
    });
  }

  function render() {
    updateCounts();

    sectionTitle.textContent = SECTION_TITLES[state.category] || 'Tous';
    document.querySelectorAll('.cat-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cat === state.category);
    });

    const list = filteredGames();
    sectionCount.textContent = list.length ? `${list.length} élément${list.length > 1 ? 's' : ''}` : '';

    grid.innerHTML = '';

    if (!state.games.length) {
      emptyState.hidden = false;
      el('emptyTitle').textContent = 'Ta bibliothèque est vide';
      el('emptyText').textContent = 'Ajoute ton premier jeu, ta plateforme ou ton application pour commencer.';
      grid.hidden = true;
    } else if (!list.length) {
      emptyState.hidden = false;
      el('emptyTitle').textContent = 'Aucun résultat';
      el('emptyText').textContent = "Aucun élément ne correspond à cette recherche ou catégorie.";
      grid.hidden = true;
    } else {
      emptyState.hidden = true;
      grid.hidden = false;
      list.forEach((game) => grid.appendChild(buildTile(game)));
    }

    renderHero();
  }

  function buildTile(game) {
    const meta = CATEGORY_META[game.category] || CATEGORY_META.other;
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.id = game.id;

    if (game.cover) {
      const cover = document.createElement('div');
      cover.className = 'tile-cover';
      cover.style.backgroundImage = `url("${toFileUrl(game.cover)}")`;
      tile.appendChild(cover);
    } else {
      const fb = document.createElement('div');
      fb.className = 'tile-fallback';
      fb.style.background = fallbackGradient(game.name);
      fb.textContent = initials(game.name);
      tile.appendChild(fb);
    }

    const scrim = document.createElement('div');
    scrim.className = 'tile-scrim';
    tile.appendChild(scrim);

    const badge = document.createElement('div');
    badge.className = 'tile-badge';
    badge.textContent = meta.icon;
    tile.appendChild(badge);

    const fav = document.createElement('div');
    fav.className = 'tile-fav' + (game.favorite ? ' active' : '');
    fav.textContent = game.favorite ? '★' : '☆';
    fav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(game.id);
    });
    tile.appendChild(fav);

    const play = document.createElement('div');
    play.className = 'tile-play';
    play.textContent = '▶️';
    tile.appendChild(play);

    const name = document.createElement('div');
    name.className = 'tile-name';
    name.textContent = game.name;
    tile.appendChild(name);

    tile.addEventListener('mouseenter', () => {
      state.activeId = game.id;
      renderHero();
    });

    tile.addEventListener('click', () => launchGame(game.id));

    tile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, game.id);
    });

    return tile;
  }

  function renderHero() {
    const game = state.games.find((g) => g.id === state.activeId);
    const backdrop = el('heroBackdrop');
    const badge = el('heroBadge');
    const title = el('heroTitle');
    const subtitle = el('heroSubtitle');
    const actions = el('heroActions');

    if (!game) {
      backdrop.style.backgroundImage = 'none';
      badge.textContent = 'Bienvenue';
      title.textContent = 'NovaLauncher';
      const platforms = new Set(state.games.map((g) => g.category)).size;
      subtitle.textContent = state.games.length
        ? `${state.games.length} élément${state.games.length > 1 ? 's' : ''} · ${platforms} catégorie${platforms > 1 ? 's' : ''}. Survole ou clique une tuile pour la lancer.`
        : "Ajoute tes jeux Steam, Epic Games, tes émulateurs et tes applications pour tout lancer depuis un seul endroit.";
      actions.innerHTML = '';
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = '+ Ajouter un jeu';
      btn.addEventListener('click', () => openModal('add'));
      actions.appendChild(btn);
      return;
    }

    const meta = CATEGORY_META[game.category] || CATEGORY_META.other;
    backdrop.style.backgroundImage = game.cover ? `url("${toFileUrl(game.cover)}")` : 'none';
    badge.textContent = `${meta.icon} ${meta.label}`;
    title.textContent = game.name;
    subtitle.textContent = game.playCount
      ? `Lancé ${game.playCount} fois`
      : 'Pas encore lancé';

    actions.innerHTML = '';
    const playBtn = document.createElement('button');
    playBtn.className = 'btn-primary';
    playBtn.textContent = '▶️ Lancer';
    playBtn.addEventListener('click', () => launchGame(game.id));
    actions.appendChild(playBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-secondary';
    editBtn.textContent = '✏️ Modifier';
    editBtn.addEventListener('click', () => openModal('edit', game.id));
    actions.appendChild(editBtn);
  }

  /* ------------------------------------------------------------------ */
  /* Actions jeux                                                       */
  /* ------------------------------------------------------------------ */

  async function launchGame(id) {
    const res = await window.api.launchGame(id);
    if (!res.ok) {
      alert(`Impossible de lancer cet élément :\n${res.error}`);
      return;
    }
    const idx = state.games.findIndex((g) => g.id === id);
    if (idx !== -1) state.games[idx] = res.game;
    state.activeId = id;
    render();
  }

  async function toggleFavorite(id) {
    const game = state.games.find((g) => g.id === id);
    if (!game) return;
    const updated = await window.api.updateGame(id, { favorite: !game.favorite });
    if (updated) {
      const idx = state.games.findIndex((g) => g.id === id);
      state.games[idx] = updated;
      render();
    }
  }

  async function deleteGame(id) {
    const game = state.games.find((g) => g.id === id);
    if (!game) return;
    const ok = confirm(`Supprimer « ${game.name} » de la bibliothèque ?`);
    if (!ok) return;
    await window.api.deleteGame(id);
    state.games = state.games.filter((g) => g.id !== id);
    if (state.activeId === id) {
      const lastPlayed = [...state.games].sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))[0];
      state.activeId = lastPlayed ? lastPlayed.id : null;
    }
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Modale ajout / édition                                             */
  /* ------------------------------------------------------------------ */

  function openModal(mode, gameId, prefill) {
    state.editingId = mode === 'edit' ? gameId : null;
    state.pendingCover = null;

    const form = el('gameForm');
    form.reset();
    el('btnDeleteGame').hidden = mode !== 'edit';

    if (mode === 'edit') {
      const game = state.games.find((g) => g.id === gameId);
      if (!game) return;
      el('modalTitle').textContent = 'Modifier';
      el('fieldName').value = game.name;
      el('fieldCategory').value = game.category;
      el('fieldTarget').value = game.target;
      el('fieldArgs').value = game.args || '';
      state.pendingCover = game.cover || null;
      updateCoverPreview(game.name, game.cover);
    } else {
      el('modalTitle').textContent = 'Ajouter un jeu / une app';
      if (prefill) {
        el('fieldName').value = prefill.name || '';
        el('fieldCategory').value = prefill.category || 'app';
        el('fieldTarget').value = prefill.target || '';
      }
      updateCoverPreview(el('fieldName').value, null);
    }

    el('modalOverlay').hidden = false;
    el('fieldName').focus();
  }

  function closeModal() {
    el('modalOverlay').hidden = true;
    state.editingId = null;
    state.pendingCover = null;
  }

  function updateCoverPreview(name, coverPath) {
    const preview = el('coverPreview');
    const letter = el('coverPreviewLetter');
    if (coverPath) {
      preview.style.backgroundImage = `url("${toFileUrl(coverPath)}")`;
      letter.style.display = 'none';
    } else {
      preview.style.backgroundImage = 'none';
      preview.style.background = fallbackGradient(name || '');
      letter.style.display = 'block';
      letter.textContent = initials(name || '');
    }
  }

  el('fieldName').addEventListener('input', () => {
    if (!state.pendingCover) updateCoverPreview(el('fieldName').value, null);
  });

  el('btnAdd').addEventListener('click', () => openModal('add'));
  el('btnAddEmpty').addEventListener('click', () => openModal('add'));
  el('modalClose').addEventListener('click', closeModal);
  el('btnCancelModal').addEventListener('click', closeModal);
  el('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });

  el('btnBrowseExe').addEventListener('click', async () => {
    const filePath = await window.api.pickExecutable();
    if (!filePath) return;
    el('fieldTarget').value = filePath;
    if (!el('fieldName').value.trim()) {
      el('fieldName').value = guessName(filePath);
    }
    el('fieldCategory').value = guessCategory(filePath);
    if (!state.pendingCover) updateCoverPreview(el('fieldName').value, null);
  });

  el('btnBrowseImage').addEventListener('click', async () => {
    const imgPath = await window.api.pickImage();
    if (!imgPath) return;
    state.pendingCover = imgPath;
    updateCoverPreview(el('fieldName').value, imgPath);
  });

  el('btnClearImage').addEventListener('click', () => {
    state.pendingCover = null;
    updateCoverPreview(el('fieldName').value, null);
  });

  el('btnDeleteGame').addEventListener('click', async () => {
    if (!state.editingId) return;
    const id = state.editingId;
    closeModal();
    await deleteGame(id);
  });

  el('gameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: el('fieldName').value.trim() || 'Sans nom',
      category: el('fieldCategory').value,
      target: el('fieldTarget').value.trim(),
      args: el('fieldArgs').value.trim(),
      cover: state.pendingCover,
    };

    if (!payload.target) {
      alert("Indique un chemin d'exécutable ou un lien de lancement.");
      return;
    }

    if (state.editingId) {
      const updated = await window.api.updateGame(state.editingId, payload);
      const idx = state.games.findIndex((g) => g.id === state.editingId);
      if (idx !== -1) state.games[idx] = updated;
      state.activeId = state.editingId;
    } else {
      const created = await window.api.addGame(payload);
      state.games.push(created);
      state.activeId = created.id;
    }

    closeModal();
    render();
  });

  /* ------------------------------------------------------------------ */
  /* Catégories / recherche                                             */
  /* ------------------------------------------------------------------ */

  el('categoryNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-item');
    if (!btn) return;
    state.category = btn.dataset.cat;
    render();
  });

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    render();
  });

  /* ------------------------------------------------------------------ */
  /* Menu contextuel                                                    */
  /* ------------------------------------------------------------------ */

  const contextMenu = el('contextMenu');

  function openContextMenu(x, y, gameId) {
    state.contextGameId = gameId;
    const game = state.games.find((g) => g.id === gameId);
    const favBtn = contextMenu.querySelector('[data-action="favorite"]');
    favBtn.textContent = game && game.favorite ? '⭐ Retirer des favoris' : '⭐ Ajouter aux favoris';

    contextMenu.hidden = false;
    const menuWidth = 200;
    const menuHeight = 200;
    const maxX = window.innerWidth - menuWidth - 8;
    const maxY = window.innerHeight - menuHeight - 8;
    contextMenu.style.left = Math.min(x, Math.max(8, maxX)) + 'px';
    contextMenu.style.top = Math.min(y, Math.max(8, maxY)) + 'px';
  }

  function closeContextMenu() {
    contextMenu.hidden = true;
    state.contextGameId = null;
  }

  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) closeContextMenu();
  });
  window.addEventListener('blur', closeContextMenu);
  document.addEventListener('scroll', closeContextMenu, true);

  contextMenu.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = state.contextGameId;
    const action = btn.dataset.action;
    closeContextMenu();
    if (!id) return;

    if (action === 'launch') launchGame(id);
    else if (action === 'favorite') toggleFavorite(id);
    else if (action === 'edit') openModal('edit', id);
    else if (action === 'delete') deleteGame(id);
    else if (action === 'find-cover') findCoverForGame(id);
    else if (action === 'folder') {
      const game = state.games.find((g) => g.id === id);
      if (game) window.api.showInFolder(game.target);
    }
  });

  /* ------------------------------------------------------------------ */
  /* Jaquettes automatiques                                             */
  /* ------------------------------------------------------------------ */

  async function findCoverForGame(id) {
    const res = await window.api.autoFetchCovers([id]);
    if (!res.ok) return;
    state.games = res.games;
    render();
    if (!res.updated) {
      alert(
        "Aucune jaquette trouvée automatiquement pour cet élément.\n" +
        "(Ça marche pour les jeux Steam avec un lien steam://rungameid/... et pour les jeux émulés dont la console est reconnue — pas encore pour Epic Games ou les applications classiques.)"
      );
    }
  }

  el('btnAutoCovers').addEventListener('click', async () => {
    const missing = state.games.filter((g) => !g.cover).length;
    if (!missing) {
      alert('Tous tes jeux ont déjà une jaquette.');
      return;
    }
    const btn = el('btnAutoCovers');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = '🖼️ Recherche en cours…';

    const res = await window.api.autoFetchCovers();

    btn.disabled = false;
    btn.textContent = original;
    if (!res.ok) return;

    state.games = res.games;
    render();
    alert(
      `Jaquettes trouvées : ${res.updated}\n` +
      `Reconnues mais introuvables en ligne : ${res.notFound}\n` +
      `Non couvertes (Epic Games, applications, consoles non reconnues...) : ${res.unsupported}`
    );
  });

  /* ------------------------------------------------------------------ */
  /* Paramètres                                                         */
  /* ------------------------------------------------------------------ */

  el('btnSettings').addEventListener('click', () => {
    el('settingsOverlay').hidden = false;
  });
  el('settingsClose').addEventListener('click', () => {
    el('settingsOverlay').hidden = true;
  });
  el('settingsOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'settingsOverlay') el('settingsOverlay').hidden = true;
  });

  el('accentPicker').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-accent]');
    if (!btn) return;
    const accent = btn.dataset.accent;
    applyAccent(accent);
    state.settings.accent = accent;
    await window.api.updateSettings({ accent });
  });

  el('toggleMinimize').addEventListener('change', async (e) => {
    state.settings.minimizeOnLaunch = e.target.checked;
    await window.api.updateSettings({ minimizeOnLaunch: e.target.checked });
  });

  /* ------------------------------------------------------------------ */
  /* Émulation (RetroArch)                                              */
  /* ------------------------------------------------------------------ */

  let consolesPersistTimer = null;

  function persistConsolesDebounced() {
    clearTimeout(consolesPersistTimer);
    consolesPersistTimer = setTimeout(() => {
      window.api.saveConsoles(state.emulation.consoles);
    }, 400);
  }

  async function persistConsolesNow() {
    await window.api.saveConsoles(state.emulation.consoles);
  }

  function fillCoreSelect(select, selectedCorePath) {
    select.innerHTML = '';
    if (!state.cores.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Aucun cœur détecté';
      select.appendChild(opt);
      return;
    }
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Choisir un cœur —';
    select.appendChild(placeholder);
    state.cores.forEach((core) => {
      const opt = document.createElement('option');
      opt.value = core.path;
      opt.textContent = core.label;
      if (core.path === selectedCorePath) opt.selected = true;
      select.appendChild(opt);
    });
    // Cœur choisi manuellement mais absent du dossier "cores" détecté : on l'ajoute quand même.
    if (selectedCorePath && !state.cores.some((c) => c.path === selectedCorePath)) {
      const opt = document.createElement('option');
      opt.value = selectedCorePath;
      opt.textContent = `Personnalisé : ${selectedCorePath.split(/[\\/]/).pop()}`;
      opt.selected = true;
      select.appendChild(opt);
    }
  }

  function buildConsoleRow(profile, index) {
    const row = document.createElement('div');
    row.className = 'console-row';
    row.dataset.index = String(index);

    row.innerHTML = `
      <div class="console-row-top">
        <input class="console-name" data-field="name" type="text" placeholder="Nom (ex : SNES)" value="${escapeHtml(profile.name)}" />
        <button type="button" class="icon-btn console-remove" title="Supprimer cette console">🗑️</button>
      </div>
      <div class="console-row-grid">
        <div>
          <label>Cœur libretro</label>
          <div class="console-core-row">
            <select class="console-core" data-field="corePath"></select>
            <button type="button" class="btn-secondary btn-small console-core-browse" title="Choisir un fichier de cœur manuellement">…</button>
          </div>
        </div>
        <div>
          <label>Extensions (séparées par virgule)</label>
          <input class="console-ext" data-field="extensions" type="text" placeholder=".sfc,.smc" value="${escapeHtml(profile.extensions)}" />
        </div>
      </div>
      <div class="console-row-folder">
        <input class="console-folder" type="text" readonly placeholder="Dossier de ROMs" value="${escapeHtml(profile.romsFolder)}" />
        <button type="button" class="btn-secondary btn-small console-browse-folder">Parcourir</button>
        <button type="button" class="btn-primary btn-small console-scan">🔍 Scanner</button>
      </div>
      <div class="console-row-result"></div>
    `;

    fillCoreSelect(row.querySelector('.console-core'), profile.corePath);
    return row;
  }

  function renderConsoleList() {
    const container = el('consoleList');
    container.innerHTML = '';
    if (!state.emulation.consoles.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Aucune console configurée. Clique sur « + Ajouter une console » pour commencer.';
      container.appendChild(empty);
      return;
    }
    state.emulation.consoles.forEach((profile, index) => {
      container.appendChild(buildConsoleRow(profile, index));
    });
  }

  async function refreshCores() {
    state.cores = (await window.api.listCores()) || [];
    el('coresStatus').textContent = state.cores.length
      ? `${state.cores.length} cœur(s) détecté(s) dans le dossier "cores" de RetroArch.`
      : "Aucun cœur détecté. Vérifie que RetroArch est bien installé et que tu as téléchargé des cœurs (menu RetroArch → Cœurs → Télécharger un cœur), ou choisis-en un manuellement avec le bouton « … ».";
    renderConsoleList();
  }

  el('btnEmulation').addEventListener('click', async () => {
    el('emulationOverlay').hidden = false;
    const em = await window.api.getEmulation();
    state.emulation = em || { retroarchPath: null, consoles: [] };
    el('retroarchPath').value = state.emulation.retroarchPath || '';
    if (state.emulation.retroarchPath) {
      await refreshCores();
    } else {
      state.cores = [];
      el('coresStatus').textContent = 'Configure le chemin de RetroArch pour détecter tes cœurs.';
      renderConsoleList();
    }
  });

  el('emulationClose').addEventListener('click', () => {
    el('emulationOverlay').hidden = true;
  });
  el('emulationOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'emulationOverlay') el('emulationOverlay').hidden = true;
  });

  el('btnBrowseRetroarch').addEventListener('click', async () => {
    const p = await window.api.pickExecutable();
    if (!p) return;
    el('retroarchPath').value = p;
    state.emulation.retroarchPath = p;
    await window.api.updateRetroarchPath(p);
    await refreshCores();
  });

  el('btnAddConsole').addEventListener('click', async () => {
    state.emulation.consoles.push({ name: '', corePath: '', extensions: '', romsFolder: '' });
    await persistConsolesNow();
    renderConsoleList();
  });

  el('consoleList').addEventListener('input', (e) => {
    const row = e.target.closest('.console-row');
    if (!row) return;
    const field = e.target.dataset.field;
    if (!field) return;
    const index = Number(row.dataset.index);
    state.emulation.consoles[index][field] = e.target.value;
    persistConsolesDebounced();
  });

  el('consoleList').addEventListener('change', (e) => {
    if (!e.target.classList.contains('console-core')) return;
    const row = e.target.closest('.console-row');
    if (!row) return;
    const index = Number(row.dataset.index);
    state.emulation.consoles[index].corePath = e.target.value;
    persistConsolesNow();
  });

  el('consoleList').addEventListener('click', async (e) => {
    const row = e.target.closest('.console-row');
    if (!row) return;
    const index = Number(row.dataset.index);
    const profile = state.emulation.consoles[index];
    if (!profile) return;

    if (e.target.classList.contains('console-remove')) {
      state.emulation.consoles.splice(index, 1);
      await persistConsolesNow();
      renderConsoleList();
      return;
    }

    if (e.target.classList.contains('console-browse-folder')) {
      const folder = await window.api.pickFolder();
      if (folder) {
        profile.romsFolder = folder;
        await persistConsolesNow();
        renderConsoleList();
      }
      return;
    }

    if (e.target.classList.contains('console-core-browse')) {
      const corePath = await window.api.pickCoreFile();
      if (corePath) {
        profile.corePath = corePath;
        await persistConsolesNow();
        renderConsoleList();
      }
      return;
    }

    if (e.target.classList.contains('console-scan')) {
      const resultEl = row.querySelector('.console-row-result');
      resultEl.textContent = 'Scan en cours…';
      const res = await window.api.scanConsole(profile);
      if (!res.ok) {
        resultEl.textContent = `⚠️ ${res.error}`;
        return;
      }
      state.games = res.games;
      resultEl.textContent = `✅ ${res.added} jeu(x) ajouté(s) sur ${res.matchedTotal} fichier(s) trouvé(s) (le reste était déjà dans ta bibliothèque).`;
      render();
    }
  });

  /* ------------------------------------------------------------------ */
  /* Glisser-déposer                                                    */
  /* ------------------------------------------------------------------ */

  const dropOverlay = el('dropOverlay');

  function hasFiles(e) {
    return !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
  }

  function hideDropOverlay() {
    dropOverlay.hidden = true;
  }

  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dropOverlay.hidden = false;
  });
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
  });
  window.addEventListener('dragleave', (e) => {
    // Ne masque que quand on quitte vraiment la fenêtre (pas un simple survol d'enfant).
    if (!e.relatedTarget) hideDropOverlay();
  });
  window.addEventListener('dragend', hideDropOverlay);
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    hideDropOverlay();
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.path) return;
    openModal('add', null, {
      name: guessName(file.path),
      category: guessCategory(file.path),
      target: file.path,
    });
  });
  // Filet de sécurité : un clic ou Échap referme toujours l'overlay, même si un
  // événement de drag a été mal comptabilisé par le système.
  dropOverlay.addEventListener('click', hideDropOverlay);

  /* ------------------------------------------------------------------ */
  /* Raccourcis clavier                                                 */
  /* ------------------------------------------------------------------ */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContextMenu();
      if (!el('modalOverlay').hidden) closeModal();
      if (!el('settingsOverlay').hidden) el('settingsOverlay').hidden = true;
      if (!el('emulationOverlay').hidden) el('emulationOverlay').hidden = true;
      if (!dropOverlay.hidden) hideDropOverlay();
    }
  });

  init();
})();
