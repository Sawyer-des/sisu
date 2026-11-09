# Sisu — Finnish vocabulary studio

Finnish–English vocabulary learning with 2,385 entries, 17 chapters, 58 topics and six study modes. Study setup always starts Finnish → English and includes the entire chosen collection, with optional smaller batches. Flashcards offer Still learning, Remembered and Skip; there are no timed reviews. Motion respects device reduced-motion preferences, and appearance can follow the device or use Light/Dark.

## User accounts
Create an account using only a username and password. No email or other profile details are collected. Usernames are case-insensitive, 3–32 characters, using letters, digits, dots, underscores and hyphens. Passwords are 15–128 characters. Keep the password safe: email-based recovery is not available.

Guest practice does not record progress, practice counts or learning history. Personal vocabulary, stars and account backups require sign-in. Each account has its own progress and vocabulary in the server database; signing in on another device loads that account. Signing out clears account data from the interface. Passwords and session tokens are never stored in browser localStorage. The only automatically stored browser preference is appearance.

Passwords are salted and hashed with scrypt (N=32768, r=8, p=3), using @noble/hashes. Sessions use random 256-bit opaque tokens; only their SHA-256 hashes are stored in the database. Production cookies are Secure, HttpOnly, SameSite=Strict and host-only. Authentication is rate limited. Mutating requests require same-origin Origin headers. State writes require both the authenticated account ID and a matching revision, preventing stale tabs or simultaneous devices from silently overwriting another save. If a save conflict occurs, download the unsaved backup, reload and selectively restore what you need.

## Run locally
Requires Node.js 24 or later.

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:8766. The preview uses a local SQLite database in `.local/sisu.sqlite`. It applies the initial schema only when the local database is new. `npm test` verifies authentication, account isolation, save revisions, CSRF protection, expiration and throttling. The local server deliberately uses a development cookie for loopback HTTP; production uses a Secure host-only cookie.

## Deploy
This is a full-stack Cloudflare Worker with a D1 database, not a GitHub Pages-only website. `npm run build` regenerates the static client and bundles the account API plus assets into `dist/server/index.js`. Bind a D1 database as `DB`, apply the SQL migrations in `drizzle/` before deployment, then deploy that Worker. A Sites deployment uses its existing private project configuration and applies migrations through the Sites workflow. The public GitHub export excludes that private hosting project configuration.

Original book PDFs, source Word uploads, real accounts, session tokens, local databases and browser backups are not included in this repository. Do not commit `.local`, `.env`, database exports or account data.

## Vocabulary and source notes
Book 1 has 1,273 entries and Book 2 has 1,112. Chapters, Topics and All words are views of the same entries. The 259 previously unplaced entries were reorganized with page searches in both scanned textbooks: 175 have located wording, 29 a related or inflected form, and 55 are placed by meaning without a claimed source page. The editor’s Source information and `categorization.csv` distinguish these. Original translations and the already-chaptered entries were not exhaustively verified word by word.

Use Manage & settings to add, edit, import or export vocabulary while signed in. Imports accept CSV with required `fi,en`, or JSON entries. Keep vocabulary IDs stable when editing the source. Progress keys combine Finnish, part of speech and meaning. Four consecutive successful recalls mark a word mastered; a miss resets recall progress. Matching counts as signed-in practice without raising mastery. Skipping never changes progress or counts.

## Existing device progress and backups
Earlier versions used the browser key `sisu-studio-v1`. That old data is not shown to guests or automatically attached to any account. After signing in, Manage & settings → Import previous device progress explicitly imports it into that account. Download a backup before replacing existing progress. Full backup import/export remains available while signed in.

## Source layout
- `dist/app.js`, `dist/styles.css`: editable client.
- `dist/data.js`, `vocabulary.json`: vocabulary and source structure.
- `index.template.html`, `scripts/release.cjs`: versioned static asset generation.
- `server/accounts.mjs`: authentication and per-user state API.
- `server/worker.mjs`, `scripts/build-worker.mjs`: deployable Worker and bundled assets.
- `drizzle/`: append-only database schema migrations.
- `tests/accounts.test.mjs`: server authentication and isolation checks.

`Sisu.html` is an offline guest-practice copy; accounts require the server-backed website. Account registration and data never work by publishing static files alone.
