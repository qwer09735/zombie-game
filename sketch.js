/*
AI 輔助 p5.js 殭屍倖存者遊戲範例
適用：p5.js Web Editor
做法：把本檔內容貼到 sketch.js 即可執行

已包含功能：
1. 玩家走位：方向鍵 / WASD
2. 殭屍追玩家：敵人會往玩家座標移動
3. 自動攻擊：每隔一段時間攻擊最近敵人
4. 撿經驗：殭屍死亡後掉經驗球
5. 升級三選一：升級時按 1/2/3 選技能
6. 多種武器：子彈、光環、旋轉刀、炸彈
7. Boss：每 30 秒出現，不同 Boss 有不同技能，並顯示血量
8. 血量、分數、存活時間：畫面左上角顯示
9. 角色解鎖：使用 localStorage 儲存解鎖狀態
10. 角色造型：不同角色有不同外觀，不再只是圓形
11. 背景造型：廢墟地板、裂痕、碎石、警示線
12. 血跡殘留：怪物死亡後會留下血跡
13. 滑鼠操作：首頁開始、選角色、遊戲結束都可以點擊
14. 無邊際地圖：玩家不受畫面邊界限制，鏡頭會跟著玩家移動
15. v4 修正：無邊際地圖下，子彈不再用畫布邊界刪除，避免跑遠後自動攻擊失效
16. v5 新增：Game Over 後存活時間停止、選角頁可直接開始、武器圖鑑、殭屍圖鑑
17. v6 新增：手機觸控操作，左下角虛擬搖桿，頁面避免滑動，適合上傳 GitHub Pages 後用手機玩
*/

// ============================================================
// 一、遊戲狀態與基本資料
// ============================================================

let gameState = "title"; 
// title：首頁
// character：角色選擇
// playing：遊戲中
// upgrade：升級選擇中
// gameover：遊戲結束
// weaponDex：武器圖鑑
// zombieDex：殭屍圖鑑

let player;
let enemies = [];
let bullets = [];
let expGems = [];
let bosses = [];
let explosions = [];
let floatingTexts = [];

let score = 0;
let kills = 0;
let bossKillsThisRun = 0;

let startTime = 0;
let finalSurvivalSeconds = 0;
let lastEnemySpawn = 0;
let lastAttackTime = 0;
let lastAuraDamageTime = 0;
let lastBombTime = 0;
let lastBossSpawnTime = 0;
let bossSpawnCount = 0;

let selectedCharacterId = "student";
let unlockedCharacters = {};
let playerStats = {};

let upgradeOptions = [];
let justUnlockedMessages = [];

// 背景裝飾、血跡與鏡頭
let environmentDetails = [];
let bloodStains = [];

// cameraX / cameraY 代表鏡頭中心在世界座標的位置。
// 玩家可以一直走，鏡頭會跟著玩家，因此地圖看起來是無邊際的。
let cameraX = 0;
let cameraY = 0;

// 手機觸控用虛擬搖桿
let virtualJoystick = {
  active: false,
  baseX: 95,
  baseY: 505,
  knobX: 95,
  knobY: 505,
  dx: 0,
  dy: 0,
  r: 58
};

let nextId = 1;

// ============================================================
// 二、角色資料
// ============================================================

const characters = [
  {
    id: "student",
    name: "新手學生",
    desc: "能力平均，最適合第一次遊玩。",
    unlockText: "一開始就解鎖",
    color: "#4A90E2",
    maxHp: 100,
    speed: 4,
    attackBonus: 0,
    cooldownBonus: 0
  },
  {
    id: "runner",
    name: "跑酷少年",
    desc: "速度很快，但血量比較少。",
    unlockText: "單局存活 60 秒解鎖",
    color: "#F5A623",
    maxHp: 80,
    speed: 5.3,
    attackBonus: 0,
    cooldownBonus: 0
  },
  {
    id: "scientist",
    name: "科學博士",
    desc: "武器冷卻較短，攻擊頻率更高。",
    unlockText: "打倒 1 隻 Boss 解鎖",
    color: "#7ED321",
    maxHp: 90,
    speed: 4,
    attackBonus: 0,
    cooldownBonus: 120
  },
  {
    id: "guardian",
    name: "鐵甲戰士",
    desc: "血量很多，適合穩定生存。",
    unlockText: "累積擊殺 100 隻殭屍解鎖",
    color: "#9B9B9B",
    maxHp: 150,
    speed: 3.5,
    attackBonus: 1,
    cooldownBonus: 0
  }
];

// ============================================================
// 三、p5.js 初始化
// ============================================================

function setup() {
  createCanvas(900, 600);
  pixelDensity(1); // 手機效能比較穩
  textFont("Arial");
  createEnvironmentDetails();
  loadSaveData();
}

function draw() {
  background(24, 26, 34);

  if (gameState === "title") {
    drawTitleScreen();
  } else if (gameState === "character") {
    drawCharacterScreen();
  } else if (gameState === "playing") {
    updateGame();
    drawGame();
  } else if (gameState === "upgrade") {
    drawGame();
    drawUpgradeScreen();
  } else if (gameState === "gameover") {
    drawGameOverScreen();
  } else if (gameState === "weaponDex") {
    drawWeaponDexScreen();
  } else if (gameState === "zombieDex") {
    drawZombieDexScreen();
  }
}

// ============================================================
// 四、儲存與角色解鎖
// ============================================================

function loadSaveData() {
  let savedUnlocks = localStorage.getItem("p5_survivor_unlocks");
  let savedStats = localStorage.getItem("p5_survivor_stats");
  let savedSelected = localStorage.getItem("p5_survivor_selected");

  if (savedUnlocks) {
    unlockedCharacters = JSON.parse(savedUnlocks);
  } else {
    unlockedCharacters = { student: true };
  }

  if (savedStats) {
    playerStats = JSON.parse(savedStats);
  } else {
    playerStats = {
      highScore: 0,
      maxSurvival: 0,
      totalKills: 0,
      totalBossKills: 0
    };
  }

  if (savedSelected) {
    selectedCharacterId = savedSelected;
  }

  if (!unlockedCharacters[selectedCharacterId]) {
    selectedCharacterId = "student";
  }

  saveData();
}

function saveData() {
  localStorage.setItem("p5_survivor_unlocks", JSON.stringify(unlockedCharacters));
  localStorage.setItem("p5_survivor_stats", JSON.stringify(playerStats));
  localStorage.setItem("p5_survivor_selected", selectedCharacterId);
}

function resetSaveData() {
  unlockedCharacters = { student: true };
  playerStats = {
    highScore: 0,
    maxSurvival: 0,
    totalKills: 0,
    totalBossKills: 0
  };
  selectedCharacterId = "student";
  saveData();
}

function checkUnlocksAfterGame(survivalSeconds) {
  justUnlockedMessages = [];

  if (survivalSeconds >= 60 && !unlockedCharacters.runner) {
    unlockedCharacters.runner = true;
    justUnlockedMessages.push("解鎖角色：跑酷少年！");
  }

  if (playerStats.totalBossKills >= 1 && !unlockedCharacters.scientist) {
    unlockedCharacters.scientist = true;
    justUnlockedMessages.push("解鎖角色：科學博士！");
  }

  if (playerStats.totalKills >= 100 && !unlockedCharacters.guardian) {
    unlockedCharacters.guardian = true;
    justUnlockedMessages.push("解鎖角色：鐵甲戰士！");
  }

  saveData();
}

// ============================================================
// 五、開始與重置遊戲
// ============================================================

function resetGame() {
  const charData = getSelectedCharacter();

  player = {
    x: 0,
    y: 0,
    r: 16,
    color: charData.color,
    hp: charData.maxHp,
    maxHp: charData.maxHp,
    speed: charData.speed,
    level: 1,
    exp: 0,
    nextExp: 6,
    pickupRadius: 38,
    invincibleUntil: 0,
    baseAttackCooldown: max(180, 650 - charData.cooldownBonus),
    bulletDamage: 10 + charData.attackBonus,
    attackRange: 100,
    auraLevel: 0,
    bladeLevel: 0,
    bombLevel: 0,
    bulletLevel: 1
  };

  enemies = [];
  bullets = [];
  expGems = [];
  bosses = [];
  explosions = [];
  floatingTexts = [];
  bloodStains = [];
  upgradeOptions = [];

  score = 0;
  kills = 0;
  bossKillsThisRun = 0;

  startTime = millis();
  finalSurvivalSeconds = 0;
  lastEnemySpawn = millis();
  lastAttackTime = millis();
  lastAuraDamageTime = millis();
  lastBombTime = millis();
  lastBossSpawnTime = millis();
  bossSpawnCount = 0;
  cameraX = player.x;
  cameraY = player.y;

  for (let i = 0; i < 4; i++) {
    spawnEnemy();
  }

  gameState = "playing";
}

function getSelectedCharacter() {
  return characters.find(c => c.id === selectedCharacterId) || characters[0];
}

// ============================================================
// 六、主要更新流程
// ============================================================

function updateGame() {
  updatePlayer();
  updateEnemySpawning();
  updateEnemies();
  updateBossSpawning();
  updateBosses();
  updateAutoAttack();
  updateBullets();
  updateWeapons();
  updateExplosions();
  updateExpGems();
  updateFloatingTexts();
  checkPlayerHit();

  if (player.hp <= 0) {
    endGame();
  }
}

function drawGame() {
  updateCamera();

  // 背景用鏡頭座標繪製，產生無邊際地圖的感覺
  drawGridBackground();

  // 下面這些物件都在「世界座標」中，所以要先套用鏡頭位移
  push();
  applyCameraTransform();

  drawBloodStains();
  drawExpGems();
  drawPlayer();
  drawEnemies();
  drawBosses();
  drawBullets();
  drawWeapons();
  drawExplosions();
  drawFloatingTexts();

  pop();

  // Boss 頂部血條、HUD、手機搖桿都是固定在螢幕上的，所以不要受到鏡頭影響
  drawBossTopHpBar();
  drawHUD();
  drawMobileControls();
}

// ============================================================
// 七、玩家移動
// ============================================================

function updatePlayer() {
  let dx = 0;
  let dy = 0;

  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) dx -= 1;  // A
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) dx += 1; // D
  if (keyIsDown(UP_ARROW) || keyIsDown(87)) dy -= 1;    // W
  if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) dy += 1;  // S

  // 手機版：讀取左下角虛擬搖桿
  updateVirtualJoystick();
  dx += virtualJoystick.dx;
  dy += virtualJoystick.dy;

  // 斜向移動時避免速度變太快
  if (dx !== 0 || dy !== 0) {
    let len = sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }

  player.x += dx * player.speed;
  player.y += dy * player.speed;

  // 無邊際地圖版本：不限制玩家在畫布內。
  // 玩家座標可以一直增加或減少，鏡頭會跟著玩家移動。
}

// 之後如果要把角色換成自己的圖片：
// 1. 在 p5.js Web Editor 左側上傳圖片，例如 student.png。
// 2. 在 preload() 用 loadImage() 載入。
// 3. 在 drawPlayer() 裡用 image(圖片, -寬/2, -高/2, 寬, 高) 取代目前的繪圖。
// 目前先用程式畫角色，避免沒有圖片檔時遊戲壞掉。
function drawPlayer() {
  push();
  translate(player.x, player.y);

  let charId = selectedCharacterId;
  let blink = millis() < player.invincibleUntil && frameCount % 8 < 4;

  // 受傷後短暫閃白
  let mainColor = blink ? "#FFFFFF" : player.color;

  // 腳底陰影
  noStroke();
  fill(0, 0, 0, 80);
  ellipse(0, 16, 34, 12);

  if (charId === "runner") {
    drawRunnerHero(mainColor);
  } else if (charId === "scientist") {
    drawScientistHero(mainColor);
  } else if (charId === "guardian") {
    drawGuardianHero(mainColor);
  } else {
    drawStudentHero(mainColor);
  }

  pop();
}

function drawStudentHero(mainColor) {
  // 身體
  noStroke();
  fill("#2C3E50");
  rect(-10, 2, 20, 22, 6);

  // 書包
  fill("#8E5A2A");
  rect(-17, 4, 9, 18, 4);

  // 頭
  fill("#FFD6A5");
  circle(0, -10, 25);

  // 頭髮
  fill("#3A2A1A");
  arc(0, -16, 26, 18, PI, TWO_PI);

  // 衣服
  fill(mainColor);
  rect(-12, 4, 24, 18, 6);

  // 臉
  fill(20);
  circle(-5, -11, 3);
  circle(5, -11, 3);
  stroke(20);
  strokeWeight(1.5);
  line(-3, -4, 3, -4);

  // 小木棍武器
  stroke("#D6A04D");
  strokeWeight(4);
  line(13, 3, 24, -6);
}

function drawRunnerHero(mainColor) {
  // 速度殘影
  noStroke();
  fill(255, 200, 80, 70);
  ellipse(-12, 8, 25, 12);

  fill("#1F2937");
  rect(-9, 2, 18, 22, 6);

  fill("#FFD6A5");
  circle(0, -10, 24);

  // 帽子
  fill(mainColor);
  arc(0, -16, 27, 16, PI, TWO_PI);
  rect(3, -18, 15, 4, 3);

  // 運動服
  fill(mainColor);
  rect(-12, 4, 24, 18, 6);

  fill(20);
  circle(-5, -10, 3);
  circle(5, -10, 3);

  // 跑鞋
  fill("#FFFFFF");
  ellipse(-8, 24, 12, 5);
  ellipse(8, 24, 12, 5);
}

function drawScientistHero(mainColor) {
  // 白袍
  noStroke();
  fill("#F5F5F5");
  rect(-13, 0, 26, 28, 5);

  // 領帶
  fill(mainColor);
  triangle(-4, 1, 4, 1, 0, 14);

  // 頭
  fill("#FFD6A5");
  circle(0, -12, 24);

  // 頭髮
  fill("#555");
  arc(0, -18, 25, 16, PI, TWO_PI);

  // 眼鏡
  noFill();
  stroke(30);
  strokeWeight(1.5);
  circle(-5, -12, 7);
  circle(5, -12, 7);
  line(-1, -12, 1, -12);

  // 科學槍
  stroke("#7ED321");
  strokeWeight(4);
  line(13, 4, 25, 4);
  noStroke();
  fill("#7ED321");
  circle(27, 4, 6);
}

function drawGuardianHero(mainColor) {
  // 盔甲身體
  noStroke();
  fill("#555");
  rect(-14, 0, 28, 28, 6);

  fill(mainColor);
  rect(-10, 4, 20, 20, 5);

  // 頭盔
  fill("#777");
  circle(0, -10, 28);
  fill("#222");
  rect(-10, -13, 20, 6, 3);

  // 盾牌
  fill("#B0BEC5");
  stroke("#ECEFF1");
  strokeWeight(2);
  ellipse(-19, 7, 16, 24);

  // 劍
  stroke("#DCEFFF");
  strokeWeight(4);
  line(15, 8, 26, -6);
  stroke("#888");
  strokeWeight(3);
  line(12, 11, 17, 5);
}

// ============================================================
// 八、殭屍系統
// ============================================================

// ============================================================
// 八、殭屍系統
// ============================================================

function updateEnemySpawning() {
  let survival = getSurvivalSeconds();

  // 存活越久，生成越快
  let spawnInterval = max(280, 1100 - survival * 8);

  if (millis() - lastEnemySpawn > spawnInterval) {
    spawnEnemy();
    lastEnemySpawn = millis();
  }
}

function spawnEnemy(x = null, y = null, small = false) {
  let pos = randomEdgePosition();

  let enemy = {
    id: nextId++,
    x: x === null ? pos.x : x,
    y: y === null ? pos.y : y,
    r: small ? 10 : random(12, 18),
    hp: small ? 12 : random(18, 32),
    maxHp: small ? 12 : random(18, 32),
    speed: small ? random(1.6, 2.4) : random(0.9, 1.8) + getSurvivalSeconds() * 0.006,
    damage: small ? 8 : 10,
    color: small ? "#7FFF7F" : "#55C667",
    lastBladeHit: 0
  };

  enemies.push(enemy);
}

function updateEnemies() {
  for (let e of enemies) {
    moveToward(e, player.x, player.y, e.speed);
  }

  // 清掉死亡殭屍
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      killEnemy(i);
    }
  }
}

function killEnemy(index) {
  let e = enemies[index];

  kills++;
  score += 10;

  spawnBloodStain(e.x, e.y, e.r, false);
  spawnExpGem(e.x, e.y, 1);
  addFloatingText("+10", e.x, e.y, "#FFD166");

  enemies.splice(index, 1);
}

function drawEnemies() {
  for (let e of enemies) {
    drawZombieBody(e.x, e.y, e.r, e.color, e.hp / e.maxHp);

    // 小血條
    drawMiniHpBar(e.x - e.r, e.y - e.r - 12, e.r * 2, 4, e.hp, e.maxHp);
  }
}

function drawZombieBody(x, y, r, colorValue, hpRatio) {
  push();
  translate(x, y);

  // 陰影
  noStroke();
  fill(0, 0, 0, 80);
  ellipse(0, r * 0.8, r * 2, r * 0.65);

  // 身體
  fill("#3E7048");
  rect(-r * 0.55, -r * 0.05, r * 1.1, r * 1.25, 5);

  // 破衣服
  fill(colorValue);
  rect(-r * 0.65, r * 0.1, r * 1.3, r * 0.75, 4);

  // 頭
  fill(colorValue);
  circle(0, -r * 0.55, r * 1.45);

  // 傷口
  fill("#7A0F0F");
  circle(r * 0.25, -r * 0.75, r * 0.22);

  // 眼睛
  fill("#FF3B3B");
  circle(-r * 0.28, -r * 0.6, r * 0.22);
  circle(r * 0.28, -r * 0.6, r * 0.22);

  // 嘴巴
  stroke(30);
  strokeWeight(1.5);
  line(-r * 0.22, -r * 0.28, r * 0.22, -r * 0.28);

  // 手
  stroke("#4E8A57");
  strokeWeight(max(3, r * 0.22));
  line(-r * 0.55, r * 0.2, -r * 1.0, r * 0.55);
  line(r * 0.55, r * 0.2, r * 1.0, r * 0.55);

  // 血量低時顏色稍微變暗
  if (hpRatio < 0.35) {
    noStroke();
    fill(0, 0, 0, 80);
    circle(0, -r * 0.55, r * 1.45);
  }

  pop();
}

// ============================================================
// 九、Boss 系統
// ============================================================

const bossTypes = [
  {
    kind: "tank",
    name: "巨大殭屍王",
    color: "#B34747",
    maxHp: 320,
    speed: 0.75,
    r: 34,
    desc: "血很多，慢慢追玩家"
  },
  {
    kind: "dasher",
    name: "衝刺怪",
    color: "#9B59B6",
    maxHp: 230,
    speed: 1.0,
    r: 28,
    desc: "每隔幾秒突然加速"
  },
  {
    kind: "splitter",
    name: "分裂怪",
    color: "#E67E22",
    maxHp: 260,
    speed: 0.95,
    r: 30,
    desc: "死亡後分裂成小怪"
  },
  {
    kind: "summoner",
    name: "召喚師",
    color: "#3498DB",
    maxHp: 240,
    speed: 0.85,
    r: 29,
    desc: "會召喚小殭屍"
  }
];


const weaponDexEntries = [
  {
    name: "自動子彈",
    key: "bullet",
    desc: "每隔一段時間自動攻擊最近的敵人。升級後可以變快、變痛，也可能一次射多顆。",
    unlock: "一開始就有"
  },
  {
    name: "守護光環",
    key: "aura",
    desc: "玩家身邊出現一圈能量，靠近的殭屍會持續受到傷害。",
    unlock: "升級時選到「守護光環」"
  },
  {
    name: "旋轉刀",
    key: "blade",
    desc: "小刀會繞著玩家旋轉，碰到敵人就造成傷害。",
    unlock: "升級時選到「旋轉刀」"
  },
  {
    name: "小炸彈",
    key: "bomb",
    desc: "每隔幾秒在敵人附近爆炸，範圍內敵人都會受傷。",
    unlock: "升級時選到「小炸彈」"
  }
];

const zombieDexEntries = [
  {
    name: "普通殭屍",
    key: "normal",
    desc: "最常見的敵人，會慢慢追著玩家跑。",
    type: "enemy"
  },
  {
    name: "小殭屍",
    key: "small",
    desc: "體型小、速度較快，通常由 Boss 召喚或分裂產生。",
    type: "enemy"
  },
  {
    name: "巨大殭屍王",
    key: "tank",
    desc: "血量很多，移動慢，但碰到玩家會很痛。",
    type: "boss"
  },
  {
    name: "衝刺怪",
    key: "dasher",
    desc: "平常速度普通，但每隔幾秒會突然衝刺。",
    type: "boss"
  },
  {
    name: "分裂怪",
    key: "splitter",
    desc: "被打倒後會分裂出多隻小殭屍。",
    type: "boss"
  },
  {
    name: "召喚師",
    key: "summoner",
    desc: "會定期召喚小殭屍干擾玩家。",
    type: "boss"
  }
];

function updateBossSpawning() {
  if (millis() - lastBossSpawnTime > 30000) {
    spawnBoss();
    lastBossSpawnTime = millis();
  }
}

function spawnBoss() {
  let type = bossTypes[bossSpawnCount % bossTypes.length];
  bossSpawnCount++;

  let pos = randomEdgePosition();
  let boss = {
    id: nextId++,
    x: pos.x,
    y: pos.y,
    r: type.r,
    hp: type.maxHp + bossSpawnCount * 60,
    maxHp: type.maxHp + bossSpawnCount * 60,
    speed: type.speed + bossSpawnCount * 0.04,
    damage: 22,
    kind: type.kind,
    name: type.name,
    color: type.color,
    lastSkillTime: millis(),
    dashUntil: 0,
    lastBladeHit: 0
  };

  bosses.push(boss);
  addFloatingText("Boss 出現！" + boss.name, width / 2, 90, "#FF6B6B");
}

function updateBosses() {
  for (let b of bosses) {
    let actualSpeed = b.speed;

    if (b.kind === "dasher") {
      if (millis() - b.lastSkillTime > 4200) {
        b.dashUntil = millis() + 700;
        b.lastSkillTime = millis();
        addFloatingText("衝刺！", b.x, b.y - 45, "#E0B0FF");
      }

      if (millis() < b.dashUntil) {
        actualSpeed = b.speed * 4.2;
      }
    }

    if (b.kind === "summoner") {
      if (millis() - b.lastSkillTime > 5000) {
        for (let i = 0; i < 3; i++) {
          spawnEnemy(b.x + random(-35, 35), b.y + random(-35, 35), true);
        }
        b.lastSkillTime = millis();
        addFloatingText("召喚小怪！", b.x, b.y - 45, "#87CEFA");
      }
    }

    moveToward(b, player.x, player.y, actualSpeed);
  }

  for (let i = bosses.length - 1; i >= 0; i--) {
    if (bosses[i].hp <= 0) {
      killBoss(i);
    }
  }
}

function killBoss(index) {
  let b = bosses[index];

  bossKillsThisRun++;
  score += 200;
  spawnBloodStain(b.x, b.y, b.r, true);
  spawnExpGem(b.x, b.y, 8);
  addFloatingText("Boss 擊敗！+200", b.x, b.y, "#FFD166");

  if (b.kind === "splitter") {
    for (let i = 0; i < 8; i++) {
      spawnEnemy(b.x + random(-45, 45), b.y + random(-45, 45), true);
    }
  }

  bosses.splice(index, 1);
}

function drawBosses() {
  for (let b of bosses) {
    drawBossBody(b);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(b.name, b.x, b.y - b.r - 24);

    // Boss 本體血條
    drawMiniHpBar(b.x - b.r, b.y - b.r - 12, b.r * 2, 6, b.hp, b.maxHp);
  }
}

function drawBossBody(b) {
  push();
  translate(b.x, b.y);

  // 陰影
  noStroke();
  fill(0, 0, 0, 100);
  ellipse(0, b.r * 0.85, b.r * 2.2, b.r * 0.8);

  // 身體
  fill(b.color);
  rect(-b.r * 0.65, -b.r * 0.05, b.r * 1.3, b.r * 1.35, 8);

  // 頭
  fill(b.color);
  circle(0, -b.r * 0.55, b.r * 1.55);

  // 依 Boss 類型加造型
  if (b.kind === "tank") {
    fill("#5C1E1E");
    triangle(-b.r * 0.5, -b.r * 1.2, -b.r * 0.2, -b.r * 0.9, -b.r * 0.7, -b.r * 0.8);
    triangle(b.r * 0.5, -b.r * 1.2, b.r * 0.2, -b.r * 0.9, b.r * 0.7, -b.r * 0.8);
  } else if (b.kind === "dasher") {
    fill("#E0B0FF");
    triangle(0, -b.r * 1.35, -b.r * 0.35, -b.r * 0.85, b.r * 0.35, -b.r * 0.85);
  } else if (b.kind === "splitter") {
    fill("#FFD166");
    circle(-b.r * 0.35, -b.r * 0.95, b.r * 0.28);
    circle(b.r * 0.35, -b.r * 0.95, b.r * 0.28);
  } else if (b.kind === "summoner") {
    noFill();
    stroke("#87CEFA");
    strokeWeight(3);
    circle(0, -b.r * 0.55, b.r * 1.95);
  }

  // 眼睛
  noStroke();
  fill("#111");
  circle(-b.r * 0.25, -b.r * 0.6, b.r * 0.18);
  circle(b.r * 0.25, -b.r * 0.6, b.r * 0.18);

  // 手臂
  stroke(b.color);
  strokeWeight(max(8, b.r * 0.25));
  line(-b.r * 0.65, b.r * 0.25, -b.r * 1.05, b.r * 0.65);
  line(b.r * 0.65, b.r * 0.25, b.r * 1.05, b.r * 0.65);

  pop();
}

function drawBossTopHpBar() {
  if (bosses.length === 0) return;

  // 只顯示第一隻 Boss 的血條
  let b = bosses[0];

  let barW = 520;
  let barH = 18;
  let x = width / 2 - barW / 2;
  let y = 48;

  fill(20, 20, 25, 220);
  rect(x - 8, y - 26, barW + 16, 54, 8);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text("BOSS：" + b.name, width / 2, y - 13);

  noStroke();
  fill("#4A4A4A");
  rect(x, y, barW, barH, 8);

  let ratio = constrain(b.hp / b.maxHp, 0, 1);
  fill("#FF4D4D");
  rect(x, y, barW * ratio, barH, 8);

  stroke(255);
  noFill();
  rect(x, y, barW, barH, 8);
}

// ============================================================
// 十、自動攻擊與子彈
// ============================================================

function getAttackCooldown() {
  let cooldown = player.baseAttackCooldown - (player.bulletLevel - 1) * 45;
  return max(150, cooldown);
}

function updateAutoAttack() {
  if (millis() - lastAttackTime < getAttackCooldown()) return;

  let target = findNearestTarget();
  if (!target) return;

  shootBulletAt(target);
  lastAttackTime = millis();
}

function findNearestTarget() {
  let allTargets = enemies.concat(bosses);
  if (allTargets.length === 0) return null;

  let nearest = null;
  let nearestDist = Infinity;

  for (let t of allTargets) {
    let d = dist(player.x, player.y, t.x, t.y);
    if (d < nearestDist) {
      nearest = t;
      nearestDist = d;
    }
  }

  return nearest;
}

function shootBulletAt(target) {
  let angle = atan2(target.y - player.y, target.x - player.x);
  let speed = 8.5;

  // bulletLevel 越高，一次射越多顆
  let bulletCount = min(1 + floor((player.bulletLevel - 1) / 2), 3);
  let spread = 0.18;

  for (let i = 0; i < bulletCount; i++) {
    let offset = (i - (bulletCount - 1) / 2) * spread;
    bullets.push({
      x: player.x,
      y: player.y,
      r: 5,
      vx: cos(angle + offset) * speed,
      vy: sin(angle + offset) * speed,
      damage: player.bulletDamage,
      life: 90,
      color: "#FFE66D"
    });
  }
}

function updateBullets() {
  for (let bullet of bullets) {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
    bullet.life--;

    // 打一般殭屍
    for (let e of enemies) {
      if (dist(bullet.x, bullet.y, e.x, e.y) < bullet.r + e.r) {
        e.hp -= bullet.damage;
        bullet.life = 0;
        break;
      }
    }

    // 打 Boss
    if (bullet.life > 0) {
      for (let b of bosses) {
        if (dist(bullet.x, bullet.y, b.x, b.y) < bullet.r + b.r) {
          b.hp -= bullet.damage;
          bullet.life = 0;
          break;
        }
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    // v4 修正：
    // 無邊際地圖中，b.x / b.y 是「世界座標」，不能再用 0~width、0~height 判斷。
    // 否則玩家跑到畫面原本範圍外，例如 x > 900，子彈一生成就會被刪掉，
    // 看起來就像自動攻擊壞掉。
    // 現在只用 life 控制子彈壽命。
    if (b.life <= 0) {
      bullets.splice(i, 1);
    }
  }
}

function drawBullets() {
  noStroke();
  for (let b of bullets) {
    fill(b.color);
    circle(b.x, b.y, b.r * 2);
  }
}

// ============================================================
// 十一、多種武器：光環、旋轉刀、炸彈
// ============================================================

function updateWeapons() {
  updateAuraWeapon();
  updateBladeWeapon();
  updateBombWeapon();
}

function drawWeapons() {
  drawAuraWeapon();
  drawBladeWeapon();
}

function updateAuraWeapon() {
  if (player.auraLevel <= 0) return;

  if (millis() - lastAuraDamageTime < 450) return;

  let radius = 55 + player.auraLevel * 12;
  let damage = 6 + player.auraLevel * 2;

  damageTargetsInRange(player.x, player.y, radius, damage);
  lastAuraDamageTime = millis();
}

function drawAuraWeapon() {
  if (player.auraLevel <= 0) return;

  let radius = 55 + player.auraLevel * 12;

  push();
  noFill();
  stroke(120, 200, 255, 150);
  strokeWeight(3);
  circle(player.x, player.y, radius * 2);
  pop();
}

function updateBladeWeapon() {
  if (player.bladeLevel <= 0) return;

  let bladeCount = min(player.bladeLevel, 4);
  let orbitRadius = 48 + player.bladeLevel * 8;
  let bladeDamage = 9 + player.bladeLevel * 3;
  let angleBase = frameCount * 0.08;

  let allTargets = enemies.concat(bosses);

  for (let i = 0; i < bladeCount; i++) {
    let angle = angleBase + TWO_PI * i / bladeCount;
    let bx = player.x + cos(angle) * orbitRadius;
    let by = player.y + sin(angle) * orbitRadius;

    for (let t of allTargets) {
      if (dist(bx, by, t.x, t.y) < 10 + t.r) {
        if (millis() - t.lastBladeHit > 350) {
          t.hp -= bladeDamage;
          t.lastBladeHit = millis();
        }
      }
    }
  }
}

function drawBladeWeapon() {
  if (player.bladeLevel <= 0) return;

  let bladeCount = min(player.bladeLevel, 4);
  let orbitRadius = 48 + player.bladeLevel * 8;
  let angleBase = frameCount * 0.08;

  push();
  noStroke();
  fill("#C7F9CC");

  for (let i = 0; i < bladeCount; i++) {
    let angle = angleBase + TWO_PI * i / bladeCount;
    let bx = player.x + cos(angle) * orbitRadius;
    let by = player.y + sin(angle) * orbitRadius;
    circle(bx, by, 16);
  }

  pop();
}

function updateBombWeapon() {
  if (player.bombLevel <= 0) return;

  let cooldown = max(1800, 4200 - player.bombLevel * 450);

  if (millis() - lastBombTime < cooldown) return;

  let target = findNearestTarget();
  let x;
  let y;

  if (target) {
    x = target.x + random(-25, 25);
    y = target.y + random(-25, 25);
  } else {
    x = player.x + random(-80, 80);
    y = player.y + random(-80, 80);
  }

  explosions.push({
    x,
    y,
    r: 5,
    maxR: 48 + player.bombLevel * 15,
    damage: 22 + player.bombLevel * 8,
    life: 24,
    damagedIds: []
  });

  lastBombTime = millis();
}

function updateExplosions() {
  for (let ex of explosions) {
    ex.r += ex.maxR / 18;
    ex.life--;

    let allTargets = enemies.concat(bosses);
    for (let t of allTargets) {
      if (ex.damagedIds.includes(t.id)) continue;

      if (dist(ex.x, ex.y, t.x, t.y) < ex.r + t.r) {
        t.hp -= ex.damage;
        ex.damagedIds.push(t.id);
      }
    }
  }

  for (let i = explosions.length - 1; i >= 0; i--) {
    if (explosions[i].life <= 0) {
      explosions.splice(i, 1);
    }
  }
}

function drawExplosions() {
  push();
  noFill();
  strokeWeight(3);

  for (let ex of explosions) {
    stroke(255, 120, 60, map(ex.life, 0, 24, 0, 180));
    circle(ex.x, ex.y, ex.r * 2);
  }

  pop();
}

function damageTargetsInRange(x, y, radius, damage) {
  for (let e of enemies) {
    if (dist(x, y, e.x, e.y) < radius + e.r) {
      e.hp -= damage;
    }
  }

  for (let b of bosses) {
    if (dist(x, y, b.x, b.y) < radius + b.r) {
      b.hp -= damage;
    }
  }
}

// ============================================================
// 十二、經驗與升級
// ============================================================

function spawnExpGem(x, y, value) {
  expGems.push({
    x,
    y,
    r: 6 + value * 0.7,
    value,
    color: value >= 5 ? "#F5D742" : "#7BED9F"
  });
}

function updateExpGems() {
  for (let gem of expGems) {
    let d = dist(player.x, player.y, gem.x, gem.y);

    // 靠近時自動吸過來
    if (d < player.pickupRadius) {
      moveToward(gem, player.x, player.y, 4);
    }

    if (d < player.r + gem.r) {
      gainExp(gem.value);
      gem.collected = true;
    }
  }

  for (let i = expGems.length - 1; i >= 0; i--) {
    if (expGems[i].collected) {
      expGems.splice(i, 1);
    }
  }
}

function drawExpGems() {
  noStroke();

  for (let gem of expGems) {
    fill(gem.color);
    circle(gem.x, gem.y, gem.r * 2);

    fill(255, 255, 255, 120);
    circle(gem.x - 2, gem.y - 2, gem.r * 0.7);
  }
}

function gainExp(amount) {
  player.exp += amount;

  while (player.exp >= player.nextExp) {
    player.exp -= player.nextExp;
    player.level++;
    player.nextExp = floor(player.nextExp * 1.35 + 3);
    openUpgradeMenu();
    break;
  }
}

function openUpgradeMenu() {
  upgradeOptions = createUpgradeOptions();
  gameState = "upgrade";
}

function createUpgradeOptions() {
  const pool = [
    {
      name: "閃電鞋",
      desc: "移動速度 +0.5",
      apply: () => { player.speed += 0.5; }
    },
    {
      name: "快速射擊",
      desc: "自動攻擊速度變快",
      apply: () => { player.baseAttackCooldown = max(160, player.baseAttackCooldown - 70); }
    },
    {
      name: "強力子彈",
      desc: "子彈傷害 +4",
      apply: () => { player.bulletDamage += 4; }
    },
    {
      name: "雙重子彈",
      desc: "子彈等級 +1",
      apply: () => { player.bulletLevel++; }
    },
    {
      name: "能量補給",
      desc: "最大 HP +20，並回復 20 HP",
      apply: () => {
        player.maxHp += 20;
        player.hp = min(player.maxHp, player.hp + 20);
      }
    },
    {
      name: "磁鐵背包",
      desc: "撿經驗範圍增加",
      apply: () => { player.pickupRadius += 25; }
    },
    {
      name: "守護光環",
      desc: "解鎖或升級光環武器",
      apply: () => { player.auraLevel++; }
    },
    {
      name: "旋轉刀",
      desc: "解鎖或升級旋轉刀",
      apply: () => { player.bladeLevel++; }
    },
    {
      name: "小炸彈",
      desc: "解鎖或升級炸彈武器",
      apply: () => { player.bombLevel++; }
    }
  ];

  shuffle(pool, true);
  return pool.slice(0, 3);
}

function chooseUpgrade(index) {
  if (gameState !== "upgrade") return;
  if (!upgradeOptions[index]) return;

  upgradeOptions[index].apply();
  addFloatingText("升級：" + upgradeOptions[index].name, width / 2, height / 2 - 80, "#A8FF78");
  upgradeOptions = [];
  gameState = "playing";
}

// ============================================================
// 十三、玩家受傷與遊戲結束
// ============================================================

function checkPlayerHit() {
  if (millis() < player.invincibleUntil) return;

  for (let e of enemies) {
    if (dist(player.x, player.y, e.x, e.y) < player.r + e.r) {
      damagePlayer(e.damage);
      return;
    }
  }

  for (let b of bosses) {
    if (dist(player.x, player.y, b.x, b.y) < player.r + b.r) {
      damagePlayer(b.damage);
      return;
    }
  }
}

function damagePlayer(amount) {
  player.hp -= amount;
  player.invincibleUntil = millis() + 700;
  addFloatingText("-" + amount, player.x, player.y - 30, "#FF6B6B");
}

function endGame() {
  let survivalSeconds = getSurvivalSeconds();
  finalSurvivalSeconds = survivalSeconds;

  playerStats.highScore = max(playerStats.highScore, score);
  playerStats.maxSurvival = max(playerStats.maxSurvival, survivalSeconds);
  playerStats.totalKills += kills;
  playerStats.totalBossKills += bossKillsThisRun;

  checkUnlocksAfterGame(survivalSeconds);
  saveData();

  gameState = "gameover";
}

// ============================================================
// 十四、畫面：首頁、角色選擇、升級、結束
// ============================================================

function drawTitleScreen() {
  drawGridBackground();

  textAlign(CENTER, CENTER);

  fill(255);
  textSize(42);
  text("AI 小小殭屍倖存者", width / 2, 105);

  fill(210);
  textSize(18);
  text("p5.js Web Editor 示範版 v6 手機版", width / 2, 150);

  const charData = getSelectedCharacter();

  fill(255);
  textSize(20);
  text("目前角色：" + charData.name, width / 2, 210);

  fill(190);
  textSize(15);
  text(charData.desc, width / 2, 238);

  drawButton(width / 2 - 130, 300, 260, 46, "Enter：開始遊戲");
  drawButton(width / 2 - 130, 358, 260, 46, "C：選擇角色");
  drawButton(width / 2 - 130, 416, 260, 46, "W：武器圖鑑");
  drawButton(width / 2 - 130, 474, 260, 46, "Z：殭屍圖鑑");

  fill(170);
  textSize(14);
  text("電腦：WASD / 方向鍵移動｜手機：左下角搖桿移動｜攻擊會自動發射", width / 2, 548);
  text("升級時按 1 / 2 / 3 或直接點選｜建議手機橫向遊玩｜R：清除存檔", width / 2, 574);
}

function drawCharacterScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(34);
  text("選擇角色", width / 2, 55);

  textSize(15);
  fill(190);
  text("按 1 / 2 / 3 / 4 或用滑鼠點選角色。選好後按 Enter 或點開始遊戲。", width / 2, 88);

  let startX = 85;
  let cardW = 175;
  let cardH = 280;

  for (let i = 0; i < characters.length; i++) {
    let c = characters[i];
    let x = startX + i * 205;
    let y = 130;
    let unlocked = unlockedCharacters[c.id];

    fill(c.id === selectedCharacterId ? "#273B5E" : "#1E222E");
    stroke(c.id === selectedCharacterId ? "#FFE66D" : "#555");
    strokeWeight(2);
    rect(x, y, cardW, cardH, 14);

    noStroke();
    fill(unlocked ? c.color : "#555");
    circle(x + cardW / 2, y + 55, 56);

    fill(255);
    textSize(18);
    textAlign(CENTER, CENTER);
    text((i + 1) + ". " + c.name, x + cardW / 2, y + 112);

    fill(unlocked ? 210 : 120);
    textSize(13);
    text(c.desc, x + 18, y + 142, cardW - 36, 58);

    fill(unlocked ? "#A8FF78" : "#FFB86C");
    textSize(13);
    text(unlocked ? "已解鎖" : c.unlockText, x + 15, y + 222, cardW - 30, 42);
  }

  fill(170);
  textSize(14);
  textAlign(CENTER, CENTER);
  text("最高分：" + playerStats.highScore + "｜最長存活：" + playerStats.maxSurvival + " 秒｜累積擊殺：" + playerStats.totalKills + "｜Boss 擊殺：" + playerStats.totalBossKills, width / 2, 440);

  drawButton(width / 2 - 280, 480, 180, 42, "B：回首頁");
  drawButton(width / 2 - 90, 480, 180, 42, "Enter：開始");
  drawButton(width / 2 + 100, 480, 180, 42, "W：武器圖鑑");
  drawButton(width / 2 - 90, 535, 180, 42, "Z：殭屍圖鑑");
}

function drawUpgradeScreen() {
  fill(0, 0, 0, 160);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(34);
  text("升級！選擇一個能力", width / 2, 150);

  let cardW = 220;
  let cardH = 150;
  let gap = 25;
  let totalW = cardW * 3 + gap * 2;
  let startX = width / 2 - totalW / 2;

  for (let i = 0; i < 3; i++) {
    let x = startX + i * (cardW + gap);
    let y = 250;
    let option = upgradeOptions[i];

    fill("#1E293B");
    stroke("#A8FF78");
    strokeWeight(2);
    rect(x, y, cardW, cardH, 16);

    noStroke();
    fill("#A8FF78");
    textSize(22);
    text((i + 1) + ". " + option.name, x + cardW / 2, y + 45);

    fill(230);
    textSize(16);
    text(option.desc, x + 20, y + 90, cardW - 40, 50);
  }

  fill(220);
  textSize(15);
  text("按鍵盤 1 / 2 / 3 選擇，也可以用滑鼠點選", width / 2, 450);
}


function drawWeaponDexScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text("武器圖鑑", width / 2, 55);

  fill(190);
  textSize(15);
  text("這裡整理目前遊戲中的武器。按 B 回首頁，按 C 選角色。", width / 2, 88);

  let cardW = 370;
  let cardH = 145;
  let startX = 75;
  let startY = 125;

  for (let i = 0; i < weaponDexEntries.length; i++) {
    let item = weaponDexEntries[i];
    let col = i % 2;
    let row = floor(i / 2);
    let x = startX + col * 405;
    let y = startY + row * 175;

    drawDexCard(x, y, cardW, cardH);
    drawWeaponIcon(item.key, x + 62, y + 72, 1);

    fill(255);
    textAlign(LEFT, TOP);
    textSize(20);
    text(item.name, x + 125, y + 25);

    fill(210);
    textSize(14);
    text(item.desc, x + 125, y + 58, 220, 52);

    fill("#A8FF78");
    textSize(13);
    text("取得方式：" + item.unlock, x + 125, y + 115, 220, 24);
  }

  drawButton(width / 2 - 100, 535, 200, 42, "B：回首頁");
}

function drawZombieDexScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text("殭屍圖鑑", width / 2, 55);

  fill(190);
  textSize(15);
  text("這裡整理一般殭屍與 Boss。按 B 回首頁，按 C 選角色。", width / 2, 88);

  let cardW = 255;
  let cardH = 135;
  let startX = 55;
  let startY = 120;

  for (let i = 0; i < zombieDexEntries.length; i++) {
    let item = zombieDexEntries[i];
    let col = i % 3;
    let row = floor(i / 3);
    let x = startX + col * 285;
    let y = startY + row * 165;

    drawDexCard(x, y, cardW, cardH);

    if (item.type === "enemy") {
      let rr = item.key === "small" ? 13 : 18;
      drawZombieBody(x + 52, y + 68, rr, item.key === "small" ? "#7FFF7F" : "#55C667", 1);
    } else {
      let type = bossTypes.find(b => b.kind === item.key);
      drawBossBody({
        x: x + 52,
        y: y + 70,
        r: 24,
        kind: item.key,
        color: type ? type.color : "#B34747"
      });
    }

    fill(255);
    textAlign(LEFT, TOP);
    textSize(18);
    text(item.name, x + 100, y + 22);

    fill(210);
    textSize(13);
    text(item.desc, x + 100, y + 56, 135, 64);
  }

  drawButton(width / 2 - 100, 535, 200, 42, "B：回首頁");
}

function drawDexCard(x, y, w, h) {
  fill("#1E222E");
  stroke("#64748B");
  strokeWeight(2);
  rect(x, y, w, h, 14);
}

function drawWeaponIcon(kind, x, y, level) {
  push();
  translate(x, y);

  if (kind === "bullet") {
    noStroke();
    fill("#FFE66D");
    circle(0, 0, 18);
    fill("#FFF3A3");
    circle(-4, -4, 6);
    stroke("#FFE66D");
    strokeWeight(4);
    line(-28, 18, -8, 6);
  } else if (kind === "aura") {
    noFill();
    stroke("#78C8FF");
    strokeWeight(4);
    circle(0, 0, 54);
    noStroke();
    fill("#78C8FF");
    circle(0, 0, 13);
  } else if (kind === "blade") {
    noStroke();
    fill("#C7F9CC");
    for (let i = 0; i < 4; i++) {
      let a = TWO_PI * i / 4 + 0.4;
      ellipse(cos(a) * 24, sin(a) * 24, 12, 24);
    }
    fill("#EFFFF1");
    circle(0, 0, 10);
  } else if (kind === "bomb") {
    noStroke();
    fill("#2D3748");
    circle(0, 5, 38);
    fill("#FF6B35");
    circle(12, -14, 12);
    stroke("#FFB703");
    strokeWeight(3);
    line(6, -10, 14, -20);
  }

  pop();
}

function drawGameOverScreen() {
  drawGridBackground();

  textAlign(CENTER, CENTER);

  fill("#FF6B6B");
  textSize(46);
  text("GAME OVER", width / 2, 115);

  fill(255);
  textSize(22);
  text("本局分數：" + score, width / 2, 190);
  text("存活時間：" + getSurvivalSeconds() + " 秒", width / 2, 225);
  text("擊殺殭屍：" + kills, width / 2, 260);
  text("擊敗 Boss：" + bossKillsThisRun, width / 2, 295);

  fill("#FFE66D");
  textSize(18);
  text("最高分：" + playerStats.highScore + "｜最長存活：" + playerStats.maxSurvival + " 秒", width / 2, 350);

  fill("#A8FF78");
  textSize(18);
  for (let i = 0; i < justUnlockedMessages.length; i++) {
    text(justUnlockedMessages[i], width / 2, 392 + i * 28);
  }

  drawButton(width / 2 - 290, 465, 180, 44, "Enter：再玩一次");
  drawButton(width / 2 - 90, 465, 180, 44, "C：角色選擇");
  drawButton(width / 2 + 110, 465, 180, 44, "B：回首頁");

  fill(180);
  textSize(14);
  text("W：武器圖鑑｜Z：殭屍圖鑑", width / 2, 535);
}

// ============================================================
// 十五、HUD 與畫面小工具
// ============================================================

function drawHUD() {
  let survival = getSurvivalSeconds();

  fill(0, 0, 0, 130);
  noStroke();
  rect(12, 12, 265, 150, 12);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(15);
  text("HP", 26, 25);
  drawBar(65, 25, 175, 13, player.hp, player.maxHp, "#FF6B6B");

  fill(255);
  text("LV：" + player.level, 26, 50);
  text("EXP：" + floor(player.exp) + " / " + player.nextExp, 26, 75);
  text("分數：" + score, 26, 100);
  text("擊殺：" + kills, 26, 125);
  text("時間：" + survival + " 秒", 140, 125);

  // 武器狀態
  fill(0, 0, 0, 130);
  rect(width - 230, 12, 215, 135, 12);

  fill(255);
  textSize(14);
  text("武器狀態", width - 215, 25);
  text("子彈 Lv." + player.bulletLevel, width - 215, 50);
  text("光環 Lv." + player.auraLevel, width - 215, 72);
  text("旋轉刀 Lv." + player.bladeLevel, width - 215, 94);
  text("炸彈 Lv." + player.bombLevel, width - 215, 116);
}

function drawBar(x, y, w, h, value, maxValue, colorValue) {
  noStroke();
  fill("#444");
  rect(x, y, w, h, 6);

  let ratio = constrain(value / maxValue, 0, 1);
  fill(colorValue);
  rect(x, y, w * ratio, h, 6);

  stroke(255);
  noFill();
  rect(x, y, w, h, 6);
}

function drawMiniHpBar(x, y, w, h, value, maxValue) {
  noStroke();
  fill("#333");
  rect(x, y, w, h, 3);

  fill("#FF6B6B");
  rect(x, y, w * constrain(value / maxValue, 0, 1), h, 3);
}

function drawButton(x, y, w, h, label) {
  fill("#2D3748");
  stroke("#A8FF78");
  strokeWeight(2);
  rect(x, y, w, h, 12);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(label, x + w / 2, y + h / 2);
}

function createEnvironmentDetails() {
  // v3 無邊際版本不再預先生成固定背景物件。
  // 背景會依照 cameraX / cameraY 即時計算，所以玩家走到哪裡都有地板。
  environmentDetails = [];
}

function updateCamera() {
  if (!player) return;

  // 讓鏡頭平滑追蹤玩家。
  // 0.12 越大追得越快；越小越滑順。
  cameraX = lerp(cameraX, player.x, 0.12);
  cameraY = lerp(cameraY, player.y, 0.12);
}

function applyCameraTransform() {
  // 把世界座標轉成螢幕座標：
  // 鏡頭中心 cameraX / cameraY 會被畫在畫面中心。
  translate(width / 2 - cameraX, height / 2 - cameraY);
}

function worldToScreenX(worldX) {
  return worldX - cameraX + width / 2;
}

function worldToScreenY(worldY) {
  return worldY - cameraY + height / 2;
}

function screenToWorldX(screenX) {
  return screenX + cameraX - width / 2;
}

function screenToWorldY(screenY) {
  return screenY + cameraY - height / 2;
}

function drawGridBackground() {
  background(20, 23, 29);

  let tile = 50;

  // 找出目前鏡頭看得到的世界座標範圍
  let left = cameraX - width / 2 - tile;
  let right = cameraX + width / 2 + tile;
  let top = cameraY - height / 2 - tile;
  let bottom = cameraY + height / 2 + tile;

  let startX = floor(left / tile) * tile;
  let startY = floor(top / tile) * tile;

  // 地板磁磚：依照世界座標畫，所以走遠也會一直延伸
  noStroke();
  for (let x = startX; x < right; x += tile) {
    for (let y = startY; y < bottom; y += tile) {
      let sx = worldToScreenX(x);
      let sy = worldToScreenY(y);

      let gx = floor(x / tile);
      let gy = floor(y / tile);

      if ((gx + gy) % 2 === 0) {
        fill(31, 35, 45);
      } else {
        fill(27, 31, 40);
      }

      rect(sx, sy, tile, tile);
    }
  }

  // 磁磚線
  stroke(255, 255, 255, 18);
  strokeWeight(1);
  for (let x = startX; x < right; x += tile) {
    let sx = worldToScreenX(x);
    line(sx, 0, sx, height);
  }
  for (let y = startY; y < bottom; y += tile) {
    let sy = worldToScreenY(y);
    line(0, sy, width, sy);
  }

  // 無邊際背景裝飾：用格子座標做出穩定的假隨機效果
  drawInfiniteDecorations(left, right, top, bottom, tile);

  // 邊界暗角，固定在螢幕上
  noStroke();
  fill(0, 0, 0, 45);
  rect(0, 0, width, 22);
  rect(0, height - 22, width, 22);
  rect(0, 0, 22, height);
  rect(width - 22, 0, 22, height);
}

function drawInfiniteDecorations(left, right, top, bottom, tile) {
  let startGX = floor(left / tile);
  let endGX = floor(right / tile);
  let startGY = floor(top / tile);
  let endGY = floor(bottom / tile);

  for (let gx = startGX; gx <= endGX; gx++) {
    for (let gy = startGY; gy <= endGY; gy++) {
      let n = pseudoRandom(gx, gy);

      // 裂痕
      if (n < 0.12) {
        let wx = gx * tile + tile * pseudoRandom(gx + 31, gy + 7);
        let wy = gy * tile + tile * pseudoRandom(gx - 11, gy + 19);
        let sx = worldToScreenX(wx);
        let sy = worldToScreenY(wy);
        let len = 18 + 50 * pseudoRandom(gx + 3, gy + 5);
        let angle = TWO_PI * pseudoRandom(gx + 9, gy + 13);

        stroke(10, 10, 12, 120);
        strokeWeight(2);
        line(sx, sy, sx + cos(angle) * len, sy + sin(angle) * len);
        line(sx + 8, sy + 2, sx + cos(angle + 0.7) * len * 0.35, sy + sin(angle + 0.7) * len * 0.35);
      }

      // 碎石
      if (n > 0.72) {
        let wx = gx * tile + tile * pseudoRandom(gx + 101, gy + 33);
        let wy = gy * tile + tile * pseudoRandom(gx + 77, gy + 55);
        let sx = worldToScreenX(wx);
        let sy = worldToScreenY(wy);
        let s = 2 + 5 * pseudoRandom(gx + 17, gy + 91);

        noStroke();
        fill(80, 84, 95, 90);
        circle(sx, sy, s);
      }

      // 警示線
      if (n > 0.94) {
        let wx = gx * tile + 5;
        let wy = gy * tile + 20;
        let sx = worldToScreenX(wx);
        let sy = worldToScreenY(wy);
        let w = 60 + 60 * pseudoRandom(gx + 88, gy + 12);
        let h = 10 + 8 * pseudoRandom(gx + 28, gy + 62);

        push();
        translate(sx, sy);
        rotate(-0.15);
        noStroke();
        fill(180, 120, 30, 75);
        rect(0, 0, w, h, 2);
        fill(40, 35, 25, 75);
        for (let i = 0; i < w; i += 18) {
          quad(i, 0, i + 9, 0, i + 2, h, i - 7, h);
        }
        pop();
      }
    }
  }
}

function pseudoRandom(a, b) {
  // 固定格子座標會得到固定亂數，避免背景裝飾一直跳動。
  let x = sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return x - floor(x);
}

function spawnBloodStain(x, y, size, isBoss) {
  let count = isBoss ? 12 : 5;

  for (let i = 0; i < count; i++) {
    bloodStains.push({
      x: x + random(-size * 0.8, size * 0.8),
      y: y + random(-size * 0.8, size * 0.8),
      r: random(size * 0.25, size * (isBoss ? 0.75 : 0.5)),
      alpha: random(70, 130),
      angle: random(TWO_PI),
      sx: random(0.8, 1.8),
      sy: random(0.45, 1.0)
    });
  }

  // 避免血跡太多造成效能下降
  if (bloodStains.length > 180) {
    bloodStains.splice(0, bloodStains.length - 180);
  }
}

function drawBloodStains() {
  push();
  noStroke();

  for (let s of bloodStains) {
    push();
    translate(s.x, s.y);
    rotate(s.angle);
    fill(100, 0, 0, s.alpha);
    ellipse(0, 0, s.r * 2 * s.sx, s.r * 2 * s.sy);

    // 深色中心
    fill(55, 0, 0, s.alpha * 0.55);
    ellipse(0, 0, s.r * 1.0, s.r * 0.55);
    pop();
  }

  pop();
}

function addFloatingText(txt, x, y, colorValue) {
  floatingTexts.push({
    txt,
    x,
    y,
    color: colorValue,
    life: 70
  });
}

function updateFloatingTexts() {
  for (let ft of floatingTexts) {
    ft.y -= 0.6;
    ft.life--;
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    if (floatingTexts[i].life <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

function drawFloatingTexts() {
  textAlign(CENTER, CENTER);
  textSize(16);
  noStroke();

  for (let ft of floatingTexts) {
    let alpha = map(ft.life, 0, 70, 0, 255);
    fillWithAlpha(ft.color, alpha);
    text(ft.txt, ft.x, ft.y);
  }
}

function fillWithAlpha(hexColor, alpha) {
  let c = color(hexColor);
  c.setAlpha(alpha);
  fill(c);
}


// ============================================================
// 十六、手機觸控操作：虛擬搖桿
// ============================================================

function isTouchDevice() {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

function updateVirtualJoystick() {
  virtualJoystick.baseX = 95;
  virtualJoystick.baseY = height - 95;

  virtualJoystick.active = false;
  virtualJoystick.dx = 0;
  virtualJoystick.dy = 0;
  virtualJoystick.knobX = virtualJoystick.baseX;
  virtualJoystick.knobY = virtualJoystick.baseY;

  // 只有遊戲中才讀取搖桿
  if (gameState !== "playing") return;

  // 找左半邊、偏下方的觸控點當作移動搖桿
  for (let t of touches) {
    if (t.x < width * 0.58 && t.y > height * 0.25) {
      let vx = t.x - virtualJoystick.baseX;
      let vy = t.y - virtualJoystick.baseY;
      let d = sqrt(vx * vx + vy * vy);
      let maxR = virtualJoystick.r;

      if (d > maxR) {
        vx = vx / d * maxR;
        vy = vy / d * maxR;
        d = maxR;
      }

      virtualJoystick.active = true;
      virtualJoystick.knobX = virtualJoystick.baseX + vx;
      virtualJoystick.knobY = virtualJoystick.baseY + vy;
      virtualJoystick.dx = vx / maxR;
      virtualJoystick.dy = vy / maxR;
      return;
    }
  }
}

function drawMobileControls() {
  // 桌機也可以顯示，但手機最有用。
  // 用 navigator.maxTouchPoints 判斷，避免桌機畫面太擠。
  if (!isTouchDevice()) return;

  // 遊戲中：左下角搖桿
  if (gameState === "playing") {
    let bx = virtualJoystick.baseX;
    let by = virtualJoystick.baseY;
    let kx = virtualJoystick.active ? virtualJoystick.knobX : bx;
    let ky = virtualJoystick.active ? virtualJoystick.knobY : by;

    push();
    noStroke();

    fill(0, 0, 0, 95);
    circle(bx, by, virtualJoystick.r * 2 + 18);

    noFill();
    stroke(255, 255, 255, 120);
    strokeWeight(3);
    circle(bx, by, virtualJoystick.r * 2);

    noStroke();
    fill(168, 255, 120, 160);
    circle(kx, ky, 42);

    fill(255, 255, 255, 180);
    textAlign(CENTER, CENTER);
    textSize(13);
    text("移動", bx, by + virtualJoystick.r + 26);
    pop();
  }
}

// 手機觸控開始：在非遊戲中頁面，讓按鈕可以更穩定被點擊。
// 遊戲中則交給 updateVirtualJoystick() 讀取 touches。
function touchStarted() {
  if (gameState !== "playing") {
    if (touches.length > 0) {
      handlePointerPressed(touches[0].x, touches[0].y);
    }
  }
  return false; // 避免手機頁面滑動或縮放
}

function touchMoved() {
  return false; // 避免拖動搖桿時網頁跟著滑
}

function touchEnded() {
  virtualJoystick.active = false;
  virtualJoystick.dx = 0;
  virtualJoystick.dy = 0;
  return false;
}

// ============================================================
// 十六、鍵盤與滑鼠操作
// ============================================================

function keyPressed() {
  if (gameState === "title") {
    if (keyCode === ENTER) {
      resetGame();
    }

    if (key === "c" || key === "C") {
      gameState = "character";
    }

    if (key === "w" || key === "W") {
      gameState = "weaponDex";
    }

    if (key === "z" || key === "Z") {
      gameState = "zombieDex";
    }

    if (key === "r" || key === "R") {
      resetSaveData();
    }
  } else if (gameState === "character") {
    if (keyCode === ENTER) {
      resetGame();
    }

    if (key === "b" || key === "B") {
      gameState = "title";
    }

    if (key === "w" || key === "W") {
      gameState = "weaponDex";
    }

    if (key === "z" || key === "Z") {
      gameState = "zombieDex";
    }

    let n = int(key);
    if (n >= 1 && n <= characters.length) {
      let c = characters[n - 1];
      if (unlockedCharacters[c.id]) {
        selectedCharacterId = c.id;
        saveData();
      }
    }
  } else if (gameState === "upgrade") {
    if (key === "1") chooseUpgrade(0);
    if (key === "2") chooseUpgrade(1);
    if (key === "3") chooseUpgrade(2);
  } else if (gameState === "gameover") {
    if (keyCode === ENTER) {
      resetGame();
    }

    if (key === "c" || key === "C") {
      gameState = "character";
    }

    if (key === "b" || key === "B") {
      gameState = "title";
    }

    if (key === "w" || key === "W") {
      gameState = "weaponDex";
    }

    if (key === "z" || key === "Z") {
      gameState = "zombieDex";
    }
  } else if (gameState === "weaponDex" || gameState === "zombieDex") {
    if (key === "b" || key === "B") {
      gameState = "title";
    }

    if (key === "c" || key === "C") {
      gameState = "character";
    }
  }
}

function mousePressed() {
  handlePointerPressed(mouseX, mouseY);
}

function handlePointerPressed(px, py) {
  if (gameState === "title") {
    // 點擊開始遊戲
    if (isPointInRect(px, py, width / 2 - 130, 300, 260, 46)) {
      resetGame();
      return;
    }

    // 點擊選擇角色
    if (isPointInRect(px, py, width / 2 - 130, 358, 260, 46)) {
      gameState = "character";
      return;
    }

    // 點擊武器圖鑑
    if (isPointInRect(px, py, width / 2 - 130, 416, 260, 46)) {
      gameState = "weaponDex";
      return;
    }

    // 點擊殭屍圖鑑
    if (isPointInRect(px, py, width / 2 - 130, 474, 260, 46)) {
      gameState = "zombieDex";
      return;
    }
  }

  if (gameState === "character") {
    // 點擊角色卡片
    let startX = 85;
    let cardW = 175;
    let cardH = 280;

    for (let i = 0; i < characters.length; i++) {
      let c = characters[i];
      let x = startX + i * 205;
      let y = 130;

      if (isPointInRect(px, py, x, y, cardW, cardH)) {
        if (unlockedCharacters[c.id]) {
          selectedCharacterId = c.id;
          saveData();
        }
        return;
      }
    }

    // 選角頁底部按鈕
    if (isPointInRect(px, py, width / 2 - 280, 480, 180, 42)) {
      gameState = "title";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 90, 480, 180, 42)) {
      resetGame();
      return;
    }

    if (isPointInRect(px, py, width / 2 + 100, 480, 180, 42)) {
      gameState = "weaponDex";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 90, 535, 180, 42)) {
      gameState = "zombieDex";
      return;
    }
  }

  if (gameState === "upgrade") {
    let cardW = 220;
    let cardH = 150;
    let gap = 25;
    let totalW = cardW * 3 + gap * 2;
    let startX = width / 2 - totalW / 2;

    for (let i = 0; i < 3; i++) {
      let x = startX + i * (cardW + gap);
      let y = 250;

      if (isPointInRect(px, py, x, y, cardW, cardH)) {
        chooseUpgrade(i);
      }
    }
  }

  if (gameState === "gameover") {
    // 點擊再玩一次
    if (isPointInRect(px, py, width / 2 - 290, 465, 180, 44)) {
      resetGame();
      return;
    }

    if (isPointInRect(px, py, width / 2 - 90, 465, 180, 44)) {
      gameState = "character";
      return;
    }

    if (isPointInRect(px, py, width / 2 + 110, 465, 180, 44)) {
      gameState = "title";
      return;
    }
  }

  if (gameState === "weaponDex" || gameState === "zombieDex") {
    if (isPointInRect(px, py, width / 2 - 100, 535, 200, 42)) {
      gameState = "title";
      return;
    }
  }
}

function isPointInRect(px, py, x, y, w, h) {
  return px > x && px < x + w && py > y && py < y + h;
}

// ============================================================
// 十七、共用數學工具
// ============================================================

function moveToward(obj, targetX, targetY, speed) {
  let angle = atan2(targetY - obj.y, targetX - obj.x);
  obj.x += cos(angle) * speed;
  obj.y += sin(angle) * speed;
}

function randomEdgePosition() {
  // 在無邊際地圖中，敵人要從「玩家目前視野外圍」生成，
  // 而不是固定從原本畫布的 0~width / 0~height 生成。
  let side = floor(random(4));
  let margin = 90;

  let left = cameraX - width / 2 - margin;
  let right = cameraX + width / 2 + margin;
  let top = cameraY - height / 2 - margin;
  let bottom = cameraY + height / 2 + margin;

  if (side === 0) {
    return { x: random(left, right), y: top };
  } else if (side === 1) {
    return { x: right, y: random(top, bottom) };
  } else if (side === 2) {
    return { x: random(left, right), y: bottom };
  } else {
    return { x: left, y: random(top, bottom) };
  }
}

function getSurvivalSeconds() {
  if (gameState === "title" || gameState === "character" || gameState === "weaponDex" || gameState === "zombieDex") return 0;
  if (gameState === "gameover") return finalSurvivalSeconds;
  return floor((millis() - startTime) / 1000);
}
