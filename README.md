# File Creation Tracker

An Obsidian plugin that shows recently created files in a sidebar, sorted by date.

## Why I built this

I use VS Code and AI CLI tools (Claude Code, etc.) to create most of my documents. Obsidian is great for browsing and reviewing notes, but the built-in file explorer doesn't help much when I want to quickly find files I just created from outside Obsidian.

The existing "Recent Files" plugin only tracks files you've **opened inside Obsidian**. If you create a file in VS Code or through a terminal command, it won't show up. That was my daily frustration.

**File Creation Tracker** reads the actual filesystem creation date, so it catches every file regardless of where it was created.

## Features

- Shows recently created files in a sidebar view
- Works with files created **outside Obsidian** (VS Code, terminal, scripts, etc.)
- Sorts by file creation date, filename date pattern (YYYY-MM-DD), or modified date
- Groups files by date: Today, Yesterday, This Week, This Month, Older
- User-friendly settings - no regex, no code:
  - **Sort by**: dropdown selection
  - **Exclude folders**: checkbox list of your vault folders
  - **Exclude file types**: toggle for images, audio, code files, etc.
  - **Display count**: slider (10-100)
  - **Date range**: 7 days / 30 days / 90 days / 1 year / all
- Auto-refreshes when new files are created or deleted
- Click any file to open it directly

## Installation

### From Obsidian Community Plugins (coming soon)

1. Open Settings > Community Plugins > Browse
2. Search for "File Creation Tracker"
3. Install and enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/hyeji-simulacre/file-creation-tracker/releases/latest)
2. Create a folder: `your-vault/.obsidian/plugins/file-creation-tracker/`
3. Place the three files in that folder
4. Restart Obsidian and enable the plugin in Settings > Community Plugins

## Usage

After enabling, click the clock icon in the left ribbon or use the command palette: "Open File Creation Tracker".

## Who this is for

- People who create files outside Obsidian (VS Code, CLI tools, scripts)
- People who use Obsidian primarily for reading and reviewing, not writing
- Anyone who wants a quick chronological view of their vault activity

## Development

This plugin is plain JavaScript with no build step. Edit `main.js` directly.

With [Obsidian CLI](https://obsidian.md/cli) (v1.11.5+), you can streamline the dev workflow:

```bash
# Reload the plugin after editing
obsidian reload-plugin file-creation-tracker

# Open DevTools for debugging
obsidian devtools

# Inspect the sidebar DOM
obsidian eval "document.querySelector('.fct-container')?.innerHTML"
```

Enable CLI in: Settings > General > Command line interface.

## Note

This plugin was built with Claude Code (AI CLI). Desktop only - uses filesystem creation time which may not be available on mobile.

## Support

If you find this plugin useful:

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal)](https://paypal.me/HyejiJung350)
