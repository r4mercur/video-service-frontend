# video-service-frontend

Angular client for a self-hosted video platform: browse and watch videos without an account,
upload and manage your own once you are logged in.

The Spring Boot backend lives in a separate repository:
[video-service](https://github.com/r4mercur/video-service).

---

## What it does

**Watching**

- Catalog page with category filters, sorting and cursor-based paging, plus a dedicated search page
  with numbered pages.
- Watch page with an HLS player: native playback on Safari and iOS, `hls.js` everywhere else, with
  quality selection, resume from the last position and a recommendation rail.
- Playback quality is measured in the browser and reported back in batches, so the backend can see
  what viewers actually experience even though media is served directly from object storage.
- Age-restricted categories are hidden behind an explicit, remembered opt-in.
- Any viewer can report a video, logged in or not.

**Uploading**

- Multi-step wizard: pick a file, fill in metadata and category, choose a thumbnail, watch the
  upload progress.
- Files are uploaded directly to object storage in parts using presigned URLs from the backend;
  progress, pause, resume and cancel are handled per part, and an interrupted session can be picked
  up again.
- After the upload the wizard follows the transcoding status until the video is ready.

**Managing**

- Studio page listing your own videos including private ones, with editing of title, description,
  category and visibility, a status dialog for videos still processing or failed, and deletion.
- Login and registration on one page; the access token is kept in memory only and refreshed
  transparently through the cookie-based refresh endpoint.
- Profile photo dialog with client-side type and size checks; wherever no photo is set, the shared
  avatar component falls back to initials.
- Admin area for reviewing reports and acting on them, behind a role guard.

---

## Tech stack

| Layer     | Choice                                                     |
| --------- | ---------------------------------------------------------- |
| Framework | Angular 22, standalone components, zoneless, signals-first |
| Language  | TypeScript 6 (`strict`, no `any`)                          |
| Styling   | SCSS with a hand-built design system — no UI framework     |
| Playback  | hls.js, native HLS on Safari/iOS                           |
| Testing   | Vitest + jsdom (unit), Playwright (E2E, Chromium + WebKit) |
| Tooling   | ESLint, Prettier, Husky + lint-staged                      |
| Runtime   | Node 24 LTS, npm 11 (both pinned)                          |

A few decisions that shape the code: no NgModules, no `zone.js`, no Angular Material or Tailwind.
State is held in signals, RxJS is used only where there are real streams such as upload progress.
All UI text is marked up for `$localize` even though only English is extracted today, and
formatting goes through `Intl` and Angular pipes rather than hand-rolled helpers. The code stays
SSR-compatible so that switching to Angular SSR later does not require a refactor.

---

## Getting started

**Prerequisites**

- Node 24.19+ and npm 11.17+ (see `.nvmrc` and `engines`)
- The backend running on `http://localhost:8080` with its Docker Compose stack up — the dev server
  proxies `/api` there and `/public` to the local media origin on port 80

```bash
npm ci
npm start          # http://localhost:4200
```

`npm ci` also regenerates `src/app/core/app-version.generated.ts`, which is how the UI shows the
released version (`dev` outside a tagged CI build).

**Common scripts**

| Command                | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `npm start`            | dev server with the API proxy                                 |
| `npm run build`        | production bundle into `dist/`                                |
| `npm test`             | unit tests in watch mode (`npm run test:ci` for a single run) |
| `npm run e2e`          | Playwright suite (`e2e:ui` for the interactive runner)        |
| `npm run lint`         | ESLint (`lint:fix` to apply fixes)                            |
| `npm run format`       | Prettier (`format:check` in CI)                               |
| `npm run generate:api` | regenerate API types from the running backend's OpenAPI doc   |

---

## Project structure

```
src/app/
  core/       singletons: auth, guards, HTTP interceptors, runtime config,
              storage, generated API types, watch progress, content preferences
  shared/     presentational components, dialogs and pipes
  features/
    catalog/  home page, category filters, search
    watch/    player page, recommendations, telemetry, reporting
    upload/   upload wizard, transport, session store
    studio/   own videos, metadata editing, status dialog
    auth/     login, registration, profile photo
    admin/    report review
  layout/     app shell and header
src/styles/   design tokens, reset, typography, mixins, accessibility helpers
```

Path aliases: `@core/*`, `@shared/*`, `@features/*`, `@styles/*`. Files follow the Angular 20+
naming convention without type suffixes (`video-row.ts`, not `video-row.component.ts`).

**API types are generated, not written.** `src/app/core/api/schema.ts` comes from the backend's
OpenAPI document via `npm run generate:api` while the backend is running; request and response
shapes are never maintained in two places.

**Configuration is loaded at runtime**, not baked into the bundle: `public/config.json` holds
`apiBaseUrl`, which is fetched before the app bootstraps. An empty string means same-origin, which
is what both the dev proxy and the production reverse proxy provide — so the same bundle can be
deployed anywhere without a rebuild.

---

## Testing

Unit tests run on Vitest with jsdom and live next to the code they cover. The E2E tests in `e2e/`
run against the real dev server in Chromium and WebKit; the backend has to be running, and only the
presigned storage uploads are stubbed inside the tests. WebKit is not optional here — it is the
only way to catch the differences between native HLS and hls.js.

---

## Deployment

CI runs lint, unit tests and a production build on every branch and pull request. Releases are
manual: pushing a `v*.*.*` tag builds the bundle and ships it over SSH to the server, where Caddy
serves it as a static SPA with a fallback to `index.html` and reverse-proxies `/api` to the
backend. Media is fetched by the browser straight from object storage, which is why the content
security policy has to allow that origin for `media-src` and `connect-src`.

---

## Further documentation

`CLAUDE.md` holds the design document for this repository: architecture decisions, Angular
conventions, SSR rules and the reasoning behind them.
