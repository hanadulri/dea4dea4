// Core Game & Physics Engine for Poop Fortress (Lush Meadow & 50-Stage Progression)
class FortressEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Minimap Canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Stage State (1 to 50)
    this.maxStages = 50;
    this.stage = this.loadStageProgress();
    this.wind = 0; // -3.5 to +3.5 m/s
    this.worldWidth = 2600; // Wide panoramic world map
    this.terrainType = 0; // 0 to 4 archetypes

    // Camera State (Horizontal & Vertical tracking)
    this.cameraX = 0;
    this.cameraTargetX = 0;
    this.cameraY = 0;
    this.cameraTargetY = 0;

    // Target Dummy State
    this.target = {
      name: '김현서',
      x: 1200,
      y: 400,
      maxHp: 100,
      currentHp: 100,
      width: 60,
      height: 90,
      hitState: 0
    };

    // Cannon State
    this.cannon = {
      x: 180,
      y: 450,
      barrelLength: 45,
      angle: 45, // degrees
      angleSpeed: 0.85,
      dir: 1,
      minAngle: 15,
      maxAngle: 85
    };

    // Power Gauge State
    this.power = 0; // 0 to 100
    this.powerSpeed = 1.15;
    this.powerDir = 1;

    // Firing States: 'AIMING' -> 'CHARGING' -> 'FLYING' -> 'EXPLODING'
    this.gameState = 'AIMING';

    // Active Projectile & Dynamic Effects
    this.projectile = null;
    this.particles = [];
    this.damageTexts = [];

    // Terrain data & foliage
    this.terrainHeights = [];
    this.foliageList = []; // Wildflowers & grass tufts
    this.clouds = [];
    this.initClouds();

    this.isRunning = false;

    // Initialization
    this.resizeCanvas();
    this.bindEvents();
    this.initStage(this.stage);
    this.startLoop();
  }

  loadStageProgress() {
    try {
      const saved = localStorage.getItem('poop_fortress_stage_save');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 1 && val <= 50) {
          return val;
        }
      }
    } catch (e) {}
    return 1;
  }

  saveStageProgress(stageNum) {
    try {
      localStorage.setItem('poop_fortress_stage_save', Math.min(50, stageNum).toString());
    } catch (e) {}
  }

  initClouds() {
    this.clouds = [
      { x: 200, y: 70, scale: 1.1, speed: 0.25 },
      { x: 650, y: 110, scale: 0.8, speed: 0.18 },
      { x: 1150, y: 60, scale: 1.3, speed: 0.3 },
      { x: 1700, y: 95, scale: 0.9, speed: 0.2 },
      { x: 2200, y: 75, scale: 1.2, speed: 0.28 }
    ];
  }

  getContainerDimensions() {
    const wrapper = this.canvas.parentElement;
    let w = wrapper ? wrapper.clientWidth : 0;
    let h = wrapper ? wrapper.clientHeight : 0;

    if (w <= 0 || h <= 0) {
      const app = document.getElementById('app-container');
      w = app ? app.clientWidth : window.innerWidth;
      h = (app ? app.clientHeight : window.innerHeight) - 64;
    }
    if (w <= 0) w = window.innerWidth || 800;
    if (h <= 0) h = (window.innerHeight || 600) - 64;

    return { width: Math.max(320, w), height: Math.max(240, h) };
  }

  resizeCanvas() {
    const dims = this.getContainerDimensions();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.displayWidth = dims.width;
    this.displayHeight = dims.height;

    this.canvas.width = dims.width * dpr;
    this.canvas.height = dims.height * dpr;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    if (this.terrainHeights.length === 0 || this.terrainHeights.length < this.worldWidth) {
      this.generateTerrain();
    }
  }

  initStage(stageNum) {
    this.stage = Math.min(this.maxStages, Math.max(1, stageNum));
    this.saveStageProgress(this.stage);

    const stageBadge = document.getElementById('hud-stage-num');
    if (stageBadge) stageBadge.textContent = `${this.stage} / 50`;

    const menuStartLabel = document.getElementById('btn-start-label');
    if (menuStartLabel) menuStartLabel.textContent = `게임 시작 (${this.stage} / 50)`;

    // Random Wind: -3.5 to +3.5 m/s
    const rawWind = (Math.random() * 7.0 - 3.5).toFixed(1);
    this.wind = parseFloat(rawWind);
    this.updateWindUI();

    const dims = this.getContainerDimensions();
    this.displayWidth = dims.width;
    this.displayHeight = dims.height;

    // Pick terrain archetype (0: Rolling Plains, 1: Twin Peaks, 2: Plateau, 3: Steppes, 4: Basin & Cliff)
    this.terrainType = (this.stage - 1) % 5;

    // Cannon position
    this.cannon.x = 180;
    this.generateTerrain();

    // Mathematically calculate safe, guaranteed reachable zone
    const maxReachableX = this.calculateMaxReachableX();
    const safeMaxX = Math.max(this.cannon.x + 550, Math.floor(maxReachableX - 160));
    const safeMinX = Math.max(this.cannon.x + 400, Math.min(safeMaxX - 150, Math.floor(this.displayWidth * 0.65)));

    const targetX = Math.floor(safeMinX + Math.random() * Math.max(100, safeMaxX - safeMinX));
    const groundY = this.getTerrainY(targetX);

    // Target Name: "김현서" or "박수홍"
    const names = ['김현서', '박수홍'];
    const selectedName = names[Math.floor(Math.random() * names.length)];

    // Target HP scales with stage (from 90 up to ~750)
    const baseHp = 90 + (this.stage - 1) * 14;

    this.target = {
      name: selectedName,
      x: targetX,
      y: groundY - 80,
      maxHp: baseHp,
      currentHp: baseHp,
      width: 60,
      height: 90,
      hitState: 0
    };

    // Camera reset
    this.cameraX = Math.max(0, this.cannon.x - 140);
    this.cameraTargetX = this.cameraX;
    this.cameraY = 0;
    this.cameraTargetY = 0;

    this.updateTargetHUD();
    this.gameState = 'AIMING';
    this.cannon.angle = 45;
    this.cannon.dir = 1;
    this.power = 0;
    this.powerDir = 1;
    this.projectile = null;
    this.particles = [];
    this.damageTexts = [];
    this.updateControlsUI();
  }

  // Guaranteed Reachability Simulation
  calculateMaxReachableX() {
    let simX = this.cannon.x + Math.cos(45 * Math.PI / 180) * this.cannon.barrelLength;
    let simY = this.cannon.y - Math.sin(45 * Math.PI / 180) * this.cannon.barrelLength;
    const power = 100 * 0.18; // Max power test
    let vx = Math.cos(45 * Math.PI / 180) * power;
    let vy = -Math.sin(45 * Math.PI / 180) * power;
    const windRes = window.shopManager ? window.shopManager.getWindFactor() : 1.0;
    const ax = (this.wind * 0.006) * windRes;

    for (let i = 0; i < 450; i++) {
      if (vx + ax < 0.9) vx = Math.max(0.9, vx * 0.99);
      else vx += ax;
      vy += 0.12;
      simX += vx;
      simY += vy;
      if (simX >= this.worldWidth) break;
      if (i > 15 && simY >= this.getTerrainY(simX)) {
        return simX;
      }
    }
    return Math.min(this.worldWidth - 250, simX);
  }

  generateTerrain() {
    const width = this.worldWidth;
    const height = this.displayHeight || 500;
    this.terrainHeights = new Array(width + 20).fill(0);
    const baseHeight = height - 130;

    // Seed offset per stage for unique procedural topography
    const seedOffset = (this.stage * 173.31) % 1000;

    // 5 Distinct Terrain Archetypes
    for (let x = 0; x < width + 20; x++) {
      let h = baseHeight;

      if (this.terrainType === 0) {
        // Archetype 0: 완만한 구릉 초원 (Rolling Green Plains)
        h += Math.sin((x + seedOffset) * 0.0025) * 45 + Math.cos(x * 0.007) * 20;
      } else if (this.terrainType === 1) {
        // Archetype 1: 쌍봉우리와 계곡 (Twin Peaks & Deep Meadow Basin)
        const centerDist = Math.abs(x - width * 0.5);
        h += Math.sin((x + seedOffset) * 0.004) * 55 + (centerDist < 400 ? 35 : -25);
      } else if (this.terrainType === 2) {
        // Archetype 2: 계단식 고원 능선 (Stepped Plateau Ridge)
        const step = Math.floor(x / 450) % 2 === 0 ? -30 : 25;
        h += step + Math.sin(x * 0.003) * 35;
      } else if (this.terrainType === 3) {
        // Archetype 3: 물결치는 스텝 둔덕 (Wavy Steppe Mounds)
        h += Math.sin(x * 0.005 + seedOffset) * 38 + Math.sin(x * 0.012) * 18;
      } else {
        // Archetype 4: 분화구 평원과 절벽 (Crater Basin & Cliff)
        const basin = Math.sin((x - 800) * 0.0018) * 60;
        h += basin + Math.cos(x * 0.008) * 22;
      }

      // Guarantee smooth launch zone around cannon so fire line is 100% unobstructed
      if (x < this.cannon.x + 160) {
        h = Math.max(h, baseHeight - 10);
        if (x < this.cannon.x + 80) {
          h = baseHeight + 10;
        }
      }

      this.terrainHeights[x] = h;
    }

    this.cannon.y = this.getTerrainY(this.cannon.x) - 15;
    if (this.target) {
      this.target.y = this.getTerrainY(this.target.x) - 80;
    }

    // Generate decorative foliage (wildflowers & grass blades) along the green ridge
    this.generateFoliage();
  }

  generateFoliage() {
    this.foliageList = [];
    const flowerColors = ['#ffffff', '#fde047', '#f472b6', '#a78bfa', '#fb923c'];

    for (let x = 80; x < this.worldWidth; x += Math.floor(25 + Math.random() * 35)) {
      const groundY = this.getTerrainY(x);
      const isFlower = Math.random() < 0.45;
      this.foliageList.push({
        x: x,
        y: groundY,
        isFlower: isFlower,
        color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
        size: isFlower ? 3.5 + Math.random() * 2 : 5 + Math.random() * 3
      });
    }
  }

  getTerrainY(x) {
    if (!this.terrainHeights || this.terrainHeights.length === 0) {
      return (this.displayHeight || 500) - 130;
    }
    const idx = Math.max(0, Math.min(Math.floor(x), this.terrainHeights.length - 1));
    return this.terrainHeights[idx] || ((this.displayHeight || 500) - 130);
  }

  updateWindUI() {
    const windArrow = document.getElementById('wind-arrow');
    const windText = document.getElementById('wind-text');
    if (windArrow && windText) {
      const absWind = Math.abs(this.wind);
      const dirText = this.wind > 0 ? '▶' : this.wind < 0 ? '◀' : '•';
      windArrow.style.transform = `rotate(${this.wind > 0 ? 0 : 180}deg)`;
      windText.textContent = `${dirText} ${absWind.toFixed(1)} m/s`;
    }
  }

  updateTargetHUD() {
    const nameEl = document.getElementById('target-name-display');
    const hpFill = document.getElementById('target-hp-fill');
    const distBadge = document.getElementById('target-distance-badge');
    const minimapDist = document.getElementById('minimap-dist-text');

    const distMeters = Math.round(this.target.x - this.cannon.x);

    if (nameEl) nameEl.textContent = `🎯 ${this.target.name}`;
    if (distBadge) distBadge.textContent = `거리 ${distMeters}m`;
    if (minimapDist) minimapDist.textContent = `거리 ${distMeters}m`;

    if (hpFill) {
      const pct = Math.max(0, (this.target.currentHp / this.target.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
    }
  }

  bindEvents() {
    const fireBtn = document.getElementById('btn-fire');

    const handleAction = (e) => {
      if (e) e.preventDefault();
      if (window.audioEngine) window.audioEngine.init();
      this.handleActionClick();
    };

    if (fireBtn) {
      fireBtn.addEventListener('pointerdown', handleAction);
    }

    this.canvas.addEventListener('pointerdown', (e) => {
      if (window.audioEngine) window.audioEngine.init();
      handleAction(e);
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleAction();
      }
      if (this.gameState === 'AIMING') {
        if (e.code === 'ArrowUp') {
          this.cannon.angle = Math.min(this.cannon.maxAngle, this.cannon.angle + 2);
        } else if (e.code === 'ArrowDown') {
          this.cannon.angle = Math.max(this.cannon.minAngle, this.cannon.angle - 2);
        }
      }
    });

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  handleActionClick() {
    if (this.gameState === 'AIMING') {
      this.gameState = 'CHARGING';
      this.power = 0;
      this.powerDir = 1;
      if (window.audioEngine) window.audioEngine.playClick();
      this.updateControlsUI();
    } else if (this.gameState === 'CHARGING') {
      this.gameState = 'FLYING';
      this.fireProjectile();
      this.updateControlsUI();
    }
  }

  fireProjectile() {
    const weapon = window.shopManager ? window.shopManager.getEquippedPoop() : {
      id: 'classic', color: '#8B4513', damage: 30, radius: 25
    };

    if (window.profileManager) window.profileManager.recordShot();
    if (window.audioEngine) window.audioEngine.playShoot();

    const rad = (this.cannon.angle * Math.PI) / 180;
    const powerScale = 0.18;
    const totalPower = Math.max(12, this.power) * powerScale;

    const windResistance = window.shopManager ? window.shopManager.getWindFactor() : 1.0;
    const netWindAcc = (this.wind * 0.006) * windResistance;

    const startX = this.cannon.x + Math.cos(rad) * this.cannon.barrelLength;
    const startY = this.cannon.y - Math.sin(rad) * this.cannon.barrelLength;

    this.projectile = {
      x: startX,
      y: startY,
      vx: Math.cos(rad) * totalPower,
      vy: -Math.sin(rad) * totalPower,
      ax: netWindAcc,
      gravity: 0.12,
      weapon: weapon,
      trail: []
    };

    // Immediate camera focus on launch
    this.cameraTargetX = Math.max(0, Math.min(this.worldWidth - this.displayWidth, startX - this.displayWidth * 0.35));
    this.cameraX = this.cameraTargetX;
    this.cameraY = 0;
    this.cameraTargetY = 0;
  }

  updateControlsUI() {
    const stepStatus = document.getElementById('control-step-status');
    const fireBtn = document.getElementById('btn-fire');

    if (!stepStatus || !fireBtn) return;

    if (this.gameState === 'AIMING') {
      stepStatus.textContent = '발사각 조절 중...';
      stepStatus.style.color = '#60a5fa';
      fireBtn.textContent = '각도 확정 🎯';
      fireBtn.className = 'btn-fire aiming';
    } else if (this.gameState === 'CHARGING') {
      stepStatus.textContent = '파워 조절 중...';
      stepStatus.style.color = '#fde047';
      fireBtn.textContent = '발사!! 💥';
      fireBtn.className = 'btn-fire charging';
    } else {
      stepStatus.textContent = '발사 완료!';
      stepStatus.style.color = '#f87171';
      fireBtn.textContent = '비행 중... 🚀';
      fireBtn.className = 'btn-fire';
    }
  }

  update() {
    // 1. Angle sweep
    if (this.gameState === 'AIMING') {
      if (isNaN(this.cannon.angle)) this.cannon.angle = 45;
      if (!this.cannon.dir) this.cannon.dir = 1;

      this.cannon.angle += this.cannon.angleSpeed * this.cannon.dir;
      if (this.cannon.angle >= this.cannon.maxAngle) {
        this.cannon.angle = this.cannon.maxAngle;
        this.cannon.dir = -1;
      } else if (this.cannon.angle <= this.cannon.minAngle) {
        this.cannon.angle = this.cannon.minAngle;
        this.cannon.dir = 1;
      }
    }

    // 2. Power sweep
    if (this.gameState === 'CHARGING') {
      if (!this.powerDir) this.powerDir = 1;
      this.power += this.powerSpeed * this.powerDir;
      if (this.power >= 100) {
        this.power = 100;
        this.powerDir = -1;
      } else if (this.power <= 0) {
        this.power = 0;
        this.powerDir = 1;
      }
      const fillEl = document.getElementById('power-meter-fill');
      const markerEl = document.getElementById('power-meter-marker');
      if (fillEl) fillEl.style.width = `${this.power}%`;
      if (markerEl) markerEl.style.left = `${this.power}%`;
    }

    // Drifting clouds in sky
    this.clouds.forEach(c => {
      c.x += c.speed;
      if (c.x > this.worldWidth + 200) c.x = -200;
    });

    // 3. Projectile physics & Camera Follow
    if (this.gameState === 'FLYING' && this.projectile) {
      const p = this.projectile;

      if (p.vx + p.ax < 0.9) {
        p.vx = Math.max(0.9, p.vx * 0.99);
      } else {
        p.vx += p.ax;
      }

      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      p.trail.push({ x: p.x, y: p.y, alpha: 1.0 });
      if (p.trail.length > 8) p.trail.shift();

      this.addSmokeParticle(p.x, p.y, p.weapon.color);

      // Camera horizontal follow
      this.cameraTargetX = Math.max(0, Math.min(this.worldWidth - this.displayWidth, p.x - this.displayWidth * 0.48));

      // Camera vertical follow if high in sky
      if (p.y < 100) {
        this.cameraTargetY = Math.max(0, 100 - p.y);
      } else {
        this.cameraTargetY = 0;
      }

      this.cameraX += (this.cameraTargetX - this.cameraX) * 0.22;
      this.cameraY += (this.cameraTargetY - this.cameraY) * 0.18;

      // Collision with Target Dummy
      const tgt = this.target;
      const hitBoxPadding = 20;
      if (
        p.x >= tgt.x - hitBoxPadding &&
        p.x <= tgt.x + tgt.width + hitBoxPadding &&
        p.y >= tgt.y - hitBoxPadding &&
        p.y <= tgt.y + tgt.height + hitBoxPadding
      ) {
        this.triggerExplosion(p.x, p.y, true);
        return;
      }

      // Collision with Ground Terrain
      const groundY = this.getTerrainY(p.x);
      if (p.y >= groundY || p.x > this.worldWidth + 100 || p.x < -100) {
        this.triggerExplosion(p.x, p.y, false);
        return;
      }
    } else {
      if (this.gameState !== 'EXPLODING') {
        this.cameraTargetX = Math.max(0, Math.min(this.worldWidth - this.displayWidth, this.cannon.x - 140));
        this.cameraTargetY = 0;
      }
      this.cameraX += (this.cameraTargetX - this.cameraX) * 0.10;
      this.cameraY += (this.cameraTargetY - this.cameraY) * 0.12;
    }

    // 4. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += pt.gravity || 0.1;
      pt.alpha -= pt.decay || 0.028;
      if (pt.alpha <= 0) this.particles.splice(i, 1);
    }

    // 5. Update damage floating texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      const dt = this.damageTexts[i];
      dt.y -= 1.2;
      dt.alpha -= 0.018;
      if (dt.alpha <= 0) this.damageTexts.splice(i, 1);
    }

    if (this.target.hitState > 0) {
      this.target.hitState--;
    }
  }

  triggerExplosion(x, y, hitTarget) {
    const weapon = this.projectile ? this.projectile.weapon : { color: '#8B4513', damage: 30, radius: 25 };
    const isBig = weapon.id === 'cosmic' || weapon.id === 'rainbow';

    this.projectile = null;

    if (window.audioEngine) window.audioEngine.playExplosion(isBig);

    const count = isBig ? 45 : 25;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5.5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        color: weapon.color || '#8B4513',
        size: 3 + Math.random() * 6,
        alpha: 1.0,
        decay: 0.035 + Math.random() * 0.02,
        gravity: 0.22
      });
    }

    if (hitTarget) {
      let baseDmg = weapon.damage || 30;
      const mult = window.shopManager ? window.shopManager.getDamageMultiplier() : 1.0;
      let finalDamage = Math.floor(baseDmg * mult);

      const critChance = window.shopManager ? window.shopManager.getCritChance() : 0.0;
      const isCrit = Math.random() < critChance;
      if (isCrit) {
        finalDamage = Math.floor(finalDamage * 1.8);
      }

      this.target.currentHp -= finalDamage;
      this.target.hitState = 25;

      if (window.audioEngine) window.audioEngine.playHit();
      if (window.profileManager) window.profileManager.recordHit(finalDamage);

      this.damageTexts.push({
        text: isCrit ? `💥 CRITICAL -${finalDamage}!` : `-${finalDamage}`,
        x: this.target.x + 30,
        y: this.target.y - 20,
        color: isCrit ? '#fde047' : '#ef4444',
        size: isCrit ? 26 : 20,
        alpha: 1.0
      });

      this.updateTargetHUD();

      if (this.target.currentHp <= 0) {
        this.target.currentHp = 0;
        this.updateTargetHUD();
        setTimeout(() => this.onStageVictory(), 600);
      } else {
        setTimeout(() => {
          this.gameState = 'AIMING';
          this.updateControlsUI();
        }, 900);
      }
    } else {
      this.damageTexts.push({
        text: '빗나감! 💦',
        x: x,
        y: y - 25,
        color: '#94a3b8',
        size: 18,
        alpha: 1.0
      });

      setTimeout(() => {
        this.gameState = 'AIMING';
        this.updateControlsUI();
      }, 900);
    }

    this.gameState = 'EXPLODING';
  }

  onStageVictory() {
    if (window.audioEngine) window.audioEngine.playVictory();

    const baseReward = 200 + this.stage * 80;
    const upgradeGoldMult = window.shopManager ? window.shopManager.getGoldMultiplier() : 1.0;
    const totalReward = Math.floor(baseReward * upgradeGoldMult);

    if (window.shopManager) window.shopManager.addGold(totalReward);
    if (window.profileManager) window.profileManager.recordStageClear(this.stage, totalReward);

    const rewardDisplay = document.getElementById('victory-reward-amount');
    if (rewardDisplay) rewardDisplay.textContent = `+${totalReward} G`;

    const victoryIcon = document.getElementById('victory-icon');
    const victoryTitle = document.getElementById('victory-title');
    const victoryDesc = document.getElementById('victory-desc');
    const nextBtn = document.getElementById('btn-next-stage');

    if (this.stage >= this.maxStages) {
      // 50-Stage Finale!
      if (victoryIcon) victoryIcon.textContent = '🏆';
      if (victoryTitle) victoryTitle.textContent = '축! 50단계 최종 올클리어!';
      if (victoryDesc) victoryDesc.textContent = '모든 50단계 허수아비를 쓰러뜨리고 진정한 똥트리스 마스터가 되었습니다!';
      if (nextBtn) nextBtn.textContent = '1단계부터 새 게임 시작 🔄';
    } else {
      if (victoryIcon) victoryIcon.textContent = '🎉';
      if (victoryTitle) victoryTitle.textContent = `STAGE ${this.stage} CLEAR!`;
      if (victoryDesc) victoryDesc.textContent = `허수아비 ${this.target.name}을(를) 통쾌하게 물리쳤습니다!`;
      if (nextBtn) nextBtn.textContent = `다음 단계 (Stage ${this.stage + 1} / 50) ▶`;
    }

    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal) victoryModal.classList.add('active');
  }

  nextStage() {
    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal) victoryModal.classList.remove('active');

    if (this.stage >= this.maxStages) {
      this.initStage(1);
    } else {
      this.initStage(this.stage + 1);
    }
  }

  addSmokeParticle(x, y, color) {
    this.particles.push({
      x: x + (Math.random() * 6 - 3),
      y: y + (Math.random() * 6 - 3),
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      color: color || '#94a3b8',
      size: 3 + Math.random() * 4,
      alpha: 0.6,
      decay: 0.05,
      gravity: -0.05
    });
  }

  render() {
    const width = this.displayWidth || 800;
    const height = this.displayHeight || 500;
    const camX = Math.round(this.cameraX);
    const camY = Math.round(this.cameraY || 0);

    this.ctx.clearRect(0, 0, width, height);

    // 1. Lush Green Pasture Sky (Azure Blue to Golden Horizon)
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#0284c7');
    skyGradient.addColorStop(0.55, '#38bdf8');
    skyGradient.addColorStop(0.85, '#bae6fd');
    skyGradient.addColorStop(1, '#fef08a');
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, width, height);

    // Golden Sun
    const sunX = (width - 110) - (camX * 0.05);
    const sunGrad = this.ctx.createRadialGradient(sunX, 65 + camY * 0.1, 10, sunX, 65 + camY * 0.1, 45);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.3, '#fde047');
    sunGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    this.ctx.fillStyle = sunGrad;
    this.ctx.beginPath();
    this.ctx.arc(sunX, 65 + camY * 0.1, 45, 0, Math.PI * 2);
    this.ctx.fill();

    // Drifting Fluffy White Clouds
    this.drawClouds(camX, camY);

    // 2. Distant Green Hills (Parallax background mountains)
    this.drawDistantHills(camX, camY, width, height);

    // 3. Main Lush Meadow Ground
    this.ctx.save();
    this.ctx.translate(-camX, camY);

    this.ctx.beginPath();
    this.ctx.moveTo(camX - 50, height - camY + 200);
    for (let x = Math.max(0, camX - 50); x <= Math.min(this.worldWidth, camX + width + 50); x += 4) {
      this.ctx.lineTo(x, this.terrainHeights[x] || (height - 130));
    }
    this.ctx.lineTo(camX + width + 50, height - camY + 200);
    this.ctx.closePath();

    // Lush Emerald Grass to Fertile Earth Gradient
    const groundGrad = this.ctx.createLinearGradient(0, height - 190, 0, height + 250);
    groundGrad.addColorStop(0, '#16a34a'); // Fresh Emerald Green
    groundGrad.addColorStop(0.12, '#15803d'); // Deep Lush Meadow
    groundGrad.addColorStop(0.38, '#4d7c0f'); // Forest Moss
    groundGrad.addColorStop(0.68, '#78350f'); // Warm Brown Soil
    groundGrad.addColorStop(1, '#451a03'); // Deep Earth
    this.ctx.fillStyle = groundGrad;
    this.ctx.fill();

    // Glowing Grass Edge Highlight
    this.ctx.strokeStyle = '#4ade80';
    this.ctx.lineWidth = 4;
    this.ctx.stroke();

    // 4. Draw Wildflowers & Foliage on Terrain
    this.drawFoliage(camX, width);

    // 5. Cannon
    this.drawCannon();

    // 6. Target Dummy Scarecrow ("김현서" / "박수홍")
    this.drawTargetScarecrow();

    // 7. Trajectory Guide Line
    if (this.gameState === 'AIMING' || this.gameState === 'CHARGING') {
      this.drawTrajectoryGuide();
    }

    // 8. Projectile & Rotating Poop with High Visibility
    if (this.projectile) {
      const p = this.projectile;
      p.trail.forEach(t => {
        this.ctx.fillStyle = p.weapon.color;
        this.ctx.globalAlpha = t.alpha * 0.45;
        this.ctx.beginPath();
        this.ctx.arc(t.x, t.y, 4.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      });

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      const flightAngle = Math.atan2(p.vy, p.vx);
      this.ctx.rotate(flightAngle);
      this.ctx.font = '28px serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(p.weapon.icon || '💩', 0, 0);
      this.ctx.restore();
    }

    // 9. Particles
    this.particles.forEach(pt => {
      this.ctx.fillStyle = pt.color;
      this.ctx.globalAlpha = pt.alpha;
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    });

    // 10. Floating Damage Text
    this.damageTexts.forEach(dt => {
      this.ctx.font = `900 ${dt.size}px Jua, sans-serif`;
      this.ctx.fillStyle = dt.color;
      this.ctx.globalAlpha = dt.alpha;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(dt.text, dt.x, dt.y);
      this.ctx.globalAlpha = 1.0;
    });

    this.ctx.restore();

    // 11. Render Minimap
    this.renderMinimap();
  }

  drawClouds(camX, camY) {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.clouds.forEach(c => {
      const screenX = c.x - (camX * 0.15);
      const screenY = c.y + (camY * 0.1);
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, 18 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(screenX + 16 * c.scale, screenY - 8 * c.scale, 22 * c.scale, 0, Math.PI * 2);
      this.ctx.arc(screenX + 36 * c.scale, screenY, 18 * c.scale, 0, Math.PI * 2);
      this.ctx.closePath();
      this.ctx.fill();
    });
  }

  drawDistantHills(camX, camY, width, height) {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(34, 197, 94, 0.25)'; // Soft pastel mountain green
    this.ctx.beginPath();
    this.ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 15) {
      const worldX = x + camX * 0.25;
      const h = (height - 180) + Math.sin(worldX * 0.002) * 50 + Math.cos(worldX * 0.005) * 25 + camY * 0.2;
      this.ctx.lineTo(x, h);
    }
    this.ctx.lineTo(width, height);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  drawFoliage(camX, width) {
    const minX = camX - 30;
    const maxX = camX + width + 30;

    this.foliageList.forEach(f => {
      if (f.x >= minX && f.x <= maxX) {
        if (f.isFlower) {
          // Cute Little Wildflower
          this.ctx.fillStyle = f.color;
          this.ctx.beginPath();
          this.ctx.arc(f.x, f.y - 2, f.size, 0, Math.PI * 2);
          this.ctx.fill();

          // Flower center
          this.ctx.fillStyle = '#fde047';
          this.ctx.beginPath();
          this.ctx.arc(f.x, f.y - 2, f.size * 0.45, 0, Math.PI * 2);
          this.ctx.fill();
        } else {
          // Grass Blade Tufts
          this.ctx.strokeStyle = '#86efac';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.moveTo(f.x, f.y);
          this.ctx.lineTo(f.x - 3, f.y - f.size);
          this.ctx.moveTo(f.x, f.y);
          this.ctx.lineTo(f.x + 3, f.y - f.size * 0.9);
          this.ctx.stroke();
        }
      }
    });
  }

  drawCannon() {
    const c = this.cannon;
    const rad = ((c.angle || 45) * Math.PI) / 180;

    this.ctx.save();
    this.ctx.translate(c.x, c.y);

    // Barrel
    this.ctx.rotate(-rad);
    const barrelGrad = this.ctx.createLinearGradient(0, -9, c.barrelLength, 9);
    barrelGrad.addColorStop(0, '#334155');
    barrelGrad.addColorStop(1, '#94a3b8');
    this.ctx.fillStyle = barrelGrad;
    this.ctx.fillRect(0, -9, c.barrelLength, 18);
    this.ctx.strokeStyle = '#0f172a';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, -9, c.barrelLength, 18);

    this.ctx.restore();

    // Wheel
    this.ctx.fillStyle = '#f97316';
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2.5;
    this.ctx.stroke();

    // Hub
    this.ctx.fillStyle = '#0f172a';
    this.ctx.beginPath();
    this.ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
    this.ctx.fill();

    // Angle text
    this.ctx.font = '15px Jua, sans-serif';
    this.ctx.fillStyle = '#fbbf24';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.round(c.angle || 45)}°`, c.x, c.y - 28);
  }

  drawTargetScarecrow() {
    const t = this.target;
    this.ctx.save();
    this.ctx.translate(t.x, t.y);

    if (t.hitState > 0) {
      this.ctx.rotate((Math.random() - 0.5) * 0.15);
    }

    // Wooden Post
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(25, 30, 10, 60);
    this.ctx.fillRect(5, 45, 50, 8);

    // Straw Body
    this.ctx.fillStyle = '#eab308';
    this.ctx.beginPath();
    this.ctx.arc(30, 45, 18, 0, Math.PI * 2);
    this.ctx.fill();

    // Head
    this.ctx.fillStyle = t.hitState > 0 ? '#ef4444' : '#fde047';
    this.ctx.beginPath();
    this.ctx.arc(30, 20, 16, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Expression
    this.ctx.fillStyle = '#0f172a';
    if (t.hitState > 0) {
      this.ctx.font = '14px sans-serif';
      this.ctx.fillText('😵', 22, 25);
    } else {
      this.ctx.beginPath();
      this.ctx.arc(24, 18, 2.5, 0, Math.PI * 2);
      this.ctx.arc(36, 18, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.beginPath();
      this.ctx.arc(30, 23, 5, 0, Math.PI);
      this.ctx.stroke();
    }

    // Straw Hat
    this.ctx.fillStyle = '#d97706';
    this.ctx.fillRect(12, 4, 36, 6);
    this.ctx.fillRect(20, -4, 20, 8);

    // Sign Board with Name: "김현서" or "박수홍"
    this.ctx.fillStyle = '#b45309';
    this.ctx.fillRect(2, 60, 56, 22);
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(2, 60, 56, 22);

    // Name Text
    this.ctx.font = '900 14px Jua, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(t.name, 30, 76);

    // Floating HP Bar
    const barWidth = 66;
    const barHeight = 7;
    const barX = -3;
    const barY = -20;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    const pct = Math.max(0, t.currentHp / t.maxHp);
    this.ctx.fillStyle = pct > 0.5 ? '#10b981' : pct > 0.25 ? '#fbbf24' : '#ef4444';
    this.ctx.fillRect(barX, barY, barWidth * pct, barHeight);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    this.ctx.restore();
  }

  drawTrajectoryGuide() {
    const rad = ((this.cannon.angle || 45) * Math.PI) / 180;
    const testPower = (this.gameState === 'CHARGING' ? Math.max(12, this.power) : 50) * 0.18;

    let simX = this.cannon.x + Math.cos(rad) * this.cannon.barrelLength;
    let simY = this.cannon.y - Math.sin(rad) * this.cannon.barrelLength;
    let simVx = Math.cos(rad) * testPower;
    let simVy = -Math.sin(rad) * testPower;

    const windResistance = window.shopManager ? window.shopManager.getWindFactor() : 1.0;
    const netWindAcc = (this.wind * 0.006) * windResistance;

    this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(simX, simY);

    for (let i = 0; i < 22; i++) {
      if (simVx + netWindAcc < 0.9) {
        simVx = Math.max(0.9, simVx * 0.99);
      } else {
        simVx += netWindAcc;
      }
      simVy += 0.12;
      simX += simVx;
      simY += simVy;
      this.ctx.lineTo(simX, simY);
      if (simY >= this.getTerrainY(simX)) break;
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  renderMinimap() {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const mCtx = this.minimapCtx;
    const mW = this.minimapCanvas.width;
    const mH = this.minimapCanvas.height;

    mCtx.clearRect(0, 0, mW, mH);

    // Sky Background in Minimap
    mCtx.fillStyle = '#0284c7';
    mCtx.fillRect(0, 0, mW, mH);

    const scaleX = mW / this.worldWidth;
    const scaleY = mH / (this.displayHeight || 500);

    // Lush Green Terrain silhouette in Minimap
    mCtx.fillStyle = '#22c55e';
    mCtx.beginPath();
    mCtx.moveTo(0, mH);
    for (let x = 0; x < mW; x++) {
      const worldX = x / scaleX;
      const groundY = this.getTerrainY(worldX) * scaleY;
      mCtx.lineTo(x, groundY);
    }
    mCtx.lineTo(mW, mH);
    mCtx.closePath();
    mCtx.fill();

    // Current Viewport Box
    const viewX = this.cameraX * scaleX;
    const viewW = this.displayWidth * scaleX;
    mCtx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
    mCtx.lineWidth = 1.5;
    mCtx.strokeRect(viewX, 1, viewW, mH - 2);

    // Cannon (Cyan dot)
    const cannonMapX = this.cannon.x * scaleX;
    const cannonMapY = this.cannon.y * scaleY;
    mCtx.fillStyle = '#06b6d4';
    mCtx.beginPath();
    mCtx.arc(cannonMapX, cannonMapY, 3, 0, Math.PI * 2);
    mCtx.fill();

    // Target (Red dot & Name)
    const targetMapX = this.target.x * scaleX;
    const targetMapY = this.target.y * scaleY;
    mCtx.fillStyle = '#ef4444';
    mCtx.beginPath();
    mCtx.arc(targetMapX, targetMapY, 3.5, 0, Math.PI * 2);
    mCtx.fill();

    mCtx.font = '8px sans-serif';
    mCtx.fillStyle = '#f87171';
    mCtx.textAlign = 'center';
    mCtx.fillText(this.target.name, targetMapX, targetMapY - 5);

    // Flying Projectile indicator (Glowing yellow dot)
    if (this.projectile) {
      const projMapX = this.projectile.x * scaleX;
      const projMapY = this.projectile.y * scaleY;
      mCtx.fillStyle = '#fbbf24';
      mCtx.beginPath();
      mCtx.arc(projMapX, projMapY, 2.5, 0, Math.PI * 2);
      mCtx.fill();
    }
  }

  startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    const tick = () => {
      this.update();
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

window.FortressEngine = FortressEngine;
