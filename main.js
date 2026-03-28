// File Creation Tracker - Obsidian Plugin
// Shows recently created files sorted by date, including files created outside Obsidian.

const { Plugin, ItemView, PluginSettingTab, Setting, Notice, TFolder } = require('obsidian');

// ─── Constants ───────────────────────────────────────────────────────────────

const VIEW_TYPE = 'file-creation-tracker-view';
const VIEW_DISPLAY = 'File Creation Tracker';

const SORT_OPTIONS = {
  'ctime': 'File creation date',
  'filename-date': 'Date in filename (YYYY-MM-DD)',
  'mtime': 'Last modified date'
};

const DATE_RANGE_OPTIONS = {
  '7': 'Recent 7 days',
  '30': 'Recent 30 days',
  '90': 'Recent 90 days',
  '365': 'Recent 1 year',
  '0': 'All files'
};

const EXTENSION_LABELS = {
  png: 'PNG images', jpg: 'JPG images', jpeg: 'JPEG images',
  gif: 'GIF images', svg: 'SVG images', webp: 'WebP images',
  pdf: 'PDF documents',
  mp3: 'MP3 audio', mp4: 'MP4 video', wav: 'WAV audio',
  webm: 'WebM media', m4a: 'M4A audio',
  css: 'CSS files', js: 'JavaScript files', json: 'JSON files'
};

const DEFAULT_SETTINGS = {
  sortBy: 'ctime',
  excludedFolders: {},
  excludedExtensions: {
    png: true, jpg: true, jpeg: true, gif: true, svg: true, webp: true,
    pdf: false, mp3: true, mp4: true, wav: true, webm: true, m4a: true,
    css: true, js: true, json: true
  },
  displayCount: 30,
  dateRange: 30
};

// ─── Utility Functions ───────────────────────────────────────────────────────

function extractDateFromFilename(filename) {
  // Match YYYY-MM-DD pattern in filename
  const match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!isNaN(d.getTime())) return d.getTime();
  }
  // Match YYYYMMDD pattern
  const match2 = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (match2) {
    const d = new Date(parseInt(match2[1]), parseInt(match2[2]) - 1, parseInt(match2[3]));
    if (!isNaN(d.getTime()) && parseInt(match2[1]) >= 2000 && parseInt(match2[1]) <= 2099) return d.getTime();
  }
  return null;
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

function getDateGroup(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  if (date >= monthAgo) return 'This Month';
  return 'Older';
}

// ─── Sidebar View ────────────────────────────────────────────────────────────

class FileCreationTrackerView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.fileCache = [];
    this.isLoading = false;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return VIEW_DISPLAY; }
  getIcon() { return 'clock'; }

  async onOpen() {
    this.containerEl.children[1].empty();
    this.rootEl = this.containerEl.children[1].createDiv({ cls: 'fct-container' });
    await this.refresh();

    // Auto-refresh on file changes
    this.registerEvent(this.app.vault.on('create', () => this.debouncedRefresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.debouncedRefresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.debouncedRefresh()));
  }

  debouncedRefresh() {
    if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
    this._refreshTimeout = setTimeout(() => this.refresh(), 1000);
  }

  async refresh() {
    if (this.isLoading) return;
    this.isLoading = true;

    this.rootEl.empty();
    const loadingEl = this.rootEl.createDiv({ cls: 'fct-loading' });
    loadingEl.setText('Scanning files...');

    try {
      const files = await this.scanFiles();
      this.rootEl.empty();

      if (files.length === 0) {
        const empty = this.rootEl.createDiv({ cls: 'fct-empty-state' });
        empty.setText('No files found matching your filters. Check Settings to adjust.');
        return;
      }

      this.renderFileList(files);
    } catch (e) {
      this.rootEl.empty();
      const err = this.rootEl.createDiv({ cls: 'fct-empty-state' });
      err.setText('Error scanning files: ' + e.message);
    } finally {
      this.isLoading = false;
    }
  }

  async scanFiles() {
    const settings = this.plugin.settings;
    const allFiles = this.app.vault.getFiles();

    // Filter files
    const filtered = allFiles.filter(file => {
      // Exclude by extension
      if (settings.excludedExtensions[file.extension]) return false;

      // Exclude by folder
      const topFolder = file.path.split('/')[0];
      if (settings.excludedFolders[topFolder]) return false;

      // Exclude .obsidian
      if (file.path.startsWith('.obsidian')) return false;

      return true;
    });

    // Get stat info for all files
    const fileData = await Promise.all(
      filtered.map(async (file) => {
        try {
          const stat = await this.app.vault.adapter.stat(file.path);
          if (!stat) return null;

          let sortDate;
          if (settings.sortBy === 'filename-date') {
            sortDate = extractDateFromFilename(file.basename);
            if (!sortDate) sortDate = stat.ctime;
          } else if (settings.sortBy === 'mtime') {
            sortDate = stat.mtime;
          } else {
            sortDate = stat.ctime;
          }

          return {
            path: file.path,
            name: file.basename,
            extension: file.extension,
            folder: file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '',
            sortDate: sortDate,
            ctime: stat.ctime,
            mtime: stat.mtime
          };
        } catch (e) {
          return null;
        }
      })
    );

    // Remove nulls, filter by date range, sort, and limit
    let results = fileData.filter(f => f !== null);

    // Date range filter
    if (settings.dateRange > 0) {
      const cutoff = Date.now() - settings.dateRange * 86400000;
      results = results.filter(f => f.sortDate >= cutoff);
    }

    // Sort descending (newest first)
    results.sort((a, b) => b.sortDate - a.sortDate);

    // Limit
    results = results.slice(0, settings.displayCount);

    return results;
  }

  renderFileList(files) {
    let currentGroup = '';

    for (const file of files) {
      const group = getDateGroup(file.sortDate);

      if (group !== currentGroup) {
        currentGroup = group;
        this.rootEl.createDiv({ cls: 'fct-date-group', text: group });
      }

      const item = this.rootEl.createDiv({ cls: 'fct-file-item' });

      const nameEl = item.createDiv({ cls: 'fct-file-name' });
      nameEl.setText(file.name);

      const metaEl = item.createDiv({ cls: 'fct-file-meta' });

      const pathEl = metaEl.createDiv({ cls: 'fct-file-path' });
      pathEl.setText(file.folder);

      const dateEl = metaEl.createDiv({ cls: 'fct-file-date' });
      dateEl.setText(formatDate(file.sortDate));

      item.addEventListener('click', () => {
        this.app.workspace.openLinkText(file.path, '');
      });
    }
  }

  async onClose() {
    if (this._refreshTimeout) clearTimeout(this._refreshTimeout);
  }
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

class FileCreationTrackerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    // ── Sort By ──
    new Setting(containerEl)
      .setName('Sort by')
      .setDesc('Choose how to determine each file\'s date')
      .addDropdown(drop => {
        for (const [value, label] of Object.entries(SORT_OPTIONS)) {
          drop.addOption(value, label);
        }
        drop.setValue(this.plugin.settings.sortBy);
        drop.onChange(async (value) => {
          this.plugin.settings.sortBy = value;
          await this.plugin.saveSettings();
        });
      });

    // ── Date Range ──
    new Setting(containerEl)
      .setName('Date range')
      .setDesc('Show files from this time period')
      .addDropdown(drop => {
        for (const [value, label] of Object.entries(DATE_RANGE_OPTIONS)) {
          drop.addOption(value, label);
        }
        drop.setValue(String(this.plugin.settings.dateRange));
        drop.onChange(async (value) => {
          this.plugin.settings.dateRange = parseInt(value);
          await this.plugin.saveSettings();
        });
      });

    // ── Display Count ──
    new Setting(containerEl)
      .setName('Number of files to show')
      .setDesc(`Currently: ${this.plugin.settings.displayCount} files`)
      .addSlider(slider => {
        slider.setLimits(10, 100, 5);
        slider.setValue(this.plugin.settings.displayCount);
        slider.setDynamicTooltip();
        slider.onChange(async (value) => {
          this.plugin.settings.displayCount = value;
          await this.plugin.saveSettings();
          this.display(); // refresh desc text
        });
      });

    // ── Exclude Folders ──
    containerEl.createEl('h3', { text: 'Exclude folders' });
    containerEl.createEl('p', {
      text: 'Turn on folders you want to hide from the list.',
      cls: 'setting-item-description'
    });

    const folderGrid = containerEl.createDiv({ cls: 'fct-folder-grid' });
    const rootFolder = this.app.vault.getRoot();

    if (rootFolder && rootFolder.children) {
      const folders = rootFolder.children
        .filter(child => child instanceof TFolder)
        .filter(child => !child.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const folder of folders) {
        const item = folderGrid.createDiv({ cls: 'fct-folder-item' });
        const checkbox = item.createEl('input', { type: 'checkbox' });
        checkbox.checked = !!this.plugin.settings.excludedFolders[folder.name];
        checkbox.addEventListener('change', async () => {
          this.plugin.settings.excludedFolders[folder.name] = checkbox.checked;
          await this.plugin.saveSettings();
        });
        item.createEl('label', { text: folder.name });
      }
    }

    // ── Exclude File Types ──
    containerEl.createEl('h3', { text: 'Exclude file types' });
    containerEl.createEl('p', {
      text: 'Turn on file types you want to hide from the list.',
      cls: 'setting-item-description'
    });

    const extGrid = containerEl.createDiv({ cls: 'fct-ext-grid' });

    for (const [ext, label] of Object.entries(EXTENSION_LABELS)) {
      const item = extGrid.createDiv({ cls: 'fct-ext-item' });
      const checkbox = item.createEl('input', { type: 'checkbox' });
      checkbox.checked = !!this.plugin.settings.excludedExtensions[ext];
      checkbox.addEventListener('change', async () => {
        this.plugin.settings.excludedExtensions[ext] = checkbox.checked;
        await this.plugin.saveSettings();
      });
      item.createEl('label', { text: `${label} (.${ext})` });
    }
  }
}

// ─── Main Plugin ─────────────────────────────────────────────────────────────

class FileCreationTrackerPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE, (leaf) => new FileCreationTrackerView(leaf, this));

    this.addSettingTab(new FileCreationTrackerSettingTab(this.app, this));

    // Ribbon icon to open/toggle the view
    this.addRibbonIcon('clock', VIEW_DISPLAY, () => {
      this.activateView();
    });

    // Command to open the view
    this.addCommand({
      id: 'open-file-creation-tracker',
      name: 'Open File Creation Tracker',
      callback: () => this.activateView()
    });

    // Auto-open on startup if the view was previously open
    this.app.workspace.onLayoutReady(() => {
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
      if (leaves.length > 0) {
        leaves[0].view.refresh();
      }
    });
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    // Merge nested objects
    this.settings.excludedFolders = Object.assign(
      {}, DEFAULT_SETTINGS.excludedFolders, loaded?.excludedFolders || {}
    );
    this.settings.excludedExtensions = Object.assign(
      {}, DEFAULT_SETTINGS.excludedExtensions, loaded?.excludedExtensions || {}
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Refresh the view if it's open
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    for (const leaf of leaves) {
      if (leaf.view && leaf.view.refresh) {
        leaf.view.refresh();
      }
    }
  }

  onunload() {}
}

module.exports = FileCreationTrackerPlugin;
