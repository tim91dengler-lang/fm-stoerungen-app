# Promote auf Produktion — manueller Pfad (Slice 1)

Schicht 7 der Sicherheitsarchitektur: jeder Merge auf `main` deployt automatisch
auf den Staging-Stack (Port 8080). Produktion (Port 80/443) erfolgt **nur
manuell durch Tim** nach Acceptance-Klick.

Für Slice 1 gibt es bewusst noch keinen Auto-Promote-Workflow. Sobald Pilot
ansteht, wird das in einem eigenen ADR + Workflow nachgezogen.

## Manueller Promote-Pfad

Voraussetzungen:
- Staging-Build ist grün und manuell durchgeklickt.
- Tim hat den Image-Tag des Staging-Builds (z. B. `20260521-abc1234`) gemerkt.

Schritte (auf dem Hetzner-Server, als Root):

```bash
# 1. Tag re-pull und re-tag (Tim auf seinem Rechner oder direkt am Server)
docker pull ghcr.io/tim91dengler-lang/fm-api:20260521-abc1234
docker tag ghcr.io/tim91dengler-lang/fm-api:20260521-abc1234 \
           ghcr.io/tim91dengler-lang/fm-api:prod

# 2. Auf dem Server: .env aktualisieren mit API_TAG=20260521-abc1234
cd /srv/fm-stoerungen/prod
nano .env

# 3. pg_dump + Alembic-Migration laufen lassen
ENV=prod ./migrate.sh

# 4. Stack neu pullen + starten
docker compose --env-file .env -f docker-compose.prod.yml pull
docker compose --env-file .env -f docker-compose.prod.yml up -d

# 5. Smoke-Test
curl -fsS http://localhost/health
```

## Rollback

Falls Health-Check rot wird:

```bash
# Sofort: vorherigen API_TAG in .env eintragen, Stack neu starten
docker compose --env-file .env -f docker-compose.prod.yml up -d --force-recreate

# Wenn Migration kaputt: pg_dump restoren
./restore.sh
```

Schicht 8: RTO < 5 min.

## Wenn der Auto-Promote-Workflow kommt

Vor dem ersten Pilot-Go-Live entsteht ein
`.github/workflows/deploy-prod.yml`-Workflow mit `workflow_dispatch`-Trigger.
Bis dahin gilt dieser manuelle Pfad als Norm.
