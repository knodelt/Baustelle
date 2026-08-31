# Baustellen Tycoon

**Baustellen Tycoon** ist ein mobile-first Tycoon-/Idle-Spiel. Der Spieler startet als kleiner Bauunternehmer, nimmt Aufträge an, beobachtet den Baufortschritt und baut Fuhrpark, Maschinenbestand und Firmengelände aus.

## Technik

- Vanilla HTML, CSS und JavaScript mit ES Modules
- Progressive Web App mit Offline-App-Shell
- IndexedDB für den sofortigen lokalen Spielstand
- Cloudflare Worker mit Static Assets
- Cloudflare D1 als optionale Cloud-Kopie
- Gast-Session ohne Login; Tokens werden serverseitig nur als SHA-256-Hash gespeichert
- Kein Frontend-Buildschritt und keine Node-Runtime für die Anwendung

## Projektstruktur

- `public/` – vollständige statische PWA
- `public/js/` – Spielkern, Wirtschaft, Speicherung, API und Oberfläche
- `worker/index.js` – API-Routing, Gast-Session und D1-Speicherung
- `schema.sql` – D1-Schema
- `wrangler.jsonc` – Worker-, Asset- und Binding-Konfiguration

## Cloudflare Worker bereitstellen

Das Repository kann direkt über **Workers Builds** mit Cloudflare verbunden werden.

### Einstellungen

- Repository: `knodelt/Baustelle`
- Projektname: `baustelle`
- Produktionsbranch: `main`
- Build-Befehl: leer
- Bereitstellungsbefehl: `npx wrangler deploy`
- Bereitstellungsbefehl für Nicht-Produktions-Branches: `npx wrangler versions upload`
- Pfad: `/`

Der Worker veröffentlicht die Dateien aus `public/` als Static Assets. Nur Aufrufe unter `/api/*` werden zuerst vom Worker verarbeitet. Alle anderen Anfragen werden ohne Worker-Aufruf als statische Dateien ausgeliefert.

Die erste Bereitstellung funktioniert auch ohne D1. In diesem Zustand spielt und speichert die App vollständig lokal auf dem Gerät.

## D1 einrichten

1. Eine D1-Datenbank mit dem Namen `baustellentycoon-db` erstellen.
2. `schema.sql` auf die Datenbank anwenden.
3. Das Binding `DB` in `wrangler.jsonc` mit der echten Datenbank-ID ergänzen.
4. Den Worker erneut bereitstellen.

Beispiel:

```bash
npx wrangler d1 create baustellentycoon-db
npx wrangler d1 execute baustellentycoon-db --remote --file=schema.sql
```

Der von Cloudflare ausgegebene Binding-Block wird in `wrangler.jsonc` eingefügt. Er sieht grundsätzlich so aus:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "baustellentycoon-db",
    "database_id": "ECHTE_D1_DATABASE_ID"
  }
]
```

Keine erfundene oder beispielhafte ID in der produktiven Konfiguration verwenden.

## Lokale Entwicklung

Die komplette Anwendung einschließlich Worker-API und lokaler D1-Emulation startet mit:

```bash
npx wrangler dev
```

Für eine rein statische Oberflächenprüfung genügt weiterhin:

```bash
python3 -m http.server 8080 --directory public
```

## Version

Initiale Produktversion: `v1.0.0`
