# ChannelTabs

A [Vencord](https://vencord.dev) userplugin that adds **browser-style tabs** for channels and DMs, plus a **split view** — watch up to 4 channels live at once in a 2×2 grid.

- Every channel you open becomes its own tab (tabs reset each launch — no clutter).
- Right-click any channel/DM/thread → **Open in split view** or **Open in new tab**.
- Resize panes by dragging the dividers. Drag a channel in to dock it as a pane.

> **Heads up:** The *focused* pane is real, full Discord (working composer, right-click menus, uploads). The other panes are a live read/send mirror of their channel. Click a pane to focus it and make it the "real" one.

---

## Install

This is a **userplugin**, so it has to be built into Vencord from source. There's no one-file drop-in.

### 1. Set up a Vencord dev build (one time)

You need [Git](https://git-scm.com), [Node.js](https://nodejs.org) 18+, and [pnpm](https://pnpm.io/installation) (`npm i -g pnpm`).

```bash
git clone https://github.com/Vendicated/Vencord
cd Vencord
pnpm install
```

### 2. Add this plugin

From inside the `Vencord` folder:

```bash
# creates the userplugins folder if it doesn't exist
mkdir -p src/userplugins
git clone https://github.com/panther130555/ChannelTabs src/userplugins/ChannelTabs
```

### 3. Build and inject

```bash
pnpm build
pnpm inject
```

Pick your Discord install when prompted. Then **fully restart Discord** (quit from the tray/menu bar, not just close the window).

### 4. Enable it

Discord → **Settings → Vencord → Plugins** → turn on **ChannelTabs**.

---

## Updating

```bash
cd src/userplugins/ChannelTabs
git pull
cd ../../..
pnpm build && pnpm inject
```

Restart Discord.

## Uninstall

```bash
rm -rf src/userplugins/ChannelTabs
pnpm build && pnpm inject
```

---

## Notes / known limits

- **Tabs don't persist** between launches — this is intentional.
- Only the focused pane is native Discord; the rest are a custom mirror (they can read and send, but lack the full composer button row until focused).
- Built against current Vencord. If a Vencord update breaks it, open an issue.

## License

GPL-3.0-or-later. Built on Vencord (also GPL-3.0).
