# Hanzi Learning

A Chinese vocabulary and stroke-practice site with a green Mozilla Text interface, automatic light/dark themes, and a protected curriculum editor. Existing textbook data and learning routes are preserved.

## Run locally

The companion SwiftUI iPhone/iPad app lives in [`ios/`](ios/README.md). Open `ios/HanziLearning.xcodeproj` in Xcode to run it on a simulator or signed device.

Requires Node.js 24 or newer. No package installation or build step is needed.

```sh
npm start
```

Open http://localhost:3000. The local **test PIN is `1234`**. Use the Admin link in the footer. An `ADMIN_PIN` environment variable overrides the development default. Node does not automatically read `.env`; use `node --env-file=.env server/index.js` if desired.

## Docker

```sh
cp .env.example .env
docker compose up --build -d
```

Open http://localhost:3000. Compose uses the test PIN `1234` unless `ADMIN_PIN` is set in `.env`. Configure a different four-digit PIN before exposing the admin interface publicly.

For an HTTPS reverse proxy, set `COOKIE_SECURE=true` and `PUBLIC_ORIGIN=https://your-domain.example`. Forward requests to port 3000, preserve the Host header, and use one app instance. The app ignores forwarded client IPs; cooldown protection applies globally so changing addresses or browsers cannot bypass it.

The container runs as an unprivileged user with a read-only root filesystem. The named `hanzi-data` volume holds textbooks, the previous saved revision of each textbook (`.bak`), and authentication cooldown state. Keep this volume when recreating the container. `docker compose down` retains it; do not use `down -v` if you want to retain data and cooldowns. Back up the volume for disaster recovery.

## Admin workspace

- **Overview:** totals for units, chapters, sections, and vocabulary; textbook shortcuts and session status.
- **Textbook editor:** edit either textbook, add/remove units, chapters, sections, and vocabulary. Example sentences and translations are preserved.
- **Import JSON:** validates the existing `{ "units": [...] }` format and replaces only the current draft until Save changes is selected.
- **Export draft:** downloads the current draft, including unsaved edits.
- **Save changes:** validates content, prevents overwriting a newer revision from another session, keeps one previous revision, and atomically updates the persistent textbook. Learners see changes on their next page load.
- **Lock & sign out:** invalidates the current session immediately.

The protected editor lives at `/admin/editor`. Old `maker.html` and `testmaker.html` bookmarks redirect to it. Serve the app through the included server, not a static file server: server-side authentication is required to protect admin routes.

## PIN protection

The numeric keypad, PIN dots, auto-submit, shake feedback, and escalating lockout flow were adapted from the local `First-Comment-Bot` project (`public/index.html`, `public/js/main.js`, `public/css/style.css`, and `src/index.ts`). Reset/setup/OTP endpoints and reset controls are deliberately absent.

Protection was strengthened for this app:

- Five incorrect attempts cause a five-minute cooldown; later batches of five double the cooldown up to one hour. Wrong attempts are counted globally and synchronously persisted. Active cooldowns reject even a correct PIN.
- Cooldowns survive reloads, cookie deletion, different clients, and server restarts. Do not delete or replace the persisted security state.
- PINs are checked server-side using a salted scrypt hash and timing-safe comparison. The PIN/hash is never sent to the client or used as a cookie.
- Random session tokens are stored hashed in server memory, expire after one hour, and are invalidated by logout or a server restart. Cookies use HttpOnly, SameSite=Strict, and optionally Secure.
- Admin HTML, JavaScript, schema, and APIs are protected. Writes require a session CSRF token, JSON content type, and same-origin requests. Static serving uses a file allowlist; source code, environment files, and runtime data are not exposed.
- Production mode requires an explicit four-digit `ADMIN_PIN`. There is no PIN reset or change operation in the UI/API; deployment configuration is managed by the server operator.

This is intentionally a single-instance application. Global throttling means repeated guesses can temporarily block all new admin logins; existing signed-in sessions keep working.

## Checks

```sh
npm test
npm run check
```

Tests cover authentication, persistent escalating cooldowns, direct admin URL protection, session expiry/logout, origin and CSRF checks, protected textbook saves, validation, and stale-edit conflicts. The check script validates JavaScript syntax, local HTML assets, and bundled curriculum data.

## Fonts and resources

Mozilla Text is the sans-serif typeface in [Mozilla's typography system](https://protocol.mozilla.org/docs/fundamentals/typography), bundled locally under the SIL Open Font License. See `public/assets/fonts/OFL.txt` and [Mozilla Text](https://github.com/mozilla/mozilla-text-type).

Hanzi Writer and character stroke data load from jsDelivr, so handwriting practice needs an internet connection. Vocabulary browsing, editor access, and fonts are served locally. The optional feedback form is hosted by Google.

## Practice scores

Completed lessons and quizzes save automatically to browser localStorage (the latest 200 sessions). A completed word earns 100 points without mistakes or 50 points with corrections; skipped words earn 0. The session percentage is earned points divided by possible points. Guided learning, single-word practice, section quizzes, and pop quizzes are labeled separately.

Open **My progress** from the home page, footer, or results screen. Export JSON or spreadsheet-ready CSV, or clear the local history. Scores are local to a browser profile and site origin; they do not sync across devices. If storage is unavailable or full, results explain the problem and still offer a session export. Incomplete sessions are not saved.

Writing practice uses one large pad at a time, including multi-character words. Google Material Symbols are bundled locally under the license in `public/assets/fonts/Material-Symbols-LICENSE.txt`.

## Page folders and clean URLs

The server serves each page's `index.html` at its clean URL. The HTML references the `style.css` and `script.js` in that same page folder using absolute URL paths, so `/textbook/1` works without a trailing slash or `index.html` in the address bar.

```text
public/
  index.html, style.css, script.js          # /
  textbook/
    1/index.html, style.css, script.js      # /textbook/1
    2/index.html, style.css, script.js      # /textbook/2
  learn/index.html, style.css, script.js    # /learn
  practice/index.html, style.css, script.js # /practice
  quiz/
    index.html, style.css, script.js        # /quiz
    session/index.html, style.css, script.js # /quiz/session
  login/index.html, style.css, script.js    # /login
  admin/
    index.html, style.css, script.js        # /admin
    editor/index.html, style.css, script.js # /admin/editor
    shared/                                # Protected session/schema helpers
  progress/index.html, style.css, script.js # /progress
  feedback/index.html, style.css, script.js # /feedback
  about/index.html, style.css, script.js    # /about
  shared/                                  # Common UI, styles, quiz and score logic
  assets/                                  # Local fonts and icons
server/                                    # HTTP routes, authentication, saves
data/                                      # Seed textbooks; runtime edits use DATA_DIR
```

Page-specific CSS lives with the page. Reusable styles, textbook rendering, stroke practice, and browser score storage live in `public/shared/` to avoid duplicating them. HTML contains no inline styles or scripts. The old unused monolithic `app.js` has been removed.

Routes are defined in `server/routes.js`. Existing `.html` bookmarks, explicit `index.html` paths, and trailing-slash page URLs redirect to their canonical clean URL while preserving query parameters. Admin pages and their assets remain authenticated before serving or redirecting. Unknown routes return 404; only allowed regular files inside `public/` are served. Scores remain saved because the site origin and localStorage key have not changed.
