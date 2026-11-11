# Sisu — Finnish vocabulary studio

Finnish–English vocabulary learning with 2,358 entries, 17 chapters, 58 topics and six study modes. Study setup always starts Finnish → English and includes the entire chosen collection, with optional smaller batches. Flashcards offer Still learning, Remembered and Skip; there are no timed reviews. Motion respects device reduced-motion preferences, and appearance can follow the device or use Light/Dark.

## Vocabulary editing permissions
Only the existing Sawyer account can add, edit, remove or import vocabulary. The API binds this permission to the immutable account ID, not to a browser flag or a typed username. Other users can practice, save progress, star words and restore their own progress backups, but backups cannot change their vocabulary. Existing vocabulary edits were personal to each account; this change does not publish edits globally.

## User accounts
Create an account using only a username and password. No email or other profile details are collected. Usernames are case-insensitive, 3–32 characters, using letters, digits, dots, underscores and hyphens. Passwords are 15–128 characters. Keep the password safe: email-based recovery is not available.

Guest practice does not record progress, practice counts or learning history. Personal vocabulary, stars and account backups require sign-in. Each account has its own progress and vocabulary in the server database; signing in on another device loads that account. Signing out clears account data from the interface. Passwords and session tokens are never stored in browser localStorage. Appearance is stored on the device. On GitHub Pages, the browser also remembers an opaque login token; progress remains in the shared database. Signing out removes that token.

Passwords are salted and hashed with scrypt (N=32768, r=8, p=3), using @noble/hashes. Sessions use random 256-bit opaque tokens; only their SHA-256 hashes are stored in the database. Production cookies are Secure, HttpOnly, SameSite=Strict and host-only. Authentication is rate limited. Mutating requests require same-origin Origin headers. State writes require both the authenticated account ID and a matching revision, preventing stale tabs or simultaneous devices from silently overwriting another save. If a save conflict occurs, download the unsaved backup, reload and selectively restore what you need.

## Run locally
Requires Node.js 24 or later.

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:8766. The preview uses a local SQLite database in `.local/sisu.sqlite`. It applies the initial schema only when the local database is new. `npm test` verifies authentication, account isolation, save revisions, CSRF protection, expiration and throttling. The local server deliberately uses a development cookie for loopback HTTP; production uses a Secure host-only cookie.

## GitHub Pages setup
The complete GitHub Pages website is in `docs/`. In repository Settings → Pages, select **Deploy from a branch**, branch **main**, folder **/docs**, then Save. The intended address is https://sawyer-des.github.io/sisu/. The frontend automatically connects to the existing Sisu account backend. No API key or service signup is needed. The backend must remain available to serve shared accounts; the app does not store account data in the GitHub repository.

The GitHub Pages frontend uses per-user bearer sessions because third-party cookies may be blocked. The API accepts browser requests from the exact Pages origin only, and account saves still require that user's session. Both site addresses use the same accounts and progress. `npm run build` refreshes `docs/` from current client sources for future uploads.

## Deploy
This is a full-stack Cloudflare Worker with a D1 database, not a GitHub Pages-only website. `npm run build` regenerates the static client and bundles the account API plus assets into `dist/server/index.js`. Bind a D1 database as `DB`, apply the SQL migrations in `drizzle/` before deployment, then deploy that Worker. A Sites deployment uses its existing private project configuration and applies migrations through the Sites workflow. The public GitHub export excludes that private hosting project configuration.

Original book PDFs, source Word uploads, real accounts, session tokens, local databases and browser backups are not included in this repository. Do not commit `.local`, `.env`, database exports or account data.

## Vocabulary and source notes
Book 1 has 1,253 entries and Book 2 has 1,105. Chapters, Topics and All words are views of the same entries. The 259 previously unplaced entries were reorganized with page searches in both scanned textbooks: 175 have located wording, 29 a related or inflected form, and 55 are placed by meaning without a claimed source page. The editor’s Source information and `categorization.csv` distinguish these. Original translations and the already-chaptered entries were not exhaustively verified word by word.

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

## Chapter duplicate cleanup and American English
The vocabulary now has one normalized Finnish headword per book/chapter. Twenty-six repeated headword groups were consolidated, removing 27 duplicate rows while retaining their meanings and parts of speech. Case variants such as suomi / Suomi are annotated in the meanings. Identical headwords in separate chapters/books remain separate source entries. The kuusi numeral was moved to SM1 Chapter 1 Numbers (printed page 15); the spruce meaning stays in SM2 Chapter 3 tree vocabulary (printed page 89). `vocabulary-audit.json` records the consolidations and source corrections.

Combined entries carry structured senses and a combined grammatical label. Typed English answers accept the original meanings without requiring grammatical labels. Old IDs and progress keys are retained as aliases: old progress is consulted conservatively without adding duplicate review counts, and a new review continues from that progress. Backups retain the original account records. The interface uses en-US and American English spelling/terms.

Sawyer can restore removed original vocabulary individually under Manage & settings → Removed words → Restore word. Restoring a word removes only its hidden ID (including old merged aliases); progress, history, stars and vocabulary edits are retained.

## Flashcard practice and browsing
Flashcards and Learn use fixed decks: each selected entry appears once, including when every answer is Still learning or incorrect. The session counter stays fixed. Missed cards can be selected for a new practice session after completion; cards are never inserted a few positions ahead.

In the Flashcards setup, select **Browse — no progress saved**. Choose Collection order or Shuffle, then use Previous/Next buttons or left/right arrow keys and flip with Space or a click. The deck includes the entire chosen collection by default. At the last card, Next is disabled and Previous still works; End browsing exits. No recall ratings, practice history or account-state saves occur from browsing. The Practice option retains Still learning, Remembered and Skip. Browse again at the end of a rated session opens genuine browse-only mode; earlier saved ratings remain saved.

## Stable study navigation
Within a study session, the sidebar, header, page content container and study region stay mounted. A keyed DOM update changes only the current study content and retains existing buttons/input nodes where applicable. New flashcard faces reset without rebuilding the page. Advancing cards, answer feedback, matching updates and summaries do not scroll to the page top. Focus uses preventScroll, and the study region preserves its occupied space so shorter questions do not collapse the viewport. Starting a new session or navigating to another section can still reset the page position intentionally.

Appearance and navigation: coordinated light/dark palettes, responsive layouts down to 320px, visible keyboard focus, account-aware home messaging, a home logo link, and account-menu links to progress and settings. Empty search results include recovery actions.

Unfinished signed-in sessions save automatically to the account, with synchronous per-account device recovery for interrupted saves. Overview and Practice list In progress sets. Reopening an active session restores its fixed deck, position, answers and matching board. Browse-only sessions save their place without changing recall progress. App update notices are dismissible and are deferred during active study.
