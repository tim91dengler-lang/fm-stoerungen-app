# Konzept: Mobile-Tauglichkeit (Stufe 1)

> **Status:** Freigegeben (Tim, 2026-05-29). **M1 + M2 + M4 umgesetzt.** M3 verworfen. M5 offen.
> **Datum:** 2026-05-29 (Stand-Update 2026-05-30)
> **Autor:** Claude (Senior-Dev-Modus)
> **Bezug:** `docs/plan.md` §5.9 (PWA), Mobile-Anforderungen; CLAUDE.md §4 (Listen-Konvention)
>
> **Freigabe-Entscheidungen:** Bottom-Tab-Leiste ja · PWA auf `vite-plugin-pwa`/Workbox (M5) ja · Reihenfolge bestätigt.
> **M3 verworfen (Tim, 2026-05-30):** Kanban-Touch entfällt — der Status-Wechsel läuft am Handy ohnehin über das Ticket-Detail („alles im Ticket bearbeiten"), das ist der bessere Flow. Kein Touch-Drag / Schnellmenü auf dem Kanban-Board nötig.

---

## 1. Ziel & Auslöser

Das **Mobile ist das Herzstück** der App — Techniker arbeiten am Handy (Keller, Heizungsraum,
Tiefgarage). Bisher lag der Fokus auf der Desktop-Webanwendung. Dieses Konzept klärt:
*Wie machen wir die App auf dem Handy wirklich nutzbar — und wie aufwändig ist das?*

Grundlage ist ein **realer Mobile-Readiness-Check** (29.05.2026): Login als Admin, iPhone-Viewport
(390×844, Touch, Retina) gegen die laufende App, alle Kern-Screens per Playwright durchgeklickt
und gemessen (Layout-Overflow, Touch-Targets) + Code-Audit.

**Kernergebnis: kein Rewrite nötig.** Die Basis ist überraschend mobil-tauglich (durchgehend
responsives Tailwind, kein horizontaler Overflow auf irgendeinem Screen). Es fehlen im Kern
**zwei handfeste Dinge**; der Rest ist Feinschliff.

---

## 2. Ist-Stand (Befund 29.05.2026)

| Bereich | Status | Befund |
|---|:---:|---|
| Dashboard | 🟢 | Kacheln stapeln 2×2, Ticket-Liste sauber lesbar. Fertig. |
| Ticket bearbeiten (Detail-Drawer) | 🟢 | Vollbild-Overlay, gestapelte Sektionen, große Foto-Dropzone + Chat-Eingabe. Feldtauglich. |
| Ticket erfassen (Formular-Modal) | 🟢 | Vollbild, gestapelt, **native Dropdowns** (Handy-Picker — ideal). 2-Spalten-Selects minimal eng, aber bedienbar. |
| Meine Tickets | 🟢 | Sauberer Empty-State, korrektes Layout. |
| Kanban — Layout | 🟢 | Spalten stapeln zu vollbreiten Karten mit großen Tap-Flächen. |
| Kanban — Interaktion | 🔴 | Nutzt natives HTML5-`draggable` → Drag-&-Drop **funktioniert auf Touch nicht**. |
| Ticket-Pool (Liste) | 🔴 | Desktop-Power-Tabelle 1:1: Gruppierungs-Ablagezone, Mini-Checkboxen/Kebab, Tabelle scrollt seitlich raus. Technisch nutzbar, aber nicht feldtauglich. |
| **Navigation < 1024px** | 🔴 | **Hauptblocker** — siehe unten. |
| PWA / Installierbarkeit | 🟡 | Grundgerüst komplett (Manifest, Icons, Install-Prompt, SW), aber Service Worker bewusst deaktiviert während Hot-Iteration. |

### Der Hauptblocker: keine mobile Navigation

Die Sidebar ist `hidden … lg:flex` (`apps/web/src/components/AppLayout.tsx:134`) — sie erscheint
erst ab 1024px. Darunter (= **jedes Handy**) gibt es **keine Navigation**: kein Hamburger, keine
Bottom-Bar, kein Menü. Auch „Neues Ticket" und „Abmelden" hängen nur in der Sidebar bzw. sind
`lg:flex`. Konsequenz: Auf dem Handy landet man auf dem Dashboard und **kommt nicht weg** — weder
zum Ticket-Pool noch zu Stammdaten, und ein Ticket neu anlegen geht auch nicht.

Das ist die eine Lücke, die alles andere blockiert: Solange man nicht navigieren kann, ist die
mobile Qualität der Einzelseiten irrelevant.

### Nebenbefund (nicht Mobile, separat)

`apps/api/src/fm_api/scripts/seed_mockup.py` ist aktuell defekt (PartnerTyp-Enum statt String beim
Partner-Insert) — der volle Demo-Seed läuft nicht durch (Rollback). Kleines, eigenes Ticket.

---

## 3. Scope

### In Scope (Stufe 1 — „mobil wirklich nutzbar")

1. **Mobile Navigation** — Hauptblocker auflösen.
2. **Mobile Listen-Darstellung** — Ticket-Pool (und Muster für alle Listen) als Karten am Handy.
3. **Kanban touch-fähig** — Drag-&-Drop auf Touch reparieren.
4. **Mobile-Feinschliff** — Touch-Targets, „Neues Ticket"-Erreichbarkeit, Abmelden am Handy.
5. **PWA scharf schalten** — Service Worker wieder aktiv, sauberes Cache-Versioning, Installierbarkeit verifiziert.

### Out of Scope (spätere Stufen / eigene Pakete)

- **Offline-Schreiben / Background-Sync** (Stufe 2) — Ticket offline erfassen, später syncen.
  Braucht IndexedDB-Queue + serverseitige Idempotency-Keys. Eigenes großes Paket.
- **Push Notifications** (Stufe 2).
- **Native Apps** (Stufe 3, nur falls PWA-Limits stören).
- Umbau bestehender, bereits mobil-tauglicher Screens (Dashboard, Detail, Erfassung) — die bleiben.

---

## 4. Arbeitspakete (Reihenfolge + Aufwand)

Reihenfolge bewusst so: erst durchnavigierbar machen (entsperrt alles), dann die kaputten
Interaktionen, dann Feinschliff, dann PWA.

| # | Paket | Inhalt | Status |
|:--:|---|---|:--:|
| **M1** | **Mobile Navigation** | Hamburger-Button im Header (< lg). Slide-in-Drawer, der `navGroups` aus `AppLayout` **wiederverwendet** (keine Doppelpflege). „Neues Ticket"-Button + „Abmelden" im Drawer. Plus Bottom-Tab-Leiste für die Kern-Aktionen (Dashboard, Pool, Meine Tickets, Mehr). | ✅ **fertig** (#92) |
| **M2** | **Mobile Listen-Karten** | Ticket-Pool: unterhalb `lg` automatisch Karten- statt Tabellen-Darstellung (geteilte `TicketCard` mit Kanban). Gesamtsuche bleibt; Power-Tabellen-Features Desktop-only. Opt-in pro Liste via `renderMobileCard`. | ✅ **fertig** (#93) |
| ~~M3~~ | ~~Kanban touch-fähig~~ | **Verworfen (2026-05-30):** Status-Wechsel läuft am Handy über das Ticket-Detail; kein Kanban-Touch nötig. | ❌ entfällt |
| **M4** | **Mobile-Feinschliff** | Touch-Targets ≥ 44px: globale Mobile-Regel für Formfelder (`input/select/textarea`), Icon-Buttons (Glocke, Detail-X/Foto/Senden/Löschen, Erfassen-Buttons, Kanban-Link) pro Komponente; Header-Safe-Area oben (Notch). Desktop unverändert (`lg:`-Overrides). | ✅ **fertig** |
| **M5** | **PWA scharf schalten** | Service-Worker-Deaktivierung (Stand 23.05.) zurücknehmen. **Architektur-Entscheidung** (siehe §5): manueller SW härten **vs.** auf `vite-plugin-pwa`/Workbox umstellen (von tech-spec vorgesehen). Installierbarkeit + Offline-Read-Fallback auf echtem Gerät verifizieren, Lighthouse-PWA-Check. | ⏳ offen |

Jedes Paket ein eigener PR mit Staging-Acceptance durch Tim. **Es fehlt nur noch M5 (PWA).**

---

## 5. Technische Entscheidungen (zur Freigabe)

**E1 — Navigationsmuster (M1).**
Empfehlung: **Hamburger-Drawer als Primärnavigation** (alle Bereiche, da die App viele Stammdaten-
Seiten hat) **plus optionale Bottom-Tab-Leiste** für die 3–4 Techniker-Kern-Aktionen.
Begründung: Drawer skaliert mit der Menübreite, Bottom-Tabs geben dem Außendienst Ein-Daumen-Zugriff
auf das Wichtigste. *Alternative:* nur Drawer (schlanker, aber häufige Aktionen sind 2 Taps weg).

**E2 — Service-Worker-Strategie (M5).**
Empfehlung: **auf `vite-plugin-pwa` (Workbox) umstellen** — von der tech-spec ohnehin vorgesehen.
Vorteil: automatisches Cache-Versioning (löst genau das „alte-UI-gecacht"-Problem strukturell,
statt per Hand zu deaktivieren), Precaching mit Hashes, saubere Update-Flows, dev-Modus stört nicht.
*Alternative:* manuellen SW behalten und nur härten (weniger Dependencies, aber Cache-Logik bleibt Handarbeit).

**E3 — Mobile-Erkennung (M1/M2).**
CSS-Breakpoints (`lg:`) wo möglich; wo JS nötig ist (Drawer-State, Karten-vs-Tabelle-Umschaltung)
ein kleiner `useMediaQuery`-Hook (existiert noch nicht im Code). Breakpoint: `lg` = 1024px,
konsistent zur bestehenden Sidebar-Schwelle.

---

## 6. Offene Fragen an Tim

1. **Bottom-Tab-Leiste ja/nein?** (E1) — Empfehlung ja, für Techniker-Kern-Aktionen.
2. **PWA: Workbox-Umstieg ok?** (E2) — Empfehlung ja.
3. **Kanban am Handy:** echtes Touch-Drag-&-Drop, oder reicht ein „Status ändern"-Schnellmenü?
   (Drag am kleinen Screen ist oft fummelig — Schnellmenü ggf. die bessere Feld-UX.)
4. **Reihenfolge ok**, oder soll ein Paket vorgezogen werden?

---

## 7. Test & Acceptance

- Pro Paket: Playwright-Screenshot-Check bei 390×844 (iPhone) **und** 360×800 (Android) vor Acceptance-Bitte.
- M5: Lighthouse-PWA-Audit + Install-Test auf echtem Gerät (Tim, „Zum Startbildschirm hinzufügen").
- Tim macht Staging-Acceptance je PR (Klick-Test am echten Handy), Prod-Promote wie gehabt.

---

## 8. Empfohlener erster Schritt

**M1 (Mobile Navigation)** — entsperrt als Einziges die gesamte App am Handy und ist klar abgegrenzt.
Danach kann Tim auf dem echten Gerät durchklicken und die restlichen Pakete am realen Eindruck priorisieren.
