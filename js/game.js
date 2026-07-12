(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  const COLORS = {
    skin: '#f7a33b', skinLight: '#ffc06b', hair: '#4b241b', hair2: '#7a3c24',
    dress: '#2f8b8b', dressDark: '#175c66', pink: '#f05a93', yellow: '#ffd34d',
    outline: '#32192c', white: '#fffaf0', ghost: 'rgba(255,255,255,.18)'
  };

  const SHAPES = {
    I: [[0,1],[1,1],[2,1],[3,1]],
    O: [[0,0],[1,0],[0,1],[1,1]],
    T: [[0,0],[1,0],[2,0],[1,1]],
    S: [[1,0],[2,0],[0,1],[1,1]],
    Z: [[0,0],[1,0],[1,1],[2,1]],
    J: [[0,0],[0,1],[1,1],[2,1]],
    L: [[2,0],[0,1],[1,1],[2,1]]
  };
  const TYPES = Object.keys(SHAPES);

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('next');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold');
  const holdCtx = holdCanvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startButton = document.getElementById('startButton');

  let board, current, nextQueue, heldType, canHold, score, lines, level;
  let running = false, paused = false, gameOver = false;
  let lastTime = 0, dropAccumulator = 0;
  const spriteCache = new Map();

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function rotateCells(cells, rot) {
    let result = cells.map(([x, y]) => [x, y]);
    for (let r = 0; r < rot; r++) result = result.map(([x, y]) => [y, -x]);
    const minX = Math.min(...result.map(c => c[0]));
    const minY = Math.min(...result.map(c => c[1]));
    return result.map(([x, y]) => [x - minX, y - minY]);
  }

  function bbox(cells) {
    return {
      w: Math.max(...cells.map(c => c[0])) + 1,
      h: Math.max(...cells.map(c => c[1])) + 1
    };
  }

  function makeBag() {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function fillQueue() {
    while (nextQueue.length < 7) nextQueue.push(...makeBag());
  }

  function spawn(type = null) {
    fillQueue();
    const pieceType = type || nextQueue.shift();
    fillQueue();
    const cells = rotateCells(SHAPES[pieceType], 0);
    const { w } = bbox(cells);
    current = { type: pieceType, rot: 0, x: Math.floor((COLS - w) / 2), y: -1 };
    canHold = true;
    if (collides(current.x, current.y, current.rot)) endGame();
  }

  function collides(px, py, rot) {
    const cells = rotateCells(SHAPES[current.type], rot);
    return cells.some(([cx, cy]) => {
      const x = px + cx, y = py + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      return y >= 0 && board[y][x] !== null;
    });
  }

  function move(dx, dy) {
    if (!running || paused || gameOver) return false;
    if (!collides(current.x + dx, current.y + dy, current.rot)) {
      current.x += dx;
      current.y += dy;
      if (dy > 0) score += 1;
      updateStats();
      return true;
    }
    if (dy > 0) lockPiece();
    return false;
  }

  function rotate() {
    if (!running || paused || gameOver) return;
    const nextRot = (current.rot + 1) % 4;
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collides(current.x + kick, current.y, nextRot)) {
        current.x += kick;
        current.rot = nextRot;
        return;
      }
    }
  }

  function hardDrop() {
    if (!running || paused || gameOver) return;
    let distance = 0;
    while (!collides(current.x, current.y + 1, current.rot)) {
      current.y++;
      distance++;
    }
    score += distance * 2;
    lockPiece();
  }

  function holdPiece() {
    if (!running || paused || gameOver || !canHold) return;
    const temp = heldType;
    heldType = current.type;
    canHold = false;
    if (temp) {
      const cells = rotateCells(SHAPES[temp], 0);
      current = { type: temp, rot: 0, x: Math.floor((COLS - bbox(cells).w) / 2), y: -1 };
    } else {
      spawn();
      canHold = false;
    }
    drawPreviews();
  }

  function lockPiece() {
    const cells = rotateCells(SHAPES[current.type], current.rot);
    for (const [localX, localY] of cells) {
      const x = current.x + localX, y = current.y + localY;
      if (y < 0) { endGame(); return; }
      board[y][x] = { type: current.type, rot: current.rot, localX, localY };
    }
    clearLines();
    spawn();
    drawPreviews();
  }

  function clearLines() {
    let count = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(null));
        count++;
        y++;
      }
    }
    if (count > 0) {
      const table = [0, 100, 300, 500, 800];
      score += table[count] * level;
      lines += count;
      level = Math.floor(lines / 10) + 1;
      updateStats();
      burstConfetti(count === 4 ? 42 : 18);
    }
  }

  function getDropInterval() {
    return Math.max(90, 900 - (level - 1) * 70);
  }

  function ghostY() {
    let y = current.y;
    while (!collides(current.x, y + 1, current.rot)) y++;
    return y;
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#190b2b');
    gradient.addColorStop(1, '#0d0817');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * BLOCK + .5, 0); ctx.lineTo(x * BLOCK + .5, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * BLOCK + .5); ctx.lineTo(canvas.width, y * BLOCK + .5); ctx.stroke();
    }
  }

  function getSprite(type, rot) {
    const key = `${type}-${rot}`;
    if (spriteCache.has(key)) return spriteCache.get(key);
    const cells = rotateCells(SHAPES[type], rot);
    const { w, h } = bbox(cells);
    const c = document.createElement('canvas');
    c.width = w * BLOCK; c.height = h * BLOCK;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    drawPose(g, type, cells, w, h);
    spriteCache.set(key, c);
    return c;
  }

  function px(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawPose(g, type, cells, w, h) {
    const W = w * BLOCK, H = h * BLOCK;
    const occupied = new Set(cells.map(([x,y]) => `${x},${y}`));

    // softly lit occupied cells
    for (const [x,y] of cells) {
      const grad = g.createLinearGradient(x*BLOCK, y*BLOCK, (x+1)*BLOCK, (y+1)*BLOCK);
      grad.addColorStop(0, 'rgba(240,90,147,.22)');
      grad.addColorStop(1, 'rgba(47,139,139,.28)');
      g.fillStyle = grad;
      g.fillRect(x*BLOCK+1, y*BLOCK+1, BLOCK-2, BLOCK-2);
    }

    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) / 72;
    const s = Math.max(.8, scale);

    // limbs extend toward extreme occupied cells, creating the tetromino silhouette
    const extremes = cells.map(([x,y]) => ({ x: x*BLOCK + BLOCK/2, y: y*BLOCK + BLOCK/2 }));
    extremes.sort((a,b) => Math.hypot(b.x-cx,b.y-cy)-Math.hypot(a.x-cx,a.y-cy));
    const targets = extremes.slice(0,4);

    g.lineCap = 'square';
    g.lineJoin = 'miter';
    g.strokeStyle = COLORS.outline;
    g.lineWidth = Math.max(5, 4*s);
    for (const t of targets) {
      g.beginPath(); g.moveTo(cx, cy+6*s); g.lineTo(t.x, t.y); g.stroke();
      g.strokeStyle = COLORS.skin;
      g.lineWidth = Math.max(3, 2.6*s);
      g.beginPath(); g.moveTo(cx, cy+6*s); g.lineTo(t.x, t.y); g.stroke();
      g.strokeStyle = COLORS.outline;
      g.lineWidth = Math.max(5, 4*s);
    }

    // dress/body
    px(g, cx-12*s, cy-2*s, 24*s, 28*s, COLORS.outline);
    px(g, cx-9*s, cy, 18*s, 24*s, COLORS.dress);
    px(g, cx-9*s, cy+10*s, 18*s, 5*s, COLORS.pink);
    px(g, cx-7*s, cy+17*s, 4*s, 4*s, COLORS.yellow);
    px(g, cx+2*s, cy+18*s, 4*s, 4*s, COLORS.pink);

    // head + hair
    px(g, cx-13*s, cy-28*s, 26*s, 25*s, COLORS.outline);
    px(g, cx-10*s, cy-25*s, 20*s, 20*s, COLORS.skinLight);
    px(g, cx-12*s, cy-29*s, 24*s, 7*s, COLORS.hair);
    px(g, cx-13*s, cy-25*s, 5*s, 17*s, COLORS.hair2);
    px(g, cx+8*s, cy-25*s, 5*s, 17*s, COLORS.hair2);
    // braid-ish pixels
    px(g, cx-15*s, cy-7*s, 6*s, 7*s, COLORS.hair);
    px(g, cx-16*s, cy-1*s, 7*s, 7*s, COLORS.hair2);
    px(g, cx-15*s, cy+5*s, 6*s, 7*s, COLORS.hair);

    // face
    px(g, cx-6*s, cy-16*s, 3*s, 4*s, COLORS.outline);
    px(g, cx+4*s, cy-16*s, 3*s, 4*s, COLORS.outline);
    px(g, cx-4*s, cy-8*s, 9*s, 3*s, COLORS.white);

    // necklace
    px(g, cx-4*s, cy-1*s, 3*s, 4*s, '#d6f0ef');
    px(g, cx+1*s, cy-1*s, 3*s, 4*s, '#d6f0ef');

    // outer pixel border for each occupied cell
    g.strokeStyle = 'rgba(255,255,255,.13)';
    g.lineWidth = 1;
    for (const [x,y] of cells) g.strokeRect(x*BLOCK+.5, y*BLOCK+.5, BLOCK-1, BLOCK-1);

    // make empty bounding-box cells fully transparent
    for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
      if (!occupied.has(`${x},${y}`)) g.clearRect(x*BLOCK, y*BLOCK, BLOCK, BLOCK);
    }
  }

  function drawTile(cell, x, y, alpha = 1) {
    const sprite = getSprite(cell.type, cell.rot);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.drawImage(sprite,
      cell.localX * BLOCK, cell.localY * BLOCK, BLOCK, BLOCK,
      x * BLOCK, y * BLOCK, BLOCK, BLOCK);
    ctx.restore();
  }

  function drawPiece(piece, py = piece.y, alpha = 1) {
    const cells = rotateCells(SHAPES[piece.type], piece.rot);
    const sprite = getSprite(piece.type, piece.rot);
    for (const [lx, ly] of cells) {
      const y = py + ly;
      if (y < 0) continue;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, lx*BLOCK, ly*BLOCK, BLOCK, BLOCK,
        (piece.x+lx)*BLOCK, y*BLOCK, BLOCK, BLOCK);
      ctx.restore();
    }
  }

  function draw() {
    drawBackground();
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (board[y][x]) drawTile(board[y][x], x, y);
    }
    if (current && running) {
      drawPiece(current, ghostY(), .18);
      drawPiece(current);
    }
  }

  function drawPreview(ctx2, type, width, height) {
    ctx2.clearRect(0,0,width,height);
    if (!type) return;
    const cells = rotateCells(SHAPES[type], 0);
    const { w,h } = bbox(cells);
    const sprite = getSprite(type, 0);
    const scale = Math.min((width-18)/(w*BLOCK), (height-18)/(h*BLOCK), 1.45);
    const dw = w*BLOCK*scale, dh = h*BLOCK*scale;
    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(sprite, (width-dw)/2, (height-dh)/2, dw, dh);
  }

  function drawPreviews() {
    drawPreview(nextCtx, nextQueue[0], nextCanvas.width, nextCanvas.height);
    drawPreview(holdCtx, heldType, holdCanvas.width, holdCanvas.height);
  }

  function updateStats() {
    scoreEl.textContent = score.toLocaleString('de-DE');
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function startGame() {
    board = emptyBoard(); nextQueue = []; heldType = null; score = 0; lines = 0; level = 1;
    running = true; paused = false; gameOver = false; lastTime = performance.now(); dropAccumulator = 0;
    fillQueue(); spawn(); updateStats(); drawPreviews();
    overlay.classList.remove('visible');
    requestAnimationFrame(loop);
  }

  function endGame() {
    gameOver = true; running = false;
    overlayTitle.textContent = 'Spiel vorbei';
    overlayText.textContent = `Du hast ${score.toLocaleString('de-DE')} Punkte erreicht. Ahnang wäre stolz!`;
    startButton.textContent = 'Nochmal spielen';
    overlay.classList.add('visible');
    burstConfetti(30);
  }

  function togglePause() {
    if (gameOver || !current) return;
    paused = !paused;
    running = !paused;
    if (paused) {
      overlayTitle.textContent = 'Pause';
      overlayText.textContent = 'Ein kurzer Geburtstagskuchen-Moment 🎂';
      startButton.textContent = 'Weiterspielen';
      overlay.classList.add('visible');
    } else {
      overlay.classList.remove('visible');
      lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function loop(now) {
    if (!running || paused || gameOver) { draw(); return; }
    const delta = now - lastTime;
    lastTime = now;
    dropAccumulator += delta;
    if (dropAccumulator >= getDropInterval()) {
      if (!collides(current.x, current.y + 1, current.rot)) current.y++;
      else lockPiece();
      dropAccumulator = 0;
    }
    draw();
    requestAnimationFrame(loop);
  }

  function burstConfetti(amount) {
    const colors = ['#c084fc','#f472b6','#facc15','#34d399','#60a5fa'];
    for (let i=0;i<amount;i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = `${Math.random()*100}vw`;
      el.style.background = colors[Math.floor(Math.random()*colors.length)];
      el.style.animationDuration = `${2.2 + Math.random()*2.2}s`;
      el.style.setProperty('--drift', `${-80 + Math.random()*160}px`);
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4600);
    }
  }

  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowdown','arrowup',' '].includes(key)) e.preventDefault();
    if (key === 'arrowleft') move(-1,0);
    else if (key === 'arrowright') move(1,0);
    else if (key === 'arrowdown') move(0,1);
    else if (key === 'arrowup' || key === 'x') rotate();
    else if (key === ' ') hardDrop();
    else if (key === 'c' || key === 'shift') holdPiece();
    else if (key === 'p' || key === 'escape') togglePause();
  });

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('pointerdown', () => {
      const action = btn.dataset.action;
      if (action === 'left') move(-1,0);
      if (action === 'right') move(1,0);
      if (action === 'down') move(0,1);
      if (action === 'rotate') rotate();
      if (action === 'drop') hardDrop();
      if (action === 'hold') holdPiece();
    });
  });

  startButton.addEventListener('click', () => {
    if (paused) togglePause(); else startGame();
  });

  // Initial state
  board = emptyBoard(); nextQueue = makeBag(); heldType = null; score = 0; lines = 0; level = 1;
  current = { type: 'T', rot: 0, x: 3, y: 6 };
  draw(); drawPreviews(); updateStats();
})();
