"use strict";

const GAME_WIDTH = 420;
const GAME_HEIGHT = 720;
const INITIAL_LIVES = 3;
const MAX_LIVES = 5;
const INITIAL_PADDLE_WIDTH = 90;
const PADDLE_HEIGHT = 14;
const PADDLE_Y = 618;
const BALL_RADIUS = 7;
const INITIAL_BALL_SPEED = 5.1;
const MAX_BALLS = 30;
const BRICK_COLS = 10;
const BRICK_WIDTH = 36;
const BRICK_HEIGHT = 20;
const BRICK_GAP = 5;
const BRICK_START_Y = 102;
const COMBO_TIME = 2;
const ITEM_DROP_RATE = 0.045;
const COIN_DROP_RATE = 0.15;
const COIN_VALUE = 1;
const ITEM_FALL_SPEED = 2.5;
const COIN_FALL_SPEED = 2.8;
const LASER_COST = 20;
const SHIELD_COST = 30;
const WIDE_COST = 18;
const MULTI_COST = 24;
const STORAGE_KEY = "breakReactorBestScore";
const SFX_VOLUME = 0.22;
const MAX_PARTICLES = 180;
const MAX_EXPLOSION_TARGETS = 12;
const MAX_EXPLOSIONS_PER_FRAME = 3;
const SFX_COOLDOWN = {
  chip: 0.018,
  break: 0.035,
  explosion: 0.09,
  laser: 0.035
};

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const pauseButton = document.getElementById("pauseButton");
const buyLaserButton = document.getElementById("buyLaserButton");
const buyShieldButton = document.getElementById("buyShieldButton");
const shopButton = document.getElementById("shopButton");
const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const shopOverlay = document.getElementById("shopOverlay");
const gameOverStats = document.getElementById("gameOverStats");
const resumeButton = document.getElementById("resumeButton");
const restartPauseButton = document.getElementById("restartPauseButton");
const restartGameButton = document.getElementById("restartGameButton");
const closeShopButton = document.getElementById("closeShopButton");
const shopCoinText = document.getElementById("shopCoinText");
const shopLaserButton = document.getElementById("shopLaserButton");
const shopShieldButton = document.getElementById("shopShieldButton");
const shopWideButton = document.getElementById("shopWideButton");
const shopMultiButton = document.getElementById("shopMultiButton");

const permanentUpgrades = {
  lifeBonus: 0,
  paddleWidthBonus: 0,
  coinDropBonus: 0,
  itemDropBonus: 0,
  initialShield: 0
};

const itemTable = [
  { type: "wide", label: "W", color: "#35e9ff", weight: 22 },
  { type: "multi", label: "M", color: "#f8ff65", weight: 18 },
  { type: "slow", label: "T", color: "#9fffc9", weight: 16 },
  { type: "bomb", label: "B", color: "#ff8b39", weight: 14 },
  { type: "laser", label: "L", color: "#ff3df2", weight: 12 },
  { type: "pierce", label: "P", color: "#ffffff", weight: 10 },
  { type: "shield", label: "S", color: "#6dff8f", weight: 8 }
];

const missionTemplates = [
  { type: "break", label: "ブロック破壊", base: 18, step: 2, reward: 16 },
  { type: "coin", label: "コイン回収", base: 4, step: 1, reward: 18 },
  { type: "combo", label: "コンボ到達", base: 12, step: 3, reward: 20 },
  { type: "special", label: "特殊ブロック破壊", base: 3, step: 1, reward: 22 }
];

const brickStyles = {
  normal: { color: "#6f8fa3", dark: "#2d4655", light: "#b9d8e2", score: 1 },
  hard: { color: "#8d8f96", dark: "#45484f", light: "#c9cbd0", score: 1.4 },
  bomb: { color: "#b65a42", dark: "#612b23", light: "#ff9a72", score: 1.2 },
  coin: { color: "#ad7836", dark: "#5b3b19", light: "#e5b665", score: 1.1 },
  item: { color: "#7e7049", dark: "#403725", light: "#c8b77b", score: 1.1 }
};

const materialStyles = {
  normal: { color: "#55d8ff", dark: "#155a80", light: "#d7fbff", crack: "#0b4056" },
  wood: { color: "#9b6238", dark: "#5a321d", light: "#d7a060", crack: "#3e2212" },
  stone: { color: "#7d8289", dark: "#3b4047", light: "#c3c8ce", crack: "#262a31" },
  metal: { color: "#6f7686", dark: "#272c36", light: "#d6dbe7", crack: "#11151c" }
};

const audio = {
  ctx: null,
  master: null,
  enabled: false,
  lastPlayed: {}
};

let lastTouchEnd = 0;

const state = {
  running: false,
  paused: false,
  shopOpen: false,
  gameEnded: false,
  score: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  wave: 1,
  lives: INITIAL_LIVES,
  coins: 0,
  combo: 0,
  comboTimer: 0,
  feverTimer: 0,
  waveKills: 0,
  waveTarget: 12,
  waveBanner: 0,
  bannerText: "WAVE 1",
  warningTimer: 0,
  hitStop: 0,
  shake: 0,
  bgPulse: 0,
  lastTime: 0,
  pointerX: GAME_WIDTH / 2,
  paddle: {
    x: GAME_WIDTH / 2,
    y: PADDLE_Y,
    width: INITIAL_PADDLE_WIDTH,
    baseWidth: INITIAL_PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    targetX: GAME_WIDTH / 2
  },
  balls: [],
  bricks: [],
  items: [],
  coinDrops: [],
  particles: [],
  popups: [],
  lasers: [],
  rockets: [],
  mission: null,
  missionStreak: 0,
  debugMode: false,
  explosionsThisFrame: 0,
  effects: {
    wide: 0,
    laser: 0,
    laserCooldown: 0,
    pierce: 0,
    bomb: 0,
    slow: 0,
    shield: 0
  },
  boss: null
};

function init() {
  setupDebugApi();
  resetGame();
  bindEvents();
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  state.running = true;
  state.paused = false;
  state.shopOpen = false;
  state.gameEnded = false;
  state.score = 0;
  state.best = Number(localStorage.getItem(STORAGE_KEY) || 0);
  const debugOptions = readDebugOptions();
  state.debugMode = debugOptions.enabled;
  state.wave = debugOptions.wave;
  state.lives = Math.min(MAX_LIVES, INITIAL_LIVES + permanentUpgrades.lifeBonus);
  state.coins = debugOptions.coins;
  state.combo = 0;
  state.comboTimer = 0;
  state.feverTimer = 0;
  state.waveKills = 0;
  state.waveTarget = 12;
  state.waveBanner = 1.4;
  state.bannerText = "WAVE 1";
  state.warningTimer = 0;
  state.hitStop = 0;
  state.shake = 0;
  state.bgPulse = 0;
  state.paddle.baseWidth = INITIAL_PADDLE_WIDTH + permanentUpgrades.paddleWidthBonus;
  state.paddle.width = state.paddle.baseWidth;
  state.paddle.x = GAME_WIDTH / 2;
  state.paddle.targetX = GAME_WIDTH / 2;
  state.pointerX = GAME_WIDTH / 2;
  state.balls.length = 0;
  state.bricks.length = 0;
  state.items.length = 0;
  state.coinDrops.length = 0;
  state.particles.length = 0;
  state.popups.length = 0;
  state.lasers.length = 0;
  state.rockets.length = 0;
  state.mission = null;
  state.missionStreak = 0;
  state.effects.wide = 0;
  state.effects.laser = 0;
  state.effects.laserCooldown = 0;
  state.effects.pierce = 0;
  state.effects.bomb = 0;
  state.effects.slow = 0;
  state.effects.shield = Math.min(3, permanentUpgrades.initialShield);
  state.boss = null;
  spawnBall(false);
  generateWave();
  setOverlay(pauseOverlay, false);
  setOverlay(gameOverOverlay, false);
  setOverlay(shopOverlay, false);
  updateButtons();
}

function readDebugOptions() {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const wave = clamp(Math.floor(Number(params.get("wave") || hashParams.get("wave") || 1)), 1, 10000);
  const coins = clamp(Math.floor(Number(params.get("coins") || hashParams.get("coins") || 0)), 0, 999999);
  const enabled = params.has("debug") || hashParams.has("debug") || wave > 1 || coins > 0;
  return { enabled, wave, coins };
}

function setupDebugApi() {
  window.BreakReactorDebug = {
    state,
    jumpToWave,
    giveCoins(amount = 100) {
      state.coins = clamp(state.coins + Math.floor(amount), 0, 999999);
      state.debugMode = true;
      updateButtons();
    },
    clearStage() {
      for (const brick of [...state.bricks]) destroyBrick(brick);
      if (state.boss) damageBoss(state.boss.hp, state.boss.x + state.boss.w / 2, state.boss.y + state.boss.h / 2);
    }
  };
}

function jumpToWave(wave) {
  const nextWave = clamp(Math.floor(Number(wave) || 1), 1, 10000);
  state.wave = nextWave;
  state.waveKills = 0;
  state.waveBanner = 1.1;
  state.bannerText = `WAVE ${state.wave}`;
  state.boss = null;
  state.bricks.length = 0;
  state.rockets.length = 0;
  state.lasers.length = 0;
  state.debugMode = true;
  generateWave();
}

function bindEvents() {
  canvas.addEventListener("pointermove", handlePointer);
  canvas.addEventListener("pointerdown", (event) => {
    unlockAudio();
    handlePointer(event);
    launchBall();
  });
  pauseButton.addEventListener("click", () => {
    unlockAudio();
    togglePause();
  });
  resumeButton.addEventListener("click", () => {
    unlockAudio();
    togglePause();
  });
  restartPauseButton.addEventListener("click", resetGame);
  restartGameButton.addEventListener("click", resetGame);
  buyLaserButton.addEventListener("click", () => {
    unlockAudio();
    buyLaser();
  });
  buyShieldButton.addEventListener("click", () => {
    unlockAudio();
    buyShield();
  });
  shopButton.addEventListener("click", () => {
    unlockAudio();
    openShop();
  });
  closeShopButton.addEventListener("click", closeShop);
  shopLaserButton.addEventListener("click", buyLaser);
  shopShieldButton.addEventListener("click", buyShield);
  shopWideButton.addEventListener("click", buyWide);
  shopMultiButton.addEventListener("click", buyMulti);
  window.addEventListener("keydown", (event) => {
    unlockAudio();
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if (event.code === "KeyR") resetGame();
    if (event.shiftKey && event.code === "KeyW") {
      const value = window.prompt("開始したいWAVEを入力 (1-10000)", String(state.wave));
      if (value !== null) jumpToWave(value);
    }
    if (event.shiftKey && event.code === "KeyC") {
      state.coins = clamp(state.coins + 100, 0, 999999);
      state.debugMode = true;
      updateButtons();
    }
    if (event.code === "Space") {
      event.preventDefault();
      launchBall();
    }
  });
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("touchend", preventDoubleTapZoom, { passive: false });
  window.addEventListener("gesturestart", (event) => event.preventDefault());
  window.addEventListener("gesturechange", (event) => event.preventDefault());
  window.addEventListener("gestureend", (event) => event.preventDefault());
}

function handlePointer(event) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  state.pointerX = clamp((event.clientX - rect.left) * (GAME_WIDTH / rect.width), 0, GAME_WIDTH);
  state.paddle.targetX = state.pointerX;
}

function gameLoop(time) {
  const now = time / 1000;
  const dt = Math.min(0.033, now - (state.lastTime || now));
  state.lastTime = now;
  if (state.running && !state.paused && !state.gameEnded) update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

function update(dt) {
  state.explosionsThisFrame = 0;
  if (state.hitStop > 0) {
    state.hitStop -= dt;
    updateParticles(dt * 0.35);
    return;
  }

  updatePaddle(dt);
  updateEffects(dt);
  updateBoss(dt);
  updateBalls(dt);
  updateItems(dt);
  updateCoins(dt);
  updateLasers(dt);
  updateRockets(dt);
  updateParticles(dt);
  updatePopups(dt);
  checkCollisions();

  state.comboTimer -= dt;
  if (state.comboTimer <= 0) state.combo = 0;
  state.waveBanner = Math.max(0, state.waveBanner - dt);
  state.warningTimer = Math.max(0, state.warningTimer - dt);
  state.feverTimer = Math.max(0, state.feverTimer - dt);
  state.shake = Math.max(0, state.shake - dt * 18);
  state.bgPulse = Math.max(0, state.bgPulse - dt * 2.4);

  if (!state.boss && state.waveKills >= state.waveTarget) advanceWave();
  updateButtons();
}

function spawnBall(launched = false, x = state.paddle.x, y = state.paddle.y - BALL_RADIUS - 2) {
  if (state.balls.length >= MAX_BALLS) return;
  const angle = -Math.PI / 2 + randomRange(-0.28, 0.28);
  const speed = getBallSpeed();
  state.balls.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: BALL_RADIUS,
    launched
  });
}

function launchBall() {
  if (state.paused || state.gameEnded) return;
  for (const ball of state.balls) {
    if (!ball.launched) {
      ball.launched = true;
      ball.vx = randomRange(-1.3, 1.3);
      ball.vy = -getBallSpeed();
    }
  }
}

function updateBalls(dt) {
  for (const ball of state.balls) {
    if (!ball.launched) {
      ball.x = state.paddle.x;
      ball.y = state.paddle.y - ball.r - 3;
      continue;
    }

    const distanceThisFrame = Math.hypot(ball.vx * dt * 60, ball.vy * dt * 60);
    const steps = Math.max(1, Math.ceil(distanceThisFrame / (ball.r * 0.42)));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      ball.prevX = ball.x;
      ball.prevY = ball.y;
      ball.x += ball.vx * stepDt * 60;
      ball.y += ball.vy * stepDt * 60;
      constrainBallToWalls(ball);
      const bounced = checkBallSolidCollisions(ball);
      if (bounced && state.effects.pierce <= 0) break;
    }
    tuneBallSpeed(ball, dt);
  }

  state.balls = state.balls.filter((ball) => ball.y < GAME_HEIGHT + 42);
  if (state.balls.length === 0) handleAllBallsLost();
}

function constrainBallToWalls(ball) {
  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
  }
  if (ball.x > GAME_WIDTH - ball.r) {
    ball.x = GAME_WIDTH - ball.r;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < 56 + ball.r) {
    ball.y = 56 + ball.r;
    ball.vy = Math.abs(ball.vy);
  }
}

function handleAllBallsLost() {
  if (state.effects.shield > 0) {
    state.effects.shield -= 1;
    addPopup("シールド", state.paddle.x, state.paddle.y - 42, "#68d17a", 1.2);
    burst(state.paddle.x, state.paddle.y, "#68d17a", 26, 4.5);
    spawnBall(false);
    return;
  }

  state.lives -= 1;
  state.combo = 0;
  state.comboTimer = 0;
  state.shake = 4;
  if (state.lives <= 0) {
    gameOver();
  } else {
    spawnBall(false);
  }
}

function updatePaddle(dt) {
  state.paddle.width = state.paddle.baseWidth * (state.effects.wide > 0 ? 1.5 : 1);
  const half = state.paddle.width / 2;
  state.paddle.targetX = clamp(state.paddle.targetX, half + 8, GAME_WIDTH - half - 8);
  state.paddle.x = lerp(state.paddle.x, state.paddle.targetX, Math.min(1, dt * 18));
}

function generateWave() {
  const isBossWave = state.wave % 5 === 0;
  if (isBossWave) {
    state.bannerText = "警告";
    state.warningTimer = 2.4;
    spawnBoss();
    return;
  }

  const rows = clamp(3 + Math.floor(Math.max(0, state.wave - 1) / 3), 3, 7);
  const specialRate = clamp(0.06 + state.wave * 0.014, 0.06, 0.28);
  const countChance = clamp(0.7 + state.wave * 0.022, 0.7, 0.94);
  const left = (GAME_WIDTH - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP)) / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      if (Math.random() > countChance) continue;
      const type = state.wave <= 2 ? "normal" : Math.random() < specialRate ? pickBrickType() : "normal";
      const maxHp = pickBrickHp(type);
      addBrick(left + col * (BRICK_WIDTH + BRICK_GAP), BRICK_START_Y + row * (BRICK_HEIGHT + BRICK_GAP), type, maxHp);
    }
  }

  state.waveTarget = Math.max(14, Math.floor(state.bricks.length * 0.66));
  state.waveKills = 0;
  state.bannerText = `WAVE ${state.wave}`;
  state.waveBanner = 1.25;
  startMission();
}

function preventDoubleTapZoom(event) {
  const now = Date.now();
  if (now - lastTouchEnd <= 320) event.preventDefault();
  lastTouchEnd = now;
}

function spawnBoss() {
  const tier = getBossTier(state.wave);
  const bossWidth = tier === "small" ? BRICK_WIDTH * 4 + BRICK_GAP * 3 : tier === "mid" ? BRICK_WIDTH * 6 + BRICK_GAP * 5 : BRICK_WIDTH * 8 + BRICK_GAP * 7;
  const bossHeight = tier === "small" ? BRICK_HEIGHT * 2 + BRICK_GAP : tier === "mid" ? BRICK_HEIGHT * 3 + BRICK_GAP * 2 : BRICK_HEIGHT * 4 + BRICK_GAP * 3;
  const bossX = (GAME_WIDTH - bossWidth) / 2;
  const targetY = tier === "small" ? 96 : 88;
  clearBricksInRect({ x: bossX - 8, y: targetY - 8, w: bossWidth + 16, h: bossHeight + 54 });
  state.boss = {
    x: bossX,
    baseX: bossX,
    y: -110,
    targetY,
    w: bossWidth,
    h: bossHeight,
    tier,
    hp: getBossHp(state.wave, tier),
    maxHp: getBossHp(state.wave, tier),
    summonTimer: tier === "small" ? 999 : tier === "mid" ? 7.5 : 5.8,
    rocketTimer: tier === "small" ? 3.2 : tier === "mid" ? 2.8 : 2.2,
    phase: 0,
    moveAmp: bossMoveAmplitude(state.wave, tier),
    moveSpeed: bossMoveSpeed(state.wave, tier)
  };
  state.waveTarget = 99999;
  state.waveKills = 0;
  state.shake = 5;
  startMission();
}

function bossMoveAmplitude(wave, tier) {
  if (wave < 10) return 0;
  const tierBase = tier === "mid" ? 18 : 30;
  return clamp(tierBase + Math.floor(wave / 12) * 4, 12, 58);
}

function bossMoveSpeed(wave, tier) {
  if (wave < 10) return 0;
  const tierBase = tier === "mid" ? 0.72 : 0.95;
  return clamp(tierBase + wave * 0.006, 0.55, 1.8);
}

function getBossTier(wave) {
  if (wave < 10) return "small";
  if (wave < 20) return "mid";
  return "large";
}

function getBossHp(wave, tier) {
  const scale = Math.sqrt(wave);
  if (tier === "small") return Math.round(12 + wave * 0.7 + scale * 2.5);
  if (tier === "mid") return Math.round(42 + wave * 2.2 + scale * 5);
  return Math.round(96 + wave * 3.6 + scale * 9);
}

function updateBoss(dt) {
  if (!state.boss) return;
  const boss = state.boss;
  boss.y = lerp(boss.y, boss.targetY, Math.min(1, dt * 2.8));
  if (boss.moveAmp > 0 && Math.abs(boss.y - boss.targetY) < 24) {
    const targetX = boss.baseX + Math.sin(boss.phase * boss.moveSpeed) * boss.moveAmp;
    boss.x = clamp(lerp(boss.x, targetX, Math.min(1, dt * 3.2)), 16, GAME_WIDTH - boss.w - 16);
  }
  boss.summonTimer -= dt;
  boss.rocketTimer -= dt;
  boss.phase += dt;
  if (boss.rocketTimer <= 0 && Math.abs(boss.y - boss.targetY) < 8) {
    boss.rocketTimer = boss.tier === "small" ? randomRange(3.2, 4.8) : boss.tier === "mid" ? randomRange(2.8, 4.2) : randomRange(2.1, 3.2);
    spawnRocket();
  }
  if (boss.summonTimer <= 0) {
    boss.summonTimer = boss.tier === "mid" ? randomRange(7.0, 9.5) : randomRange(5.5, 7.2);
    summonBossBricks();
  }
}

function summonBossBricks() {
  if (!state.boss || state.boss.tier === "small") return;
  const left = (GAME_WIDTH - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP)) / 2;
  const slots = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      slots.push({ row, col, sort: Math.random() });
    }
  }
  slots.sort((a, b) => a.sort - b.sort);

  let spawned = 0;
  for (const slot of slots) {
    if (spawned >= (state.boss.tier === "mid" ? 2 : 4)) break;
    const x = left + slot.col * (BRICK_WIDTH + BRICK_GAP);
    const y = 210 + slot.row * (BRICK_HEIGHT + BRICK_GAP);
    if (state.boss && rectsOverlap({ x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT }, state.boss, 8)) continue;
    addBrick(x, y, "normal", 1, true);
    spawned += 1;
  }
  if (spawned > 0) addPopup("召喚", GAME_WIDTH / 2, 214, "#ffb35c", 0.8);
}

function addBrick(x, y, type, maxHp, replace = false) {
  if (replace) clearBricksInRect({ x, y, w: BRICK_WIDTH, h: BRICK_HEIGHT });
  if (!canPlaceBrick(x, y, BRICK_WIDTH, BRICK_HEIGHT)) return false;
  state.bricks.push({
    x,
    y,
    w: BRICK_WIDTH,
    h: BRICK_HEIGHT,
    type,
    hp: maxHp,
    maxHp,
    pulse: randomRange(0, Math.PI * 2)
  });
  return true;
}

function clearBricksInRect(rect) {
  for (const brick of [...state.bricks]) {
    if (!rectsOverlap(rect, brick, 2)) continue;
    state.bricks.splice(state.bricks.indexOf(brick), 1);
    burst(brick.x + brick.w / 2, brick.y + brick.h / 2, "#42bfe8", 5, 1.8);
  }
}

function canPlaceBrick(x, y, w, h) {
  const rect = { x, y, w, h };
  if (state.boss && rectsOverlap(rect, state.boss, 6)) return false;
  return !state.bricks.some((brick) => rectsOverlap(rect, brick, 1));
}

function damageBrick(brick, amount = 1, sourceX = brick.x + brick.w / 2, sourceY = brick.y + brick.h / 2) {
  brick.hp -= amount;
  burst(sourceX, sourceY, brickStyles[brick.type].color, 3, 1.8);
  if (brick.hp <= 0) destroyBrick(brick, sourceX, sourceY);
  else playSfx("chip");
}

function destroyBrick(brick, x = brick.x + brick.w / 2, y = brick.y + brick.h / 2) {
  const index = state.bricks.indexOf(brick);
  if (index === -1) return;
  state.bricks.splice(index, 1);
  state.waveKills += 1;
  updateMission("break", 1);
  if (brick.type !== "normal") updateMission("special", 1);

  const baseScore = 10 * brick.maxHp * brickStyles[brick.type].score;
  const gain = Math.round(baseScore * scoreMultiplier());
  state.score += gain;
  state.best = Math.max(state.best, state.score);
  state.combo += 1;
  state.comboTimer = COMBO_TIME;
  updateMission("combo", state.combo, true);
  if (state.combo === 100) {
    state.feverTimer = 10;
    addPopup("FEVER", GAME_WIDTH / 2, 250, "#ff3df2", 1.7);
  }

  burst(x, y, brickStyles[brick.type].color, brick.type === "bomb" ? 18 : 9, brick.type === "bomb" ? 4.8 : 2.8);
  addPopup(`+${gain}`, x, y, "#ffffff", 0.6);
  state.shake = Math.max(state.shake, brick.type === "bomb" ? 10 : 3);
  state.hitStop = Math.max(state.hitStop, brick.type === "bomb" ? 0.055 : 0.018);

  if (brick.type === "bomb") explodeAt(x, y, 74, 1);
  playSfx(brick.type === "bomb" ? "explosion" : "break");
  if (Math.random() < ITEM_DROP_RATE + permanentUpgrades.itemDropBonus + (brick.type === "item" ? 0.3 : 0)) spawnItem(x, y);
  if (Math.random() < COIN_DROP_RATE + permanentUpgrades.coinDropBonus + (brick.type === "coin" ? 0.48 : 0)) spawnCoin(x, y, brick.type === "coin" ? 2 : COIN_VALUE);
}

function spawnItem(x, y) {
  const picked = weightedPick(itemTable);
  state.items.push({
    x,
    y,
    vy: ITEM_FALL_SPEED,
    r: 13,
    type: picked.type,
    label: picked.label,
    color: picked.color,
    spin: 0
  });
}

function spawnCoin(x, y, value = COIN_VALUE) {
  state.coinDrops.push({ x, y, vy: COIN_FALL_SPEED, r: 9, value, spin: Math.random() * 10 });
}

function applyItem(type) {
  if (type === "multi") {
    const source = state.balls.find((ball) => ball.launched) || state.balls[0];
    for (let i = 0; i < 2; i += 1) {
      if (source && state.balls.length < MAX_BALLS) {
        spawnBall(true, source.x, source.y);
        const ball = state.balls[state.balls.length - 1];
        ball.vx = randomRange(-4.2, 4.2);
        ball.vy = -Math.abs(randomRange(3.8, getBallSpeed() + 1));
      }
    }
  }
  if (type === "wide") state.effects.wide += 12;
  if (type === "laser") state.effects.laser += 8;
  if (type === "pierce") state.effects.pierce += 6;
  if (type === "bomb") state.effects.bomb += 8;
  if (type === "shield") state.effects.shield = Math.min(3, state.effects.shield + 1);
  if (type === "slow") state.effects.slow += 8;
  addPopup(itemNameV2(type), state.paddle.x, state.paddle.y - 46, itemColor(type), 1.1);
  playSfx("item");
  burst(state.paddle.x, state.paddle.y - 10, itemColor(type), 24, 4);
}

function buyLaser() {
  if (!canBuy() || state.coins < LASER_COST) return;
  state.coins -= LASER_COST;
  state.effects.laser += 5;
  addPopup("レーザー", state.paddle.x, state.paddle.y - 52, "#49c7ff", 1);
  playSfx("buy");
  updateButtons();
}

function buyShield() {
  if (!canBuy() || state.coins < SHIELD_COST || state.effects.shield >= 3) return;
  state.coins -= SHIELD_COST;
  state.effects.shield += 1;
  addPopup("シールド", state.paddle.x, state.paddle.y - 52, "#68d17a", 1);
  playSfx("buy");
  updateButtons();
}

function buyWide() {
  if (!canBuy() || state.coins < WIDE_COST) return;
  state.coins -= WIDE_COST;
  state.effects.wide += 10;
  addPopup("ワイド", state.paddle.x, state.paddle.y - 52, "#49c7ff", 1);
  playSfx("buy");
  updateButtons();
}

function buyMulti() {
  if (!canBuy() || state.coins < MULTI_COST) return;
  state.coins -= MULTI_COST;
  applyItem("multi");
  playSfx("buy");
  updateButtons();
}

function startMission() {
  if (state.boss) {
    state.mission = {
      type: "boss",
      label: "リアクター撃破",
      target: 1,
      progress: 0,
      reward: clamp(28 + Math.floor(state.wave / 5) * 4, 28, 1200),
      done: false
    };
    return;
  }

  const template = missionTemplates[(state.wave + state.missionStreak) % missionTemplates.length];
  const target = clamp(template.base + Math.floor(state.wave / 3) * template.step, template.base, 9999);
  state.mission = {
    type: template.type,
    label: template.label,
    target,
    progress: 0,
    reward: clamp(template.reward + Math.floor(state.wave / 8) * 3, template.reward, 999),
    done: false
  };
}

function updateMission(type, amount = 1, absolute = false) {
  const mission = state.mission;
  if (!mission || mission.done || mission.type !== type) return;
  mission.progress = absolute ? Math.max(mission.progress, amount) : mission.progress + amount;
  if (mission.progress < mission.target) return;
  mission.done = true;
  state.missionStreak += 1;
  state.coins = clamp(state.coins + mission.reward, 0, 999999);
  state.score += mission.reward * 20;
  state.best = Math.max(state.best, state.score);
  state.bgPulse = 1;
  addPopup(`ミッション +${mission.reward}コイン`, GAME_WIDTH / 2, 190, "#9fffc9", 1.25);
  burst(GAME_WIDTH / 2, 190, "#9fffc9", 34, 4.4);
}

function updateItems(dt) {
  for (const item of state.items) {
    item.y += item.vy * dt * 60;
    item.spin += dt * 7;
  }
  state.items = state.items.filter((item) => item.y < GAME_HEIGHT + 24);
}

function updateCoins(dt) {
  for (const coin of state.coinDrops) {
    coin.y += coin.vy * dt * 60;
    coin.spin += dt * 9;
  }
  state.coinDrops = state.coinDrops.filter((coin) => coin.y < GAME_HEIGHT + 24);
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function updatePopups(dt) {
  for (const popup of state.popups) {
    popup.y -= dt * 42;
    popup.life -= dt;
    popup.scale += dt * 0.8;
  }
  state.popups = state.popups.filter((popup) => popup.life > 0);
}

function checkCollisions() {
  const paddleRect = getPaddleRect();
  for (const item of [...state.items]) {
    if (circleRect(item, paddleRect)) {
      state.items.splice(state.items.indexOf(item), 1);
      applyItem(item.type);
    }
  }

  for (const coin of [...state.coinDrops]) {
    if (circleRect(coin, paddleRect)) {
      state.coinDrops.splice(state.coinDrops.indexOf(coin), 1);
      state.coins += coin.value;
      updateMission("coin", coin.value);
      addPopup(`+${coin.value}コイン`, coin.x, coin.y, "#ffe668", 0.72);
      playSfx("coin");
      burst(coin.x, coin.y, "#ffe668", 16, 3);
    }
  }
}

function checkBallSolidCollisions(ball) {
  const paddleRect = getPaddleRect();
  if (circleRect(ball, paddleRect) && ball.vy > 0) {
    const hit = (ball.x - state.paddle.x) / (state.paddle.width / 2);
    const angle = -Math.PI / 2 + clamp(hit, -1, 1) * 1.08;
    const speed = Math.max(getBallSpeed(), Math.hypot(ball.vx, ball.vy));
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    ball.y = paddleRect.y - ball.r - 1;
    playSfx("paddle");
    burst(ball.x, ball.y, "#49c7ff", 5, 2.5);
    return true;
  }

  if (state.boss && circleRect(ball, state.boss)) {
    const hitBoss = { ...state.boss };
    damageBoss(1, ball.x, ball.y);
    if (state.effects.bomb > 0) explodeAt(ball.x, ball.y, 64, 1);
    if (state.effects.pierce <= 0) reflectBallFromRect(ball, hitBoss);
    return true;
  }

  const contacts = findBallBrickContacts(ball, state.effects.pierce > 0 ? 4 : 2);

  if (contacts.length === 0) return false;
  const primary = contacts[0];
  for (const brick of contacts) damageBrick(brick, 1, ball.x, ball.y);
  if (state.effects.bomb > 0) explodeAt(ball.x, ball.y, 58, 1);
  if (state.effects.pierce <= 0) reflectBallFromRect(ball, primary);
  return true;
}

function findBallBrickContacts(ball, limit) {
  const contacts = [];
  const minY = ball.y - ball.r - BRICK_HEIGHT;
  const maxY = ball.y + ball.r;
  for (const brick of state.bricks) {
    if (brick.y > maxY || brick.y + brick.h < minY) continue;
    if (!circleRect(ball, brick)) continue;
    const depth = rectContactDepth(ball, brick);
    let inserted = false;
    for (let i = 0; i < contacts.length; i += 1) {
      if (depth > contacts[i].depth) {
        contacts.splice(i, 0, { brick, depth });
        inserted = true;
        break;
      }
    }
    if (!inserted) contacts.push({ brick, depth });
    if (contacts.length > limit) contacts.length = limit;
  }
  return contacts.map((contact) => contact.brick);
}

function damageBoss(amount, x, y) {
  if (!state.boss) return;
  state.boss.hp -= amount;
  burst(x, y, bossColor(), 8, 3);
  state.shake = Math.max(state.shake, 2.5);
  state.bgPulse = Math.min(1, state.bgPulse + 0.18);
  if (state.boss.hp <= 0) {
    const bonus = state.wave * 500;
    state.score += bonus;
    state.best = Math.max(state.best, state.score);
    addPopup(`BOSS +${bonus}`, GAME_WIDTH / 2, state.boss.y + 44, "#ffffff", 1.6);
    burst(GAME_WIDTH / 2, state.boss.y + 42, "#ff5f45", 58, 6);
    state.shake = 9;
    state.hitStop = 0.07;
    state.boss = null;
    updateMission("boss", 1);
    playSfx("bossDown");
    advanceWave();
  }
}

function updateEffects(dt) {
  for (const key of ["wide", "laser", "pierce", "bomb", "slow"]) {
    state.effects[key] = Math.max(0, state.effects[key] - dt);
  }
  state.effects.laserCooldown -= dt;
  if (state.effects.laser > 0 && state.effects.laserCooldown <= 0) {
    state.effects.laserCooldown = 0.4;
    fireLaser(state.paddle.x - state.paddle.width * 0.28);
    fireLaser(state.paddle.x + state.paddle.width * 0.28);
  }
}

function fireLaser(x) {
  let hitY = 54;
  let hitType = null;
  let hitTarget = null;
  for (const brick of state.bricks) {
    if (x < brick.x || x > brick.x + brick.w || brick.y + brick.h >= state.paddle.y) continue;
    if (brick.y + brick.h > hitY) {
      hitY = brick.y + brick.h;
      hitType = "brick";
      hitTarget = brick;
    }
  }
  if (state.boss && x >= state.boss.x && x <= state.boss.x + state.boss.w && state.boss.y + state.boss.h < state.paddle.y) {
    if (state.boss.y + state.boss.h > hitY) {
      hitY = state.boss.y + state.boss.h;
      hitType = "boss";
      hitTarget = state.boss;
    }
  }
  state.lasers.push({ x, y: state.paddle.y - 8, endY: hitY, life: 0.16, hit: !!hitTarget });
  playSfx("laser");
  if (hitType === "brick") damageBrick(hitTarget, 1, x, hitY);
  if (hitType === "boss") damageBoss(1, x, hitY);
}

function updateLasers(dt) {
  for (const laser of state.lasers) laser.life -= dt;
  state.lasers = state.lasers.filter((laser) => laser.life > 0);
}

function spawnRocket() {
  if (!state.boss) return;
  const boss = state.boss;
  const startX = clamp(boss.x + boss.w / 2 + randomRange(-boss.w * 0.35, boss.w * 0.35), 28, GAME_WIDTH - 28);
  const aim = clamp((state.paddle.x - startX) * 0.012, -1.15, 1.15);
  state.rockets.push({
    x: startX,
    y: boss.y + boss.h + 8,
    vx: aim,
    vy: boss.tier === "large" ? 2.8 : 2.35,
    r: 7,
    life: 8
  });
  addPopup("!", startX, boss.y + boss.h + 24, "#ff6b5f", 0.9);
}

function updateRockets(dt) {
  const paddleRect = getPaddleRect();
  for (const rocket of [...state.rockets]) {
    rocket.x += rocket.vx * dt * 60;
    rocket.y += rocket.vy * dt * 60;
    rocket.life -= dt;
    if (circleRect(rocket, paddleRect)) {
      state.rockets.splice(state.rockets.indexOf(rocket), 1);
      burst(rocket.x, rocket.y, "#ff6b5f", 24, 4.5);
      playSfx("explosion");
      state.shake = Math.max(state.shake, 5);
      if (state.effects.shield > 0) {
        state.effects.shield -= 1;
        addPopup("シールド", state.paddle.x, state.paddle.y - 42, "#68d17a", 1.1);
      } else {
        state.lives -= 1;
        addPopup("-1", state.paddle.x, state.paddle.y - 42, "#ff6b5f", 1.2);
        if (state.lives <= 0) gameOver();
      }
    }
  }
  state.rockets = state.rockets.filter((rocket) => rocket.life > 0 && rocket.y < GAME_HEIGHT + 30);
}

function togglePause() {
  if (state.gameEnded) return;
  if (state.shopOpen) {
    closeShop();
    return;
  }
  state.paused = !state.paused;
  if (state.paused) {
    state.shake = 0;
    state.hitStop = 0;
  }
  setOverlay(pauseOverlay, state.paused);
  updateButtons();
}

function openShop() {
  if (state.gameEnded) return;
  state.shopOpen = true;
  state.paused = true;
  setOverlay(pauseOverlay, false);
  setOverlay(shopOverlay, true);
  updateButtons();
}

function closeShop() {
  if (!state.shopOpen) return;
  state.shopOpen = false;
  state.paused = false;
  setOverlay(shopOverlay, false);
  updateButtons();
}

function gameOver() {
  state.gameEnded = true;
  state.running = false;
  playSfx("gameOver");
  if (state.score > Number(localStorage.getItem(STORAGE_KEY) || 0)) {
    localStorage.setItem(STORAGE_KEY, String(state.score));
  }
  state.best = Number(localStorage.getItem(STORAGE_KEY) || state.best);
  gameOverStats.innerHTML = `
    <dt>スコア</dt><dd>${state.score}</dd>
    <dt>ベスト</dt><dd>${state.best}</dd>
    <dt>到達WAVE</dt><dd>${state.wave}</dd>
    <dt>コイン</dt><dd>${state.coins}</dd>
  `;
  setOverlay(gameOverOverlay, true);
  updateButtons();
}

function draw() {
  ctx.save();
  const shake = state.paused || state.shopOpen || state.gameEnded ? 0 : state.shake;
  const sx = shake > 0 ? randomRange(-shake, shake) : 0;
  const sy = shake > 0 ? randomRange(-shake, shake) : 0;
  ctx.translate(sx, sy);
  drawBackground();
  drawBricks();
  drawBoss();
  drawLasers();
  drawRockets();
  drawPaddle();
  drawBalls();
  drawItems();
  drawCoins();
  drawParticles();
  drawPopups();
  drawHudV2();
  drawBanners();
  ctx.restore();
}

function drawBackground() {
  const bossTint = state.boss || state.warningTimer > 0;
  const fever = state.feverTimer > 0;
  const pulse = state.bgPulse;
  const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, bossTint ? shadeColor("#211414", pulse * 34) : fever ? "#1f251d" : shadeColor("#101a1f", pulse * 18));
  gradient.addColorStop(0.5, fever ? "#211d17" : shadeColor("#121515", pulse * 12));
  gradient.addColorStop(1, bossTint ? "#120809" : "#07090b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const t = performance.now() * 0.00038;
  ctx.globalAlpha = fever ? 0.38 : bossTint ? 0.32 + pulse * 0.18 : 0.26 + pulse * 0.14;
  ctx.strokeStyle = fever ? "#ffe48c" : bossTint ? "#7a3034" : "#34505d";
  ctx.lineWidth = 1.1;
  for (let y = 60; y < GAME_HEIGHT; y += 34) {
    ctx.beginPath();
    const rowDrift = Math.sin(y * 0.037 + t * 0.7) * (2.2 + pulse * 2.5);
    const rowPhase = Math.sin(y * 0.011) * 3.4;
    for (let x = 0; x <= GAME_WIDTH; x += 10) {
      const soft = Math.sin(x * 0.024 + y * 0.033 + t + rowPhase) * (4.8 + pulse * 3.2);
      const lazy = Math.sin(x * 0.011 - y * 0.019 + t * 0.34) * 2.4;
      const waveY = y + rowDrift + soft + lazy;
      if (x === 0) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
  }

  if (bossTint || pulse > 0) {
    const cx = state.boss ? state.boss.x + state.boss.w / 2 : GAME_WIDTH / 2;
    const cy = state.boss ? state.boss.y + state.boss.h / 2 : 136;
    const ring = 56 + Math.sin(t * 4) * 8 + pulse * 28;
    ctx.globalAlpha = 0.18 + pulse * 0.28;
    ctx.strokeStyle = bossTint ? "#ff6b5f" : "#49c7ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, ring * 0.58, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHud() {
  const entries = [
    ["スコア", state.score],
    ["ベスト", state.best],
    ["WAVE", state.wave],
    ["ライフ", state.lives],
    ["コイン", state.coins],
    ["コンボ", state.combo]
  ];
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 11px Segoe UI, Arial";
  entries.forEach(([label, value], index) => {
    const x = 12 + (index % 3) * 112;
    const y = 10 + Math.floor(index / 3) * 23;
    ctx.fillStyle = "rgba(245,251,255,0.62)";
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 15px Segoe UI, Arial";
    ctx.fillText(String(value), x + 45, y - 2);
    ctx.font = "700 11px Segoe UI, Arial";
  });

  drawEffectTimers();
  if (state.boss) drawBossHp();
}

function drawEffectTimers() {
  const active = [];
  if (state.effects.wide > 0) active.push(["ワイド", state.effects.wide, "#49c7ff"]);
  if (state.effects.laser > 0) active.push(["レーザー", state.effects.laser, "#49c7ff"]);
  if (state.effects.pierce > 0) active.push(["貫通", state.effects.pierce, "#ffffff"]);
  if (state.effects.bomb > 0) active.push(["爆弾", state.effects.bomb, "#ff9a72"]);
  if (state.effects.slow > 0) active.push(["スロー", state.effects.slow, "#9fffc9"]);
  active.forEach(([label, value, color], index) => {
    const y = 58 + index * 15;
    ctx.fillStyle = color;
    ctx.font = "800 10px Segoe UI, Arial";
    ctx.fillText(`${label} ${value.toFixed(1)}s`, 12, y);
  });
  if (state.effects.shield > 0) {
    ctx.fillStyle = "#6dff8f";
    ctx.font = "900 12px Segoe UI, Arial";
    ctx.fillText(`シールド x${state.effects.shield}`, 300, 58);
  }
}

function drawHudV2() {
  const entries = [
    ["スコア", state.score],
    ["ベスト", state.best],
    ["WAVE", state.wave],
    ["ライフ", state.lives],
    ["コイン", state.coins],
    ["コンボ", state.combo]
  ];
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "800 10px Segoe UI, Arial";
  entries.forEach(([label, value], index) => {
    const x = 12 + (index % 3) * 124;
    const y = 9 + Math.floor(index / 3) * 22;
    ctx.fillStyle = "rgba(245,251,255,0.62)";
    ctx.fillText(label, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 14px Segoe UI, Arial";
    ctx.fillText(formatHudValue(value), x + 43, y - 2);
    ctx.font = "800 10px Segoe UI, Arial";
  });

  drawEffectTimersV2();
  drawMissionPanel();
  if (state.debugMode) drawDebugLabel();
  if (state.boss) drawBossHp();
}

function drawEffectTimersV2() {
  const active = [];
  if (state.effects.wide > 0) active.push(["ワイド", state.effects.wide, "#49c7ff"]);
  if (state.effects.laser > 0) active.push(["レーザー", state.effects.laser, "#49c7ff"]);
  if (state.effects.pierce > 0) active.push(["貫通", state.effects.pierce, "#ffffff"]);
  if (state.effects.bomb > 0) active.push(["爆弾", state.effects.bomb, "#ff9a72"]);
  if (state.effects.slow > 0) active.push(["スロー", state.effects.slow, "#9fffc9"]);
  active.forEach(([label, value, color], index) => {
    const y = 82 + index * 13;
    ctx.fillStyle = color;
    ctx.font = "800 10px Segoe UI, Arial";
    ctx.fillText(`${label} ${value.toFixed(1)}s`, 12, y);
  });
  if (state.effects.shield > 0) {
    ctx.fillStyle = "#6dff8f";
    ctx.font = "900 11px Segoe UI, Arial";
    ctx.fillText(`シールド x${state.effects.shield}`, 302, 82);
  }
}

function drawMissionPanel() {
  if (!state.mission) return;
  const mission = state.mission;
  const x = 12;
  const y = 54;
  const w = 336;
  const pct = clamp(mission.progress / mission.target, 0, 1);
  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 12, 0.58)";
  roundRect(x, y, w, 24, 6);
  ctx.fill();
  ctx.fillStyle = mission.done ? "rgba(159,255,201,0.84)" : "rgba(73,199,255,0.72)";
  roundRect(x + 3, y + 18, (w - 6) * pct, 3, 2);
  ctx.fill();
  ctx.fillStyle = mission.done ? "#9fffc9" : "#f7fbff";
  ctx.font = "800 9px Segoe UI, Arial";
  ctx.fillText(`ミッション: ${mission.label}`, x + 7, y + 4);
  ctx.textAlign = "right";
  ctx.fillText(`${Math.min(mission.progress, mission.target)}/${mission.target} +${mission.reward}コイン`, x + w - 7, y + 4);
  ctx.restore();
}

function drawDebugLabel() {
  ctx.save();
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,230,104,0.82)";
  ctx.font = "900 9px Segoe UI, Arial";
  ctx.fillText("開発: Shift+WでWAVE / Shift+Cでコイン", GAME_WIDTH - 12, 598);
  ctx.restore();
}

function drawBossHp() {
  const pct = clamp(state.boss.hp / state.boss.maxHp, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(42, 84, 336, 9);
  ctx.fillStyle = bossColor();
  ctx.shadowColor = bossColor();
  ctx.shadowBlur = 14;
  ctx.fillRect(42, 84, 336 * pct, 9);
  ctx.shadowBlur = 0;
}

function drawBricks() {
  for (const brick of state.bricks) {
    const material = getBrickMaterial(brick);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.32)";
    ctx.shadowBlur = state.bricks.length > 48 ? 0 : 5;
    const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
    grad.addColorStop(0, material.light);
    grad.addColorStop(0.48, material.color);
    grad.addColorStop(1, material.dark);
    ctx.fillStyle = grad;
    roundRect(brick.x, brick.y, brick.w, brick.h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,248,220,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();

    drawBrickTexture(brick, material);

    if (brick.hp < brick.maxHp) {
      ctx.strokeStyle = material.crack;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(brick.x + brick.w * 0.24, brick.y + 5);
      ctx.lineTo(brick.x + brick.w * 0.38, brick.y + brick.h * 0.48);
      ctx.lineTo(brick.x + brick.w * 0.32, brick.y + brick.h - 5);
      ctx.moveTo(brick.x + brick.w * 0.62, brick.y + 4);
      ctx.lineTo(brick.x + brick.w * 0.74, brick.y + brick.h * 0.42);
      ctx.lineTo(brick.x + brick.w * 0.68, brick.y + brick.h - 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    }

    ctx.fillStyle = "rgba(255,248,230,0.72)";
    ctx.font = "900 11px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyph = brickGlyph(brick.type);
    if (glyph) ctx.fillText(glyph, brick.x + brick.w / 2, brick.y + brick.h / 2 + 1);
    ctx.restore();
  }
}

function drawBrickTexture(brick, material) {
  ctx.save();
  roundRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2, 4);
  ctx.clip();
  ctx.lineCap = "round";

  if (material === materialStyles.wood) {
    ctx.strokeStyle = "rgba(62,34,18,0.34)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i += 1) {
      const y = brick.y + 5 + i * 5 + Math.sin(brick.pulse + i) * 0.7;
      ctx.beginPath();
      ctx.moveTo(brick.x + 4, y);
      ctx.bezierCurveTo(brick.x + 13, y - 2, brick.x + 22, y + 2, brick.x + brick.w - 4, y - 0.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(brick.x + brick.w * 0.62, brick.y + brick.h * 0.52, 4.2, 2.5, -0.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (material === materialStyles.stone) {
    ctx.strokeStyle = "rgba(38,42,49,0.42)";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(brick.x + 8, brick.y + 4);
    ctx.lineTo(brick.x + 13, brick.y + 10);
    ctx.lineTo(brick.x + 10, brick.y + 16);
    ctx.moveTo(brick.x + 23, brick.y + 3);
    ctx.lineTo(brick.x + 19, brick.y + 9);
    ctx.lineTo(brick.x + 28, brick.y + 15);
    ctx.stroke();
  } else if (material === materialStyles.metal) {
    ctx.strokeStyle = "rgba(17,21,28,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(brick.x + brick.w * 0.5, brick.y + 3);
    ctx.lineTo(brick.x + brick.w * 0.5, brick.y + brick.h - 3);
    ctx.moveTo(brick.x + 4, brick.y + brick.h * 0.5);
    ctx.lineTo(brick.x + brick.w - 4, brick.y + brick.h * 0.5);
    ctx.stroke();
    ctx.fillStyle = "rgba(230,235,245,0.4)";
    ctx.fillRect(brick.x + 6, brick.y + 5, 2, 2);
    ctx.fillRect(brick.x + brick.w - 8, brick.y + brick.h - 7, 2, 2);
  } else {
    ctx.strokeStyle = "rgba(183,242,255,0.34)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(brick.x + 5, brick.y + 6);
    ctx.quadraticCurveTo(brick.x + brick.w * 0.5, brick.y + 2.5, brick.x + brick.w - 5, brick.y + 6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(11,64,86,0.25)";
    ctx.beginPath();
    ctx.moveTo(brick.x + 7, brick.y + brick.h - 6);
    ctx.lineTo(brick.x + brick.w - 7, brick.y + brick.h - 7);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBoss() {
  if (!state.boss) return;
  const boss = state.boss;
  const hpRatio = clamp(boss.hp / boss.maxHp, 0, 1);
  ctx.save();
  ctx.shadowColor = bossColor();
  ctx.shadowBlur = 16;
  const grad = ctx.createLinearGradient(boss.x, boss.y, boss.x + boss.w, boss.y + boss.h);
  grad.addColorStop(0, "#ff9a72");
  grad.addColorStop(0.45, bossColor());
  grad.addColorStop(1, "#6b1f21");
  ctx.fillStyle = grad;
  roundRect(boss.x, boss.y, boss.w, boss.h, 7);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,235,215,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(60, 8, 10, 0.62)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(boss.x + boss.w * 0.18, boss.y + 8);
  ctx.lineTo(boss.x + boss.w * 0.28, boss.y + boss.h - 10);
  if (hpRatio < 0.72) {
    ctx.moveTo(boss.x + boss.w * 0.55, boss.y + 6);
    ctx.lineTo(boss.x + boss.w * 0.42, boss.y + boss.h - 8);
  }
  if (hpRatio < 0.38) {
    ctx.moveTo(boss.x + boss.w * 0.78, boss.y + 10);
    ctx.lineTo(boss.x + boss.w * 0.66, boss.y + boss.h - 7);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPaddle() {
  const rect = getPaddleRect();
  ctx.save();
  if (state.effects.shield > 0) {
    ctx.strokeStyle = "rgba(109,255,143,0.6)";
    ctx.shadowColor = "#6dff8f";
    ctx.shadowBlur = 18;
    roundRect(rect.x - 10, rect.y - 12, rect.w + 20, rect.h + 24, 14);
    ctx.stroke();
  }
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y);
  grad.addColorStop(0, "#6f8fa3");
  grad.addColorStop(0.5, "#f1dec0");
  grad.addColorStop(1, "#9b6238");
  ctx.shadowColor = "#49c7ff";
  ctx.shadowBlur = 13;
  ctx.fillStyle = grad;
  roundRect(rect.x, rect.y, rect.w, rect.h, 7);
  ctx.fill();
  ctx.restore();
}

function drawBalls() {
  for (const ball of state.balls) {
    ctx.save();
    const color = state.effects.pierce > 0 ? "#ffffff" : "#a8f7ff";
    ctx.shadowColor = color;
    ctx.shadowBlur = state.effects.pierce > 0 ? 24 : 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawItems() {
  for (const item of state.items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(Math.sin(item.spin) * 0.22);
    ctx.shadowColor = item.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(0, 0, item.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#06101f";
    ctx.font = "900 15px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, 0, 1);
    ctx.restore();
  }
}

function drawCoins() {
  for (const coin of state.coinDrops) {
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.scale(Math.max(0.35, Math.abs(Math.sin(coin.spin))), 1);
    ctx.shadowColor = "#ffe668";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffe668";
    ctx.beginPath();
    ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a4b00";
    ctx.font = "900 11px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", 0, 1);
    ctx.restore();
  }
}

function drawLasers() {
  for (const laser of state.lasers) {
    ctx.save();
    ctx.globalAlpha = clamp(laser.life / 0.16, 0, 1);
    ctx.strokeStyle = laser.hit ? "#fff4a8" : "#49c7ff";
    ctx.shadowColor = laser.hit ? "#ffe668" : "#49c7ff";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(laser.x, laser.y);
    ctx.lineTo(laser.x, laser.endY);
    ctx.stroke();
    if (laser.hit) {
      ctx.fillStyle = "#fff4a8";
      ctx.beginPath();
      ctx.arc(laser.x, laser.endY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRockets() {
  for (const rocket of state.rockets) {
    ctx.save();
    ctx.translate(rocket.x, rocket.y);
    ctx.rotate(Math.atan2(rocket.vy, rocket.vx) - Math.PI / 2);
    ctx.shadowColor = "#ff6b5f";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#ff6b5f";
    roundRect(-5, -10, 10, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#ffe48c";
    ctx.beginPath();
    ctx.moveTo(-4, 10);
    ctx.lineTo(0, 18 + Math.sin(performance.now() * 0.02) * 3);
    ctx.lineTo(4, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPopups() {
  for (const popup of state.popups) {
    ctx.save();
    ctx.globalAlpha = clamp(popup.life / popup.maxLife, 0, 1);
    ctx.translate(popup.x, popup.y);
    ctx.scale(popup.scale, popup.scale);
    ctx.fillStyle = popup.color;
    ctx.shadowColor = popup.color;
    ctx.shadowBlur = 18;
    ctx.font = "900 18px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(popup.text, 0, 0);
    ctx.restore();
  }
}

function drawBanners() {
  if (state.waveBanner > 0 || state.warningTimer > 0) {
    const text = state.warningTimer > 0 ? "警告\nボス接近" : state.bannerText;
    ctx.save();
    ctx.globalAlpha = Math.max(state.waveBanner, Math.min(1, state.warningTimer));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = state.warningTimer > 0 ? "#ff6b5f" : "#fff8e9";
    ctx.shadowColor = state.warningTimer > 0 ? "#ff3c36" : "#49c7ff";
    ctx.shadowBlur = 18;
    ctx.font = "900 34px Segoe UI, Arial";
    const lines = text.split("\n");
    lines.forEach((line, i) => ctx.fillText(line, GAME_WIDTH / 2, 288 + i * 38));
    ctx.restore();
  }
}

function advanceWave() {
  state.wave += 1;
  state.waveKills = 0;
  generateWave();
}

function explodeAt(x, y, radius, damage) {
  if (state.explosionsThisFrame >= MAX_EXPLOSIONS_PER_FRAME) {
    burst(x, y, "#ff8b39", 5, 3.4);
    return;
  }
  state.explosionsThisFrame += 1;
  burst(x, y, "#ff8b39", 16, 5.2);
  state.shake = Math.max(state.shake, 6);
  const targets = [];
  for (const brick of state.bricks) {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    const dist = distance(x, y, cx, cy);
    if (dist <= radius) targets.push({ brick, cx, cy, dist });
  }
  targets.sort((a, b) => a.dist - b.dist);
  for (const target of targets.slice(0, MAX_EXPLOSION_TARGETS)) {
    damageBrick(target.brick, damage, target.cx, target.cy);
  }
  if (state.boss && distance(x, y, state.boss.x + state.boss.w / 2, state.boss.y + state.boss.h / 2) <= radius + 110) {
    damageBoss(damage, x, y);
  }
}

function reflectBallFromRect(ball, rect) {
  const prevX = ball.prevX ?? ball.x - ball.vx;
  const prevY = ball.prevY ?? ball.y - ball.vy;
  const r = ball.r + 0.5;
  const cameFromLeft = prevX <= rect.x - r;
  const cameFromRight = prevX >= rect.x + rect.w + r;
  const cameFromTop = prevY <= rect.y - r;
  const cameFromBottom = prevY >= rect.y + rect.h + r;

  let axis = "y";
  if ((cameFromLeft || cameFromRight) && !(cameFromTop || cameFromBottom)) {
    axis = "x";
  } else if ((cameFromTop || cameFromBottom) && !(cameFromLeft || cameFromRight)) {
    axis = "y";
  } else {
    const pushLeft = Math.abs(ball.x - (rect.x - r));
    const pushRight = Math.abs(ball.x - (rect.x + rect.w + r));
    const pushTop = Math.abs(ball.y - (rect.y - r));
    const pushBottom = Math.abs(ball.y - (rect.y + rect.h + r));
    axis = Math.min(pushLeft, pushRight) < Math.min(pushTop, pushBottom) ? "x" : "y";
  }

  if (axis === "x") {
    ball.x = cameFromRight ? rect.x + rect.w + r : rect.x - r;
    ball.vx = cameFromRight ? Math.abs(ball.vx) : -Math.abs(ball.vx);
  } else {
    ball.y = cameFromBottom ? rect.y + rect.h + r : rect.y - r;
    ball.vy = cameFromBottom ? Math.abs(ball.vy) : -Math.abs(ball.vy);
  }

  keepBallAnglePlayable(ball);
}

function keepBallAnglePlayable(ball) {
  const speed = Math.max(getBallSpeed() * 0.92, Math.hypot(ball.vx, ball.vy));
  const minVertical = Math.min(speed * 0.42, 2.4);
  if (Math.abs(ball.vy) < minVertical) {
    const sign = ball.vy < 0 ? -1 : 1;
    ball.vy = sign * minVertical;
    ball.vx = Math.sign(ball.vx || randomRange(-1, 1)) * Math.sqrt(Math.max(0.1, speed * speed - ball.vy * ball.vy));
  }
}

function burst(x, y, color, count, force) {
  const available = Math.max(0, MAX_PARTICLES - state.particles.length);
  const actualCount = Math.min(count, available);
  for (let i = 0; i < actualCount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = randomRange(0.4, force);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      size: randomRange(1.4, 3.4),
      color,
      life: randomRange(0.28, 0.72),
      maxLife: 0.72
    });
  }
}

function addPopup(text, x, y, color, scale = 1) {
  state.popups.push({ text, x, y, color, life: 0.8, maxLife: 0.8, scale });
}

function scoreMultiplier() {
  let multiplier = 1;
  if (state.combo >= 10) multiplier = 1.2;
  if (state.combo >= 30) multiplier = 1.5;
  if (state.combo >= 50) multiplier = 2;
  if (state.feverTimer > 0 || state.combo >= 100) multiplier *= 2.4;
  return multiplier;
}

function getBallSpeed() {
  const comboBoost = Math.min(0.8, state.combo * 0.006);
  const base = INITIAL_BALL_SPEED + Math.min(2.2, Math.log2(state.wave + 1) * 0.24) + comboBoost;
  return state.effects.slow > 0 ? base * 0.76 : base;
}

function tuneBallSpeed(ball, dt) {
  if (!ball.launched) return;
  const target = getBallSpeed();
  const current = Math.hypot(ball.vx, ball.vy) || target;
  const next = lerp(current, target, Math.min(1, dt * 0.9));
  ball.vx = (ball.vx / current) * next;
  ball.vy = (ball.vy / current) * next;
}

function getPaddleRect() {
  return {
    x: state.paddle.x - state.paddle.width / 2,
    y: state.paddle.y,
    w: state.paddle.width,
    h: state.paddle.height
  };
}

function circleRect(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function rectContactDepth(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const distanceToRect = Math.hypot(circle.x - closestX, circle.y - closestY);
  return circle.r - distanceToRect;
}

function rectsOverlap(a, b, padding = 0) {
  return (
    a.x < b.x + b.w + padding &&
    a.x + a.w + padding > b.x &&
    a.y < b.y + b.h + padding &&
    a.y + a.h + padding > b.y
  );
}

function updateButtons() {
  const quickUsable = canUseUpgrades();
  const shopUsable = canBuy();
  buyLaserButton.disabled = !quickUsable || state.coins < LASER_COST;
  buyShieldButton.disabled = !quickUsable || state.coins < SHIELD_COST || state.effects.shield >= 3;
  shopButton.disabled = state.gameEnded;
  shopLaserButton.disabled = !shopUsable || state.coins < LASER_COST;
  shopShieldButton.disabled = !shopUsable || state.coins < SHIELD_COST || state.effects.shield >= 3;
  shopWideButton.disabled = !shopUsable || state.coins < WIDE_COST;
  shopMultiButton.disabled = !shopUsable || state.coins < MULTI_COST || state.balls.length >= MAX_BALLS;
  shopCoinText.textContent = `所持コイン ${state.coins}`;
  pauseButton.disabled = state.gameEnded;
  pauseButton.textContent = state.paused ? "▶" : "⏸";
}

function canUseUpgrades() {
  return state.running && !state.paused && !state.shopOpen && !state.gameEnded;
}

function canBuy() {
  return state.running && !state.gameEnded && (!state.paused || state.shopOpen);
}

function setOverlay(element, visible) {
  element.classList.toggle("hidden", !visible);
  element.setAttribute("aria-hidden", String(!visible));
}

function unlockAudio() {
  if (audio.enabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audio.ctx = audio.ctx || new AudioContext();
  audio.master = audio.master || audio.ctx.createGain();
  audio.master.gain.value = SFX_VOLUME;
  audio.master.connect(audio.ctx.destination);
  audio.ctx.resume();
  audio.enabled = true;
}

function playSfx(type) {
  if (!audio.enabled || !audio.ctx) return;
  const now = audio.ctx.currentTime;
  const cooldown = SFX_COOLDOWN[type] || 0;
  if (cooldown > 0 && now - (audio.lastPlayed[type] || 0) < cooldown) return;
  audio.lastPlayed[type] = now;
  const sounds = {
    paddle: [[260, 0.045, "triangle", 0.48], [520, 0.035, "sine", 0.18]],
    chip: [[180, 0.035, "square", 0.18]],
    break: [[160, 0.055, "triangle", 0.42], [96, 0.08, "sawtooth", 0.16]],
    explosion: [[82, 0.16, "sawtooth", 0.5], [44, 0.18, "square", 0.22]],
    coin: [[820, 0.045, "sine", 0.38], [1240, 0.06, "sine", 0.24]],
    item: [[460, 0.07, "triangle", 0.36], [720, 0.09, "sine", 0.25]],
    buy: [[360, 0.06, "triangle", 0.28], [620, 0.08, "sine", 0.2]],
    laser: [[980, 0.045, "sawtooth", 0.16]],
    bossDown: [[120, 0.18, "sawtooth", 0.48], [260, 0.22, "triangle", 0.24]],
    gameOver: [[180, 0.18, "triangle", 0.28], [90, 0.24, "sine", 0.26]]
  };
  for (const [frequency, duration, wave, gainValue] of sounds[type] || sounds.chip) {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.72), now + duration);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

function weightedPick(table) {
  const total = table.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of table) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return table[0];
}

function pickBrickType() {
  const roll = Math.random();
  if (roll < 0.26) return "hard";
  if (roll < 0.46) return "bomb";
  if (roll < 0.72) return "coin";
  return "item";
}

function pickBrickHp(type) {
  if (state.wave <= 3 && type !== "hard") return 1;

  const woodRate = clamp((state.wave - 3) * 0.045, 0, 0.32);
  const stoneRate = state.wave >= 8 ? clamp((state.wave - 7) * 0.032, 0, 0.16) : 0;
  const metalRate = state.wave >= 14 ? clamp((state.wave - 13) * 0.018, 0, 0.08) : 0;
  const hardBonus = type === "hard" ? 0.16 : 0;
  const roll = Math.random();

  if (roll < metalRate + hardBonus * 0.2) return 4;
  if (roll < metalRate + stoneRate + hardBonus * 0.55) return 3;
  if (roll < metalRate + stoneRate + woodRate + hardBonus) return 2;
  return 1;
}

function brickGlyph(type) {
  return { normal: "", hard: "", bomb: "", coin: "", item: "" }[type];
}

function getBrickMaterial(brick) {
  if (brick.maxHp <= 1) return materialStyles.normal;
  if (brick.hp <= 1) return materialStyles.normal;
  if (brick.hp === 2) return materialStyles.wood;
  if (brick.hp === 3) return materialStyles.stone;
  return materialStyles.metal;
}

function itemColor(type) {
  return itemTable.find((item) => item.type === type)?.color || "#ffffff";
}

function itemName(type) {
  return {
    multi: "マルチ",
    wide: "ワイド",
    laser: "レーザー",
    pierce: "貫通",
    bomb: "爆弾",
    shield: "シールド",
    slow: "スロー"
  }[type] || type;
}

function itemNameV2(type) {
  return {
    multi: "マルチ",
    wide: "ワイド",
    laser: "レーザー",
    pierce: "貫通",
    bomb: "爆弾",
    shield: "シールド",
    slow: "スロー"
  }[type] || type;
}

function bossColor() {
  if (!state.boss) return "#d9413f";
  const hp = state.boss.hp / state.boss.maxHp;
  return hp < 0.35 ? "#8f1f23" : hp < 0.68 ? "#c93332" : "#d9413f";
}

function shadeColor(hex, percent) {
  const value = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = clamp((value >> 16) + amt, 0, 255);
  const g = clamp(((value >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((value & 0xff) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function formatHudValue(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000000000) return `${(n / 1000000000).toFixed(1)}B`;
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 100000) return `${Math.round(n / 1000)}K`;
  return String(Math.floor(n));
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function gameOver() {
  state.gameEnded = true;
  state.running = false;
  playSfx("gameOver");
  if (state.score > Number(localStorage.getItem(STORAGE_KEY) || 0)) {
    localStorage.setItem(STORAGE_KEY, String(state.score));
  }
  state.best = Number(localStorage.getItem(STORAGE_KEY) || state.best);
  gameOverStats.innerHTML = `
    <dt>スコア</dt><dd>${formatHudValue(state.score)}</dd>
    <dt>ベスト</dt><dd>${formatHudValue(state.best)}</dd>
    <dt>到達WAVE</dt><dd>${state.wave}</dd>
    <dt>コイン</dt><dd>${state.coins}</dd>
  `;
  setOverlay(gameOverOverlay, true);
  updateButtons();
}

function updateButtons() {
  buyLaserButton.disabled = !canUseUpgrades() || state.coins < LASER_COST;
  buyShieldButton.disabled = !canUseUpgrades() || state.coins < SHIELD_COST || state.effects.shield >= 3;
  shopButton.disabled = state.gameEnded;
  shopLaserButton.disabled = !canBuy() || state.coins < LASER_COST;
  shopShieldButton.disabled = !canBuy() || state.coins < SHIELD_COST || state.effects.shield >= 3;
  shopWideButton.disabled = !canBuy() || state.coins < WIDE_COST;
  shopMultiButton.disabled = !canBuy() || state.coins < MULTI_COST || state.balls.length >= MAX_BALLS;
  shopCoinText.textContent = `所持コイン ${state.coins}`;
  pauseButton.disabled = state.gameEnded;
  pauseButton.textContent = state.paused ? ">" : "||";
}

init();
