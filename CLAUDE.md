# CLAUDE.md — Video-Plattform Frontend

Diese Datei ist die verbindliche Arbeitsgrundlage für alle Änderungen in diesem Repository.

---

## 1. Arbeitsregeln (haben Vorrang vor allem Anderen)

1. **Immer zuerst einen Implementierungsplan liefern.** Kein Code, keine Dateien, keine Konfigurationsänderungen, bevor der Plan vorliegt und bestätigt wurde.
2. **Bei Unklarheiten explizit nachfragen.** Keine Annahmen treffen und stillschweigend weiterbauen. Lieber eine Rückfrage zu viel als eine falsche Implementierung.
3. **Alternativen aufzeigen,** wenn eine gewünschte Lösung nicht den Best Practices entspricht. Entscheidung liegt beim Nutzer, aber Trade-offs müssen benannt werden (inkl. Aufwandsschätzung).
4. **In realistische Arbeitsschritte aufteilen.** Arbeitspakete mit Aufwandsschätzung in Personentagen, damit jederzeit tiefer ins Detail gegangen werden kann.

---

## 2. Projektkontext

Video-Plattform zum Hochladen und Abspielen beliebiger Videos.

| Ebene | Technologie |
|---|---|
| Frontend | Angular 22 (dieses Repository) |
| Backend | Spring Boot |
| Cache | Redis |
| Object Storage | S3-kompatibel, selbst gehostet (Open Source, z. B. MinIO/Garage) |
| Ziel-Infrastruktur | Hetzner Cloud |

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
**Ausnahme/Empfehlung:** Angular Aria darf für barrierefreies Verhalten interaktiver Komponenten (Dropdown, Dialog, Combobox, Slider, Tabs) genutzt werden. Aria liefert nur Verhalten, kein CSS — die Optik bleibt zu 100 % selbst gebaut. *(Noch final zu bestätigen.)*

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

| Ebene | Werkzeug | Gilt für |
|---|---|---|
| Unit | Vitest + jsdom | Services, Pipes, reine Logik, Signal-Berechnungen |
| Component | Vitest + Angular TestBed | Komponenten ohne Media-APIs |
| E2E | Playwright (Chromium + WebKit) | Happy Paths, Upload-Flow, **alles rund um den Player** |

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

| # | Paket | Aufwand | Status |
|---|---|---|---|
| AP 0 | Toolchain & Repo-Hygiene | 1–1,5 PT | spezifiziert, nicht umgesetzt |
| AP 1 | App-Shell, Routing, Design-Tokens | 2–3 PT | blockiert (Designs fehlen) |
| AP 2 | Core-Infrastruktur (Config, Interceptors, Fehler) | 2 PT | offen |
| AP 3 | Auth (Login, Refresh, Guards, Rollen) | 3 PT | offen |
| AP 4 | Katalog (Grid, Suche, Filter, Detailseite) | 4–5 PT | offen, braucht API-Contract |
| AP 5 | Player (HLS, Qualität, Untertitel, a11y) | 4 PT | offen |
| AP 6 | Upload (Chunking, Progress, Resume, Metadaten) | 5 PT | offen |
| AP 7 | Studio (eigene Videos verwalten) | 3 PT | offen |
| AP 8 | Qualität (Tests, a11y, Performance) | 3 PT | offen |
| AP 9 | Build & Deployment (Docker, Nginx, CSP, Cache) | 2 PT | offen |

**Gesamt MVP: ca. 29–31 PT.** AP 0–2 sind Voraussetzung für alles Weitere. AP 4–7 sind parallelisierbar, sobald die API-Contracts stehen.

---

## 12. Offene Punkte

- [ ] **Designs liegen noch nicht vor** — blockiert das Token-Set in AP 1
- [ ] Angular Aria für a11y-Verhalten: ja oder nein? (bei nein: +4 PT für eigene Primitives)
- [ ] Auth-Verfahren: eigenes JWT vs. Keycloak/Authentik — gemeinsam mit dem Backend zu entscheiden
- [ ] Player-Library: Vidstack vs. Shaka
- [ ] OpenAPI-Spec des Backends — Voraussetzung für AP 4
- [ ] Upload-Variante final: durchs Backend vs. presigned Direct-Upload
