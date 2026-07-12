"use strict";

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

const gameCanvas = document.getElementById("gameCanvas");
const gameCtx = gameCanvas.getContext("2d");

const nextCanvas = document.getElementById("nextCanvas");
const nextCtx = nextCanvas.getContext("2d");

const holdCanvas = document.getElementById("holdCanvas");
const holdCtx = holdCanvas.getContext("2d");

const scoreNode = document.getElementById("score");
const levelNode = document.getElementById("level");
const linesNode = document.getElementById("lines");

const overlay = document.getElementById("gameOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayMessage = document.getElementById("overlayMessage");
const overlayButton = document.getElementById("overlayButton");

for (const context of [gameCtx, nextCtx, holdCtx]) {
  context.imageSmoothingEnabled = false;
}

const poseImages = {};

let board = createBoard();
let activePiece = null;
let nextType = "L";
let heldType = null;

let holdAvailable = true;

let score = 0;
let lines = 0;
let level = 1;

let running = false;
let paused = false;

let lastTime = 0;
let fallAccumulator = 0;
let animationId = null;

let bag = [];

function loadImages() {
  return Promise.all(
    TYPES.map((type) => {
      return new Promise((resolve) => {
        const image = new Image();

        image.src = `assets/poses/pose-${type}.png`;

        image.onload = () => {
          poseImages[type] = image;
          resolve();
        };

        image.onerror = () => {
          poseImages[type] = null;
          resolve();
        };
      });
    })
  );
}

function createBoard() {
  return Array.from(
    { length: ROWS },
    () => Array(COLS).fill(null)
  );
}

function copyMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, x) => {
    return matrix.map((row) => row[x]).reverse();
  });
}

function randomType() {
  if (!bag.length) {
    bag = TYPES
      .slice()
      .sort(() => Math.random() - 0.5);
  }

  return bag.pop();
}

function createPiece(type = randomType()) {
  const matrix = copyMatrix(SHAPES[type]);

  return {
    type,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: -1
  };
}

function collides(piece) {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) {
        continue;
      }

      const boardX = piece.x + x;
      const boardY = piece.y + y;

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true;
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true;
      }
    }
  }

  return false;
}

function occupiedBounds(matrix) {
  let minX = 99;
  let minY = 99;
  let maxX = -1;
  let maxY = -1;

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
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function lockPiece() {
  activePiece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      const boardY = activePiece.y + y;
      const boardX = activePiece.x + x;

      if (boardY >= 0) {
        board[boardY][boardX] = activePiece.type;
      }
    });
  });

  clearFullLines();

  activePiece = createPiece(nextType);
  nextType = randomType();

  holdAvailable = true;

  drawPreviews();

  if (collides(activePiece)) {
    endGame();
  }
}

function clearFullLines() {
  let removed = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(Boolean)) {
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));

      removed++;
      y++;
    }
  }

  if (removed) {
    score += [0, 100, 300, 500, 800][removed] * level;
    lines += removed;
    level = Math.floor(lines / 10) + 1;

    updateStats();
  }
}

function move(dx) {
  if (!running || paused) {
    return;
  }

  activePiece.x += dx;

  if (collides(activePiece)) {
    activePiece.x -= dx;
  }

  draw();
}

function softDrop() {
  if (!running || paused) {
    return;
  }

  activePiece.y++;

  if (collides(activePiece)) {
    activePiece.y--;
    lockPiece();
  } else {
    score += 1;
    updateStats();
  }

  fallAccumulator = 0;

  draw();
}

function hardDrop() {
  if (!running || paused) {
    return;
  }

  let distance = 0;

  while (
    !collides({
      ...activePiece,
      y: activePiece.y + 1
    })
  ) {
    activePiece.y++;
    distance++;
  }

  score += distance * 2;

  updateStats();
  lockPiece();
  draw();
}

function rotatePiece() {
  if (!running || paused) {
    return;
  }

  const oldMatrix = activePiece.matrix;
  const oldX = activePiece.x;

  activePiece.matrix = rotateMatrix(activePiece.matrix);

  for (const offset of [0, -1, 1, -2, 2]) {
    activePiece.x = oldX + offset;

    if (!collides(activePiece)) {
      draw();
      return;
    }
  }

  activePiece.matrix = oldMatrix;
  activePiece.x = oldX;
}

function holdPiece() {
  if (!running || paused || !holdAvailable) {
    return;
  }

  const currentType = activePiece.type;

  if (heldType) {
    activePiece = createPiece(heldType);
    heldType = currentType;
  } else {
    heldType = currentType;
    activePiece = createPiece(nextType);
    nextType = randomType();
  }

  holdAvailable = false;

  drawPreviews();
  draw();
}

function fallDelay() {
  return Math.max(
    100,
    900 - (level - 1) * 70
  );
}

function drawBoardBackground() {
  gameCtx.fillStyle = "#090a14";
  gameCtx.fillRect(
    0,
    0,
    gameCanvas.width,
    gameCanvas.height
  );

  gameCtx.strokeStyle = "rgba(186, 164, 225, 0.18)";
  gameCtx.lineWidth = 1;

  for (let x = 0; x <= COLS; x++) {
    gameCtx.beginPath();
    gameCtx.moveTo(x * CELL, 0);
    gameCtx.lineTo(x * CELL, ROWS * CELL);
    gameCtx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    gameCtx.beginPath();
    gameCtx.moveTo(0, y * CELL);
    gameCtx.lineTo(COLS * CELL, y * CELL);
    gameCtx.stroke();
  }
}

function drawBlock(x, y, type, alpha = 1) {
  if (y < 0) {
    return;
  }

  const pixelX = x * CELL;
  const pixelY = y * CELL;

  gameCtx.save();
  gameCtx.globalAlpha = alpha;

  const gradient = gameCtx.createLinearGradient(
    pixelX,
    pixelY,
    pixelX,
    pixelY + CELL
  );

  gradient.addColorStop(
    0,
    lighten(COLORS[type], 24)
  );

  gradient.addColorStop(
    1,
    COLORS[type]
  );

  gameCtx.fillStyle = gradient;

  gameCtx.fillRect(
    pixelX + 2,
    pixelY + 2,
    CELL - 4,
    CELL - 4
  );

  gameCtx.strokeStyle = "rgba(255, 255, 255, 0.45)";

  gameCtx.strokeRect(
    pixelX + 2.5,
    pixelY + 2.5,
    CELL - 5,
    CELL - 5
  );

  gameCtx.fillStyle = "rgba(255, 255, 255, 0.17)";

  gameCtx.fillRect(
    pixelX + 5,
    pixelY + 5,
    CELL - 10,
    5
  );

  gameCtx.restore();
}

function drawPose(piece, alpha = 1) {
  const image = poseImages[piece.type];

  if (!image) {
    return;
  }

  const bounds = occupiedBounds(piece.matrix);

  const x = (piece.x + bounds.minX) * CELL;
  const y = (piece.y + bounds.minY) * CELL;

  if (y + bounds.height * CELL < 0) {
    return;
  }

  gameCtx.save();
  gameCtx.globalAlpha = alpha;

  gameCtx.drawImage(
    image,
    x,
    y,
    bounds.width * CELL,
    bounds.height * CELL
  );

  gameCtx.restore();
}

function drawPiece(piece, options = {}) {
  const ghost = options.ghost === true;

  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      drawBlock(
        piece.x + x,
        piece.y + y,
        piece.type,
        ghost ? 0.18 : 0.9
      );
    });
  });

  if (!ghost) {
    drawPose(piece, 1);
  }
}

function draw() {
  drawBoardBackground();

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        drawBlock(
          x,
          y,
          board[y][x],
          1
        );
      }
    }
  }

  if (!activePiece) {
    return;
  }

  let ghostY = activePiece.y;

  while (
    !collides({
      ...activePiece,
      y: ghostY + 1
    })
  ) {
    ghostY++;
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

function drawPreview(context, canvas, type) {
  context.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (!type) {
    return;
  }

  const matrix = SHAPES[type];
  const bounds = occupiedBounds(matrix);

  const blockSize = Math.min(
    31,
    Math.floor((canvas.width - 18) / bounds.width),
    Math.floor((canvas.height - 18) / bounds.height)
  );

  const totalWidth = bounds.width * blockSize;
  const totalHeight = bounds.height * blockSize;

  const offsetX = (canvas.width - totalWidth) / 2;
  const offsetY = (canvas.height - totalHeight) / 2;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) {
        return;
      }

      context.fillStyle = COLORS[type];

      context.fillRect(
        offsetX + (x - bounds.minX) * blockSize + 2,
        offsetY + (y - bounds.minY) * blockSize + 2,
        blockSize - 4,
        blockSize - 4
      );
    });
  });

  const image = poseImages[type];

  if (image) {
    context.drawImage(
      image,
      offsetX,
      offsetY,
      totalWidth,
      totalHeight
    );
  }
}

function drawPreviews() {
  drawPreview(
    nextCtx,
    nextCanvas,
    nextType
  );

  drawPreview(
    holdCtx,
    holdCanvas,
    heldType
  );
}

function lighten(hex, amount) {
  const value = parseInt(
    hex.slice(1),
    16
  );

  const red = Math.min(
    255,
    (value >> 16) + amount
  );

  const green = Math.min(
    255,
    ((value >> 8) & 255) + amount
  );

  const blue = Math.min(
    255,
    (value & 255) + amount
  );

  return `rgb(${red}, ${green}, ${blue})`;
}

function updateStats() {
  scoreNode.textContent = score.toLocaleString("es-ES");
  levelNode.textContent = level;
  linesNode.textContent = lines;
}

function showOverlay(title, message, buttonText) {
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  overlayButton.textContent = buttonText;

  overlay.classList.add("is-visible");
}

function hideOverlay() {
  overlay.classList.remove("is-visible");
}

function startGame() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }

  board = createBoard();
  bag = [];

  heldType = null;
  holdAvailable = true;

  score = 0;
  lines = 0;
  level = 1;

  nextType = randomType();
  activePiece = createPiece(randomType());

  running = true;
  paused = false;

  fallAccumulator = 0;
  lastTime = performance.now();

  updateStats();
  drawPreviews();
  hideOverlay();
  draw();

  animationId = requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;

  showOverlay(
    "Fin de la partida",
    `Has conseguido ${score.toLocaleString("es-ES")} puntos. ¡Mamá estará orgullosa!`,
    "Jugar otra vez"
  );
}

function togglePause() {
  if (!running) {
    return;
  }

  paused = !paused;

  if (paused) {
    showOverlay(
      "Pausa",
      "Descansa un momento y continúa cuando quieras",
      "Continuar"
    );
  } else {
    hideOverlay();
    lastTime = performance.now();
  }
}

function gameLoop(time) {
  if (!running) {
    return;
  }

  const delta = Math.min(
    time - lastTime,
    100
  );

  lastTime = time;

  if (!paused) {
    fallAccumulator += delta;

    if (fallAccumulator >= fallDelay()) {
      softDrop();
    }

    draw();
  }

  animationId = requestAnimationFrame(gameLoop);
}

document.addEventListener("keydown", (event) => {
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowDown",
      "ArrowUp",
      " "
    ].includes(event.key)
  ) {
    event.preventDefault();
  }

  if (event.key === "ArrowLeft") {
    move(-1);
  } else if (event.key === "ArrowRight") {
    move(1);
  } else if (event.key === "ArrowDown") {
    softDrop();
  } else if (event.key === "ArrowUp") {
    rotatePiece();
  } else if (event.key === " ") {
    hardDrop();
  } else if (
    event.key.toLowerCase() === "c" ||
    event.key === "Shift"
  ) {
    holdPiece();
  } else if (
    event.key.toLowerCase() === "p" ||
    event.key === "Escape"
  ) {
    togglePause();
  }
});

document
  .querySelectorAll("[data-action]")
  .forEach((button) => {
    button.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();

        const actions = {
          left: () => move(-1),
          right: () => move(1),
          rotate: rotatePiece,
          down: softDrop,
          drop: hardDrop,
          hold: holdPiece
        };

        const action = actions[button.dataset.action];

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

document
  .getElementById("restartButton")
  .addEventListener(
    "click",
    startGame
  );

document
  .getElementById("pauseButton")
  .addEventListener(
    "click",
    togglePause
  );

loadImages().then(() => {
  activePiece = createPiece("T");

  draw();
  drawPreviews();
});
