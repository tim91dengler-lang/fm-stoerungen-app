# Architecture Decision Records (ADR)

Verbindliche Architektur-Entscheidungen werden hier dokumentiert. Format: kompakt im [MADR-Stil](https://adr.github.io/madr/).

## Pflichtfelder pro ADR

- **Status:** Vorgeschlagen / Akzeptiert / Abgelehnt / Ersetzt durch ADR XXXX
- **Datum:** YYYY-MM-DD
- **plattform-relevant:** ja|nein (siehe Plattform-Anker-Strategie ADR 0001)

## Index

| Nr. | Titel | Status | Plattform-relevant |
|-----|-------|--------|--------------------|
| [0001](0001-plattform-anker-strategie.md) | Plattform-Anker-Strategie: Plattform-Ready, nicht Plattform-Aktiv | Akzeptiert | ja |

## Anlegen eines neuen ADR

```bash
# Nächste Nummer ermitteln und Vorlage kopieren
ls docs/adr/ | grep -E "^[0-9]" | tail -1
cp docs/adr/0001-plattform-anker-strategie.md docs/adr/NNNN-titel.md
```

Inhalt anpassen: Kontext, Optionen mit Trade-offs, Entscheidung, Konsequenzen, Bezug.
