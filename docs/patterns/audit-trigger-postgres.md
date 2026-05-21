# Pattern: Audit-Log über Postgres-Trigger und Session-Variablen

**Plattform-relevant:** ja
**Status:** Konzept aus Tech-Spec Kapitel 5.5, Implementation in Stufe 1.

## Einsatzgebiet

Vollständiger Audit-Trail aller schreibenden Datenbank-Operationen ohne Code-Aufwand pro Endpoint. Pflicht für DSGVO + Compliance + Streit-Szenarien.

## Idee

Ein **generischer Postgres-Trigger** auf jeder Tabelle protokolliert Insert/Update/Delete in eine zentrale `system_audit`-Tabelle. Der Backend-Service setzt **pro Request** Session-Variablen mit User-ID und Rolle, die der Trigger ausliest.

## Wie umsetzen

**1. Audit-Tabelle:**

```sql
CREATE TABLE system_audit (
  id              BIGSERIAL PRIMARY KEY,
  mandant_id      UUID NOT NULL,
  aktor_user_id   UUID,
  aktor_rolle_id  TEXT,
  tabelle         TEXT NOT NULL,
  datensatz_id    TEXT NOT NULL,
  aktion          TEXT NOT NULL,         -- 'insert','update','delete'
  vorher          JSONB,
  nachher         JSONB,
  zeit            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_audit_tabelle ON system_audit(tabelle, datensatz_id, zeit);
CREATE INDEX idx_system_audit_mandant_zeit ON system_audit(mandant_id, zeit);
```

**2. Trigger-Funktion (einmalig):**

```sql
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO system_audit(mandant_id, aktor_user_id, aktor_rolle_id,
                            tabelle, datensatz_id, aktion, vorher, nachher, zeit)
  VALUES (
    COALESCE(NEW.mandant_id, OLD.mandant_id),
    NULLIF(current_setting('app.user_id', TRUE), '')::UUID,
    NULLIF(current_setting('app.rolle_id', TRUE), ''),
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**3. Trigger an Tabellen hängen:**

```sql
CREATE TRIGGER audit_ticket   AFTER INSERT OR UPDATE OR DELETE ON ticket
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_geschaeftspartner AFTER INSERT OR UPDATE OR DELETE ON geschaeftspartner
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
-- usw. für alle Schreib-Tabellen
```

**4. Session-Variablen vom Backend setzen:**

```python
# Beim Acquire einer DB-Connection pro Request
async with db.transaction() as conn:
    await conn.execute("SELECT set_config('app.user_id', :uid, true)",
                       uid=str(current_user.id))
    await conn.execute("SELECT set_config('app.rolle_id', :rid, true)",
                       rid=current_user.rolle_id)
    # ... reguläre Queries ...
```

Das `true` macht die Setting Transaction-lokal — kein Cross-Request-Leak.

## Eigenschaften

1. **Zero Code-Pflicht pro Endpoint** — Audit greift automatisch über Trigger.
2. **Vollständigkeit garantiert** — auch direkte SQL-Manipulationen werden protokolliert.
3. **Vorher + Nachher als JSONB** — Diff sichtbar, alle Felder erfasst.
4. **Mandantenfähig ab Tag 1** — `mandant_id` mit auditiert.
5. **Performance OK** für 10–100 MA-Größenordnung. Ab 1000+ Transaktionen/Sek: dedizierte Audit-Stream-Lösung.

## Stolperfallen

- **DROP/TRUNCATE wird nicht erfasst** — andere DDL-Operationen auch nicht. Bei DB-Migration zusätzliches Audit nötig.
- **JSONB von OLD/NEW enthält große Felder** — Volltexte, Embeddings. Konfigurieren über `ALTER TABLE ... SET LOGGED` oder Spalten-Whitelist im Trigger.
- **Session-Variable wird vom Connection-Pool wiederverwendet** — daher `true` (transaction-local) in `set_config`.
- **system_audit wird sehr groß** — Partitionierung nach Monat ab ~10 GB.

## Restzweifel

Bei sehr sensiblen Personendaten (z. B. Mieter-Namen, Telefon) — sollen die im Audit JSONB landen oder pseudonymisiert? Antwort für Stufe 1: ja, im Audit (DSGVO-Recht auf Löschung wird über Audit-Löschung gelöst, mit Sonder-Permission).

## Verwandt

- [konsistente-migration.md](konsistente-migration.md) — Migrationen müssen Audit mit migrieren
