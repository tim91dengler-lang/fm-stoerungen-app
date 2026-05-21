# Phase-0-Setup — Checkliste für Tim (vor Code-Start)

**Stand:** 2026-05-21
**Status:** Tim arbeitet ab. Sobald Schritte 1–3 erledigt, kann Claude mit dem Phase-0-Skelett anfangen.
**Bezug:** Tech-Spec v0.6 Kapitel 11 + CLAUDE.md

> **Sicherheitshinweis zur Token-Übergabe:** Du gibst mir keine API-Keys oder Passwörter direkt im Chat. Stattdessen legst du sie als **GitHub Secrets** im Repo ab (Schritt 2.3) — ich greife im CI/Code darauf zu, sehe die Werte aber nie im Klartext.

---

## Schritt 1 — Joachim-Pilot-Vereinbarung (kritisch)

**Was:** Schriftliche Vereinbarung mit Joachim über die Pilot-Phase.

**Was reingehört:**
- Pilot-Objekt (welches der drei? — Bürohaus Westend, Wohnanlage Sachsenhausen, oder Logistikzentrum?)
- Zeitplan (Pilot-Start, Pilot-Dauer ~3 Monate, danach Bewertung)
- Budget (mind. Hosting-Kosten ~50–80 €/Monat während Pilot, KI-Kosten ~30–80 €/Monat)
- Auftragsverarbeitungsvertrag (AVV) gemäß DSGVO — Joachim verarbeitet Mieterdaten in der App
- Geheimhaltung (NDA-Light, weil noch kein Marktstart)
- Pilot-Endkriterien: was muss erreicht sein, damit Joachim Stufe 1 produktiv beauftragt?

**Wie:** 1 Termin mit Joachim + Aaron, Vertragsentwurf erstelle ich auf Wunsch.

**Was Claude bekommt:** Pilot-Objekt-ID + Pilot-Start-Datum (ich frage dich gezielt, wenn ich's brauche).

---

## Schritt 2 — GitHub-Repo

**Was:** Privates GitHub-Repository für den Code.

**2.1 Account anlegen / einloggen**
- Falls noch nicht: [github.com](https://github.com) → Sign up
- Account-Name z. B. `tdengler-consulting` oder dein Vorname-Nachname

**2.2 Repo anlegen**
- Klick auf „+" oben rechts → „New repository"
- Name: `fm-stoerungen-app`
- **Privat** (Pflicht — wir haben kein öffentliches Repo)
- „Initialize this repository with: README" ✓
- „Add a license" → leer lassen (entscheiden wir später)
- „Create repository"

**2.3 Claude-Zugang einrichten (Personal Access Token)**
- Klick auf dein Avatar oben rechts → „Settings" → „Developer settings" (ganz unten links) → „Personal access tokens" → „Fine-grained tokens" → „Generate new token"
- Name: `claude-fm-stoerungen-app`
- Expiration: 90 days (verlängern wir periodisch)
- Repository access: „Only select repositories" → `fm-stoerungen-app` wählen
- Permissions:
  - Repository → Contents → Read and write
  - Repository → Pull requests → Read and write
  - Repository → Actions → Read and write
  - Repository → Workflows → Read and write
  - Repository → Issues → Read and write
- Token kopieren (sicher!), an mich übermitteln **per AppleID/Bitwarden-Notiz oder anderem sicheren Weg**, oder direkt als Secret unter "Settings → Secrets and variables → Actions" mit Namen `CLAUDE_GITHUB_TOKEN` ablegen

**Was Claude bekommt:** Repo-URL (`https://github.com/USERNAME/fm-stoerungen-app`) + Personal Access Token. Direkt im Chat das Token zu posten ist nicht empfohlen — besser: lege es als GitHub-Repo-Secret an und teile mir mit, dass es da ist.

---

## Schritt 3 — Hetzner Cloud-Account

**Was:** EU-Hoster für Server, Object Storage, Volumes.

**3.1 Account anlegen**
- [hetzner.com/cloud](https://www.hetzner.com/cloud) → „Jetzt registrieren"
- IBAN für SEPA-Lastschrift (Monatsabrechnung)

**3.2 Projekt anlegen**
- Im Dashboard: „New Project" → Name `fm-stoerungen`

**3.3 API-Token erstellen**
- Im Projekt → „Security" → „API tokens" → „Generate API token"
- Description: `claude-deploy`
- Permissions: „Read & Write"
- Token kopieren

**3.4 SSH-Key hinterlegen (für späteren Server-Zugang)**
- „Security" → „SSH Keys" → ich generiere einen SSH-Key in Phase-0-Skelett und du fügst ihn hinzu

**Was Claude bekommt:** API-Token (als GitHub Secret `HETZNER_API_TOKEN` ablegen) + dein Projekt-Name.

**Kosten-Indikation (indikativ, nicht verbindlich):**
- 1× Server CPX21 (App) ~6 €/Monat
- 1× Server CPX21 (Postgres) ~6 €/Monat
- Object Storage 100 GB ~1,50 €/Monat
- Backups + Snapshots ~5 €/Monat
- **Summe Staging+Prod:** ~25–40 €/Monat in Pilot-Phase

---

## Schritt 4 — Domain

**Was:** URL unter der die App erreichbar ist.

**Empfehlung:** Subdomain deiner bestehenden Domain (`tdengler-consulting.com`).

**4.1 Bei deinem Domain-Provider** (vermutlich wo `tdengler-consulting.com` registriert ist):
- DNS-Record anlegen: `fm-app.tdengler-consulting.com` als CNAME oder A-Record (Wert pflege ich nach Server-Setup ein)
- Alternativ: eigene Joachim-Domain wie `fm-loeffler.de` registrieren (~12 €/Jahr)

**Was Claude bekommt:** Domain-Name (z. B. `fm-app.tdengler-consulting.com`) + Domain-Provider-Name (für DNS-Setup-Anleitung später).

---

## Schritt 5 — Anthropic Console-Account (für KI-Light)

**Was:** API-Zugang zu Claude-Modellen für die 3 KI-Light-Use-Cases.

**5.1 Account anlegen**
- [console.anthropic.com](https://console.anthropic.com) → Sign up
- Kreditkarte hinterlegen (Pay-as-you-go, kein Mindestbetrag)

**5.2 API-Key erstellen**
- „API Keys" → „Create Key"
- Name: `fm-stoerungen-app-prod`
- Key kopieren

**5.3 Zero-Retention-Vertrag**
- Account-Settings → „Privacy" — Zero-Retention aktivieren (Prompts/Antworten werden nicht beim Anbieter zwischengespeichert)
- AVV: über [anthropic.com/legal](https://www.anthropic.com/legal) Data Processing Addendum (DPA) gegenzeichnen — Tim bei Pilot-Start, vor Stufe-1-Live

**5.4 Budget-Cap einstellen**
- „Billing" → „Usage limits" — Monats-Cap z. B. 100 €

**Was Claude bekommt:** API-Key (als GitHub Secret `ANTHROPIC_API_KEY` ablegen).

**Kosten-Indikation:** Pilot-Phase ~10–30 €/Monat, danach 30–80 €/Monat.

---

## Schritt 6 — SMTP-Provider (für Notifications)

**Was:** Mail-Versand für In-App-Notifications (z. B. „neue Zuweisung", Bereitschafts-Alerts).

**Optionen:**
- **Mailjet** (EU) — kostenlos bis 200 Mails/Tag, danach ab ~7 €/Monat
- **Postmark** (EU-Region wählbar) — ab ~10 €/Monat
- **Office-365-SMTP** mit Joachims-Account — möglich, aber etwas frickelig (App-Password nötig)

**Empfehlung:** Mailjet — kostenlose Schwelle reicht für Pilot.

**Was Claude bekommt:** SMTP-Host + Port + Username + Password als GitHub Secrets (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

---

## Schritt 7 — Pen-Test-Anbieter anfragen (vor Pilot-Go-Live)

**Was:** Externe Sicherheitsprüfung vor dem Produktivstart bei Joachim.

**Empfohlene Anbieter (EU, Deutsch):**
- [HotSEC](https://www.hotsec.de/) — mittelständig, Web-App-Tests
- [Cure53](https://cure53.de/) — Premium, Berlin
- [SySS](https://www.syss.de/) — Tübingen, viele FM/SaaS-Kunden

**Aufwand:** 1-Tages-Test ~1.500 €, ausführlicher 2-Tages-Test ~3.000 €.

**Zeitpunkt:** Tim macht eine **unverbindliche Anfrage jetzt** (Verfügbarkeit, Slot in 4–5 Monaten reservieren). Verbindliche Beauftragung erst, wenn Pilot-Bau auf Zielgeraden ist.

**Was Claude bekommt:** Geplantes Datum des Pen-Tests (für Phasenplan).

---

## Übergabe an Claude — was als nächstes passiert

Sobald Schritte 1–3 (Joachim-Vereinbarung + GitHub-Repo + Hetzner-Account) abgehakt sind, sag mir Bescheid. Dann starte ich:

1. **Repo-Skelett** anlegen: `apps/web` (React+Vite), `apps/api` (FastAPI), `packages/shared`, `docs/` (Konzepte + ADRs übertragen)
2. **Docker-Compose** für Dev-Umgebung (Postgres + Keycloak + Backend + Frontend)
3. **GitHub Actions** mit allen 6 Sicherheits-Schichten (Lint, Test, Semgrep, CodeQL, Renovate-Config, Build)
4. **Hetzner-Server** provisionieren (1× App + 1× DB, Caddy-Reverse-Proxy, systemd-Services)
5. **DNS** richtig setzen (du gibst mir Subdomain, ich pflege den DNS-Record)
6. **Hello-World-Smoke-Test:** Browser → `https://fm-app.tdengler-consulting.com` → Login-Stub → API → DB → zurück

Phase 0 dauert ~5 Personentage Claude-Arbeit. Du klickst am Ende durch und gibst grünes Licht für Phase 1.

**Erster richtiger Vertical Slice in Phase 1:**
„Benutzer kann sich einloggen und ein leeres Ticket anlegen" — Auth + Tickets-API + minimale Tickets-UI durch alle Schichten.

---

## Übersicht — was bei dir bleibt, was Claude übernimmt

| Aufgabe | Tim | Claude |
|---|:---:|:---:|
| Joachim-Vereinbarungen, Verträge | ✓ | — |
| Account-Anlage (GitHub, Hetzner, Anthropic, SMTP) | ✓ | — |
| Tokens als GitHub Secrets hinterlegen | ✓ | — |
| Code schreiben, testen, deployen | — | ✓ |
| CI/CD konfigurieren | — | ✓ |
| Server-Provisionierung über Hetzner-API | — | ✓ |
| DNS-Record-Setzen | — | ✓ (mit Hetzner-DNS), Tim bei externem Provider |
| Datenbank-Migrationen | — | ✓ |
| Backup-Strategie + Restore-Tests | — | ✓ |
| Sicherheits-Scans + Pen-Test-Koordination | — | ✓ |
| **Acceptance-Reviews** (Staging-Klicks, Promote-Freigabe) | ✓ | — |
| Joachim-Schulung Pilot | ✓ | — |

---

*Sobald Schritte 1–3 erledigt sind: kurz Bescheid geben, ich lege los.*
