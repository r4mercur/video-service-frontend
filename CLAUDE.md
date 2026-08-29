# CLAUDE.md — Video-Plattform Frontend

Diese Datei ist die verbindliche Arbeitsgrundlage für alle Änderungen in diesem Repository.

---

## 1. Arbeitsregeln (haben Vorrang vor allem Anderen)

1. **Immer zuerst einen Implementierungsplan liefern.** Kein Code, keine Dateien, keine Konfigurationsänderungen, bevor der Plan vorliegt und bestätigt wurde.
2. **Bei Unklarheiten explizit nachfragen.** Keine Annahmen treffen und stillschweigend weiterbauen. Lieber eine Rückfrage zu viel als eine falsche Implementierung.
3. **Alternativen aufzeigen,** wenn eine gewünschte Lösung nicht den Best Practices entspricht. Entscheidung liegt beim Nutzer, aber Trade-offs müssen benannt werden (inkl. Aufwandsschätzung).
4. **In realistische Arbeitsschritte aufteilen.** Arbeitspakete mit Aufwandsschätzung in Personentagen, damit jederzeit tiefer ins Detail gegangen werden kann.
5. **Code und Kommentare sollten auf Englisch sein. In diesem File und der AGENTS.md kann es deutsch bleiben**

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

| #    | Paket                                                                                                                               | Aufwand                                                                                                           | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP 0 | Toolchain & Repo-Hygiene (ohne Playwright-Grundgerüst und CI-Workflow, siehe AP 5/6 bzw. AP 9)                                      | 1–1,5 PT                                                                                                          | umgesetzt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AP 1 | App-Shell, Routing, Design-Tokens                                                                                                   | 2–3 PT                                                                                                            | umgesetzt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AP 2 | Core-Infrastruktur (Config, Interceptors, Fehler)                                                                                   | 2 PT                                                                                                              | umgesetzt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| AP 3 | Auth (Login, Refresh, Guards, Rollen)                                                                                               | 3 PT                                                                                                              | umgesetzt (Login/Register/Refresh/Logout/Guards gegen echtes Backend verifiziert; Rollen-Guard bewusst zurückgestellt, keine Admin-Route vorhanden)                                                                                                                                                                                                                                                                                                                                                                                           |
| AP 4 | Katalog (Liste statt Grid, Detailseite)                                                                                             | 4–5 PT                                                                                                            | umgesetzt (Cursor/Load-more, echte Datenanbindung gegen `/api/videos`, `/api/videos/{slug}`, `/api/categories`; Detail-Panel auf reale Felder reduziert, Recommended = gleiche Kategorie, Fortschritt lokal via localStorage — Schreiben folgt mit AP 5); Such-/Filter-UI weiterhin nicht im Mockup vorgesehen                                                                                                                                                                                                                                |
| AP 5 | Player (HLS, Qualität, Untertitel, a11y) — inkl. Playwright-Grundgerüst (Chromium+WebKit), falls nicht schon in AP 6 angelegt       | 4 PT                                                                                                              | Player-Frame-Shell (Standbild) umgesetzt; echtes HLS/hls.js offen (Player-Library ungeklärt)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| AP 6 | Upload (Chunking, Progress, Resume, Metadaten) — inkl. Playwright-Grundgerüst (Chromium+WebKit), falls nicht schon in AP 5 angelegt | ~8,5 PT (Delta ggü. ursprünglicher Schätzung siehe Notiz) + 3,5 PT Custom-Thumbnail-Nachtrag (siehe Abschnitt 12) | umgesetzt (Playwright-Grundgerüst neu angelegt; Metadaten-Schritt vor `initiate`, presigned Multipart-Upload via `UploadTransport`, echter Fortschritt/Pause/Cancel, Status-Polling für Processing/Published, Resume nach Reload über `StorageService`; E2E deckt Happy Path + Datei-Validierung ab, mockt dabei die presigned Storage-PUTs sowie initiate/complete/status, da kein Objekt-Storage mit passender CORS-Konfiguration vorausgesetzt werden kann; Custom-Thumbnail-Upload im Metadaten-Schritt nachgerüstet, siehe Abschnitt 12) |
| AP 7 | Studio (eigene Videos verwalten)                                                                                                    | 3 PT                                                                                                              | offen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AP 8 | Qualität (Tests, a11y, Performance)                                                                                                 | 3 PT                                                                                                              | offen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| AP 9 | Build & Deployment (Docker, Nginx, CSP, Cache) — inkl. GitHub-Actions-CI-Workflow (`npm ci → lint → test → build → e2e`)            | 2 PT                                                                                                              | offen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Gesamt MVP: ca. 29–31 PT.** AP 0–2 sind Voraussetzung für alles Weitere. AP 4–7 sind parallelisierbar, sobald die API-Contracts stehen.

---

## 12. Offene Punkte

- [ ] Kein Light-Theme-Mockup vorhanden — Tokens sind theme-fähig gebaut, aber nur Dark ist befüllt
- [x] Angular Aria für a11y-Verhalten: ja. Seit AP 6 im Einsatz (`@angular/aria` + `@angular/cdk`, Listbox-Pattern für die Genre-Auswahl im Upload-Formular), Optik bleibt eigenes SCSS.
- [x] Auth-Verfahren: eigenes JWT (Access-Token im Body, Refresh via httpOnly-Cookie `refresh_token`), kein Keycloak. Quelle: `GET /v3/api-docs` vom lokalen Backend (`localhost:8080`), 2026-08-22.
- [ ] Player-Library: Vidstack vs. Shaka
- [x] OpenAPI-Spec des Backends liegt vor: `http://localhost:8080/v3/api-docs` (Swagger UI unter `/swagger-ui/index.html`). Codegen via `openapi-typescript` wird mit AP 2 eingerichtet.
- [x] Upload-Variante: presigned Direct-Upload bestätigt (`POST /api/videos` liefert Part-URLs, `POST /api/videos/{id}/complete` schließt ab)
- [x] Metadaten-Reihenfolge beim Upload: Titel/Kategorie/Sichtbarkeit müssen laut Schema VOR dem ersten Byte-Transfer feststehen (kein Update-Endpoint danach) — Mockup zeigt sie fälschlich als parallel zum Upload. Entschieden (2026-08-22): eigener Metadaten-Schritt vor `initiate`, weicht bewusst vom Mockup ab.
- [ ] Presigned-PUT-Antworten brauchen `Access-Control-Expose-Headers: ETag` auf dem Object Store (MinIO/Garage), sonst kann der Client die ETags für `complete` nicht auslesen — Infra-seitig zu konfigurieren, nicht im Frontend lösbar.
- [ ] Kein Delete/Abort-Endpoint für Videos — ein clientseitig gecancelter Upload bleibt serverseitig als `UPLOADING`-Datensatz verwaist stehen.
- [ ] E2E-Beobachtung (2026-08-22): `POST /api/auth/register` limitiert Registrierungen pro Zeitfenster ("Zu viele Registrierungen") — E2E-Suites sollten sich einen Test-User teilen (`test.describe.serial` + einmaliges Sign-up in `beforeAll`) statt pro Test neu zu registrieren.
- [ ] E2E-Beobachtung (2026-08-22): Playwrights `.fill()`/`.pressSequentially()` lässt das Signup-Email-Feld (`type="email"`) gelegentlich leer (~40 % der Läufe, vermutlich Chromium-Autofill-Kollision) — bis geklärt, `upload.spec.ts`s `typeReliably()`-Helper (fill→retype→verify via `toPass`) für alle Auth-Formularfelder wiederverwenden.
- [x] Katalog-Feed paginiert serverseitig über `cursor`/`nextCursor`, nicht über Seitenzahlen — AP 4 hat die Overview-Seite auf ein Cursor-/Load-more-Pattern umgestellt (weicht vom Mockup ab). Die in AP 1 gebaute Seitenzahlen-Pagination-Komponente bleibt ungenutzt in `shared/pagination/` liegen, falls AP 7 (Studio) sie für eine kleinere, nicht-Cursor-basierte Liste gebrauchen kann.
- [ ] `VideoSummaryDto`/`VideoDetailDto` liefern keine Aufrufzahlen, keine Tags, keine Season/Language-Felder und keinen Recommendation-Endpoint. Für AP 4 entschieden: Views entfernt, Recommended = andere Videos derselben Kategorie über den bestehenden Feed-Endpoint, Wiedergabe-Fortschritt lokal in `localStorage` (`WatchProgressService`) simuliert — das Schreiben passiert erst mit dem echten Player in AP 5, bis dahin zeigt jedes Video "Not started".
- [ ] Admin-Sektion (offene Reports/Tickets, AP 7-nah): `DELETE /api/videos/{id}` ist kein `/api/admin/...`-Endpoint. Ob das Backend Admins erlaubt, darüber fremde Videos zu löschen, ist vom Frontend aus nicht verifizierbar — die Delete-Aktion im Reports-Screen ruft ihn so auf, wie er in der Spec steht; liefert das Backend hier 403 für fremde Videos, muss das Backend-seitig nachgezogen werden.
- [x] Custom Thumbnails (2026-08-27): Backend liefert `hasCustomThumbnail` auf `VideoDetailDto` sowie `PUT`/`DELETE /api/videos/{id}/thumbnail` (Owner-`@PreAuthorize`, ffmpeg-Validierung, 8 MB Default-Limit über `app.thumbnail.max-size-bytes`). Da beide Endpunkte eine bereits existierende `videoId` brauchen, ist der Custom-Thumbnail-Picker in den Metadaten-Schritt integriert (`thumbnail-picker`-Komponente): Auswahl passiert vor `initiate`, der eigentliche `PUT`-Call feuert transparent direkt danach, sobald die `videoId` bekannt ist. Fehler dabei sind bewusst nicht blockierend (Video existiert schon, Backend fällt sonst aufs Auto-Thumbnail zurück) — nur eine Inline-Warnung während des Transfers. `DELETE .../thumbnail` (Revert-to-Auto) ist **nicht** Teil dieses Nachtrags, sondern gehört zur Video-Verwaltung bestehender Videos und damit zu Studio (AP 7, weiterhin offen). Client-seitige Vorab-Validierung (JPEG/PNG/WebP, 8 MB) ist reine UX, Backend bleibt Quelle der Wahrheit — bei Änderung des Backend-Defaults muss dieser Wert manuell nachgezogen werden, da er nicht über `config.json` abrufbar ist. Zusätzlicher Fund: Die generierte OpenAPI-Spec zeigt den `setThumbnail`-Request fälschlich als `application/json` (Springdoc-Artefakt bei `MultipartFile`-Parametern ohne `@RequestPart`-Annotation) — der reale Request ist `multipart/form-data` mit Feldname `file`.
- [ ] Rebrand-Kandidat (2026-08-29): Domainname könnte einen Namenswechsel von "Streambox" auf "sol-stream" erzwingen. Noch nicht final entschieden, nicht ungefragt umsetzen. Logo (der "S"-Mark) bleibt unverändert, nur der Markenname ändert sich. Betrifft nur Text an vier Stellen: `src/index.html` (`<title>`), `src/app/layout/header/header.html` und `src/app/features/auth/login/login.html` (Wordmark-Span neben dem Logo-Mark), `src/styles/_tokens.scss` (Kommentar "Source: Streambox mockups", rein historisch). Keine Tests/E2E-Specs assertieren aktuell auf "Streambox".
