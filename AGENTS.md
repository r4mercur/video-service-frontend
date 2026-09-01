# AGENTS.md — Video-Plattform Frontend

Diese Datei ist die verbindliche Arbeitsgrundlage für alle Änderungen in diesem Repository.

---

## 1. Arbeitsregeln (haben Vorrang vor allem Anderen)

1. **Immer zuerst einen Implementierungsplan liefern.** Kein Code, keine Dateien, keine Konfigurationsänderungen, bevor der Plan vorliegt und bestätigt wurde.
2. **Bei Unklarheiten explizit nachfragen.** Keine Annahmen treffen und stillschweigend weiterbauen. Lieber eine Rückfrage zu viel als eine falsche Implementierung.
3. **Alternativen aufzeigen,** wenn eine gewünschte Lösung nicht den Best Practices entspricht. Entscheidung liegt beim Nutzer, aber Trade-offs müssen benannt werden (inkl. Aufwandsschätzung).
4. **In realistische Arbeitsschritte aufteilen.** Arbeitspakete mit Aufwandsschätzung in Personentagen, damit jederzeit tiefer ins Detail gegangen werden kann.
5. **Code und Kommentare sollten auf Englisch sein. In diesem File und der CLAUDE.md kann es deutsch bleiben**

---

## 2. Projektkontext

Video-Plattform zum Hochladen und Abspielen beliebiger Videos.

| Ebene              | Technologie                                                      |
| ------------------ | ---------------------------------------------------------------- |
| Frontend           | Angular 22 (dieses Repository)                                   |
| Backend            | Spring Boot                                                      |
| Cache              | Redis                                                            |
| Object Storage     | S3-kompatibel, selbst gehostet (Open Source, z. B. MinIO/Garage) |
| Ziel-Infrastruktur | Hetzner Cloud                                                    |

---

## 3. Tech-Stack & Versionen

Diese Versionen sind gesetzt und dürfen nicht ohne Rücksprache angehoben werden:

- **Node.js 24.19.0** (Active LTS bis April 2028) — gepinnt über `.nvmrc` und `engines`
- **npm 11.17.0** — über `packageManager` gepinnt, kein yarn/pnpm/bun
- **Angular 22.1.x**
- **TypeScript ~6.0.2**
- **Vitest 4 + jsdom** als Unit-Test-Runner (kein Karma, kein Jasmine)
- **Playwright** für E2E (Chromium + WebKit)
- **Sass (SCSS)**, keine CSS-Frameworks

---

## 4. Architekturentscheidungen (getroffen, nicht neu aufrollen)

### 4.1 Deployment: Static SPA, SSR-fähig geschrieben

Produktion liefert ein statisches Bundle über Nginx/Caddy aus (SPA-Fallback auf `index.html`).
**Aber:** Der Code muss jederzeit SSR-fähig bleiben, damit später ohne Refactor auf Angular SSR gewechselt werden kann. Siehe harte Regeln in Abschnitt 6.

### 4.2 Styling: reines SCSS, kein UI-Framework

Kein Angular Material, kein PrimeNG, kein Tailwind. Eigene Designs, eigenes Design-System.
**Ausnahme/Empfehlung:** Angular Aria darf für barrierefreies Verhalten interaktiver Komponenten (Dropdown, Dialog, Combobox, Slider, Tabs) genutzt werden. Aria liefert nur Verhalten, kein CSS — die Optik bleibt zu 100 % selbst gebaut. _(Noch final zu bestätigen.)_

### 4.3 Upload: über das Spring-Boot-Backend

Aktuelle Entscheidung: Bytes fließen durch das Backend.
**Zwingende Auflagen dabei:**

- Upload immer **chunked** mit `Content-Range`, niemals ein einzelner großer POST
- Client-seitiges Resume nach Verbindungsabbruch muss möglich sein
- Der Upload-Client wird hinter ein `UploadTransport`-Interface gelegt, damit später ohne UI-Änderung auf presigned Direct-Upload umgestellt werden kann

**Offene Empfehlung:** Backend als Kontrollinstanz (Auth, Quota, Multipart-Session, presigned Part-URLs, Complete-Bestätigung), Bytes direkt zum Object Store. Spart Traffic-Verdopplung und macht Backend-Deployments unabhängig von laufenden Uploads.

### 4.4 i18n: Angular natives i18n, vorerst nur Englisch

UI-Sprache ist Englisch. Es wird **kein** Runtime-i18n (Transloco o. ä.) eingesetzt.
**Trotzdem gilt ab sofort:** Alle Texte werden mit `i18n`-Attribut bzw. `$localize` markiert, auch wenn nur `en` extrahiert wird. Nachrüsten weiterer Sprachen muss ohne Anfassen von Templates möglich sein.
Formatierungen (Dauer, Aufrufzahlen, relative Zeitangaben) immer über `Intl` bzw. Angular-Pipes, nie selbst gebaut.

### 4.5 Playback

HLS. Nativ auf Safari/iOS, sonst über `hls.js`. Player-Library ist noch offen (Kandidaten: Vidstack, Shaka).

---

## 5. Angular-Konventionen

- **Standalone Components ausschließlich.** Keine NgModules.
- **Zoneless.** `zone.js` ist nicht installiert und wird nicht installiert. Jede Third-Party-Library muss zoneless-kompatibel sein.
- **OnPush ist Default** (Angular 22). Nicht explizit setzen, nicht überschreiben.
- **Signals als primäres State-Modell.** RxJS nur dort, wo es echte Streams gibt (Upload-Progress, SSE, WebSocket).
- **Datenzugriff über `httpResource` / `resource`**, nicht über handgeschriebene Observable-Services.
- **Formulare über Signal Forms** (in v22 stabil), nicht über Reactive Forms.
- **Lazy Routes** pro Feature, `@defer` für alles below-the-fold (Player, Kommentare, Empfehlungen).
- **Dateinamen ohne Typ-Suffix** (Angular-20+-Konvention): `video-card.ts`, nicht `video-card.component.ts`.
- **Kein `any`.** `strict` bleibt aktiviert.
- **DTOs werden aus der OpenAPI-Spec des Backends generiert**, nicht doppelt gepflegt.

### Projektstruktur

```
src/app/
  core/         # Singletons: Interceptors, Config, Auth, Guards, StorageService
  shared/       # dumme UI-Komponenten, Pipes, Directives
  features/
    catalog/    # Startseite, Suche, Kategorien
    watch/      # Player-Seite, Kommentare, Empfehlungen
    upload/     # Upload-Wizard + Metadaten
    studio/     # eigene Videos verwalten
    auth/       # Login, Register, Profil
  layout/       # App-Shell, Header, Sidebar
src/styles/     # Tokens, Reset, Typography, Mixins, a11y
```

Path-Aliases: `@core/*`, `@shared/*`, `@features/*`, `@styles/*`.

---

## 6. SSR-Kompatibilität (harte Regeln)

Diese vier Regeln sind nicht verhandelbar, sie sind die Versicherung für einen späteren SSR-Wechsel:

1. **Kein direkter Zugriff auf `window`, `document`, `localStorage`, `navigator`.** Nur über `DOCUMENT`-Token, `isPlatformBrowser()` oder den `StorageService`. Per ESLint (`no-restricted-globals`) erzwungen.
2. **DOM-Zugriff nur in `afterNextRender()` / `afterRenderEffect()`** — nie im Constructor, nie in `ngOnInit`.
3. **Browser-only Libraries** (`hls.js` etc.) ausschließlich lazy in `@defer` oder `afterNextRender` laden.
4. **Seitentitel und Meta-Tags** über den `Title`/`Meta`-Service, nie manuell am DOM.

---

## 7. SCSS-Regeln

- **Design Tokens als CSS Custom Properties**, nicht als SCSS-Variablen. Nur so funktioniert Runtime-Theming (Dark/Light über `[data-theme]` + `prefers-color-scheme`) ohne zweiten Build.
- **`@use`, niemals `@import`** (in Sass deprecated).
- **`@layer reset, base, components, utilities`** — Spezifitätskonflikte werden über Layer gelöst, nicht über `!important`.
- **Komponenten-Styles bleiben in der Komponente** (View Encapsulation). Global landen nur Tokens, Reset, Typography und ein minimales Utility-Set.
- **Kein `!important`** ohne Kommentar mit Begründung.
- **Focus-Styles nie entfernen.** `:focus-visible` muss überall sichtbar sein.

---

## 8. Testing

| Ebene     | Werkzeug                       | Gilt für                                               |
| --------- | ------------------------------ | ------------------------------------------------------ |
| Unit      | Vitest + jsdom                 | Services, Pipes, reine Logik, Signal-Berechnungen      |
| Component | Vitest + Angular TestBed       | Komponenten ohne Media-APIs                            |
| E2E       | Playwright (Chromium + WebKit) | Happy Paths, Upload-Flow, **alles rund um den Player** |

**Wichtig:** jsdom unterstützt weder `<video>` noch MSE. Player-Verhalten wird ausschließlich in Playwright getestet. WebKit ist Pflicht, weil Safari HLS nativ abspielt und sich anders verhält als Chromium.

---

## 9. Qualität & CI

- CI läuft über **GitHub Actions**: `npm ci` → lint → test → build → E2E
- Branch Protection auf `main` mit Required Checks
- Bundle-Budgets: initial 400 kB (warn) / 600 kB (error), Component-Styles 4 kB / 8 kB
- Husky pre-commit (Prettier + ESLint auf Staged Files), pre-push (`test:ci`)
- `--no-verify` ist nicht akzeptabel
- Angular-Updates immer gruppiert (alle `@angular/*` in einem PR)

---

## 10. Ausdrücklich unerwünscht

- NgModules, `zone.js`, Reactive Forms, konstruktorbasierte Injection
- CSS-Frameworks oder fremde UI-Kit-Komponenten
- `any`, `@ts-ignore`, `!important` ohne Begründung
- Hardcodierte Umgebungswerte in `environment.ts` — Runtime-Config über `config.json`, damit ein Build für alle Umgebungen reicht
- Ungetestete Player-Logik in jsdom
- Ungefragtes Aufrollen bereits getroffener Entscheidungen aus Abschnitt 4

---

## 11. Arbeitspakete

| #    | Paket                                                                                                                               | Aufwand                                                   | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP 0 | Toolchain & Repo-Hygiene (ohne Playwright-Grundgerüst und CI-Workflow, siehe AP 5/6 bzw. AP 9)                                      | 1–1,5 PT                                                  | umgesetzt                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AP 1 | App-Shell, Routing, Design-Tokens                                                                                                   | 2–3 PT                                                    | umgesetzt                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AP 2 | Core-Infrastruktur (Config, Interceptors, Fehler)                                                                                   | 2 PT                                                      | umgesetzt                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| AP 3 | Auth (Login, Refresh, Guards, Rollen)                                                                                               | 3 PT                                                      | umgesetzt (Login/Register/Refresh/Logout/Guards gegen echtes Backend verifiziert; Rollen-Guard bewusst zurückgestellt, keine Admin-Route vorhanden)                                                                                                                                                                                                                                                                                                            |
| AP 4 | Katalog (Liste statt Grid, Detailseite)                                                                                             | 4–5 PT                                                    | umgesetzt (Cursor/Load-more, echte Datenanbindung gegen `/api/videos`, `/api/videos/{slug}`, `/api/categories`; Detail-Panel auf reale Felder reduziert, Recommended = gleiche Kategorie, Fortschritt lokal via localStorage — Schreiben folgt mit AP 5); Such-/Filter-UI weiterhin nicht im Mockup vorgesehen                                                                                                                                                 |
| AP 5 | Player (HLS, Qualität, Untertitel, a11y) — inkl. Playwright-Grundgerüst (Chromium+WebKit), falls nicht schon in AP 6 angelegt       | 4 PT                                                      | teilweise umgesetzt (Status dieser Zeile war veraltet — `hls.js` ist längst direkt integriert, kein Vidstack/Shaka: Custom-Controls für Play/Pause, Seek, Volume, Quality-Menü über Angular-Aria-Listbox, Fullscreen, Progress-Persistenz über `WatchProgressService`. Mobile/iOS-Fix für Fullscreen, Volume-UI und Controls-Layout am 2026-08-31 nachgezogen, siehe §12. Untertitel weiterhin offen.)                                                         |
| AP 6 | Upload (Chunking, Progress, Resume, Metadaten) — inkl. Playwright-Grundgerüst (Chromium+WebKit), falls nicht schon in AP 5 angelegt | ~8,5 PT (Delta ggü. ursprünglicher Schätzung siehe Notiz) | umgesetzt (Playwright-Grundgerüst neu angelegt; Metadaten-Schritt vor `initiate`, presigned Multipart-Upload via `UploadTransport`, echter Fortschritt/Pause/Cancel, Status-Polling für Processing/Published, Resume nach Reload über `StorageService`; E2E deckt Happy Path + Datei-Validierung ab, mockt dabei die presigned Storage-PUTs sowie initiate/complete/status, da kein Objekt-Storage mit passender CORS-Konfiguration vorausgesetzt werden kann) |
| AP 7 | Studio (eigene Videos verwalten)                                                                                                    | 3 PT                                                      | offen                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AP 8 | Qualität (Tests, a11y, Performance)                                                                                                 | 3 PT                                                      | offen                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| AP 9 | Build & Deployment (Docker, Nginx, CSP, Cache) — inkl. GitHub-Actions-CI-Workflow (`npm ci → lint → test → build → e2e`)            | 2 PT                                                      | offen                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Gesamt MVP: ca. 29–31 PT.** AP 0–2 sind Voraussetzung für alles Weitere. AP 4–7 sind parallelisierbar, sobald die API-Contracts stehen.

---

## 12. Offene Punkte

- [ ] Kein Light-Theme-Mockup vorhanden — Tokens sind theme-fähig gebaut, aber nur Dark ist befüllt
- [x] Angular Aria für a11y-Verhalten: ja. Seit AP 6 im Einsatz (`@angular/aria` + `@angular/cdk`, Listbox-Pattern für die Genre-Auswahl im Upload-Formular), Optik bleibt eigenes SCSS.
- [x] Auth-Verfahren: eigenes JWT (Access-Token im Body, Refresh via httpOnly-Cookie `refresh_token`), kein Keycloak. Quelle: `GET /v3/api-docs` vom lokalen Backend (`localhost:8080`), 2026-08-22.
- [x] Player-Library: Vidstack vs. Shaka (Update 2026-08-31): faktisch entschieden — Player ist Eigenbau direkt auf `hls.js` (kein Vidstack/Shaka in `package.json`), eigene Controls in `player-frame.ts`/`.html`/`.scss`. War als offener Punkt stehen geblieben, obwohl die Implementierung längst existierte.
- [x] OpenAPI-Spec des Backends liegt vor: `http://localhost:8080/v3/api-docs` (Swagger UI unter `/swagger-ui/index.html`). Codegen via `openapi-typescript` wird mit AP 2 eingerichtet.
- [x] Upload-Variante: presigned Direct-Upload bestätigt (`POST /api/videos` liefert Part-URLs, `POST /api/videos/{id}/complete` schließt ab)
- [x] Metadaten-Reihenfolge beim Upload: Titel/Kategorie/Sichtbarkeit müssen laut Schema VOR dem ersten Byte-Transfer feststehen (kein Update-Endpoint danach) — Mockup zeigt sie fälschlich als parallel zum Upload. Entschieden (2026-08-22): eigener Metadaten-Schritt vor `initiate`, weicht bewusst vom Mockup ab.
- [ ] Presigned-PUT-Antworten brauchen `Access-Control-Expose-Headers: ETag` auf dem Object Store (MinIO/Garage), sonst kann der Client die ETags für `complete` nicht auslesen — Infra-seitig zu konfigurieren, nicht im Frontend lösbar.
- [ ] Kein Delete/Abort-Endpoint für Videos — ein clientseitig gecancelter Upload bleibt serverseitig als `UPLOADING`-Datensatz verwaist stehen.
- [ ] E2E-Beobachtung (2026-08-22): `POST /api/auth/register` limitiert Registrierungen pro Zeitfenster ("Zu viele Registrierungen") — E2E-Suites sollten sich einen Test-User teilen (`test.describe.serial` + einmaliges Sign-up in `beforeAll`) statt pro Test neu zu registrieren.
- [ ] E2E-Beobachtung (2026-08-22): Playwrights `.fill()`/`.pressSequentially()` lässt das Signup-Email-Feld (`type="email"`) gelegentlich leer (~40 % der Läufe, vermutlich Chromium-Autofill-Kollision) — bis geklärt, `upload.spec.ts`s `typeReliably()`-Helper (fill→retype→verify via `toPass`) für alle Auth-Formularfelder wiederverwenden.
- [x] Katalog-Feed paginiert serverseitig über `cursor`/`nextCursor`, nicht über Seitenzahlen — AP 4 hat die Overview-Seite auf ein Cursor-/Load-more-Pattern umgestellt (weicht vom Mockup ab). Die in AP 1 gebaute Seitenzahlen-Pagination-Komponente bleibt ungenutzt in `shared/pagination/` liegen, falls AP 7 (Studio) sie für eine kleinere, nicht-Cursor-basierte Liste gebrauchen kann.
- [ ] `VideoSummaryDto`/`VideoDetailDto` liefern keine Aufrufzahlen, keine Tags, keine Season/Language-Felder und keinen Recommendation-Endpoint. Für AP 4 entschieden: Views entfernt, Recommended = andere Videos derselben Kategorie über den bestehenden Feed-Endpoint, Wiedergabe-Fortschritt lokal in `localStorage` (`WatchProgressService`) simuliert — das Schreiben passiert erst mit dem echten Player in AP 5, bis dahin zeigt jedes Video "Not started".
- [x] Rebrand (2026-08-30): Domain `sol-stream.space` gewählt, Markenname von "Streambox" auf "sol-stream" (durchgehend lowercase, wie die Domain) umbenannt. Logo (der "S"-Mark) unverändert. Geändert: `src/index.html` (`<title>`), `src/app/layout/header/header.html` und `src/app/features/auth/login/login.html` (Wordmark-Span), `src/styles/_tokens.scss` (Kommentar, rein historisch). DNS/Hosting/CSP für die Domain selbst ist Infra-Thema aus AP 9, hier nicht angefasst.
- [x] Favicon (2026-08-30): `public/favicon.ico` durch das "S"-Mark im Header-Gradient-Stil ersetzt (16/32/48px, generiert aus einem SVG passend zu `--gradient-accent`/`--color-on-accent`).
- [x] CSP-Fehler auf der jetzt live geschalteten Seite (2026-08-30): `default-src 'self'; script-src 'self'` (kein `font-src`) blockierte die extern von `fonts.gstatic.com` geladenen Google Fonts ("violates ... default-src 'self'"). Behoben durch Self-Hosting: Space Grotesk (500–700) und DM Sans (400–500), latin-only (UI ist englisch, siehe 4.4), liegen jetzt unter `public/fonts/*.woff2`, eingebunden über neue `src/styles/_fonts.scss` (in `styles.scss` eingehängt); Google-Fonts-`<link>`/Preconnects aus `index.html` entfernt. Da die Fonts jetzt same-origin sind, deckt `default-src 'self'` sie automatisch ab — **keine CSP-Änderung im Infra-Repo nötig**. Am Live-Traffic verifiziert (vor dem Fix): nur die 8 Font-Requests waren blockiert, alles andere (JS-Chunks, das globale `styles-*.css`-Bundle, `config.json`, API-Calls) lud sauber — Angulars laufzeit-injizierte Component-Styles sind hier also **nicht** von `style-src`/`unsafe-inline` betroffen.
- [ ] CSP-Folgepunkt für AP 9 (2026-08-30): `hls.js` (AP 5, noch offen) erzeugt seinen Demux-Worker typischerweise über eine `blob:`-URL. Unter der aktuellen Live-CSP (`script-src 'self'`, kein `worker-src`) würde das vermutlich geblockt, sobald der echte Player kommt. Noch nicht verifiziert (Player ist noch nicht live) — vor AP 5 prüfen, ob `worker-src 'self' blob:;` (oder ein Konfigurieren von hls.js auf `enableWorker: false`) nötig ist.
- [x] Zweiter CSP-Fehler nach dem Rebrand-Deploy (2026-08-30): "Executing inline event handler violates ... default-src 'self'" auf der Live-Seite. Ursache am DOM verifiziert: Angulars Production-Build aktiviert per Default `styles.inlineCritical`, das erzeugt `<link rel="stylesheet" ... media="print" onload="this.media='all'">` (Async-CSS-Trick) — ein inline Event-Handler-Attribut, das ohne `'unsafe-inline'`/Nonce geblockt wird. Fix in `angular.json`: production-Konfiguration bekommt einen expliziten `optimization`-Block mit `styles.inlineCritical: false` (Minify/Fonts-Optimierung bleiben an). Verifiziert: kein `onload`-Attribut mehr im gebauten `index.html`, Lint sauber, kein Bundle-Budget-Impact (CSS-Bundle ~1 kB gzip, Verlust der Async-Optimierung vernachlässigbar). **Noch nicht deployed** — Fix ist nur lokal gebaut, muss über den normalen Release-Weg (Tag push → `release.yml`) ausgerollt werden.
- [x] Mobile/iOS-Player-Bugs behoben (2026-08-31): Nutzer meldete, dass der Player auf iPhone (Safari **und** Chrome-iOS, beide WebKit-basiert) nicht korrekt angezeigt wurde und Fullscreen/Mute nicht funktionierten. Root Causes in `player-frame.ts`/`.html`/`.scss` gefunden und behoben: (1) `toggleFullscreen()` rief `Element.requestFullscreen()` auf dem umschließenden `<div>` auf — iOS WebKit unterstützt das nur auf `<video>` selbst (`webkitEnterFullscreen()`/`webkitExitFullscreen()`); Erkennung jetzt über Feature-Detection in `detectIosWebkit()` (`!document.fullscreenEnabled && typeof video.webkitEnterFullscreen === 'function'`, kein `navigator`-Zugriff, SSR-konform). (2) Fullscreen-State hing nur an `document:fullscreenchange`, iOS feuert stattdessen `webkitbeginfullscreen`/`webkitendfullscreen` auf dem Video-Element — Listener ergänzt. (3) Der Volume-Slider ist auf iOS wirkungslos (`HTMLMediaElement.volume` ist dort laut Plattform-Design ein No-Op) — auf iOS jetzt ausgeblendet, nur der Mute-Button bleibt als Lautstärke-Kontrolle. (4) `.player__row` hatte kein Wrap-/Shrink-Verhalten für schmale Viewports (Overflow-Risiko ab ca. 375–390px Breite) — jetzt `flex-wrap` plus kompaktere Paddings/Gaps/Volume-Breite unterhalb des `sm`-Breakpoints (480px). Neue Playwright-Suite `e2e/player-mobile.spec.ts` deckt Layout/Overflow auf 390×844, echtes Play/Mute am `<video>`-Element und die iOS-Fullscreen-Verzweigung ab — Testmethodik und eine dabei entdeckte Einschränkung siehe nächster Punkt.
- [ ] Playwright-WebKit kann auf Nicht-macOS-Hosts kein HLS testen (2026-08-31, entdeckt beim Schreiben von `e2e/player-mobile.spec.ts`): Das von Playwright gebündelte WebKit hat auf Windows-/Linux-Hosts weder `MediaSource` noch native HLS-Unterstützung (`'MediaSource' in window` → `false`, `video.canPlayType('application/vnd.apple.mpegurl')` → `''`) — die Apple-Media-Frameworks, auf denen beides in echtem Safari/iOS aufbaut, sind macOS-exklusiv. Reine Playwright-Plattformlücke, kein App-Bug: `PlayerFrame` zeigt in diesem Fall korrekt "HLS playback is not supported in this browser" und blendet die Controls komplett aus (so wie es für einen echt unfähigen Browser auch sein soll). Betrifft §8 direkt ("WebKit ist Pflicht, weil Safari HLS nativ abspielt"): Auf einem Nicht-macOS-CI-Runner kann der `webkit`-Job in Playwright aktuell **keine echte HLS-Wiedergabe** verifizieren. Übergangslösung in `player-mobile.spec.ts`: ein `beforeEach` prüft die tatsächliche Decode-Fähigkeit zur Laufzeit und skippt sich selbst mit klarer Begründung statt falsch-negativ zu failen — auf einem macOS-Runner liefe derselbe Test echt durch. **Offen für AP 9**: CI-Workflow braucht für den `webkit`-Job vermutlich einen `macos-latest`-Runner, sonst bleibt die WebKit-Pflicht aus §8 für Player-Tests in der Praxis nur auf Chromium eingelöst.
- [x] HLS-Testfixtures mit `.ts`-Extension kollidieren mit TypeScript-Tooling (2026-08-31): Die für `player-mobile.spec.ts` per ffmpeg erzeugten HLS-Segmente hießen ursprünglich `segment_NNN.ts` (HLS-Konvention für MPEG-Transport-Stream) — das ist eine reine Binärdatei, aber ESLints `files: ['**/*.ts']`-Glob (eslint.config.js) versuchte trotzdem, sie als TypeScript zu parsen und brach mit `Parsing error: Unexpected keyword or identifier` ab (bricht `npm run lint`, den Husky-Pre-Commit-Hook und CI). Gleiches Problem in der IDE (WebStorm assoziiert `.ts` fest mit TypeScript/Text-Encoding). Fix: Segmente in `e2e/fixtures/hls/` auf `.mpegts` umbenannt (`stream.m3u8` entsprechend angepasst) — kein Tool matcht mehr fälschlich auf sie, kein `.gitattributes`-Sonderfall nötig.

**Hinweis:** Diese Datei lag zum Zeitpunkt dieser Ergänzung bereits einige Einträge hinter der CLAUDE.md zurück (Custom-Thumbnails, Studio-Löschen/`ConfirmDialog`, Sichtbarkeits-Toggle, Logout-Fix vom 2026-08-27 bis 2026-08-31 fehlten hier). Nicht rückwirkend nachgezogen, da außerhalb des hier bearbeiteten Themas — ggf. gesondert angleichen.

- [x] Horizontal scrollbarer Viewport auf iPhone behoben (2026-09-01): Nutzer meldete, dass sich die Seite auf iOS auf der X-Achse wegziehen ließ (Y-Achse soll scrollbar bleiben, war nie das Problem). Root Cause: `layout/header/header.scss` reiht Brand-Mark, "Browse"-Nav, bei eingeloggten Nutzern zusätzlich "Upload"/"Studio"-Nav, "Sign out" und Avatar in einer einzigen Flex-Zeile ohne Wrap/Verkürzung — bei 375–390px Viewportbreite (eingeloggter Zustand) reichte der Platz nicht mehr, und `_reset.scss` hatte keine `overflow-x`-Bremse, wodurch iOS Safari die gesamte Seite statt nur den Header seitwärts ziehen ließ. Fix zweigleisig: (1) Header-Spacing unterhalb `sm` (480px) verschärft — `.header`-Padding, `.header__start`/`.header__nav`/`.header__end`-Gaps jeweils von `--space-4` auf `--space-3` reduziert (ab `sm` unverändert), ohne Inhalte zu entfernen oder zu verstecken. (2) `overflow-x: hidden` auf `html` und `body` in `_reset.scss` als globales Safety-Net gegen jede künftige Overflow-Quelle, nicht nur den Header — Y-Achse (`min-height: 100dvh` auf `body`) bleibt unangetastet. Neue Playwright-Suite `e2e/mobile-layout.spec.ts` (375×667) prüft `document.documentElement.scrollWidth <= clientWidth` auf Catalog (ein-/ausgeloggt) und Watch (ausgeloggt); alle 3 Szenarien × Chromium/WebKit (6/6) inzwischen gegen den laufenden lokalen Backend verifiziert, inklusive des zunächst ungetesteten eingeloggten Falls (`upload.spec.ts`-Login-Pattern gegen `localhost:8080`).
