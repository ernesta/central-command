# Control Center — Phase 1 Build Brief

> **For Claude Code.** Read this whole document before writing any code. Start in
> plan mode, propose a concrete implementation plan (folder structure, libraries,
> order of work), and wait for the user's approval. Then build phase by phase
> (section 12), stopping at each checkpoint so the user can run and test the app
> before you continue.

---

## 0. Context and vision

The user is a PhD student building a personal "control center": a local desktop app
that brings their research, consulting and personal life into one beautiful,
highly customisable place, with Claude at its centre (both automating things and
answering ad hoc questions). It replaces a mix of Notion, ClickUp and Obsidian,
which failed mainly on visual customisability and data flexibility.

Long-term, the app will grow to include: a global dashboard (tasks, calendar,
weather, unread email count), Meetings, Studies, Thesis, Training logs, Ideas,
a daily news tab, a research digest (new papers, posts), a focus/writing space,
and eventually Life and Consulting workspaces built from the same primitives. It
may one day be released publicly as an app.

**Phase 1 is deliberately small**: the app shell plus one real feature — Readings,
synced one-way from Zotero, with a notes editor. It exists to prove the approach
and to set up foundations that every later feature builds on. Get the foundations
right; keep the features small.

---

## 1. Guiding principles

1. **Quality over speed.** The user is not in a hurry. Prefer correct, tested,
   well-structured code over fast delivery.
2. **Beautiful and user-friendly.** Visual polish matters as much as function.
   Follow section 9 exactly.
3. **Local-first, user owns the data.** Everything lives on the user's machine in
   open formats (SQLite, Markdown files). Nothing is sent anywhere.
4. **Extensible by modules.** Each feature (Readings now; Meetings, Books, etc.
   later) is a self-contained module registered with the shell. Adding a feature
   should mean adding a module, not rewiring the app (section 3).
5. **Never lose user data.** Sync never deletes or overwrites anything the user
   wrote. Parse failures leave existing data untouched.
6. **Release-ready habits from day one**: no hardcoded personal paths (use
   Electron's `app.getPath('home')` etc.), all user-specific values in settings,
   no secrets in the repo, fonts bundled locally (the app must work offline).
7. **Don't over-abstract.** Build Readings concretely. Shape it so a second
   similar module (e.g. Books) can copy the pattern — but don't build a generic
   framework for a case that doesn't exist yet.

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Desktop shell | **Electron** (latest stable) | Secure defaults: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; all Node/file/DB access via a preload script exposing a narrow, typed IPC API |
| Language | **TypeScript** throughout | |
| Renderer | **React** + Vite (e.g. electron-vite) | |
| Styling | Plain CSS with CSS custom properties (design tokens), CSS Modules or equivalent | No Tailwind/UI kits — the look is bespoke |
| Database | **SQLite** via `better-sqlite3` in the main process | Use `electron-rebuild`/electron-builder's native rebuild; this is the most likely setup snag, handle it early |
| Migrations | Simple numbered SQL migration files, applied on startup | Every schema change is a migration from day one |
| BibTeX parsing | `@retorquere/bibtex-parser` (by the Better BibTeX author) | Handles LaTeX escapes, braces, name parsing |
| File watching | `chokidar` | |
| Markdown editor | **Milkdown** (ProseMirror-based, markdown-native, Typora-style live rendering) | Alternative if Milkdown proves problematic: TipTap with markdown serialisation. Must round-trip clean Markdown |
| Fonts | `@fontsource` packages (Newsreader, IBM Plex Sans, IBM Plex Mono), bundled | No runtime Google Fonts requests |
| Tests | **Vitest** | Unit tests for parsing, citation generation, sync; see section 11 |
| Lint/format | ESLint + Prettier | |
| Packaging (later) | electron-builder | Structure the project so this is easy later; don't package in Phase 1 |

If you believe a different choice is clearly better for any row, propose it in
your plan with a one-line reason, and let the user decide.

---

## 3. Architecture and project structure

Suggested layout (adapt as sensible, but keep the module concept):

```
/
├── CLAUDE.md                # conventions + how to run/test (you create and maintain this)
├── docs/
│   ├── ROADMAP.md           # future phases (section 13), kept up to date
│   └── DECISIONS.md         # short log of notable technical decisions and why
├── src/
│   ├── main/                # Electron main process
│   │   ├── db/              # connection, migrations runner, migrations/*.sql
│   │   ├── ipc/             # IPC handlers (thin; delegate to modules)
│   │   └── settings.ts      # settings load/save (JSON in the app data folder)
│   ├── preload/             # typed bridge exposing a minimal API to the renderer
│   ├── renderer/
│   │   ├── shell/           # top bar, workspace switcher, routing, Ask launcher
│   │   ├── theme/           # tokens.css, typography, base styles, icons
│   │   └── components/      # shared UI (Button, Pill, Select, Table, Board, Card, EmptyState)
│   └── modules/
│       └── readings/        # everything for Readings: schema, sync, parsing, IPC, UI
│           ├── main/        # sync service, bib parsing, citation formatter, repository
│           ├── renderer/    # Readings list page, detail page, board, table
│           └── index.ts     # module manifest (see below)
└── tests/
    └── fixtures/            # sample .bib files covering edge cases
```

### Module manifest (the extensibility mechanism)

Each module exports a small manifest the shell reads, for example:

```ts
{
  id: 'readings',
  workspace: 'research',        // 'life' | 'research' | 'consulting'
  label: 'Readings',
  routes: [...],                // list page, detail page
  landingCard: ReadingsCard,    // what appears on the workspace landing page
  migrations: [...],            // module-owned SQL migrations
}
```

The shell builds navigation and landing pages from registered modules. "Coming
soon" placeholders (section 5) are simply modules declared with `status: 'planned'`
and no routes. A future **Books** module should be implementable by copying the
Readings module folder and changing the parser/source and citation format.

---

## 4. Data locations and settings

App data folder: `~/ControlCenter/` (resolved via `app.getPath('home')`, never
hardcoded):

```
~/ControlCenter/
├── data/
│   ├── control-center.sqlite
│   └── zotero-export.bib        # default target for Better BibTeX auto-export
├── notes/
│   └── readings/
│       └── <citekey>.md         # one Markdown file per reading's notes
└── settings.json
```

**Why notes are Markdown files, not a DB column:** the user values Markdown and
plans to automate heavily with Claude Code. Plain `.md` files stay readable and
editable by other tools and by Claude Code directly, and survive independently of
the app. The database stores metadata only; it may cache a `has_notes` flag and a
plain-text excerpt for search.

Rules for note files:
- Created lazily (only when the user first types something).
- Filename = citekey, sanitised for the filesystem. If a citekey changes in Zotero,
  the old file is kept and the reading is flagged (see 6.5) — never auto-rename or
  delete.
- Autosave with debounce (~500 ms after typing stops) plus save on blur/close.
  Write atomically (write temp file, then rename).
- If the file is changed externally while the app is open (e.g. by Claude Code),
  reload it when the editor isn't dirty; if it is dirty, show a small non-blocking
  notice and let the user choose.

**Settings** (`settings.json`, editable in a minimal Settings screen reachable from
the top bar via a small gear icon button):
- Zotero export path (default `~/ControlCenter/data/zotero-export.bib`)
- Project/repo path (used by the Build button)
- Nothing else for Phase 1.

Include short setup instructions in the README for pointing Better BibTeX's
"Keep updated" auto-export at the configured path (Zotero → right-click library →
Export → Better BibTeX → tick "Keep updated").

---

## 5. App shell

### Top bar
- Height 64px, surface white, 1px bottom border (soft), horizontal padding 32px.
- **Left:** three workspace pills — **Life · Research · Consulting**. One active at a
  time. Pill: padding 8px 16px, fully rounded, 14px text. Inactive: secondary text,
  no background. Active: selected-tint background, selected-tint text, weight 600.
  Remember the last active workspace between launches.
- **Right:** a **Build** button and a gear (Settings) icon button. Build is visually
  distinct from the pills: 1px strong border, radius 8px, padding 8px 16px, a small
  terminal stroke icon (14px) before the label.

### Workspaces
- **Research**: has a real landing page (section 7).
- **Life** and **Consulting**: a centred empty state — heading "Nothing here yet"
  (display font, 28px) and a muted line "This is where Life will live." (or
  Consulting). No further content.

### Build button
Opens a full Claude Code session in the project repo. Phase 1 implementation:
launch the OS's terminal at the configured repo path running `claude` (macOS:
Terminal via `open`/AppleScript; handle Windows/Linux with sensible equivalents or
a clear message). An embedded terminal (xterm.js + node-pty) is a possible later
upgrade — do not build it now.

### Ask launcher
- A pill fixed 24px from the bottom-right corner: accent background, white text,
  chat-bubble stroke icon + "Ask", padding 12px 20px, fully rounded, soft shadow.
- Click expands it in place into a chat panel anchored bottom-right (~380px wide,
  ~520px tall, radius 14px, white surface, border + shadow): header ("Claude" with a
  small accent dot, and a collapse button), scrollable message list, input at the
  bottom.
- Collapsing returns to the pill. **Conversation and input state persist** across
  collapse/expand and across workspace switches (in memory is fine for Phase 1).
- Not a sidebar, not a modal: the rest of the app stays fully usable while it's open.
- Phase 1: **no model wired in.** Sending a message appends it and shows a
  placeholder reply ("Claude isn't connected yet"). Structure the code so a real
  backend (likely via Claude Code / the Claude Agent SDK) can be plugged in behind
  a single interface later.
- Keyboard: Esc collapses the panel when focused; a shortcut (e.g. Cmd/Ctrl+J)
  toggles it.

---

## 6. Readings module — data and sync

### 6.1 Table `readings`

| Column | Type | Behaviour |
|---|---|---|
| `id` | integer PK | |
| `citekey` | text, unique, not null | Better BibTeX citekey; the sync key |
| `short_citation` | text | Generated (6.3). Regenerated every sync. Never hand-edited |
| `full_title` | text | From Zotero. Always shown separately from short_citation |
| `authors` | text (JSON array) | Parsed names: `{ family, given }` for people, `{ literal }` for institutions |
| `year` | integer, nullable | From `year`, or the year part of `date` (BibLaTeX) |
| `status` | text: `read` \| `to_read` \| `unset` | From keywords (6.4) |
| `tags` | text (JSON array) | All other keywords (6.4) |
| `abstract` | text, nullable | From the entry's `abstract` field; overwritten each sync |
| `entry_type` | text | e.g. article, book, report — stored for future use |
| `missing_from_source` | integer (0/1) | Set when the citekey disappears from the .bib (6.5) |
| `has_notes` | integer (0/1) | Cache: whether a notes file exists and is non-empty |
| `notes_excerpt` | text | Cache: first ~300 plain-text chars of notes, for search |
| `added_at` | text (ISO timestamp) | Set on first insert |
| `updated_at` | text (ISO timestamp) | Set when synced fields change |

Also a small `sync_runs` table: `started_at`, `finished_at`, `status`
(`ok`/`error`), `entries_seen`, `inserted`, `updated`, `flagged_missing`,
`error_message`. Used for the sync status indicator and debugging.

### 6.2 Parsing rules
- Use `@retorquere/bibtex-parser`; convert LaTeX escapes and strip protective
  braces in titles (`{COVID}-19` → `COVID-19`).
- Support both Better BibTeX and Better BibLaTeX exports.
- Institutional authors are exported in double braces (`{{World Bank}}`): treat as a
  single literal name, never split into given/family.
- `keywords` is comma-separated; trim whitespace; ignore empty values; de-duplicate
  case-insensitively.

### 6.3 Short citation format (APA in-text style)
- 1 author: `Surname (Year)` → `Vaswani (2017)`
- 2 authors: `Surname1 & Surname2 (Year)` → `Smith & Lee (2023)`
- 3+ authors: `Surname1 et al. (Year)` → `Vaswani et al. (2017)`
- Institutional author: the whole name → `World Bank (2021)`
- No year: `(n.d.)`. No authors: use the editor(s) if present, otherwise the first
  few words of the title.
- Must have thorough unit tests (section 11).

### 6.4 Status and tags from Zotero keywords
- Keyword `read` → status `read`; keyword `to-read` → status `to_read`
  (case-insensitive; also accept `to read` and `toread`).
- Both present → `read` wins. Neither → `unset`.
- Every other keyword becomes a tag. The status keywords are never shown as tags.

### 6.5 Sync behaviour
- **Triggers:** on app start; on file change (chokidar watching the configured
  path); and a manual "Sync now" button.
- **Debounce and stability:** Better BibTeX may write the file in pieces. Wait until
  the file is stable (e.g. chokidar `awaitWriteFinish`, ~1s) before parsing.
- **Atomic:** parse the whole file first; only if parsing succeeds, apply all
  changes in a single SQLite transaction. If parsing fails, change nothing, record
  an error in `sync_runs`, and surface it in the UI.
- **Matching by citekey:**
  - New citekey → insert.
  - Existing citekey → update synced fields (`full_title`, `authors`, `year`,
    `short_citation`, `status`, `tags`, `abstract`, `entry_type`); bump
    `updated_at` only if something actually changed; clear
    `missing_from_source` if it was set.
  - Citekey in DB but not in file → set `missing_from_source = 1`. **Never delete
    the row or its notes file.**
- **One-way only.** The app never writes to the .bib file or to Zotero.
- **Idempotent:** running sync twice on the same file produces no changes the
  second time.
- File missing entirely (e.g. path not set up yet): no error spam — the UI shows
  the setup state (section 7).

---

## 7. Research landing page

- Page padding 48px 64px. Heading "Research" (display font, 32px, 700), 32px below.
- **Readings card** (the one live module): max-width 600px, white surface, 1px
  accent border, radius 14px, padding 28px 32px. Card title "Readings" (display
  font, 20px, 600). Below it, a muted 14px line:
  - Before any successful sync: "Not connected to Zotero yet" and an accent button
    "Set up Zotero sync" that opens Settings.
  - After syncing: live counts, e.g. "142 readings · 37 to read", and a subtle "Last
    synced 2 min ago".
  - Clicking the card (anywhere except the button) opens the Readings page.
- **"Coming soon" row** 36px below: an 11px uppercase label with 0.08em letter
  spacing in muted text, then four equal cards in a row (gap 16px) — Meetings,
  Studies, Training, Ideas — each with a 1px **dashed** strong border, radius 12px,
  padding 20px, 15px semibold secondary text, 60% opacity, not clickable. These are
  generated from `planned` module manifests.

---

## 8. Readings pages

### 8.1 Readings list page
- **Header** (padding 40px 48px 0): heading "Readings" (display font, 28px, 700) on
  the left; controls on the right, gap 10px:
  - Search input (~160px, grows on focus to ~240px) — searches short citation,
    full title, tags and notes excerpt.
  - Status filter select: All statuses / Read / To Read / Unset.
  - Tag filter (multi-select, can be simple for Phase 1).
  - Sort select: Year (newest), Year (oldest), Author A–Z, Recently added,
    Recently updated.
  - Segmented Table / Board toggle (1px strong border, radius 8px; active segment
    uses the selected tint).
  - "Sync now" small secondary button with a sync-status dot (ok / syncing / error;
    error shows the message on hover/click).
- A dismissible notice above the table if any readings are `missing_from_source`,
  with a filter shortcut to show them.
- Filter, sort, view and search state persist between visits.

### 8.2 Table view
- Padding 24px 48px 40px. Columns: **Citation | Title | Year | Status | Tags**
  (proportions roughly 1.4 / 2.4 / 0.6 / 0.9 / 1.6).
- Header row: 11px uppercase, 0.06em letter spacing, muted text, 1px soft bottom
  border. Clicking a header sorts by that column.
- Rows: padding 16px 12px, 14px text, 1px very soft bottom border, hover tint.
  Citation in ink, weight 600; title in secondary text; year and tags muted. A small
  notes icon after the citation when `has_notes`. Missing-from-Zotero rows show a
  small muted "Not in Zotero" label.
- Whole row is clickable → detail page. Keyboard: arrow keys move, Enter opens.
- Must stay smooth with ~2,000 rows (virtualise if needed).

### 8.3 Board view
- Columns grouped by status: **To Read · Read** (and **Unset** only if non-empty).
- Column header with count. Cards: white surface, soft border, radius 12px,
  padding 16px: short citation (600), full title (secondary, 2-line clamp), tags
  (muted, small).
- No drag-and-drop in Phase 1 — status is owned by Zotero.

### 8.4 Status pills
- Read: selected-tint background, selected-tint text, 12px, weight 600, padding
  4px 10px, fully rounded.
- To Read: transparent, 1px strong border, muted text, same sizing.
- Unset: muted "—".

### 8.5 Reading detail page (with the notes editor)
- Padding 36px 64px 40px; content column max-width ~760px for comfortable reading.
- "← Readings" back link (13px, muted), 20px below. Browser-style back (Cmd/Ctrl+[
  or mouse back) also works.
- **Synced header (read-only):**
  - Citekey: IBM Plex Mono, 12px, muted, with a small copy-to-clipboard button.
  - Full title: display font, 30px, 700.
  - Meta row (gap 14px): short citation (14px, secondary), status pill, tags (13px,
    muted).
  - If `missing_from_source`: a calm notice "This item is no longer in your Zotero
    export. Your notes are safe."
- **Abstract block** (only if present): white surface, soft border, radius 12px,
  padding 18px 22px. Label "Abstract — synced from Zotero" (11px uppercase, muted),
  then abstract text 14px, line-height 1.7, secondary text. Collapsible if long.
- **Notes** label (11px uppercase, muted), then the **live-render Markdown editor**:
  - Typora-style: typing `## ` becomes a heading, `**x**` becomes bold, `- ` becomes
    a list, etc., rendered in place with no separate preview.
  - Body 16px, line-height 1.8, ink; headings in the display font.
  - Supports: headings, bold, italic, lists, checkboxes, links, blockquotes, inline
    code, code blocks, tables if the editor supports them cleanly.
  - Empty state placeholder: "Start writing your notes…"
  - Saves to `~/ControlCenter/notes/readings/<citekey>.md` per section 4; a subtle
    "Saved" indicator near the Notes label.
- This page is the only place in Phase 1 where the user types content.

---

## 9. Visual design system (final)

Implement as CSS custom properties in `src/renderer/theme/tokens.css`. All
components use tokens, never raw hex values, so themes (including a future dark
mode) are a token swap.

### Colours — "Cool Slate"

| Token | Value | Use |
|---|---|---|
| `--bg` | `#EDEFF2` | Page background |
| `--panel` | `#E1E5EA` | Secondary panels |
| `--surface` | `#FFFFFF` | Cards, top bar, inputs |
| `--ink` | `#1B222B` | Primary text |
| `--text-secondary` | `#3A4652` | Secondary text |
| `--text-muted` | `#5C6672` | Labels, meta |
| `--border-soft` | `#D3D8DE` | Default borders, dividers |
| `--border-strong` | `#C3CAD2` | Inputs, outlined buttons, dashed placeholders |
| `--accent` | `#35577A` | Primary buttons, Ask pill, focus rings, key links |
| `--accent-contrast` | `#FFFFFF` | Text on accent |
| `--selected-bg` | `#DCE6EE` | Active pill/segment, Read pill |
| `--selected-text` | `#1F3A52` | Text on selected background |
| `--danger` | choose a muted red that fits the palette | Sync errors only |

### Typography

| Role | Font | Weights |
|---|---|---|
| Display / headings | **Newsreader** (serif) | 700 (600 for small headings) |
| Body / UI | **IBM Plex Sans** | 400, 500, 600 |
| Monospace | **IBM Plex Mono** | 400 |

Fallback stacks: Newsreader → Georgia, serif; IBM Plex Sans → system-ui,
sans-serif; IBM Plex Mono → ui-monospace, monospace.

Type scale used above: 11 (labels) · 12 · 13 · 14 (UI default) · 15 · 16 (reading
text) · 20 · 28 · 30 · 32.

### Style rules
- Calm, cool, focused, generous whitespace. Radii 8px (controls), 12px (cards),
  14px (feature cards/panels), fully rounded for pills.
- Shadows only for floating elements (Ask pill/panel, dropdowns): soft, e.g.
  `0 8px 24px rgba(27, 34, 43, 0.18)`.
- No gradients, no coloured left-border cards, no emoji as icons. Use a consistent
  stroke icon set (e.g. Lucide) at 14–18px.
- Real `<button>`, `<input>`, `<select>`, `<a>` elements; visible focus rings
  (accent); full keyboard navigation; text contrast ≥ 4.5:1.
- Subtle transitions (120–200ms) on hover, expand/collapse and view switches;
  respect `prefers-reduced-motion`.
- Custom window chrome is optional; if you use a frameless/hidden-title-bar window
  on macOS, keep the traffic lights inset within the 64px top bar.

Design mockups were made for the user during planning (layout reference only; they
use an older palette). The measurements in this brief are taken from them and are
authoritative.

---

## 10. Repo, Git and documentation
- Work in the user's existing GitHub repo. Ask for its path/URL if not obvious.
- Small, meaningful commits with clear messages; push at the end of each phase.
- `.gitignore`: `node_modules`, build output, and anything user-specific. User data
  lives in `~/ControlCenter/`, never in the repo.
- Create and maintain:
  - `README.md` — what it is, how to install, run, test, and set up the Zotero
    auto-export.
  - `CLAUDE.md` — project conventions, architecture summary, module pattern,
    commands, and "things to never do" (e.g. never write to the .bib file, never
    delete notes).
  - `docs/ROADMAP.md` — section 13, updated as phases complete.
  - `docs/DECISIONS.md` — one short entry per notable decision.
- Choose a sensible placeholder app name ("Control Center") that's easy to change
  in one place.

---

## 11. Testing and quality bar
- **Unit tests (required):** short-citation generation (all cases in 6.3, including
  institutional authors, missing year, missing authors, LaTeX-escaped names);
  keyword → status/tags mapping (6.4); BibTeX parsing on fixtures.
- **Fixtures:** a realistic `.bib` covering: 1/2/3+ authors, institutional author,
  LaTeX accents, braced title words, missing year, BibLaTeX `date`, abstract with
  special characters, both status keywords, no status keyword, duplicate keywords.
- **Sync tests:** insert, update, idempotent re-run, missing-from-source flagging
  and un-flagging, parse failure leaves DB unchanged.
- **Notes tests:** save/load round-trip preserves Markdown; external change detection.
- All tests and lint pass before each checkpoint. TypeScript strict mode.
- Manually run the app at each checkpoint and fix anything that looks off against
  section 9 before handing over.

---

## 12. Build order and checkpoints

Stop at each checkpoint, summarise what was built, tell the user exactly how to
run it and what to check, and wait for their go-ahead.

1. **Foundations** — Electron + React + TypeScript scaffold, secure preload/IPC,
   SQLite with migrations, settings file, bundled fonts, tokens.css, base
   components, CLAUDE.md/README/docs.
   *Checkpoint A: app launches with the correct fonts and colours; empty window
   with top bar.*
2. **Shell** — workspace pills (with persistence), empty states for Life and
   Consulting, Settings screen, Build button, Ask launcher (expand/collapse,
   persistent state, placeholder replies), module manifest system with planned
   modules.
   *Checkpoint B: user can click around the whole shell.*
3. **Readings data + sync** — schema, parser, citation formatter, keyword mapping,
   sync service (watcher, manual sync, atomic transactions, missing flagging),
   `sync_runs`, full tests.
   *Checkpoint C: user points Better BibTeX at the export path; a sync summary is
   shown (counts); tests pass.*
4. **Readings UI** — list page (table + board, search, filters, sort, sync status),
   Research landing page with live counts.
   *Checkpoint D: user browses their real library.*
5. **Reading detail + notes editor** — detail page, abstract block, Milkdown
   editor, Markdown file storage, autosave, external change handling.
   *Checkpoint E: user writes notes, closes and reopens the app, notes persist as
   `.md` files.*
6. **Polish pass** — visual QA against section 9, keyboard navigation, empty and
   error states, performance with a large library, final docs update, push.

---

## 13. Out of scope for Phase 1 (record in docs/ROADMAP.md)

Planned later, roughly in this order — do **not** build now, but don't make
choices that block them:
- Real Claude wiring for the Ask panel; embedded terminal for Build.
- Shared **task engine** (task, owner, start/end dates, additive time tracking,
  lists and sub-lists, tags, subtasks, 3+ states, table/board/calendar views,
  filtering, field visibility) — plus one-time import of historical ClickUp tasks.
- **Meetings** (informal notes + formal Meeting Log, "before next meeting"
  checklist).
- **Studies**, **Thesis**, **Training** (informal notes + formal log with PDF
  export, attachments), **Ideas** (status-based, later kanban), **Data Sources**,
  **Inbox**.
- Global **dashboard** (priorities, calendar, time/location/weather, unread email
  count).
- **World** news tab, **Research Digest** (papers, posts, alerts), **Focus/Writing**
  space.
- **Life** and **Consulting** workspaces.
- **Books** module (following the Readings pattern).
- Theme switching / dark mode, packaging and public release.
