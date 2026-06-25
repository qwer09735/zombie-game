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
18. v7 新增：直式畫面 600x900、血量條數字、攻擊傷害跳字、手機電腦都以直版遊玩
19. v8 修正：圖鑑改成直式單欄排版，文字自動換行，殭屍圖鑑分成普通殭屍與 BOSS 區塊
20. v9 修正：選角頁文字跑版、傷害/經驗/分數跳字分色、限制怪物與跳字數量避免玩久卡住
21. v10 修正：補回升級選單 drawUpgradeScreen，避免升級時卡住；修正手機點擊與 Game Over 按鈕位置
22. v11 修正：Boss 血條下移、武器狀態只顯示已取得武器、怪物速度隨時間提升、初始傷害提高、升級經驗降低
23. v12 修正：升級卡片文字放入框內、初始子彈顯示於武器資訊、多 Boss 同時顯示多條血量
24. v13 新增：暫停功能、暫停查看本局升級、武器/技能分離、角色特性影響升級、吸血武器、資訊欄重新排版
25. v14 修正：暫停按鈕避開武器資訊欄，武器圖鑑直版壓縮排版避免文字與回首頁按鈕重疊
26. v15 新增：遊戲模式與難度系統。無盡模式每擊殺 30 隻怪物隨機出 Boss；闖關模式 30 秒後依序出 Boss，打完一輪勝利；難度分簡單、中等、困難、極難
27. v16 修正：模式/難度頁 Enter、B 等鍵盤操作改用全域 keydown 監聽，避免 GitHub Pages 上 canvas 沒有焦點時按鍵失效
28. v17 新增整合：角色專屬武器、攻擊特效、WebAudio 音效、小怪種類擴充、Boss 獨有攻擊、圖鑑更新、HUD 對齊優化
*/

// ============================================================
// 一、遊戲狀態與基本資料
// ============================================================

let gameState = "title"; 
// title：首頁
// character：角色選擇
// modeSelect：模式與難度選擇
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
let gameEffects = []; // 專屬武器、Boss 技能、命中特效使用

let score = 0;
let kills = 0;
let bossKillsThisRun = 0;

let startTime = 0;
let finalSurvivalSeconds = 0;
let lastEnemySpawn = 0;
let lastAttackTime = 0;
let lastAuraDamageTime = 0;
let lastBombTime = 0;
let lastCharacterWeaponTime = 0;
let lastBossSpawnTime = 0;
let bossSpawnCount = 0;

// 遊戲模式與難度
let selectedGameMode = "endless"; // endless：無盡模式；stage：闖關模式
let selectedDifficulty = "normal"; // easy / normal / hard / extreme
let nextEndlessBossKillTarget = 30;
let stageBossIndex = 0;
let stageBossStarted = false;
let finalGameResult = "dead"; // dead / clear

let selectedCharacterId = "student";
let unlockedCharacters = {};
let playerStats = {};

let upgradeOptions = [];
let selectedUpgrades = [];
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

// 效能保護：避免玩久後怪物、子彈、跳字太多導致卡住
const MAX_FLOATING_TEXTS = 90;
const MAX_BULLETS = 100;
const MAX_BLOOD_STAINS = 160;
const MAX_GAME_EFFECTS = 80;

// WebAudio 音效，不需要額外上傳音檔。
// 瀏覽器規定：第一次點擊或按鍵後才能啟動聲音。
let audioCtx = null;
let soundEnabled = true;
let lastSoundAt = {};

const difficultyConfigs = {
  easy: {
    name: "簡單",
    enemyHp: 0.75,
    enemySpeed: 0.85,
    enemyDamage: 0.75,
    spawnRate: 0.8,
    bossHp: 0.75,
    bossSpeed: 0.85,
    maxEnemyMultiplier: 0.85
  },
  normal: {
    name: "中等",
    enemyHp: 1.0,
    enemySpeed: 1.0,
    enemyDamage: 1.0,
    spawnRate: 1.0,
    bossHp: 1.0,
    bossSpeed: 1.0,
    maxEnemyMultiplier: 1.0
  },
  hard: {
    name: "困難",
    enemyHp: 1.35,
    enemySpeed: 1.18,
    enemyDamage: 1.25,
    spawnRate: 1.25,
    bossHp: 1.35,
    bossSpeed: 1.15,
    maxEnemyMultiplier: 1.18
  },
  extreme: {
    name: "極難",
    enemyHp: 1.75,
    enemySpeed: 1.35,
    enemyDamage: 1.55,
    spawnRate: 1.55,
    bossHp: 1.8,
    bossSpeed: 1.3,
    maxEnemyMultiplier: 1.35
  }
};

function getDifficultyConfig() {
  return difficultyConfigs[selectedDifficulty] || difficultyConfigs.normal;
}

function getDifficultyName() {
  return getDifficultyConfig().name;
}

function getGameModeName() {
  return selectedGameMode === "stage" ? "闖關模式" : "無盡模式";
}

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
    attackBonus: 2,
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
    attackBonus: 2,
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
    attackBonus: 1,
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
    attackBonus: 4,
    cooldownBonus: 0
  }
];


const characterWeapons = {
  student: { name: "鉛筆風暴", desc: "每隔一段時間向附近多個敵人射出鉛筆，適合清理小怪。" },
  runner: { name: "疾風衝擊", desc: "週期性釋放風壓衝擊波，擊退並傷害身邊敵人。" },
  scientist: { name: "電漿連鎖", desc: "向最近敵人釋放電漿，會連鎖跳到其他敵人。" },
  guardian: { name: "盾牌震波", desc: "釋放防禦震波，傷害周圍敵人並回復少量生命。" }
};

function getCharacterWeaponInfo() {
  return characterWeapons[selectedCharacterId] || characterWeapons.student;
}

// ============================================================
// 三、p5.js 初始化
// ============================================================

function setup() {
  createCanvas(600, 900);
  pixelDensity(1); // 手機效能比較穩
  textFont("Arial");
  createEnvironmentDetails();
  loadSaveData();
  setupGlobalKeyboardControls();
}

function draw() {
  background(24, 26, 34);

  if (gameState === "title") {
    drawTitleScreen();
  } else if (gameState === "modeSelect") {
    drawModeSelectScreen();
  } else if (gameState === "character") {
    drawCharacterScreen();
  } else if (gameState === "playing") {
    updateGame();
    drawGame();
  } else if (gameState === "upgrade") {
    drawGame();
    drawUpgradeScreen();
  } else if (gameState === "paused") {
    drawGame();
    drawPauseScreen();
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
    nextExp: 4,
    pickupRadius: 38,
    invincibleUntil: 0,
    baseAttackCooldown: max(180, 560 - charData.cooldownBonus),
    bulletDamage: 14 + charData.attackBonus,
    attackRange: 100,
    auraLevel: 0,
    bladeLevel: 0,
    bombLevel: 0,
    lifestealLevel: 0,
    bulletLevel: 1
  };

  enemies = [];
  bullets = [];
  expGems = [];
  bosses = [];
  explosions = [];
  floatingTexts = [];
  gameEffects = [];
  bloodStains = [];
  upgradeOptions = [];
  selectedUpgrades = [];

  score = 0;
  kills = 0;
  bossKillsThisRun = 0;

  startTime = millis();
  finalSurvivalSeconds = 0;
  lastEnemySpawn = millis();
  lastAttackTime = millis();
  lastAuraDamageTime = millis();
  lastBombTime = millis();
  lastCharacterWeaponTime = millis();
  lastBossSpawnTime = millis();
  bossSpawnCount = 0;
  nextEndlessBossKillTarget = 30;
  stageBossIndex = 0;
  stageBossStarted = false;
  finalGameResult = "dead";
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

function getCharacterGrowth() {
  // 角色特性會影響技能升級數值。
  // attack：攻擊力成長
  // hp：血量成長
  // speed：速度成長
  // heal：回復效果
  if (selectedCharacterId === "runner") {
    return { attack: 0.9, hp: 0.8, speed: 1.5, heal: 0.9 };
  }

  if (selectedCharacterId === "scientist") {
    return { attack: 1.35, hp: 0.85, speed: 1.0, heal: 1.0 };
  }

  if (selectedCharacterId === "guardian") {
    return { attack: 1.15, hp: 1.6, speed: 0.75, heal: 1.3 };
  }

  return { attack: 1.0, hp: 1.0, speed: 1.0, heal: 1.0 };
}

function healPlayer(amount, label = "HP +") {
  let actual = min(amount, player.maxHp - player.hp);
  if (actual <= 0) return 0;

  player.hp += actual;
  addFloatingText(label + floor(actual), player.x, player.y - 58, "#5EEAD4");
  return actual;
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
  updateGameEffects();
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
  drawGameEffects();
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


const enemyTypes = [
  { kind: "normal", name: "普通殭屍", color: "#55C667", hpMult: 1.0, speedMult: 1.0, damageMult: 1.0, rMin: 12, rMax: 18, desc: "最基本的敵人，會穩定追著玩家。" },
  { kind: "small", name: "小殭屍", color: "#7FFF7F", hpMult: 0.55, speedMult: 1.45, damageMult: 0.75, rMin: 9, rMax: 12, desc: "速度快、血量少，常由 Boss 召喚或分裂。" },
  { kind: "sprinter", name: "奔跑殭屍", color: "#A7F3D0", hpMult: 0.85, speedMult: 1.75, damageMult: 0.85, rMin: 11, rMax: 15, desc: "移動很快，會從側邊快速接近玩家。" },
  { kind: "brute", name: "壯漢殭屍", color: "#2F855A", hpMult: 1.75, speedMult: 0.72, damageMult: 1.35, rMin: 17, rMax: 23, desc: "血量厚、速度慢，但碰到會更痛。" },
  { kind: "toxic", name: "毒液殭屍", color: "#9AE66E", hpMult: 1.05, speedMult: 0.95, damageMult: 1.15, rMin: 13, rMax: 18, desc: "帶有毒液，靠近時威脅較高。" },
  { kind: "bomber", name: "爆裂殭屍", color: "#F97316", hpMult: 0.9, speedMult: 1.05, damageMult: 1.0, rMin: 13, rMax: 17, desc: "死亡時會爆裂，玩家太靠近會受到傷害。" }
];

function pickEnemyType(small = false) {
  if (small) return enemyTypes.find(e => e.kind === "small");
  let survival = getSurvivalSeconds();
  let pool = ["normal", "normal", "normal", "sprinter"];
  if (survival > 25) pool.push("brute");
  if (survival > 40) pool.push("toxic");
  if (survival > 55) pool.push("bomber");
  let key = random(pool);
  return enemyTypes.find(e => e.kind === key) || enemyTypes[0];
}

function updateEnemySpawning() {
  let survival = getSurvivalSeconds();
  let cfg = getDifficultyConfig();

  // 存活越久，生成越快；難度越高，生成越快。
  let spawnInterval = max(220, (1100 - survival * 8) / cfg.spawnRate);

  if (millis() - lastEnemySpawn > spawnInterval) {
    spawnEnemy();
    lastEnemySpawn = millis();
  }
}

function getEnemySpeedMultiplier() {
  // v11：怪物速度會隨存活時間慢慢變快。
  // 60 秒約 +24%，120 秒約 +48%，最高約 +80%。
  let survival = getSurvivalSeconds();
  return constrain(1 + survival * 0.004, 1, 1.8);
}

function getMaxEnemiesAllowed() {
  // 前期少一點，後期慢慢增加；難度越高，同時怪物上限越高。
  let survival = getSurvivalSeconds();
  let cfg = getDifficultyConfig();
  return floor(constrain((28 + survival * 0.35) * cfg.maxEnemyMultiplier, 24, 95));
}

function spawnEnemy(x = null, y = null, small = false) {
  let maxEnemies = getMaxEnemiesAllowed();
  if (enemies.length >= maxEnemies) return;

  let pos = randomEdgePosition();
  let survival = getSurvivalSeconds();
  let cfg = getDifficultyConfig();
  let type = pickEnemyType(small);

  let baseHp = random(14, 24) + survival * 0.035;
  baseHp *= cfg.enemyHp * type.hpMult;

  let r = random(type.rMin, type.rMax);

  let enemy = {
    id: nextId++,
    kind: type.kind,
    name: type.name,
    x: x === null ? pos.x : x,
    y: y === null ? pos.y : y,
    r,
    hp: baseHp,
    maxHp: baseHp,
    speed: random(0.9, 1.65) * cfg.enemySpeed * type.speedMult,
    damage: ceil(10 * cfg.enemyDamage * type.damageMult),
    color: type.color,
    lastBladeHit: 0,
    lastSpecialTime: millis()
  };

  enemies.push(enemy);
}

function updateEnemies() {
  let speedMultiplier = getEnemySpeedMultiplier();

  for (let e of enemies) {
    moveToward(e, player.x, player.y, e.speed * speedMultiplier);
  }

  // 清掉死亡殭屍，也順便清掉離玩家太遠的殭屍，避免無邊際地圖玩久後累積太多物件。
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      killEnemy(i);
    } else if (dist(enemies[i].x, enemies[i].y, player.x, player.y) > 1500 && enemies.length > 25) {
      enemies.splice(i, 1);
    }
  }
}

function killEnemy(index) {
  let e = enemies[index];

  kills++;
  score += 10;

  spawnBloodStain(e.x, e.y, e.r, false);
  spawnExpGem(e.x, e.y, e.kind === "brute" ? 2 : 1);
  addFloatingText("分數 +10", e.x, e.y, "#FFD166");
  playSound("kill");

  if (e.kind === "bomber") {
    addGameEffect({ type: "ring", x: e.x, y: e.y, r: 10, maxR: 82, life: 22, color: "#FB923C" });
    if (dist(e.x, e.y, player.x, player.y) < 85) damagePlayer(12);
  }

  enemies.splice(index, 1);
}

function drawEnemies() {
  for (let e of enemies) {
    drawZombieBody(e.x, e.y, e.r, e.color, e.hp / e.maxHp, e.kind);

    // 小血條
    drawMiniHpBar(e.x - e.r, e.y - e.r - 12, e.r * 2, 4, e.hp, e.maxHp);
  }
}

function drawZombieBody(x, y, r, colorValue, hpRatio, kind = "normal") {
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

  // 不同小怪的簡單辨識造型
  noStroke();
  if (kind === "sprinter") {
    fill("#E0F2FE");
    triangle(-r * 0.25, -r * 1.25, r * 0.25, -r * 1.25, 0, -r * 0.85);
  } else if (kind === "brute") {
    fill("#1F2937");
    rect(-r * 0.55, -r * 1.05, r * 1.1, r * 0.25, 3);
  } else if (kind === "toxic") {
    fill("#B6FF4D");
    circle(-r * 0.45, -r * 0.95, r * 0.25);
    circle(r * 0.45, -r * 0.95, r * 0.25);
  } else if (kind === "bomber") {
    fill("#FACC15");
    circle(0, -r * 1.05, r * 0.38);
    fill("#7C2D12");
    circle(0, -r * 1.05, r * 0.18);
  }

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
    desc: "血很多，會定期踩地板產生震波，近距離會被重擊。"
  },
  {
    kind: "dasher",
    name: "衝刺怪",
    color: "#9B59B6",
    maxHp: 230,
    speed: 1.0,
    r: 28,
    desc: "每隔幾秒突然衝刺，衝刺路徑會留下危險殘影。"
  },
  {
    kind: "splitter",
    name: "分裂怪",
    color: "#E67E22",
    maxHp: 260,
    speed: 0.95,
    r: 30,
    desc: "死亡後分裂成小怪，戰鬥中也會週期性裂殖小殭屍。"
  },
  {
    kind: "summoner",
    name: "召喚師",
    color: "#3498DB",
    maxHp: 240,
    speed: 0.85,
    r: 29,
    desc: "會召喚小殭屍，並在玩家附近放出召喚圈干擾走位。"
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
  },
  {
    name: "吸血之牙",
    key: "lifesteal",
    desc: "攻擊命中敵人時有機率回復生命，等級越高回復越穩定。",
    unlock: "升級時選到「吸血之牙」"
  },
  {
    name: "角色專屬武器",
    key: "unique",
    desc: "每個角色都有不同自動特效攻擊：鉛筆風暴、疾風衝擊、電漿連鎖、盾牌震波。",
    unlock: "選擇角色後自動擁有"
  }
];

const zombieDexEntries = [
  { name: "普通殭屍", key: "normal", desc: "最常見的敵人，能力平均，會穩定追著玩家。", type: "enemy" },
  { name: "小殭屍", key: "small", desc: "體型小、速度快，常由 Boss 召喚或分裂產生。", type: "enemy" },
  { name: "奔跑殭屍", key: "sprinter", desc: "移動速度很快，適合從側邊包圍玩家。", type: "enemy" },
  { name: "壯漢殭屍", key: "brute", desc: "血量厚、速度慢，但碰撞傷害比較高。", type: "enemy" },
  { name: "毒液殭屍", key: "toxic", desc: "帶有毒液，傷害略高，外觀有綠色毒泡。", type: "enemy" },
  { name: "爆裂殭屍", key: "bomber", desc: "死亡時會爆裂，玩家靠太近會受到額外傷害。", type: "enemy" },
  { name: "巨大殭屍王", key: "tank", desc: "血量很多，會定期震地重踏，近距離玩家會受到傷害。", type: "boss" },
  { name: "衝刺怪", key: "dasher", desc: "會突然向玩家衝刺，衝刺路徑會出現紫色殘影。", type: "boss" },
  { name: "分裂怪", key: "splitter", desc: "死亡後分裂成小怪，戰鬥中也會週期性裂殖。", type: "boss" },
  { name: "召喚師", key: "summoner", desc: "會定期召喚小殭屍，並在玩家附近放出召喚圈。", type: "boss" }
];

function updateBossSpawning() {
  // 無盡模式：每擊殺 30 隻一般怪物，隨機出現 1 隻 Boss，不會主動結束。
  if (selectedGameMode === "endless") {
    if (kills >= nextEndlessBossKillTarget) {
      spawnBoss();
      nextEndlessBossKillTarget += 30;
    }
    return;
  }

  // 闖關模式：第一隻 Boss 在 30 秒後出現。
  // 打死後會依照順序出現下一隻，打完一輪就勝利。
  if (selectedGameMode === "stage") {
    if (!stageBossStarted && getSurvivalSeconds() >= 30 && bosses.length === 0) {
      stageBossStarted = true;
      spawnBoss(stageBossIndex);
    }
  }
}

function spawnBoss(typeIndex = null) {
  let cfg = getDifficultyConfig();

  let type;
  if (typeIndex === null) {
    // 無盡模式使用隨機 Boss
    type = random(bossTypes);
  } else {
    // 闖關模式照順序出現
    type = bossTypes[typeIndex % bossTypes.length];
  }

  bossSpawnCount++;

  let pos = randomEdgePosition();
  let bossHp = (type.maxHp + bossSpawnCount * 55) * cfg.bossHp;

  let boss = {
    id: nextId++,
    x: pos.x,
    y: pos.y,
    r: type.r,
    hp: bossHp,
    maxHp: bossHp,
    speed: (type.speed + bossSpawnCount * 0.035) * cfg.bossSpeed,
    damage: ceil(22 * cfg.enemyDamage),
    kind: type.kind,
    name: type.name,
    color: type.color,
    lastSkillTime: millis(),
    dashUntil: 0,
    lastBladeHit: 0
  };

  bosses.push(boss);
  playSound("boss");

  let modeText = selectedGameMode === "stage" ? "闖關 Boss " + (stageBossIndex + 1) + "：" : "無盡 Boss：";
  addFloatingText(modeText + boss.name, player.x, player.y - 120, "#FF6B6B");
}

function updateBosses() {
  for (let b of bosses) {
    let actualSpeed = b.speed;

    if (b.kind === "dasher") {
      if (millis() - b.lastSkillTime > 4200) {
        b.dashUntil = millis() + 700;
        b.lastSkillTime = millis();
        addGameEffect({ type: "line", x1: b.x, y1: b.y, x2: player.x, y2: player.y, life: 18, color: "#E0B0FF" });
        addFloatingText("衝刺！", b.x, b.y - 45, "#E0B0FF");
        playSound("bossSkill");
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
        addGameEffect({ type: "ring", x: player.x + random(-80, 80), y: player.y + random(-80, 80), r: 10, maxR: 95, life: 30, color: "#38BDF8" });
        b.lastSkillTime = millis();
        addFloatingText("召喚法陣！", b.x, b.y - 45, "#87CEFA");
        playSound("bossSkill");
      }
    }

    if (b.kind === "tank" && millis() - b.lastSkillTime > 5600) {
      b.lastSkillTime = millis();
      addGameEffect({ type: "ring", x: b.x, y: b.y, r: 20, maxR: 190, life: 35, color: "#FF6B6B" });
      addFloatingText("震地重踏！", b.x, b.y - 45, "#FF6B6B");
      if (dist(b.x, b.y, player.x, player.y) < 190) damagePlayer(16);
      playSound("bossSkill");
    }

    if (b.kind === "splitter" && millis() - b.lastSkillTime > 7000) {
      b.lastSkillTime = millis();
      for (let i = 0; i < 2; i++) {
        spawnEnemy(b.x + random(-38, 38), b.y + random(-38, 38), true);
      }
      addFloatingText("裂殖！", b.x, b.y - 45, "#FDBA74");
      playSound("bossSkill");
    }

    actualSpeed *= constrain(1 + getSurvivalSeconds() * 0.0025, 1, 1.55);
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
  addFloatingText("Boss 擊敗！分數 +200", b.x, b.y, "#FFD166");

  if (b.kind === "splitter") {
    for (let i = 0; i < 8; i++) {
      spawnEnemy(b.x + random(-45, 45), b.y + random(-45, 45), true);
    }
  }

  bosses.splice(index, 1);

  // 闖關模式：打死一隻 Boss 後，依序出現下一隻。
  if (selectedGameMode === "stage") {
    stageBossIndex++;

    if (stageBossIndex >= bossTypes.length) {
      endGame(true);
      return;
    }

    spawnBoss(stageBossIndex);
  }
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

  // v12：如果同時有多隻 Boss，逐條顯示血量。
  // 為了避免跟左上 HUD 和右上武器資訊重疊，血條從中段開始往下排。
  let barW = 500;
  let barH = 16;
  let x = width / 2 - barW / 2;
  let startY = 190;
  let gapY = 50;

  let showCount = min(bosses.length, 4);

  for (let i = 0; i < showCount; i++) {
    let b = bosses[i];
    let y = startY + i * gapY;

    fill(20, 20, 25, 220);
    noStroke();
    rect(x - 8, y - 25, barW + 16, 46, 8);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(14);
    text("BOSS：" + b.name, width / 2, y - 12);

    noStroke();
    fill("#4A4A4A");
    rect(x, y, barW, barH, 8);

    let ratio = constrain(b.hp / b.maxHp, 0, 1);
    fill("#FF4D4D");
    rect(x, y, barW * ratio, barH, 8);

    stroke(255);
    noFill();
    rect(x, y, barW, barH, 8);

    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(floor(max(0, b.hp)) + " / " + floor(b.maxHp), x + barW / 2, y + barH / 2 + 1);
  }

  if (bosses.length > showCount) {
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(12);
    text("還有 " + (bosses.length - showCount) + " 隻 Boss", width / 2, startY + showCount * gapY - 8);
  }
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
  if (bullets.length > MAX_BULLETS) {
    bullets.splice(0, bullets.length - MAX_BULLETS);
  }

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
        applyDamageToTarget(e, bullet.damage, "#FF4D4D");
        bullet.life = 0;
        break;
      }
    }

    // 打 Boss
    if (bullet.life > 0) {
      for (let b of bosses) {
        if (dist(bullet.x, bullet.y, b.x, b.y) < bullet.r + b.r) {
          applyDamageToTarget(b, bullet.damage, "#FF4D4D");
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
  updateCharacterWeapon();
}

function drawWeapons() {
  drawAuraWeapon();
  drawBladeWeapon();
}


function updateCharacterWeapon() {
  let cooldown = 5600;
  if (selectedCharacterId === "runner") cooldown = 4600;
  if (selectedCharacterId === "scientist") cooldown = 5200;
  if (selectedCharacterId === "guardian") cooldown = 6200;
  if (millis() - lastCharacterWeaponTime < cooldown) return;
  lastCharacterWeaponTime = millis();

  if (selectedCharacterId === "student") castStudentPencilStorm();
  else if (selectedCharacterId === "runner") castRunnerWindPulse();
  else if (selectedCharacterId === "scientist") castScientistPlasmaChain();
  else if (selectedCharacterId === "guardian") castGuardianShieldWave();
}

function getAllTargets() { return enemies.concat(bosses); }
function getTargetsNear(x, y, radius) { return getAllTargets().filter(t => dist(x, y, t.x, t.y) <= radius + t.r); }

function castStudentPencilStorm() {
  let targets = getTargetsNear(player.x, player.y, 260).sort((a,b)=>dist(player.x,player.y,a.x,a.y)-dist(player.x,player.y,b.x,b.y)).slice(0,5);
  if (targets.length === 0) return;
  for (let t of targets) {
    applyDamageToTarget(t, player.bulletDamage * 0.9 + 10, "#FDE68A");
    addGameEffect({ type: "line", x1: player.x, y1: player.y, x2: t.x, y2: t.y, life: 18, color: "#FDE68A" });
  }
  addFloatingText("鉛筆風暴！", player.x, player.y - 80, "#FDE68A");
  playSound("unique");
}

function castRunnerWindPulse() {
  let radius = 150;
  let targets = getTargetsNear(player.x, player.y, radius);
  for (let t of targets) {
    applyDamageToTarget(t, 18 + player.level * 1.2, "#93C5FD");
    let a = atan2(t.y - player.y, t.x - player.x);
    t.x += cos(a) * 18;
    t.y += sin(a) * 18;
  }
  addGameEffect({ type: "ring", x: player.x, y: player.y, r: 25, maxR: radius, life: 24, color: "#93C5FD" });
  addFloatingText("疾風衝擊！", player.x, player.y - 80, "#93C5FD");
  playSound("unique");
}

function castScientistPlasmaChain() {
  let targets = getTargetsNear(player.x, player.y, 330).sort((a,b)=>dist(player.x,player.y,a.x,a.y)-dist(player.x,player.y,b.x,b.y)).slice(0,5);
  if (targets.length === 0) return;
  let lastX = player.x, lastY = player.y;
  for (let t of targets) {
    applyDamageToTarget(t, player.bulletDamage * 0.75 + 12, "#7DD3FC");
    addGameEffect({ type: "line", x1: lastX, y1: lastY, x2: t.x, y2: t.y, life: 22, color: "#7DD3FC" });
    lastX = t.x; lastY = t.y;
  }
  addFloatingText("電漿連鎖！", player.x, player.y - 80, "#7DD3FC");
  playSound("unique");
}

function castGuardianShieldWave() {
  let radius = 170;
  for (let t of getTargetsNear(player.x, player.y, radius)) {
    applyDamageToTarget(t, 20 + player.maxHp * 0.05, "#D1D5DB");
  }
  healPlayer(4 + floor(player.level / 2), "盾牌 +");
  addGameEffect({ type: "ring", x: player.x, y: player.y, r: 30, maxR: radius, life: 32, color: "#D1D5DB" });
  addFloatingText("盾牌震波！", player.x, player.y - 80, "#D1D5DB");
  playSound("unique");
}

function addGameEffect(effect) {
  gameEffects.push(effect);
  if (gameEffects.length > MAX_GAME_EFFECTS) gameEffects.splice(0, gameEffects.length - MAX_GAME_EFFECTS);
}
function updateGameEffects() {
  for (let ef of gameEffects) { ef.life--; if (ef.type === "ring") ef.r = lerp(ef.r, ef.maxR, 0.22); }
  for (let i = gameEffects.length - 1; i >= 0; i--) if (gameEffects[i].life <= 0) gameEffects.splice(i, 1);
}
function drawGameEffects() {
  push(); noFill();
  for (let ef of gameEffects) {
    let alpha = map(ef.life, 0, 35, 0, 210);
    if (ef.type === "ring") { strokeWithAlpha(ef.color, alpha); strokeWeight(4); circle(ef.x, ef.y, ef.r * 2); }
    else if (ef.type === "line") { strokeWithAlpha(ef.color, alpha); strokeWeight(4); line(ef.x1, ef.y1, ef.x2, ef.y2); stroke(255, 255, 255, alpha * 0.5); strokeWeight(1.5); line(ef.x1, ef.y1, ef.x2, ef.y2); }
  }
  pop();
}
function strokeWithAlpha(hexColor, alpha) { let c = color(hexColor); c.setAlpha(alpha); stroke(c); }

function initAudio() {
  if (!soundEnabled || audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundEnabled = false; }
}
function playSound(type) {
  if (!soundEnabled || !audioCtx) return;
  let now = millis();
  if (lastSoundAt[type] && now - lastSoundAt[type] < 80) return;
  lastSoundAt[type] = now;
  let cfg = { hit:[180,0.035,"square"], kill:[260,0.045,"triangle"], exp:[520,0.035,"sine"], level:[720,0.08,"sine"], hurt:[110,0.08,"sawtooth"], boss:[95,0.18,"sawtooth"], bossSkill:[150,0.09,"square"], unique:[640,0.075,"triangle"] }[type] || [440,0.04,"sine"];
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.type = cfg[2];
  osc.frequency.setValueAtTime(cfg[0], audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(max(40, cfg[0]*0.55), audioCtx.currentTime + cfg[1]);
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + cfg[1]);
  osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + cfg[1] + 0.02);
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
          applyDamageToTarget(t, bladeDamage, "#FF8A4C");
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
        applyDamageToTarget(t, ex.damage, "#FF6B9A");
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

function applyDamageToTarget(target, amount, colorValue = "#FF4D4D") {
  target.hp -= amount;
  playSound("hit");

  // v9：同一個目標短時間內不要一直產生跳字，避免玩久卡住。
  if (!target.lastDamageTextTime || millis() - target.lastDamageTextTime > 120) {
    addFloatingText("-" + floor(amount), target.x, target.y - target.r - 8, colorValue);
    target.lastDamageTextTime = millis();
  }

  // v13：吸血之牙。攻擊命中敵人時，有機率幫玩家回復生命。
  if (player && player.lifestealLevel > 0 && player.hp < player.maxHp) {
    let chance = min(0.10 + player.lifestealLevel * 0.035, 0.32);
    if (random() < chance) {
      let healAmount = 1 + floor(player.lifestealLevel / 2);
      healPlayer(healAmount, "吸血 +");
    }
  }
}

function damageTargetsInRange(x, y, radius, damage) {
  for (let e of enemies) {
    if (dist(x, y, e.x, e.y) < radius + e.r) {
      applyDamageToTarget(e, damage, "#FF3B30");
    }
  }

  for (let b of bosses) {
    if (dist(x, y, b.x, b.y) < radius + b.r) {
      applyDamageToTarget(b, damage, "#FF3B30");
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
  addFloatingText("EXP +" + amount, player.x, player.y - 34, "#5EEAD4");
  playSound("exp");

  while (player.exp >= player.nextExp) {
    player.exp -= player.nextExp;
    player.level++;
    player.nextExp = floor(player.nextExp * 1.22 + 2);
    openUpgradeMenu();
    break;
  }
}

function openUpgradeMenu() {
  upgradeOptions = createUpgradeOptions();
  playSound("level");
  gameState = "upgrade";
}

function createUpgradeOptions() {
  let g = getCharacterGrowth();

  const weaponPool = [
    {
      type: "武器",
      name: "自動子彈",
      desc: "升級主要攻擊武器。子彈等級 +1，並稍微提高傷害。",
      apply: () => {
        player.bulletLevel++;
        player.bulletDamage += 2;
        return "子彈 Lv." + player.bulletLevel + "，傷害 +2";
      }
    },
    {
      type: "武器",
      name: "守護光環",
      desc: "解鎖或升級光環。靠近玩家的敵人會持續受到傷害。",
      apply: () => {
        player.auraLevel++;
        return "光環 Lv." + player.auraLevel;
      }
    },
    {
      type: "武器",
      name: "旋轉刀",
      desc: "解鎖或升級旋轉刀。小刀會繞著玩家攻擊敵人。",
      apply: () => {
        player.bladeLevel++;
        return "旋轉刀 Lv." + player.bladeLevel;
      }
    },
    {
      type: "武器",
      name: "小炸彈",
      desc: "解鎖或升級炸彈。每隔一段時間在敵人附近爆炸。",
      apply: () => {
        player.bombLevel++;
        return "炸彈 Lv." + player.bombLevel;
      }
    },
    {
      type: "武器",
      name: "吸血之牙",
      desc: "攻擊命中時有機率回復生命。等級越高，吸血越穩定。",
      apply: () => {
        player.lifestealLevel++;
        return "吸血之牙 Lv." + player.lifestealLevel;
      }
    }
  ];

  const skillPool = [
    {
      type: "技能",
      name: "力量訓練",
      desc: "依角色攻擊特性提高攻擊力。博士加成較高，戰士也不錯。",
      apply: () => {
        let amount = ceil(4 * g.attack);
        player.bulletDamage += amount;
        return "攻擊力 +" + amount;
      }
    },
    {
      type: "技能",
      name: "體能訓練",
      desc: "依角色血量特性提高最大生命，並回復一部分生命。",
      apply: () => {
        let amount = ceil(18 * g.hp);
        let heal = ceil(amount * 0.55);
        player.maxHp += amount;
        let healed = healPlayer(heal, "回復 +");
        return "最大 HP +" + amount + "，回復 " + healed;
      }
    },
    {
      type: "技能",
      name: "疾風步伐",
      desc: "依角色速度特性提高移動速度。跑酷少年加成最高。",
      apply: () => {
        let amount = round(0.35 * g.speed * 10) / 10;
        player.speed += amount;
        return "速度 +" + amount;
      }
    },
    {
      type: "技能",
      name: "戰鬥專注",
      desc: "降低自動攻擊冷卻時間，讓攻擊更頻繁。",
      apply: () => {
        let reduce = ceil(45 * g.attack);
        player.baseAttackCooldown = max(140, player.baseAttackCooldown - reduce);
        return "攻擊冷卻 -" + reduce + "ms";
      }
    },
    {
      type: "技能",
      name: "急救補給",
      desc: "依角色回復特性恢復生命。坦克型角色回復較多。",
      apply: () => {
        let amount = ceil(22 * g.heal);
        let healed = healPlayer(amount, "急救 +");
        return "回復 HP " + healed;
      }
    },
    {
      type: "技能",
      name: "磁鐵背包",
      desc: "增加拾取經驗球的範圍，比較容易撿到經驗。",
      apply: () => {
        player.pickupRadius += 28;
        return "拾取範圍 +28";
      }
    }
  ];

  let pool = weaponPool.concat(skillPool);

  // 讓每次升級比較像 Vampire Survivors / 弓箭傳說：
  // 可能出武器，也可能出技能，但盡量不要三個都太像。
  shuffle(pool, true);
  return pool.slice(0, 3);
}

function chooseUpgrade(index) {
  if (gameState !== "upgrade") return;
  if (!upgradeOptions[index]) return;

  let option = upgradeOptions[index];
  let effectText = option.apply();

  selectedUpgrades.push({
    type: option.type,
    name: option.name,
    desc: effectText || option.desc,
    time: getSurvivalSeconds()
  });

  // 這裡用玩家世界座標，無邊際地圖下才會出現在玩家附近
  addFloatingText(option.type + "：" + option.name, player.x, player.y - 70, option.type === "武器" ? "#FDE68A" : "#A8FF78");

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
  addFloatingText("HP -" + amount, player.x, player.y - 42, "#FF1744");
  playSound("hurt");
}

function endGame(cleared = false) {
  let survivalSeconds = getSurvivalSeconds();
  finalSurvivalSeconds = survivalSeconds;
  finalGameResult = cleared ? "clear" : "dead";

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
  text("AI 小小殭屍倖存者", width / 2, 92);

  fill(210);
  textSize(18);
  text("p5.js Web Editor 示範版 v17 整合優化版", width / 2, 135);

  const charData = getSelectedCharacter();

  fill(255);
  textSize(18);
  text("目前角色：" + charData.name, width / 2, 185);

  fill("#A8FF78");
  textSize(16);
  text("模式：" + getGameModeName() + "｜難度：" + getDifficultyName(), width / 2, 218);

  fill(190);
  textSize(14);
  text(charData.desc, width / 2, 246);

  drawButton(width / 2 - 140, 300, 280, 52, "Enter：開始遊戲");
  drawButton(width / 2 - 140, 365, 280, 52, "M：模式 / 難度");
  drawButton(width / 2 - 140, 430, 280, 52, "C：選擇角色");
  drawButton(width / 2 - 140, 495, 280, 52, "W：武器圖鑑");
  drawButton(width / 2 - 140, 560, 280, 52, "Z：殭屍圖鑑");

  fill(170);
  textSize(13);
  text("無盡：每擊殺 30 隻怪物隨機出 Boss，不會主動結束", width / 2, 660);
  text("闖關：30 秒後依序出 Boss，打完一輪就勝利", width / 2, 686);
  text("電腦：WASD / 方向鍵｜手機：左下角搖桿｜P 暫停", width / 2, 716);
}

function drawModeSelectScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text("模式 / 難度設定", width / 2, 60);

  fill(190);
  textSize(14);
  text("選擇本局規則。按 Enter 開始，按 B 回首頁。", width / 2, 96);

  textAlign(LEFT, CENTER);
  fill("#A8FF78");
  textSize(22);
  text("遊戲模式", 55, 145);

  drawModeCard(55, 175, 230, 130, "endless", "無盡模式", "每擊殺 30 隻怪物，隨機出現 1 隻 Boss。沒有終點，撐越久越強。");
  drawModeCard(315, 175, 230, 130, "stage", "闖關模式", "第一隻 Boss 在 30 秒後出現。打死後下一隻依序登場，打完一輪勝利。");

  fill("#A8FF78");
  textSize(22);
  text("難度", 55, 360);

  drawDifficultyButton(55, 395, 230, 58, "easy", "簡單");
  drawDifficultyButton(315, 395, 230, 58, "normal", "中等");
  drawDifficultyButton(55, 470, 230, 58, "hard", "困難");
  drawDifficultyButton(315, 470, 230, 58, "extreme", "極難");

  fill(220);
  textSize(13);
  textAlign(CENTER, CENTER);
  text("難度會影響：怪物血量、速度、傷害、生成速度、Boss 強度", width / 2, 565);

  drawButton(width / 2 - 180, 630, 360, 52, "開始遊戲");
  drawButton(width / 2 - 180, 700, 360, 46, "回首頁");

}

function drawModeCard(x, y, w, h, mode, title, desc) {
  let selected = selectedGameMode === mode;

  fill(selected ? "#273B5E" : "#1E222E");
  stroke(selected ? "#FFE66D" : "#6B7A99");
  strokeWeight(2);
  rect(x, y, w, h, 14);

  noStroke();
  fill(selected ? "#FFE66D" : "#FFFFFF");
  textAlign(CENTER, CENTER);
  textSize(20);
  text(title, x + w / 2, y + 30);

  fill(210);
  textAlign(LEFT, TOP);
  textSize(12.5);
  drawWrappedText(desc, x + 18, y + 60, w - 36, 18, 3);

  if (selected) {
    fill("#A8FF78");
    textAlign(CENTER, CENTER);
    textSize(13);
    text("已選擇", x + w / 2, y + h - 18);
  }
}

function drawDifficultyButton(x, y, w, h, difficulty, label) {
  let selected = selectedDifficulty === difficulty;

  fill(selected ? "#273B5E" : "#1E222E");
  stroke(selected ? "#A8FF78" : "#6B7A99");
  strokeWeight(2);
  rect(x, y, w, h, 12);

  noStroke();
  fill(selected ? "#A8FF78" : 240);
  textAlign(CENTER, CENTER);
  textSize(20);
  text(label, x + w / 2, y + h / 2);
}

function drawCharacterScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(34);
  text("選擇角色", width / 2, 48);

  textSize(14);
  fill(190);
  text("點角色卡片或按 1 / 2 / 3 / 4 選擇，Enter 可直接開始", width / 2, 78);

  let cardW = 500;
  let cardH = 126;
  let startX = width / 2 - cardW / 2;
  let startY = 100;
  let gapY = 142;

  for (let i = 0; i < characters.length; i++) {
    let c = characters[i];
    let x = startX;
    let y = startY + i * gapY;
    let unlocked = unlockedCharacters[c.id];

    fill(c.id === selectedCharacterId ? "#273B5E" : "#1E222E");
    stroke(c.id === selectedCharacterId ? "#FFE66D" : "#555");
    strokeWeight(2);
    rect(x, y, cardW, cardH, 14);

    noStroke();
    fill(unlocked ? c.color : "#555");
    circle(x + 54, y + 60, 58);

    fill(255);
    textSize(19);
    textAlign(LEFT, CENTER);
    text((i + 1) + ". " + c.name, x + 105, y + 28);

    fill(unlocked ? 210 : 120);
    textSize(13);
    textAlign(LEFT, TOP);
    drawWrappedText(c.desc, x + 105, y + 50, cardW - 130, 18, 2);

    fill(unlocked ? "#A8FF78" : "#FFB86C");
    textSize(13);
    drawWrappedText(unlocked ? "已解鎖" : c.unlockText, x + 105, y + 88, cardW - 130, 17, 2);
  }

  fill(170);
  textSize(12);
  textAlign(CENTER, CENTER);
  text("最高分：" + playerStats.highScore + "｜最長：" + playerStats.maxSurvival + " 秒｜擊殺：" + playerStats.totalKills + "｜Boss：" + playerStats.totalBossKills, width / 2, 690);

  drawButton(width / 2 - 240, 720, 150, 42, "B：回首頁");
  drawButton(width / 2 - 75, 720, 150, 42, "Enter：開始");
  drawButton(width / 2 + 90, 720, 150, 42, "武器圖鑑");
  drawButton(width / 2 - 75, 772, 150, 38, "殭屍圖鑑");
}

function drawWeaponDexScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(34);
  text("武器圖鑑", width / 2, 42);

  fill(190);
  textSize(13);
  text("目前遊戲中的武器。按 B 回首頁，按 C 選角色。", width / 2, 74);

  // v17：6 個武器壓縮顯示。
  let cardW = 520;
  let cardH = 94;
  let startX = width / 2 - cardW / 2;
  let startY = 98;
  let gapY = 106;

  for (let i = 0; i < weaponDexEntries.length; i++) {
    let item = weaponDexEntries[i];
    let x = startX;
    let y = startY + i * gapY;

    drawDexCard(x, y, cardW, cardH);
    drawWeaponIcon(item.key, x + 52, y + 48, 0.75);

    fill(255);
    textAlign(LEFT, TOP);
    textSize(19);
    text(item.name, x + 100, y + 13);

    fill(210);
    textSize(12.5);
    drawWrappedText(item.desc, x + 100, y + 39, cardW - 120, 16, 2);

    fill("#A8FF78");
    textSize(12.5);
    drawWrappedText("取得方式：" + item.unlock, x + 100, y + 70, cardW - 120, 15, 1);
  }

  drawButton(width / 2 - 120, 792, 240, 42, "B：回首頁");
}

function drawZombieDexScreen() {
  drawGridBackground();

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(34);
  text("殭屍圖鑑", width / 2, 40);

  fill(190);
  textSize(13);
  text("小怪與 BOSS 分區整理。按 B 回首頁，按 C 選角色。", width / 2, 70);

  let normalEnemies = zombieDexEntries.filter(item => item.type === "enemy");
  let bossEnemies = zombieDexEntries.filter(item => item.type === "boss");

  let cardW = 520;
  let startX = width / 2 - cardW / 2;

  drawDexSectionTitle("小怪種類", 102);

  for (let i = 0; i < normalEnemies.length; i++) {
    let item = normalEnemies[i];
    let x = startX;
    let y = 124 + i * 63;

    drawDexCard(x, y, cardW, 54);
    let type = enemyTypes.find(e => e.kind === item.key) || enemyTypes[0];
    drawZombieBody(x + 42, y + 32, 12, type.color, 1, item.key);

    fill(255);
    textAlign(LEFT, TOP);
    textSize(15);
    text(item.name, x + 78, y + 8);

    fill(210);
    textSize(11.5);
    drawWrappedText(item.desc, x + 78, y + 28, cardW - 100, 14, 2);
  }

  drawDexSectionTitle("BOSS 獨有攻擊", 522);

  for (let i = 0; i < bossEnemies.length; i++) {
    let item = bossEnemies[i];
    let x = startX;
    let y = 544 + i * 66;

    drawDexCard(x, y, cardW, 58);
    let type = bossTypes.find(b => b.kind === item.key);
    drawBossBody({ x: x + 44, y: y + 34, r: 14, kind: item.key, color: type ? type.color : "#B34747" });

    fill(255);
    textAlign(LEFT, TOP);
    textSize(15);
    text(item.name, x + 82, y + 8);

    fill(210);
    textSize(11.5);
    drawWrappedText(item.desc, x + 82, y + 29, cardW - 105, 14, 2);
  }

  drawButton(width / 2 - 120, 820, 240, 42, "B：回首頁");
}

function drawDexSectionTitle(title, y) {
  textAlign(LEFT, CENTER);
  textSize(22);
  fill("#A8FF78");
  noStroke();
  text(title, 42, y);

  stroke("#A8FF78");
  strokeWeight(2);
  line(42, y + 21, width - 42, y + 21);
  noStroke();
}

function drawWrappedText(str, x, y, maxWidth, lineHeight, maxLines = 3) {
  let chars = Array.from(str);
  let lines = [];
  let line = "";
  let index = 0;

  while (index < chars.length) {
    let testLine = line + chars[index];

    if (textWidth(testLine) > maxWidth && line.length > 0) {
      lines.push(line);
      line = "";

      if (lines.length >= maxLines) break;
    } else {
      line = testLine;
      index++;
    }
  }

  if (line.length > 0 && lines.length < maxLines) {
    lines.push(line);
  }

  // 超過行數時加省略號，避免文字跑出卡片
  if (index < chars.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (textWidth(last + "…") > maxWidth && last.length > 0) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = last + "…";
  }

  for (let i = 0; i < lines.length; i++) {
    text(lines[i], x, y + i * lineHeight);
  }
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
  } else if (kind === "lifesteal") {
    noStroke();
    fill("#A855F7");
    circle(0, 0, 36);
    fill("#FDE68A");
    triangle(-7, -8, -1, 8, -12, 8);
    triangle(7, -8, 1, 8, 12, 8);
    fill("#F43F5E");
    circle(0, -2, 10);
  } else if (kind === "unique") {
    noFill();
    stroke("#FDE68A");
    strokeWeight(4);
    starShape(0, 0, 14, 28, 5);
    noStroke();
    fill("#A8FF78");
    circle(0, 0, 10);
  }

  pop();
}

function starShape(x, y, r1, r2, points) {
  beginShape();
  for (let i = 0; i < points * 2; i++) {
    let a = -HALF_PI + i * PI / points;
    let r = i % 2 === 0 ? r2 : r1;
    vertex(x + cos(a) * r, y + sin(a) * r);
  }
  endShape(CLOSE);
}

function drawPauseScreen() {
  fill(0, 0, 0, 190);
  noStroke();
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(36);
  text("暫停", width / 2, 72);

  fill(220);
  textSize(14);
  text("按 P / ESC / Enter 繼續，或點擊下方按鈕", width / 2, 108);

  let panelX = 48;
  let panelY = 145;
  let panelW = width - 96;
  let panelH = 560;

  fill("#111827");
  stroke("#A8FF78");
  strokeWeight(2);
  rect(panelX, panelY, panelW, panelH, 16);

  noStroke();
  fill("#A8FF78");
  textAlign(LEFT, TOP);
  textSize(20);
  text("本局已選升級", panelX + 25, panelY + 24);

  fill(220);
  textSize(13);
  text("武器和技能分開紀錄，方便學生回顧這局的養成路線。", panelX + 25, panelY + 56);

  let listX = panelX + 25;
  let listY = panelY + 94;

  if (selectedUpgrades.length === 0) {
    fill(180);
    textSize(15);
    text("目前還沒有選過升級。", listX, listY);
  } else {
    let maxShow = min(selectedUpgrades.length, 13);
    let startIndex = max(0, selectedUpgrades.length - maxShow);

    for (let i = startIndex; i < selectedUpgrades.length; i++) {
      let item = selectedUpgrades[i];
      let row = i - startIndex;
      let y = listY + row * 34;

      fill(item.type === "武器" ? "#FDE68A" : "#A8FF78");
      textSize(14);
      text((i + 1) + ". [" + item.type + "] " + item.name, listX, y);

      fill(205);
      textSize(12);
      drawWrappedText(item.desc, listX + 20, y + 17, panelW - 70, 16, 1);
    }

    if (selectedUpgrades.length > maxShow) {
      fill(160);
      textSize(12);
      text("只顯示最近 " + maxShow + " 個升級。", listX, panelY + panelH - 35);
    }
  }

  drawButton(width / 2 - 210, 740, 420, 48, "繼續遊戲");
  drawButton(width / 2 - 210, 805, 420, 42, "回首頁");
}

function drawUpgradeScreen() {
  // 升級時，遊戲畫面先畫在後面，這裡再蓋一層半透明黑幕
  fill(0, 0, 0, 178);
  noStroke();
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(31);
  text("升級！選擇一個能力", width / 2, 135);

  fill(220);
  textSize(14);
  text("武器與技能會隨機出現｜按 1 / 2 / 3 或點選卡片", width / 2, 174);

  let cardW = 460;
  let cardH = 126;
  let startX = width / 2 - cardW / 2;
  let startY = 225;
  let gapY = 152;

  for (let i = 0; i < 3; i++) {
    let option = upgradeOptions[i];
    if (!option) continue;

    let x = startX;
    let y = startY + i * gapY;

    fill("#1E293B");
    stroke(option.type === "武器" ? "#FDE68A" : "#A8FF78");
    strokeWeight(2);
    rect(x, y, cardW, cardH, 16);

    noStroke();

    // 類型標籤
    fill(option.type === "武器" ? "#FDE68A" : "#A8FF78");
    rect(x + 18, y + 17, 54, 26, 8);
    fill("#111827");
    textAlign(CENTER, CENTER);
    textSize(14);
    text(option.type, x + 45, y + 30);

    // 標題
    fill(option.type === "武器" ? "#FDE68A" : "#A8FF78");
    textAlign(LEFT, CENTER);
    textSize(21);
    text((i + 1) + ". " + option.name, x + 88, y + 31);

    // 說明文字，固定放在框內
    fill(235);
    textAlign(LEFT, TOP);
    textSize(15);
    drawWrappedText(option.desc, x + 30, y + 62, cardW - 60, 21, 3);
  }

  fill(180);
  textAlign(CENTER, CENTER);
  textSize(13);
  text("選完後遊戲會繼續", width / 2, 704);
}

function drawGameOverScreen() {
  drawGridBackground();

  textAlign(CENTER, CENTER);

  if (finalGameResult === "clear") {
    fill("#A8FF78");
    textSize(44);
    text("闖關成功！", width / 2, 110);
  } else {
    fill("#FF6B6B");
    textSize(46);
    text("GAME OVER", width / 2, 110);
  }

  fill(230);
  textSize(16);
  text("模式：" + getGameModeName() + "｜難度：" + getDifficultyName(), width / 2, 155);

  fill(255);
  textSize(22);
  text("本局分數：" + score, width / 2, 205);
  text("存活時間：" + getSurvivalSeconds() + " 秒", width / 2, 240);
  text("擊殺殭屍：" + kills, width / 2, 275);
  text("擊敗 Boss：" + bossKillsThisRun, width / 2, 310);

  fill("#FFE66D");
  textSize(18);
  text("最高分：" + playerStats.highScore + "｜最長存活：" + playerStats.maxSurvival + " 秒", width / 2, 365);

  fill("#A8FF78");
  textSize(18);
  for (let i = 0; i < justUnlockedMessages.length; i++) {
    text(justUnlockedMessages[i], width / 2, 405 + i * 28);
  }

  fill(180);
  textSize(14);
  text("W：武器圖鑑｜Z：殭屍圖鑑", width / 2, 535);

  drawButton(width / 2 - 220, 600, 440, 48, "Enter：再玩一次");
  drawButton(width / 2 - 220, 665, 440, 48, "M：模式 / 難度");
  drawButton(width / 2 - 220, 730, 440, 48, "C：角色選擇");
  drawButton(width / 2 - 220, 795, 440, 42, "B：回首頁");
}

// ============================================================
// 十五、HUD 與畫面小工具
// ============================================================

function getWeaponStatusLines() {
  let weaponLines = [];
  weaponLines.push("子彈 Lv." + player.bulletLevel);
  if (player.auraLevel > 0) weaponLines.push("光環 Lv." + player.auraLevel);
  if (player.bladeLevel > 0) weaponLines.push("旋轉刀 Lv." + player.bladeLevel);
  if (player.bombLevel > 0) weaponLines.push("炸彈 Lv." + player.bombLevel);
  if (player.lifestealLevel > 0) weaponLines.push("吸血 Lv." + player.lifestealLevel);
  return weaponLines;
}

function getWeaponPanelHeight() {
  return 38 + getWeaponStatusLines().length * 21 + 46;
}

function drawHUD() {
  let survival = getSurvivalSeconds();

  // 左上：主要資訊。v17 改成欄位式排版，避免中文字看起來沒對齊。
  fill(0, 0, 0, 155);
  noStroke();
  rect(12, 12, 300, 188, 12);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(15);
  text("HP", 26, 24);
  drawBar(68, 23, 210, 16, player.hp, player.maxHp, "#FF6B6B", true);

  drawHudRow("LV", player.level, 54);
  drawHudRow("EXP", floor(player.exp) + " / " + player.nextExp, 78);
  drawHudRow("分數", score, 102);
  drawHudRow("擊殺", kills, 126);
  drawHudRow("時間", survival + " 秒", 150);

  fill(170);
  textSize(11);
  textAlign(LEFT, TOP);
  text(getGameModeName() + "｜" + getDifficultyName(), 26, 174);

  // 右上：武器資訊
  let weaponLines = getWeaponStatusLines();
  let panelX = 318;
  let panelY = 12;
  let panelW = width - panelX - 12;
  let panelH = getWeaponPanelHeight();

  fill(0, 0, 0, 155);
  rect(panelX, panelY, panelW, panelH, 12);

  fill(255);
  textAlign(LEFT, TOP);
  textSize(14);
  text("武器狀態", panelX + 15, panelY + 12);

  for (let i = 0; i < weaponLines.length; i++) {
    text(weaponLines[i], panelX + 15, panelY + 38 + i * 21);
  }

  let uniqueInfo = getCharacterWeaponInfo();
  fill("#FDE68A");
  textSize(12);
  drawWrappedText("專武：" + uniqueInfo.name, panelX + 15, panelY + 42 + weaponLines.length * 21, panelW - 28, 16, 2);

  if (gameState === "playing") drawPauseButton();
}

function drawHudRow(label, value, y) {
  fill(255);
  textAlign(LEFT, TOP);
  textSize(13);
  text(label, 26, y);
  textAlign(LEFT, TOP);
  text(String(value), 86, y);
}

function getPauseButtonRect() {
  // v14：暫停按鈕會自動放在右上武器資訊欄下方，避免重疊。
  let w = 112;
  let h = 34;
  let x = width - w - 18;
  let y = 12 + getWeaponPanelHeight() + 10;
  return { x, y, w, h };
}

function drawPauseButton() {
  let btn = getPauseButtonRect();

  fill(0, 0, 0, 145);
  stroke("#A8FF78");
  strokeWeight(1.5);
  rect(btn.x, btn.y, btn.w, btn.h, 10);

  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("暫停 P", btn.x + btn.w / 2, btn.y + btn.h / 2);
}

function drawBar(x, y, w, h, value, maxValue, colorValue, showNumber = false) {
  noStroke();
  fill("#444");
  rect(x, y, w, h, 6);

  let ratio = constrain(value / maxValue, 0, 1);
  fill(colorValue);
  rect(x, y, w * ratio, h, 6);

  stroke(255);
  noFill();
  rect(x, y, w, h, 6);

  if (showNumber) {
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(floor(max(0, value)) + " / " + floor(maxValue), x + w / 2, y + h / 2 + 0.5);
  }
}

function drawMiniHpBar(x, y, w, h, value, maxValue, showNumber = false) {
  noStroke();
  fill("#333");
  rect(x, y, w, h, 3);

  fill("#FF6B6B");
  rect(x, y, w * constrain(value / maxValue, 0, 1), h, 3);

  if (showNumber) {
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(10);
    text(floor(max(0, value)) + "/" + floor(maxValue), x + w / 2, y + h / 2);
  }
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
  if (bloodStains.length > MAX_BLOOD_STAINS) {
    bloodStains.splice(0, bloodStains.length - MAX_BLOOD_STAINS);
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

  if (floatingTexts.length > MAX_FLOATING_TEXTS) {
    floatingTexts.splice(0, floatingTexts.length - MAX_FLOATING_TEXTS);
  }
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

  for (let ft of floatingTexts) {
    let alpha = map(ft.life, 0, 70, 0, 255);

    // 黑色陰影，讓紅色傷害、綠色 EXP、黃色分數更清楚
    fill(0, 0, 0, alpha * 0.65);
    noStroke();
    text(ft.txt, ft.x + 1.5, ft.y + 1.5);

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
  if (gameState === "playing") {
    // 遊戲中也允許點擊暫停按鈕；其他地方仍作為搖桿使用。
    let btn = getPauseButtonRect();
    if (isPointInRect(mouseX, mouseY, btn.x, btn.y, btn.w, btn.h)) {
      handlePointerPressed(mouseX, mouseY);
    }
  } else {
    // 使用 mouseX / mouseY，p5 會自動換算成 canvas 座標，
    // 避免手機畫面縮放後點擊位置偏掉。
    handlePointerPressed(mouseX, mouseY);
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

function handleGameKey(rawKey, rawKeyCode) {
  initAudio();

  let key = rawKey || "";
  let keyCode = rawKeyCode || 0;

  if (gameState === "title") {
    if (keyCode === ENTER) resetGame();
    if (key === "m" || key === "M") gameState = "modeSelect";
    if (key === "c" || key === "C") gameState = "character";
    if (key === "w" || key === "W") gameState = "weaponDex";
    if (key === "z" || key === "Z") gameState = "zombieDex";
    if (key === "r" || key === "R") resetSaveData();
  } else if (gameState === "modeSelect") {
    if (keyCode === ENTER) resetGame();
    if (key === "b" || key === "B") gameState = "title";
    if (key === "1") selectedGameMode = "endless";
    if (key === "2") selectedGameMode = "stage";
    if (key === "q" || key === "Q") selectedDifficulty = "easy";
    if (key === "w" || key === "W") selectedDifficulty = "normal";
    if (key === "e" || key === "E") selectedDifficulty = "hard";
    if (key === "r" || key === "R") selectedDifficulty = "extreme";
  } else if (gameState === "character") {
    if (keyCode === ENTER) resetGame();
    if (key === "b" || key === "B") gameState = "title";
    if (key === "w" || key === "W") gameState = "weaponDex";
    if (key === "z" || key === "Z") gameState = "zombieDex";
    let n = int(key);
    if (n >= 1 && n <= characters.length) {
      let c = characters[n - 1];
      if (unlockedCharacters[c.id]) { selectedCharacterId = c.id; saveData(); }
    }
  } else if (gameState === "playing") {
    if (key === "p" || key === "P" || keyCode === ESCAPE) gameState = "paused";
  } else if (gameState === "upgrade") {
    if (key === "1") chooseUpgrade(0);
    if (key === "2") chooseUpgrade(1);
    if (key === "3") chooseUpgrade(2);
    if (keyCode === ENTER) chooseUpgrade(0);
  } else if (gameState === "paused") {
    if (key === "p" || key === "P" || keyCode === ESCAPE || keyCode === ENTER) gameState = "playing";
    if (key === "b" || key === "B") gameState = "title";
  } else if (gameState === "gameover") {
    if (keyCode === ENTER) resetGame();
    if (key === "m" || key === "M") gameState = "modeSelect";
    if (key === "c" || key === "C") gameState = "character";
    if (key === "b" || key === "B") gameState = "title";
    if (key === "w" || key === "W") gameState = "weaponDex";
    if (key === "z" || key === "Z") gameState = "zombieDex";
  } else if (gameState === "weaponDex" || gameState === "zombieDex") {
    if (key === "b" || key === "B") gameState = "title";
    if (key === "c" || key === "C") gameState = "character";
  }
}

function keyPressed() {
  handleGameKey(key, keyCode);
  return false;
}

function setupGlobalKeyboardControls() {
  // 避免重複掛監聽
  if (window.__p5ZombieKeyboardReady) return;
  window.__p5ZombieKeyboardReady = true;

  window.addEventListener("keydown", function (event) {
    // 避免按空白鍵、方向鍵、Enter、ESC 時網頁捲動或瀏覽器預設行為干擾遊戲
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Enter", "Escape"].includes(event.key)) {
      event.preventDefault();
    }

    let mappedKey = event.key;
    let mappedCode = event.keyCode || 0;

    if (event.key === "Escape") mappedCode = ESCAPE;
    if (event.key === "Enter") mappedCode = ENTER;
    if (event.key === "ArrowLeft") mappedCode = LEFT_ARROW;
    if (event.key === "ArrowRight") mappedCode = RIGHT_ARROW;
    if (event.key === "ArrowUp") mappedCode = UP_ARROW;
    if (event.key === "ArrowDown") mappedCode = DOWN_ARROW;

    handleGameKey(mappedKey, mappedCode);
  }, { passive: false });
}

function mousePressed() {
  handlePointerPressed(mouseX, mouseY);
}

function handlePointerPressed(px, py) {
  initAudio();
  if (gameState === "playing") {
    let btn = getPauseButtonRect();
    if (isPointInRect(px, py, btn.x, btn.y, btn.w, btn.h)) {
      gameState = "paused";
      return;
    }
  }

  if (gameState === "paused") {
    if (isPointInRect(px, py, width / 2 - 210, 740, 420, 48)) {
      gameState = "playing";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 210, 805, 420, 42)) {
      gameState = "title";
      return;
    }
  }

  if (gameState === "title") {
    // 點擊開始遊戲
    if (isPointInRect(px, py, width / 2 - 140, 300, 280, 52)) {
      resetGame();
      return;
    }

    // 點擊模式 / 難度
    if (isPointInRect(px, py, width / 2 - 140, 365, 280, 52)) {
      gameState = "modeSelect";
      return;
    }

    // 點擊選擇角色
    if (isPointInRect(px, py, width / 2 - 140, 430, 280, 52)) {
      gameState = "character";
      return;
    }

    // 點擊武器圖鑑
    if (isPointInRect(px, py, width / 2 - 140, 495, 280, 52)) {
      gameState = "weaponDex";
      return;
    }

    // 點擊殭屍圖鑑
    if (isPointInRect(px, py, width / 2 - 140, 560, 280, 52)) {
      gameState = "zombieDex";
      return;
    }
  }

  if (gameState === "modeSelect") {
    if (isPointInRect(px, py, 55, 175, 230, 130)) {
      selectedGameMode = "endless";
      return;
    }

    if (isPointInRect(px, py, 315, 175, 230, 130)) {
      selectedGameMode = "stage";
      return;
    }

    if (isPointInRect(px, py, 55, 395, 230, 58)) {
      selectedDifficulty = "easy";
      return;
    }

    if (isPointInRect(px, py, 315, 395, 230, 58)) {
      selectedDifficulty = "normal";
      return;
    }

    if (isPointInRect(px, py, 55, 470, 230, 58)) {
      selectedDifficulty = "hard";
      return;
    }

    if (isPointInRect(px, py, 315, 470, 230, 58)) {
      selectedDifficulty = "extreme";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 180, 630, 360, 52)) {
      resetGame();
      return;
    }

    if (isPointInRect(px, py, width / 2 - 180, 700, 360, 46)) {
      gameState = "title";
      return;
    }
  }

  if (gameState === "character") {
    // 點擊角色卡片
    let cardW = 500;
    let cardH = 126;
    let startX = width / 2 - cardW / 2;
    let startY = 100;
    let gapY = 142;

    for (let i = 0; i < characters.length; i++) {
      let c = characters[i];
      let x = startX;
      let y = startY + i * gapY;

      if (isPointInRect(px, py, x, y, cardW, cardH)) {
        if (unlockedCharacters[c.id]) {
          selectedCharacterId = c.id;
          saveData();
        }
        return;
      }
    }

    // 選角頁底部按鈕
    if (isPointInRect(px, py, width / 2 - 240, 720, 150, 42)) {
      gameState = "title";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 75, 720, 150, 42)) {
      resetGame();
      return;
    }

    if (isPointInRect(px, py, width / 2 + 90, 720, 150, 42)) {
      gameState = "weaponDex";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 75, 772, 150, 38)) {
      gameState = "zombieDex";
      return;
    }
  }

  if (gameState === "upgrade") {
    let cardW = 460;
    let cardH = 126;
    let startX = width / 2 - cardW / 2;
    let startY = 225;
    let gapY = 152;

    for (let i = 0; i < 3; i++) {
      let x = startX;
      let y = startY + i * gapY;

      if (isPointInRect(px, py, x, y, cardW, cardH)) {
        chooseUpgrade(i);
      }
    }
  }

  if (gameState === "gameover") {
    // 點擊再玩一次
    if (isPointInRect(px, py, width / 2 - 220, 600, 440, 48)) {
      resetGame();
      return;
    }

    if (isPointInRect(px, py, width / 2 - 220, 665, 440, 48)) {
      gameState = "modeSelect";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 220, 730, 440, 48)) {
      gameState = "character";
      return;
    }

    if (isPointInRect(px, py, width / 2 - 220, 795, 440, 42)) {
      gameState = "title";
      return;
    }
  }

  if (gameState === "weaponDex") {
    if (isPointInRect(px, py, width / 2 - 120, 792, 240, 42)) {
      gameState = "title";
      return;
    }
  }

  if (gameState === "zombieDex") {
    if (isPointInRect(px, py, width / 2 - 120, 820, 240, 42)) {
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
  if (gameState === "title" || gameState === "modeSelect" || gameState === "character" || gameState === "weaponDex" || gameState === "zombieDex") return 0;
  if (gameState === "gameover") return finalSurvivalSeconds;
  return floor((millis() - startTime) / 1000);
}
