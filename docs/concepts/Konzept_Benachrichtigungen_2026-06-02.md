# Konzept: Benachrichtigungen — Gesamtkonzept inkl. PWA/Handy-Push (Web-Push, E-Mail-Fallback, Reminder-Job, User-Einstellungen)

> **Projekt:** fm-stoerungen-app
> **Stand:** 2026-06-02 — **Entwurf zur Abstimmung**
> **Status:** Konzept. **Bis zur Freigabe durch Tim: kein Produktiv-Code.**
> **Methodik:** Ist-Zustand mehrgleisig im Code recherchiert (Datei:Zeile-Belege), dann strukturierter Entwurf.
> **Bezug:** `docs/plan.md` (Roadmap), `docs/tech-spec.md` (Pflichtenheft), CLAUDE.md §4 (Listen-/UX-Konvention).
> **Aufwand (grob):** L

---

## 1. Ziel

Die bereits existierende In-App-Benachrichtigung (Bell + Polling) wird zu einem vollständigen Kanal-Konzept ausgebaut, sodass Joachims Techniker auf dem Handy echte Push-Nachrichten bekommen, auch wenn die App geschlossen ist (PWA Web-Push), per E-Mail nicht verpassen, was liegen bleibt (Fallback), und Wartungs-Fälligkeiten automatisch erinnert werden (Reminder-Job). Jeder User steuert pro Kanal/Auslöser selbst, was ihn erreicht. Zielgruppe: interne Rollen (Admin, Techniker, Büro) im Pilot.

## 2. Ist-Zustand (heute im Code)

Backend-Notification-Kern existiert, aber nur In-App: Model `Notification` mit Typ-Enum mention/zuweisung/status/chat/wartung_faellig und Flag `gelesen` (apps/api/src/fm_api/models/notification.py:19-65). Service kann list_unread/count_unread/mark_read/fire (apps/api/src/fm_api/services/notification_service.py:10-87). REST: GET / + /count + mark-read + mark-all-read (apps/api/src/fm_api/api/v1/notifications.py:10-39). Gefeuert wird heute bei Mention+Chat (chat_service.py:77,94), Zuweisung+Status (ticket_service.py:737,770,781). 

LÜCKE 1 (Push fehlt komplett): Kein Push-Subscription-Model, kein VAPID, keine pywebpush-Dependency (apps/api/pyproject.toml:19-21 hat nur jose/email-validator). Frontend nutzt NIRGENDS Notification.requestPermission, pushManager oder navigator.serviceWorker.ready (grep in apps/web/src leer außer SW-Registrierung). PWA läuft über vite-plugin-pwa mit registerType:'autoUpdate' + injectRegister:false (vite.config.ts:16-39), main.tsx:15 ruft nur registerSW(). Das ist ein Workbox-generierter SW OHNE eigenen push-Event-Listener — für Web-Push muss auf injectManifest (eigener src/sw.ts) umgestellt werden. Manifest vorhanden (public/manifest.webmanifest, display:standalone, gut für iOS-Installierbarkeit).

LÜCKE 2 (kein Toast trotz plan.md §5.6): plan.md fordert In-App-Toast (3s, rechts unten) als Kanal — existiert nicht (kein sonner/react-hot-toast, keine Toast-Komponente in apps/web/src). NotificationsDropdown.tsx pollt nur alle 30s (Zeile 46), zeigt aber keinen aktiven Toast bei neuer Notification.

LÜCKE 3 (kein Scheduler/Reminder-Job): Daten sind vorbereitet — Ticket.faelligkeit_am (models/ticket.py:176, indexed) + Tickettyp.default_reminder_tage (models/tickettyp.py:38, Defaults 7/3 für Wartung/Baubegehung in tickettyp_service.py:83,93). ABER: Notification-Typ wartung_faellig wird NIRGENDS gefeuert (grep zeigt nur Frontend-Icon dafür). main.py:12-14 hat leere lifespan, kein APScheduler/Celery/Cron, kein worker-Service in docker-compose.staging.yml (nur postgres/api/web).

LÜCKE 4 (kein E-Mail-Versand): Keine SMTP-Config (core/config.py:8-53 hat keine Mail-Felder), keine aiosmtplib/fastapi-mail-Dependency. User.email existiert (models/user.py:44), aber es gibt kein last_login/last_seen-Feld → der plan.md-Trigger ">24h nicht eingeloggt" ist heute nicht messbar.

LÜCKE 5 (keine User-Einstellungen): Kein Notification-Preferences-Model, keine Settings/Profil-Seite im Frontend (find in pages/ leer), kein /me-Route in nav.tsx. fire() in notification_service.py:57-87 prüft keine Präferenzen.

## 3. Scope — erste Ausbaustufe (Pilot)

- Web-Push end-to-end: VAPID-Keypair (env), push_subscription-Tabelle (core/), Subscribe/Unsubscribe-Endpoints, eigener Service-Worker (injectManifest) mit push+notificationclick-Listener, Frontend-Opt-in-Button mit Notification.requestPermission + pushManager.subscribe. Push wird beim Feuern jeder Notification mitgesendet (pywebpush).
- iOS-/Handy-Tauglichkeit absichern: PWA muss zum Homescreen hinzugefügt sein (Web-Push auf iOS 16.4+ nur in installierter PWA). Install-Hinweis + Permission-Onboarding im Frontend (setupInstallPrompt aus lib/pwa.ts ist schon da).
- In-App-Toast nachrüsten (plan.md §5.6): leichte Toast-Komponente, getriggert beim Notification-Polling/Push-Empfang im Vordergrund.
- Reminder-Job für Wartungs-Fälligkeit: täglicher Scan über Tickets mit tickettyp=wartung + faelligkeit_am, feuert wartung_faellig N Tage vorher (default_reminder_tage) idempotent (1x pro Ticket/Fälligkeit). Realisierung als FastAPI-lifespan-Loop ODER eigener cron-getriggerter Management-Command — Entscheidung offen.
- Notification-Einstellungen pro User: Tabelle/Model mit Matrix Auslöser×Kanal (in-app immer an; push/email opt-in), Settings-Seite + /api/v1/me/notification-settings. fire() respektiert Präferenzen pro Kanal.
- E-Mail-Versand-Infrastruktur (SMTP via aiosmtplib + Jinja-Template), zunächst nur für hochpriore Auslöser (Mention/Zuweisung) als Fallback. Trigger '>24h offline' braucht neues User.last_login-Feld.

**Bewusst NICHT jetzt (später / Nordstern):**

- WebSocket-Realtime statt Polling (plan.md Stufe 2) — In-App bleibt Polling + Push.
- Microsoft-Graph-Direktversand von E-Mails (plan.md §5.12, Stufe 2) — jetzt nur SMTP-Fallback.
- Objekt-/Partner-Mentions als Push-Auslöser (Stufe 2, jetzt nur User-Mentions).
- Externe Empfänger (Mieter/Nachunternehmer) als Push/Email-Ziel — Stufe 1 nur interne User.
- Volle Read-Receipt-/Zustell-Statistik pro Push — nur minimales last_success/failure-Tracking.
- Konfigurierbare Reminder-Eskalationsketten/Cron-Regeln (plan.md offene Frage 10) — jetzt nur N-Tage-Vorlauf einmalig.

## 4. Architektur-Skizze

DATENMODELL (alles core/, FM-frei):
1) `push_subscription` — id, mandant_id, user_id (FK users, CASCADE), endpoint (unique), p256dh, auth, user_agent, created_at, last_success_at, failure_count. Bei 410/404 vom Push-Service → Subscription löschen (Auto-Cleanup). Mandanten-/User-FK wie bei notifications validieren (Memory fk-mandant-validierung).
2) `notification_setting` — user_id + auslöser-typ (mention/zuweisung/status/chat/wartung_faellig) + Kanal-Flags (in_app default true & locked, push, email). Alternativ kompakt als JSONB pro User. Empfehlung: schlanke JSONB-Spalte `notification_prefs` auf User-Model (eine Migration, kein Junction-Audit-Trick nötig).
3) User-Erweiterung: `last_login_at` (für E-Mail->24h-Trigger) — in auth_service Login setzen.
4) Notification-Erweiterung: optionale Felder push_sent_at / email_sent_at fürs Dedup/Debug (nice-to-have).

ENDPOINTS (FastAPI, /api/v1):
- POST /push/subscribe, POST /push/unsubscribe (Body: PushSubscription-JSON aus pushManager).
- GET /push/vapid-public-key (Frontend holt Public-Key für subscribe).
- GET/PUT /me/notification-settings.
- (E-Mail/Push laufen serverseitig, kein eigener Endpoint.)

SERVICE-SCHICHT — zentraler Dispatch: notification_service.fire() (heute notification_service.py:57) wird zum Fan-out-Punkt erweitert: nach DB-Insert je nach User-Prefs (a) Push via neuem push_service.send_to_user() (pywebpush, VAPID), (b) Email via email_service.send() (aiosmtplib, nur hochprior + Offline-Bedingung). Push/Email NICHT im Request-Pfad blockierend — als asyncio-Task/Background absetzen, Fehler schlucken+loggen (Notification-Insert darf nie an Push scheitern).

REMINDER-JOB: scheduler_service.scan_wartungen() — SELECT Tickets join Tickettyp WHERE typ=wartung AND faelligkeit_am - default_reminder_tage <= today AND nicht erledigt AND noch kein wartung_faellig für diese Fälligkeit. Pro Treffer fire(typ=wartung_faellig, user=zugewiesen_an). Idempotenz über Existenz-Check (notification mit ticket_id+typ+heutigem Fälligkeitsbezug). Trigger-Variante A (empfohlen Pilot): APScheduler AsyncIOScheduler in main.py-lifespan (1x täglich, kein Extra-Container). Variante B: separater worker-Service im Compose + cron. A ist für Single-API-Instanz im Pilot am einfachsten; B sauberer bei Skalierung.

FRONTEND:
- vite.config.ts von generateSW (autoUpdate) auf injectManifest umstellen + src/sw.ts mit self.addEventListener('push'...) + notificationclick (öffnet Deep-Link /tickets/:id). registerType/precache-Verhalten (autoUpdate, kein Stale-UI) erhalten.
- lib/push.ts: requestPermission, subscribe via navigator.serviceWorker.ready.pushManager.subscribe(applicationServerKey), POST an /push/subscribe.
- Onboarding-Komponente: Opt-in-Banner/Button (im Header neben Bell oder in neuer Einstellungen-Seite). iOS: Hinweis 'Zum Homescreen hinzufügen' nutzt vorhandenes setupInstallPrompt (lib/pwa.ts).
- Toast-Provider (sonner, ~3kb) für In-App-Kanal.
- Neue Seite /einstellungen mit Notification-Prefs-Matrix.

STACK-BEZUG: VAPID-Keys + SMTP-Creds via core/config.py (BaseSettings) + Compose-env. Neue Deps: pywebpush + cryptography (VAPID), aiosmtplib, apscheduler. SW-Push ist DSGVO-konform (Payload verschlüsselt, EU-Hosting; nur minimale Inhalte im Push, Detail erst nach Klick aus API).

## 5. Offene Fragen — von Tim zu entscheiden

1. Reminder-Trigger: APScheduler im FastAPI-lifespan (kein Extra-Container, einfach, aber an API-Prozess gekoppelt) ODER eigener worker-Service im Compose mit cron (sauberer, mehr Infra)? Empfehlung für Pilot: APScheduler in lifespan.
2. E-Mail-Versand in Stufe 1 wirklich jetzt oder erst Stufe 2? plan.md §5.6 nennt E-Mail-Fallback 'optional' und §5.12 verschiebt direkten Versand (MS Graph) auf Stufe 2. Vorschlag: SMTP-Fallback nur für Mention/Zuweisung minimal jetzt, Rest später.
3. SMTP-Postausgang: welcher Absender/Server? (Hetzner-Mailserver, eigener SMTP, Transaktions-Provider wie Brevo/Postmark mit EU-Region?) — kostenrelevant, daher Tim-Entscheidung.
4. Push-Default: nach Permission-Opt-in alle Auslöser per Push an, oder nur hochpriore (Mention/Zuweisung)? Empfehlung: nur hochprior als Push-Default, Rest in-app, User kann erweitern.
5. Notification-Prefs als JSONB-Spalte am User (1 Migration, simpel) ODER eigene Tabelle (sauberer, filterbar)? Empfehlung: JSONB für Pilot.
6. Soll der Opt-in-Button im Header (neben Bell) sitzen oder nur auf einer neuen Einstellungen-Seite? Header = höhere Aktivierungsrate beim Techniker.

## 6. Umsetzungsschnitt (Reihenfolge / PR-Pakete)

1. PR1 (Backend Web-Push-Fundament): VAPID-Config + push_subscription-Model + Migration + subscribe/unsubscribe/vapid-public-key-Endpoints + push_service.send_to_user (pywebpush) + Integration in fire(); Auto-Cleanup bei 410. Selbsttest via curl + echtem Browser-Subscribe.
2. PR2 (Frontend Web-Push + Toast): vite.config auf injectManifest, src/sw.ts mit push/notificationclick, lib/push.ts, Opt-in-Onboarding (Header-Button + iOS-Install-Hinweis), Toast-Provider für In-App. E2E-Smoke: Permission → Push kommt bei Hintergrund-Tab an. Lokal mit tsc -b prüfen (Memory web-build-tsc-b).
3. PR3 (User-Einstellungen): notification_prefs (JSONB) + /me/notification-settings GET/PUT + fire() respektiert Prefs + Einstellungen-Seite mit Auslöser×Kanal-Matrix + nav-Eintrag.
4. PR4 (Reminder-Job): APScheduler in lifespan + scheduler_service.scan_wartungen (idempotent) feuert wartung_faellig. Test mit fixem Fälligkeitsdatum, Job manuell triggerbar (Management-Command für CI/Test).
5. PR5 (E-Mail-Fallback, optional/abhängig von Tim-Entscheid): SMTP-Config + email_service (aiosmtplib + Jinja-Template) + User.last_login_at (in auth_service setzen) + Versand bei Mention/Zuweisung wenn User >24h offline. Hinter Feature-Flag/env, damit ohne SMTP-Creds kein Fehler.

## 7. Risiken

- iOS-Web-Push funktioniert NUR in zum Homescreen hinzugefügter PWA (iOS 16.4+) und nur in Safari-Engine — Onboarding muss das erklären, sonst denkt der Techniker es sei kaputt. Android/Chrome unkritisch.
- Umstellung generateSW→injectManifest am SW birgt Regression beim Auto-Update/Precaching (das 'alte-UI-gecacht'-Problem von Tim 2026-05-23 war genau hier) — sorgfältig testen, skipWaiting/clientsClaim/cleanupOutdatedCaches beibehalten.
- APScheduler in lifespan feuert bei mehreren API-Replicas mehrfach → im Pilot 1 Instanz unkritisch, aber bei Skalierung Locking/eigener worker nötig.
- Push/Email im Request-Pfad dürfen die Notification-Erstellung NICHT blockieren oder zum Rollback bringen (fire schreibt in DB) — strikt als Fire-and-forget mit Error-Swallowing + Logging.
- DSGVO: Push-Payload nicht mit sensiblen Ticket-Inhalten füllen (nur Typ+Kurztitel), Detail erst nach Klick aus authentifizierter API; VAPID-Private-Key als Secret behandeln (Pre-Commit-Secret-Hook, Schicht 5).
- SMTP-Versand ohne konfigurierten Server muss sauber degradieren (kein 500), sonst brechen Chat/Status-Aktionen, die fire() aufrufen.
- Stale Push-Subscriptions (alte Geräte) → failure_count/410-Cleanup nötig, sonst wachsende Fehlversuche.

---

*Konzept zuerst. Bis zur Freigabe durch Tim: kein Code.*
