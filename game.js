const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const scoreDisplay = document.getElementById("score");
const highScoreDisplay = document.getElementById("highScore");
const gameTimeDisplay = document.getElementById("gameTime");
const starCountDisplay = document.getElementById("starCount");
const powerFill = document.getElementById("powerFill");
const gameOverMessage = document.getElementById("gameOver");
const finalScoreDisplay = document.getElementById("finalScore");
const finalTimeDisplay = document.getElementById("finalTime");
const finalStarsDisplay = document.getElementById("finalStars");
const restartButton = document.getElementById("restartButton");
const moveLeftButton = document.getElementById("moveLeftButton");
const jumpButton = document.getElementById("jumpButton");
const moveRightButton = document.getElementById("moveRightButton");

const PLATFORM_HEIGHT = 18;
const MIN_PLATFORM_COUNT = 20;
const CAMERA_LINE = canvas.height * 0.4;
const MIN_JUMP_STRENGTH = 400;
const MAX_JUMP_STRENGTH = 540;
const MAX_CHARGE_TIME = 1.6;
const STAR_SIZE = 30;
const STAR_SCORE = 5;
const HIGH_SCORE_KEY = "kidsTowerHighScore";
const gravity = 900;
const keys = new Set();
const platforms = [];
const stars = [];
const touchMovement = { left: false, right: false };

const player = {
  x: 0,
  y: 0,
  width: 34,
  height: 46,
  velocityX: 0,
  velocityY: 0,
  speed: 175,
  onGround: true,
};

let nextPlatformId = 0;
let platformsUntilNextStar = randomStarInterval();
let highestReachedPlatformId = 0;
let score = 0;
let starCount = 0;
let highScore = loadHighScore();
let elapsedTime = 0;
let chargeTime = 0;
let isCharging = false;
let gameOver = false;
let previousTime = performance.now();

function loadHighScore() {
  try {
    return Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY), 10) || 0;
  } catch (error) {
    return 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  } catch (error) {
    // The game still works when browser storage is unavailable.
  }
}

function formatTime(totalSeconds) {
  const wholeSeconds = Math.floor(totalSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function randomBetween(minimum, maximum) {
  return Math.random() * (maximum - minimum) + minimum;
}

function randomStarInterval() {
  return Math.random() < 0.5 ? 3 : 4;
}

function createStar(platform) {
  stars.push({
    x: platform.x + (platform.width - STAR_SIZE) / 2,
    y: platform.y - STAR_SIZE - 8,
    size: STAR_SIZE,
    collected: false,
  });
}

function createPlatform(x, y, width, canHaveStar = true) {
  const platform = {
    id: nextPlatformId,
    x,
    y,
    width,
    height: PLATFORM_HEIGHT,
  };

  nextPlatformId += 1;
  platforms.push(platform);

  if (canHaveStar) {
    platformsUntilNextStar -= 1;

    if (platformsUntilNextStar <= 0) {
      createStar(platform);
      platformsUntilNextStar = randomStarInterval();
    }
  }

  return platform;
}

function createNextPlatform() {
  const previousPlatform = platforms[platforms.length - 1];
  const width = Math.round(randomBetween(190, 290));
  const maximumX = canvas.width - width;
  const horizontalShift = randomBetween(-115, 115);
  const x = Math.max(0, Math.min(maximumX, previousPlatform.x + horizontalShift));
  const y = previousPlatform.y - randomBetween(62, 91);

  return createPlatform(x, y, width);
}

function ensurePlatforms() {
  let highestPlatform = platforms[platforms.length - 1];

  while (platforms.length < MIN_PLATFORM_COUNT || highestPlatform.y > -100) {
    highestPlatform = createNextPlatform();
  }
}

function clearTouchControls() {
  touchMovement.left = false;
  touchMovement.right = false;
  moveLeftButton.classList.remove("is-active");
  moveRightButton.classList.remove("is-active");
  jumpButton.classList.remove("is-active");
}

function resetGame() {
  platforms.length = 0;
  stars.length = 0;
  keys.clear();
  clearTouchControls();
  nextPlatformId = 0;
  platformsUntilNextStar = randomStarInterval();
  highestReachedPlatformId = 0;
  score = 0;
  starCount = 0;
  elapsedTime = 0;
  chargeTime = 0;
  isCharging = false;
  gameOver = false;
  gameOverMessage.hidden = true;

  const startingPlatform = createPlatform(260, canvas.height - 48, 280, false);
  player.x = startingPlatform.x + (startingPlatform.width - player.width) / 2;
  player.y = startingPlatform.y - player.height;
  player.velocityX = 0;
  player.velocityY = 0;
  player.onGround = true;

  ensurePlatforms();
  updateHud();
}

function isJumpKey(key) {
  return key === " " || key === "Spacebar" || key === "Space";
}

function startCharging() {
  if (player.onGround && !isCharging && !gameOver) {
    chargeTime = 0;
    isCharging = true;
  }
}

function releaseJump() {
  if (!isCharging) {
    return;
  }

  if (player.onGround && !gameOver) {
    const chargeRatio = Math.min(chargeTime / MAX_CHARGE_TIME, 1);
    const jumpStrength = MIN_JUMP_STRENGTH +
      (MAX_JUMP_STRENGTH - MIN_JUMP_STRENGTH) * chargeRatio;
    player.velocityY = -jumpStrength;
    player.onGround = false;
  }

  chargeTime = 0;
  isCharging = false;
}

function endGame() {
  gameOver = true;
  isCharging = false;
  chargeTime = 0;
  keys.clear();
  clearTouchControls();

  if (score > highScore) {
    highScore = score;
    saveHighScore();
  }

  finalScoreDisplay.textContent = score;
  finalTimeDisplay.textContent = formatTime(elapsedTime);
  finalStarsDisplay.textContent = starCount;
  gameOverMessage.hidden = false;
  updateHud();
}

function bindHoldButton(button, onPress, onRelease) {
  const release = (event) => {
    event.preventDefault();
    button.classList.remove("is-active");
    onRelease();
  };

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-active");
    onPress();
  });

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

bindHoldButton(
  moveLeftButton,
  () => { touchMovement.left = true; },
  () => { touchMovement.left = false; },
);

bindHoldButton(
  jumpButton,
  startCharging,
  releaseJump,
);

bindHoldButton(
  moveRightButton,
  () => { touchMovement.right = true; },
  () => { touchMovement.right = false; },
);

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", " ", "Spacebar", "Space", "Enter"].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === "Enter" && gameOver) {
    resetGame();
    return;
  }

  keys.add(event.key);

  if (isJumpKey(event.key) && !event.repeat) {
    startCharging();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);

  if (isJumpKey(event.key)) {
    releaseJump();
  }
});

restartButton.addEventListener("click", resetGame);

function movePlatformsWithCamera() {
  if (player.y >= CAMERA_LINE) {
    return;
  }

  const cameraMovement = CAMERA_LINE - player.y;
  player.y = CAMERA_LINE;

  for (const platform of platforms) {
    platform.y += cameraMovement;
  }

  for (const star of stars) {
    star.y += cameraMovement;
  }

  while (platforms.length > 0 && platforms[0].y > canvas.height + 80) {
    platforms.shift();
  }

  while (stars.length > 0 && stars[0].y > canvas.height + 80) {
    stars.shift();
  }

  ensurePlatforms();
}

function landOnPlatform(previousBottom) {
  const playerBottom = player.y + player.height;

  for (const platform of platforms) {
    const overlapsPlatform =
      player.x + player.width > platform.x &&
      player.x < platform.x + platform.width;

    if (
      player.velocityY >= 0 &&
      previousBottom <= platform.y &&
      playerBottom >= platform.y &&
      overlapsPlatform
    ) {
      player.y = platform.y - player.height;
      player.velocityX = 0;
      player.velocityY = 0;
      player.onGround = true;

      if (platform.id > highestReachedPlatformId) {
        highestReachedPlatformId = platform.id;
        score += 1;
      }

      return;
    }
  }
}

function collectStars() {
  for (const star of stars) {
    if (star.collected) {
      continue;
    }

    const overlapsStar =
      player.x < star.x + star.size &&
      player.x + player.width > star.x &&
      player.y < star.y + star.size &&
      player.y + player.height > star.y;

    if (overlapsStar) {
      star.collected = true;
      starCount += 1;
      score += STAR_SCORE;
    }
  }
}

function update(deltaTime) {
  if (gameOver) {
    return;
  }

  elapsedTime += deltaTime;

  if (isCharging && player.onGround) {
    chargeTime = Math.min(chargeTime + deltaTime, MAX_CHARGE_TIME);
  }

  player.velocityX = 0;

  if (keys.has("ArrowLeft") || touchMovement.left) {
    player.velocityX -= player.speed;
  }

  if (keys.has("ArrowRight") || touchMovement.right) {
    player.velocityX += player.speed;
  }

  const previousBottom = player.y + player.height;

  player.x += player.velocityX * deltaTime;
  player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
  player.velocityY += gravity * deltaTime;
  player.y += player.velocityY * deltaTime;
  player.onGround = false;

  collectStars();
  landOnPlatform(previousBottom);
  movePlatformsWithCamera();

  if (player.y > canvas.height) {
    endGame();
  }
}

function drawPlatform(platform) {
  context.fillStyle = "#8bcf9b";
  context.fillRect(platform.x, platform.y, platform.width, platform.height);
  context.fillStyle = "#b9e5a8";
  context.fillRect(platform.x, platform.y, platform.width, 6);
}

function drawStar(star) {
  if (star.collected) {
    return;
  }

  const centerX = star.x + star.size / 2;
  const centerY = star.y + star.size / 2;
  const outerRadius = star.size / 2;
  const innerRadius = outerRadius * 0.46;

  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (point === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
  context.fillStyle = "#ffd85c";
  context.fill();
  context.strokeStyle = "#fff3a6";
  context.lineWidth = 3;
  context.stroke();
}

function drawPlayer() {
  const centerX = player.x + player.width / 2;
  const headRadius = 11;
  const headY = player.y + headRadius;

  context.fillStyle = "#ffd6b5";
  context.beginPath();
  context.arc(centerX, headY, headRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f7b6c8";
  context.fillRect(player.x + 5, player.y + 22, player.width - 10, 19);

  context.fillStyle = "#5f8dd3";
  context.fillRect(player.x + 7, player.y + 39, 7, 7);
  context.fillRect(player.x + player.width - 14, player.y + 39, 7, 7);

  context.fillStyle = "#17445c";
  context.beginPath();
  context.arc(centerX - 4, headY - 1, 1.4, 0, Math.PI * 2);
  context.arc(centerX + 4, headY - 1, 1.4, 0, Math.PI * 2);
  context.fill();
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#87ceeb";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const platform of platforms) {
    drawPlatform(platform);
  }

  for (const star of stars) {
    drawStar(star);
  }

  drawPlayer();
}

function updateHud() {
  const chargeRatio = Math.min(chargeTime / MAX_CHARGE_TIME, 1);
  scoreDisplay.textContent = score;
  highScoreDisplay.textContent = highScore;
  gameTimeDisplay.textContent = formatTime(elapsedTime);
  starCountDisplay.textContent = starCount;
  powerFill.style.width = `${Math.round(chargeRatio * 100)}%`;
}

function gameLoop(currentTime) {
  const deltaTime = Math.min((currentTime - previousTime) / 1000, 0.05);
  previousTime = currentTime;

  update(deltaTime);
  draw();
  updateHud();
  requestAnimationFrame(gameLoop);
}

resetGame();
requestAnimationFrame(gameLoop);
