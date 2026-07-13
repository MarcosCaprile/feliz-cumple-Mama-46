"use strict";

window.addEventListener("DOMContentLoaded", initGame);

function initGame() {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 32;

  const SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],

    O: [
      [1, 1],
      [1, 1]
    ],

    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],

    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],

    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],

    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],

    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  };

  const TYPES = Object.keys(SHAPES);

  const COLORS = {
    I: "#4ed8ff",
    O: "#ffd65a",
    T: "#c978ff",
    J: "#658aff",
    L: "#ff9b4a",
    S: "#62df84",
    Z: "#ff6784"
  };

  const POSE_CONFIG = {
    I: {
      nativeCols: 1,
      nativeRows: 4,
      baseQuarterTurns: -1,
      scale: 1.42
    },

    O: {
      nativeCols: 2,
      nativeRows: 2,
      baseQuarterTurns: 0,
      scale: 1.02
    },

    T: {
      nativeCols: 3,
      nativeRows: 2,
      baseQuarterTurns: 0,
      scale: 1.18
    },

    J: {
      nativeCols: 3,
      nativeRows: 2,
      baseQuarterTurns: 0,
      scale: 1.16
    },

    L: {
      nativeCols: 3,
      nativeRows: 2,
      baseQuarterTurns: 0,
      scale: 1.16
    },

    S: {
      nativeCols: 3,
      nativeRows: 2,
      baseQuarterTurns: 0,
      scale: 1.15
    },

    Z: {
      nativeCols: 3,
      nativeRows: 2,
      baseQuarterTurns: 0,
      scale: 1.15
    }
  };

  const gameCanvas =
    document.getElementById("gameCanvas");

  const nextCanvas =
    document.getElementById("nextCanvas");

  const scoreNode =
    document.getElementById("score");

  const linesNode =
    document.getElementById("lines");

  const overlay =
    document.getElementById("gameOverlay");

  const overlayTitle =
    document.getElementById("overlayTitle");

  const overlayMessage =
    document.getElementById("overlayMessage");

  const overlayButton =
    document.getElementById("overlayButton");

  const pauseButton =
    document.getElementById("pauseButton");

  const restartButton =
    document.getElementById("restartButton");

  if (
    !gameCanvas ||
    !nextCanvas ||
    !scoreNode ||
    !linesNode ||
    !overlay ||
    !overlayTitle ||
    !overlayMessage ||
    !overlayButton ||
    !pauseButton ||
    !restartButton
  ) {
    console.error(
      "Tetripil no pudo iniciarse: faltan elementos en index.html."
    );

    return;
  }

  const gameCtx =
    gameCanvas.getContext("2d");

  const nextCtx =
    nextCanvas.getContext("2d");

  if (!gameCtx || !nextCtx) {
    console.error(
      "Tetripil no pudo obtener el contexto del canvas."
    );

    return;
  }

  gameCtx.imageSmoothingEnabled = false;
  nextCtx.imageSmoothingEnabled = false;

  const poseImages = {};

  let board = createBoard();
  let activePiece = null;
  let nextType = "T";

  let score = 0;
  let lines = 0;
  let level = 1;

  let running = false;
  let paused = false;

  let lastTime = 0;
  let fallAccumulator = 0;
  let animationId = null;

  let bag = [];

  function loadPoseImages() {
    TYPES.forEach((type) => {
      const image = new Image();

      image.onload = () => {
        poseImages[type] = image;

        draw();
        drawPreview();
      };

      image.onerror = () => {
        poseImages[type] = null;

        console.warn(
          `No se encontró assets/poses/pose-${type}.png`
        );
      };

      image.src =
        `assets/poses/pose-${type}.png`;
    });
  }

  function createBoard() {
    return Array.from(
      {
        length: ROWS
      },
      () => Array(COLS).fill(null)
    );
  }

  function copyMatrix(matrix) {
    return matrix.map(
      (row) => row.slice()
    );
  }

  function rotateMatrixClockwise(matrix) {
    return matrix[0].map(
      (_, x) => {
        return matrix
          .map((row) => row[x])
          .reverse();
      }
    );
  }

  function shuffle(items) {
    for (
      let i = items.length - 1;
      i > 0;
      i -= 1
    ) {
      const j = Math.floor(
        Math.random() * (i + 1)
      );

      [
        items[i],
        items[j]
      ] = [
        items[j],
        items[i]
      ];
    }

    return items;
  }

  function randomType() {
    if (bag.length === 0) {
      bag = shuffle(
        TYPES.slice()
      );
    }

    return bag.pop();
  }

  function createPiece(
    type = randomType()
  ) {
    const matrix =
      copyMatrix(SHAPES[type]);

    return {
      type,
      matrix,
      rotation: 0,

      x: Math.floor(
        (COLS - matrix[0].length) / 2
      ),

      y: -1
    };
  }

  function occupiedBounds(matrix) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) {
          return;
        }

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    return {
      minX,
      minY,
      maxX,
      maxY,

      width:
        maxX - minX + 1,

      height:
        maxY - minY + 1
    };
  }

  function collides(piece) {
    for (
      let y = 0;
      y < piece.matrix.length;
      y += 1
    ) {
      for (
        let x = 0;
        x < piece.matrix[y].length;
        x += 1
      ) {
        if (!piece.matrix[y][x]) {
          continue;
        }

        const boardX =
          piece.x + x;

        const boardY =
          piece.y + y;

        if (
          boardX < 0 ||
          boardX >= COLS ||
          boardY >= ROWS
        ) {
          return true;
        }

        if (
          boardY >= 0 &&
          board[boardY][boardX]
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function canControl() {
    return (
      running &&
      !paused &&
      activePiece !== null
    );
  }

  function move(dx) {
    if (!canControl()) {
      return;
    }

    activePiece.x += dx;

    if (collides(activePiece)) {
      activePiece.x -= dx;
    }

    draw();
  }

  function stepDown(
    manual = false
  ) {
    if (!canControl()) {
      return;
    }

    activePiece.y += 1;

    if (collides(activePiece)) {
      activePiece.y -= 1;
      lockPiece();
    } else if (manual) {
      score += 1;
      updateStats();
    }

    fallAccumulator = 0;

    draw();
  }

  function hardDrop() {
    if (!canControl()) {
      return;
    }

    let distance = 0;

    while (
      !collides({
        ...activePiece,
        y: activePiece.y + 1
      })
    ) {
      activePiece.y += 1;
      distance += 1;
    }

    score += distance * 2;

    updateStats();
    lockPiece();
    draw();
  }

  function rotatePiece() {
    if (
      !canControl() ||
      activePiece.type === "O"
    ) {
      return;
    }

    const originalMatrix =
      activePiece.matrix;

    const originalX =
      activePiece.x;

    const originalY =
      activePiece.y;

    const originalRotation =
      activePiece.rotation;

    activePiece.matrix =
      rotateMatrixClockwise(
        originalMatrix
      );

    activePiece.rotation =
      (originalRotation + 1) % 4;

    const kicks = [
      [0, 0],
      [-1, 0],
      [1, 0],
      [-2, 0],
      [2, 0],
      [0, -1]
    ];

    for (
      const [dx, dy] of kicks
    ) {
      activePiece.x =
        originalX + dx;

      activePiece.y =
        originalY + dy;

      if (!collides(activePiece)) {
        draw();
        return;
      }
    }

    activePiece.matrix =
      originalMatrix;

    activePiece.rotation =
      originalRotation;

    activePiece.x =
      originalX;

    activePiece.y =
      originalY;
  }

  function lockPiece() {
    activePiece.matrix.forEach(
      (row, y) => {
        row.forEach((value, x) => {
          if (!value) {
            return;
          }

          const boardY =
            activePiece.y + y;

          const boardX =
            activePiece.x + x;

          if (boardY >= 0) {
            board[boardY][boardX] =
              activePiece.type;
          }
        });
      }
    );

    clearFullLines();

    activePiece =
      createPiece(nextType);

    nextType =
      randomType();

    drawPreview();

    if (collides(activePiece)) {
      endGame();
    }
  }

  function clearFullLines() {
    let removed = 0;

    for (
      let y = ROWS - 1;
      y >= 0;
      y -= 1
    ) {
      if (
        board[y].every(Boolean)
      ) {
        board.splice(y, 1);

        board.unshift(
          Array(COLS).fill(null)
        );

        removed += 1;
        y += 1;
      }
    }

    if (removed === 0) {
      return;
    }

    const lineScores = [
      0,
      100,
      300,
      500,
      800
    ];

    score +=
      lineScores[removed] *
      level;

    lines += removed;

    level =
      Math.floor(lines / 10) + 1;

    updateStats();
  }

  function fallDelay() {
    return Math.max(
      90,
      900 - (level - 1) * 70
    );
  }

  function drawBoardBackground() {
    gameCtx.fillStyle =
      "#090a14";

    gameCtx.fillRect(
      0,
      0,
      gameCanvas.width,
      gameCanvas.height
    );

    gameCtx.strokeStyle =
      "rgba(186, 164, 225, 0.18)";

    gameCtx.lineWidth = 1;

    for (
      let x = 0;
      x <= COLS;
      x += 1
    ) {
      gameCtx.beginPath();

      gameCtx.moveTo(
        x * CELL,
        0
      );

      gameCtx.lineTo(
        x * CELL,
        ROWS * CELL
      );

      gameCtx.stroke();
    }

    for (
      let y = 0;
      y <= ROWS;
      y += 1
    ) {
      gameCtx.beginPath();

      gameCtx.moveTo(
        0,
        y * CELL
      );

      gameCtx.lineTo(
        COLS * CELL,
        y * CELL
      );

      gameCtx.stroke();
    }
  }

  function lighten(
    hex,
    amount
  ) {
    const value =
      Number.parseInt(
        hex.slice(1),
        16
      );

    const red =
      Math.min(
        255,
        (value >> 16) + amount
      );

    const green =
      Math.min(
        255,
        ((value >> 8) & 255) +
          amount
      );

    const blue =
      Math.min(
        255,
        (value & 255) + amount
      );

    return (
      `rgb(${red}, ${green}, ${blue})`
    );
  }

  function drawBlock(
    context,
    pixelX,
    pixelY,
    size,
    type,
    alpha = 1
  ) {
    context.save();
    context.globalAlpha = alpha;

    const gradient =
      context.createLinearGradient(
        pixelX,
        pixelY,
        pixelX,
        pixelY + size
      );

    gradient.addColorStop(
      0,
      lighten(
        COLORS[type],
        24
      )
    );

    gradient.addColorStop(
      1,
      COLORS[type]
    );

    context.fillStyle =
      gradient;

    context.fillRect(
      pixelX + 2,
      pixelY + 2,
      size - 4,
      size - 4
    );

    context.strokeStyle =
      "rgba(255, 255, 255, 0.45)";

    context.strokeRect(
      pixelX + 2.5,
      pixelY + 2.5,
      size - 5,
      size - 5
    );

    context.fillStyle =
      "rgba(255, 255, 255, 0.17)";

    context.fillRect(
      pixelX + 5,
      pixelY + 5,
      size - 10,
      Math.max(
        3,
        size * 0.15
      )
    );

    context.restore();
  }

  function drawPoseImage(
    context,
    type,
    rotation,
    centerX,
    centerY,
    cellSize,
    alpha = 1
  ) {
    const image =
      poseImages[type];

    if (
      !image ||
      !image.naturalWidth ||
      !image.naturalHeight
    ) {
      return;
    }

    const config =
      POSE_CONFIG[type];

    const targetWidth =
      config.nativeCols *
      cellSize;

    const targetHeight =
      config.nativeRows *
      cellSize;

    const containScale =
      Math.min(
        targetWidth /
          image.naturalWidth,

        targetHeight /
          image.naturalHeight
      );

    const drawWidth =
      image.naturalWidth *
      containScale *
      config.scale;

    const drawHeight =
      image.naturalHeight *
      containScale *
      config.scale;

    const quarterTurns =
      config.baseQuarterTurns +
      rotation;

    context.save();

    context.translate(
      centerX,
      centerY
    );

    context.rotate(
      quarterTurns *
      Math.PI /
      2
    );

    context.globalAlpha =
      alpha;

    context.imageSmoothingEnabled =
      false;

    context.drawImage(
      image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    context.restore();
  }

  function drawActivePose(piece) {
    const bounds =
      occupiedBounds(
        piece.matrix
      );

    const boxX =
      (
        piece.x +
        bounds.minX
      ) *
      CELL;

    const boxY =
      (
        piece.y +
        bounds.minY
      ) *
      CELL;

    const boxWidth =
      bounds.width *
      CELL;

    const boxHeight =
      bounds.height *
      CELL;

    drawPoseImage(
      gameCtx,
      piece.type,
      piece.rotation,
      boxX + boxWidth / 2,
      boxY + boxHeight / 2,
      CELL,
      1
    );
  }

  function drawPiece(
    piece,
    {
      ghost = false
    } = {}
  ) {
    piece.matrix.forEach(
      (row, y) => {
        row.forEach(
          (value, x) => {
            if (!value) {
              return;
            }

            const boardX =
              piece.x + x;

            const boardY =
              piece.y + y;

            if (boardY < 0) {
              return;
            }

            drawBlock(
              gameCtx,
              boardX * CELL,
              boardY * CELL,
              CELL,
              piece.type,
              ghost
                ? 0.16
                : 0.78
            );
          }
        );
      }
    );

    if (!ghost) {
      drawActivePose(piece);
    }
  }

  function draw() {
    drawBoardBackground();

    for (
      let y = 0;
      y < ROWS;
      y += 1
    ) {
      for (
        let x = 0;
        x < COLS;
        x += 1
      ) {
        const type =
          board[y][x];

        if (type) {
          drawBlock(
            gameCtx,
            x * CELL,
            y * CELL,
            CELL,
            type,
            1
          );
        }
      }
    }

    if (!activePiece) {
      return;
    }

    let ghostY =
      activePiece.y;

    while (
      !collides({
        ...activePiece,
        y: ghostY + 1
      })
    ) {
      ghostY += 1;
    }

    drawPiece(
      {
        ...activePiece,
        y: ghostY
      },
      {
        ghost: true
      }
    );

    drawPiece(activePiece);
  }

  function drawPreview() {
    nextCtx.clearRect(
      0,
      0,
      nextCanvas.width,
      nextCanvas.height
    );

    if (!nextType) {
      return;
    }

    const matrix =
      SHAPES[nextType];

    const bounds =
      occupiedBounds(matrix);

    const padding = 16;

    const cellSize =
      Math.min(
        34,

        Math.floor(
          (
            nextCanvas.width -
            padding * 2
          ) /
          bounds.width
        ),

        Math.floor(
          (
            nextCanvas.height -
            padding * 2
          ) /
          bounds.height
        )
      );

    const totalWidth =
      bounds.width *
      cellSize;

    const totalHeight =
      bounds.height *
      cellSize;

    const offsetX =
      (
        nextCanvas.width -
        totalWidth
      ) /
      2;

    const offsetY =
      (
        nextCanvas.height -
        totalHeight
      ) /
      2;

    matrix.forEach(
      (row, y) => {
        row.forEach(
          (value, x) => {
            if (!value) {
              return;
            }

            drawBlock(
              nextCtx,

              offsetX +
              (
                x -
                bounds.minX
              ) *
              cellSize,

              offsetY +
              (
                y -
                bounds.minY
              ) *
              cellSize,

              cellSize,
              nextType,
              0.78
            );
          }
        );
      }
    );

    drawPoseImage(
      nextCtx,
      nextType,
      0,
      offsetX + totalWidth / 2,
      offsetY + totalHeight / 2,
      cellSize,
      1
    );
  }

  function updateStats() {
    scoreNode.textContent =
      score.toLocaleString(
        "es-ES"
      );

    linesNode.textContent =
      String(lines);
  }

  function showOverlay(
    title,
    message,
    buttonText
  ) {
    overlayTitle.textContent =
      title;

    overlayMessage.textContent =
      message;

    overlayButton.textContent =
      buttonText;

    overlay.classList.add(
      "is-visible"
    );
  }

  function hideOverlay() {
    overlay.classList.remove(
      "is-visible"
    );
  }

  function startGame() {
    if (
      animationId !== null
    ) {
      cancelAnimationFrame(
        animationId
      );
    }

    board = createBoard();
    bag = [];

    score = 0;
    lines = 0;
    level = 1;

    nextType =
      randomType();

    activePiece =
      createPiece(
        randomType()
      );

    running = true;
    paused = false;

    pauseButton.textContent =
      "Pausa";

    fallAccumulator = 0;

    lastTime =
      performance.now();

    updateStats();
    drawPreview();
    hideOverlay();
    draw();

    animationId =
      requestAnimationFrame(
        gameLoop
      );
  }

  function endGame() {
    running = false;

    if (
      animationId !== null
    ) {
      cancelAnimationFrame(
        animationId
      );

      animationId = null;
    }

    showOverlay(
      "Fin de la partida",

      `Has conseguido ${score.toLocaleString("es-ES")} puntos. ¡Pilar estará orgullosa!`,

      "Jugar otra vez"
    );
  }

  function togglePause() {
    if (!running) {
      return;
    }

    paused = !paused;

    pauseButton.textContent =
      paused
        ? "Continuar"
        : "Pausa";

    if (paused) {
      showOverlay(
        "Pausa",

        "Descansa un momento y continúa cuando quieras",

        "Continuar"
      );
    } else {
      hideOverlay();

      lastTime =
        performance.now();
    }
  }

  function gameLoop(time) {
    if (!running) {
      return;
    }

    const delta =
      Math.min(
        time - lastTime,
        100
      );

    lastTime = time;

    if (!paused) {
      fallAccumulator +=
        delta;

      if (
        fallAccumulator >=
        fallDelay()
      ) {
        stepDown(false);
      }

      draw();
    }

    animationId =
      requestAnimationFrame(
        gameLoop
      );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      const controlledKeys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowDown",
        "ArrowUp",
        " "
      ];

      if (
        controlledKeys.includes(
          event.key
        )
      ) {
        event.preventDefault();
      }

      if (
        event.key ===
        "ArrowLeft"
      ) {
        move(-1);
      } else if (
        event.key ===
        "ArrowRight"
      ) {
        move(1);
      } else if (
        event.key ===
        "ArrowDown"
      ) {
        stepDown(true);
      } else if (
        event.key ===
        "ArrowUp"
      ) {
        rotatePiece();
      } else if (
        event.key === " "
      ) {
        hardDrop();
      } else if (
        event.key.toLowerCase() ===
          "p" ||
        event.key ===
          "Escape"
      ) {
        togglePause();
      }
    }
  );

  document
    .querySelectorAll(
      "[data-action]"
    )
    .forEach((button) => {
      button.addEventListener(
        "pointerdown",
        (event) => {
          event.preventDefault();

          const actions = {
            left:
              () => move(-1),

            right:
              () => move(1),

            rotate:
              rotatePiece,

            down:
              () => stepDown(true),

            drop:
              hardDrop
          };

          const action =
            actions[
              button.dataset.action
            ];

          if (action) {
            action();
          }
        }
      );
    });

  overlayButton.addEventListener(
    "click",
    () => {
      if (paused) {
        togglePause();
      } else {
        startGame();
      }
    }
  );

  restartButton.addEventListener(
    "click",
    startGame
  );

  pauseButton.addEventListener(
    "click",
    togglePause
  );

  loadPoseImages();

  activePiece =
    createPiece("T");

  draw();
  drawPreview();
}
