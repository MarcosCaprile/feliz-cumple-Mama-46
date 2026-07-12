# Ahnang Tetris 💜

Ein vollständiges, responsives Tetris-Spiel als Geburtstagsgeschenk. Alle Tetrominos werden als Retro-Pixel-Posen der Figur gerendert.

## Lokal starten

Einfach `index.html` im Browser öffnen.

Für einen lokalen Webserver:

```bash
python -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Auf GitHub Pages veröffentlichen

1. Einen neuen GitHub-Repository erstellen
2. Den kompletten Inhalt dieses Ordners hochladen
3. Unter **Settings → Pages** als Quelle `Deploy from a branch` wählen
4. Branch `main` und Ordner `/root` auswählen
5. Nach kurzer Zeit ist die Website über die angezeigte GitHub-Pages-Adresse erreichbar

## Steuerung

- Pfeiltasten links/rechts: bewegen
- Pfeil hoch: drehen
- Pfeil runter: schneller fallen
- Leertaste: Hard Drop
- C oder Shift: Teil halten
- P oder Escape: Pause

## Dateien

- `index.html` – Seitenstruktur
- `styles.css` – Design und mobile Ansicht
- `js/game.js` – vollständige Tetris-Logik und Pixel-Pose-Rendering
- `assets/ahnang-portrait.png` – das bereitgestellte Retro-Pixel-Bild
