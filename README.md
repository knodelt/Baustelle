# Baustellen Tycoon

**Baustellen Tycoon** ist ein mobile-first Tycoon-/Idle-Spiel ohne Frontend-Buildschritt. Der Spieler startet als kleiner Bauunternehmer, nimmt Aufträge an, beobachtet den Baufortschritt und baut Fuhrpark, Maschinenbestand und Firmengelände aus.

## Technik

- Vanilla HTML, CSS und JavaScript mit ES Modules
- Progressive Web App mit Offline-App-Shell
- IndexedDB für den sofortigen lokalen Spielstand
- Cloudflare Pages Functions und D1 als optionale Cloud-Kopie
- Gast-Session ohne Login; Tokens werden serverseitig nur als SHA-256-Hash gespeichert

## Projektstruktur

- `public/` – vollständige statische PWA
- `public/js/` – Spielkern, Wirtschaft, Speicherung, API und Oberfläche
- `functions/api/` – Cloudflare Pages Functions
- `schema.sql` – D1-Schema
- `wrangler.jsonc` – Cloudflare-Konfiguration

## Cloudflare Pages

1. Dieses GitHub-Repository in Cloudflare Pages verbinden.
2. Production Branch: `main`
3. Framework Preset: `None`
4. Build Command: leer lassen oder `exit 0`
5. Build Output Directory: `public`

Bei einer normalen Pages-Git-Integration ist kein eigener Deploy-Befehl nötig. Falls die verwendete Cloudflare-Oberfläche ausdrücklich einen **Deploy command** verlangt, muss dort stehen:

```bash
npx wrangler pages deploy public --project-name=baustellentycoon --branch=main
```

Nicht `npx wrangler deploy` verwenden. Dieser Befehl ist für Cloudflare Workers gedacht und kann ein Pages-Projekt nicht korrekt veröffentlichen.

Cloudflare veröffentlicht jeden neuen Commit auf `main` automatisch. Die Pages Functions unter `functions/` werden dabei gemeinsam mit der statischen Anwendung bereitgestellt.

## D1 einrichten

1. Eine D1-Datenbank mit dem Namen `baustellentycoon-db` erstellen.
2. Das Binding `DB` mit dieser Datenbank verbinden.
3. `schema.sql` auf die Datenbank anwenden.
4. Nach dem ersten erfolgreichen Pages-Deploy den folgenden Block mit der echten Datenbank-ID in `wrangler.jsonc` ergänzen:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "baustellentycoon-db",
    "database_id": "ECHTE_D1_DATABASE_ID"
  }
]
```

Beispiel mit Wrangler:

```bash
npx wrangler d1 create baustellentycoon-db
npx wrangler d1 execute baustellentycoon-db --remote --file=schema.sql
```

Die Anwendung bleibt auch ohne erreichbare D1-Verbindung lokal spielbar und synchronisiert später erneut.

## Lokale Entwicklung

Für die statische Oberfläche genügt ein lokaler Webserver im Projektordner, zum Beispiel:

```bash
python3 -m http.server 8080 --directory public
```

Pages Functions und D1 können optional über Wrangler getestet werden. Die eigentliche Anwendung benötigt zur Laufzeit weder Node noch ein Frontend-Framework.

## Version

Initiale Produktversion: `v1.0.0`
