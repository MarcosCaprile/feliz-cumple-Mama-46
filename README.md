# Ahnang Tetris 💜

Juego completo de Tetris en español, creado como regalo de cumpleaños. Las siete piezas utilizan imágenes PNG distintas del personaje pixelado de Ahnang en poses inspiradas en las formas I, O, T, J, L, S y Z.

## Abrir el juego

Puedes abrir `index.html` directamente o iniciar un servidor local:

```bash
python -m http.server 8000
```

Después abre `http://localhost:8000`.

## Publicarlo con GitHub Pages

1. Crea un repositorio nuevo en GitHub
2. Sube todo el contenido de esta carpeta
3. Abre **Settings → Pages**
4. Selecciona **Deploy from a branch**
5. Elige la rama `main` y la carpeta `/root`

## Controles

- Flechas izquierda y derecha: mover
- Flecha arriba: girar
- Flecha abajo: bajar
- Espacio: caída rápida
- C o Shift: guardar pieza
- P o Escape: pausa

## Estructura

- `index.html`: estructura de la página
- `styles.css`: diseño responsive
- `js/game.js`: lógica completa del Tetris
- `assets/ahnang-portrait.png`: retrato original
- `assets/poses/pose-*.png`: siete poses PNG transparentes
