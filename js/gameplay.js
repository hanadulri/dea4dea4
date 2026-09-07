// Core Game & Physics Engine for Poop Fortress (Active Focus & Balanced Physics)
class FortressEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    // Minimap Canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Stage State
    this.stage = 1;
    this.wind = 0; // -3.5 to +3.5 m/s (mild, strategic wind)
    this.worldWidth = 2600; // Wide panoramic world map

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
    this.powerSpeed = 1.15; // Slower, comfortable gauge oscillation
    this.powerDir = 1;

    // Firing States: 'AIMING' -> 'CHARGING' -> 'FLYING' -> 'EXPLODING'
    this.gameState = 'AIMING';

    // Active Projectile & Dynamic Effects
    this.projectile = null;
    this.particles = [];
    this.damageTexts = [];

    // Terrain height map
    this.terrainHeights = [];
    this.isRunning = false;

    // Initialization
    this.resizeCanvas();
    this.bindEvents();
    this.initStage(1);
    this.startLoop();
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
    this.stage = stageNum;
    const stageBadge = document.getElementById('hud-stage-num');
    if (stageBadge) stageBadge.textContent = this.stage;

    // Mild Wind: -3.5 to +3.5 m/s (tactical and balanced)
    const rawWind = (Math.random() * 7.0 - 3.5).toFixed(1);
    this.wind = parseFloat(rawWind);
    this.updateWindUI();

    const dims = this.getContainerDimensions();
    this.displayWidth = dims.width;
    this.displayHeight = dims.height;

    // Cannon position
    this.cannon.x = 180;
    this.generateTerrain();

    // Target Scarecrow position across the wide map
    const minDistance = Math.max(650, this.displayWidth * 0.7);
    const minX = this.cannon.x + minDistance;
    const maxX = this.worldWidth - 220;
    const targetX = Math.floor(minX + Math.random() * (maxX - minX));

    const groundY = this.getTerrainY(targetX);

    // Target Name: "김현서" or "박수홍"
    const names = ['김현서', '박수홍'];
    const selectedName = names[Math.floor(Math.random() * names.length)];

    const baseHp = 90 + (stageNum - 1) * 45;

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

  generateTerrain() {
    const width = this.worldWidth;
    const height = this.displayHeight || 500;
    this.terrainHeights = new Array(width + 20).fill(0);
    const baseHeight = height - 120;

    const freq1 = 0.0022;
    const freq2 = 0.0065;
    const amp1 = Math.min(65, height * 0.16);
    const amp2 = Math.min(30, height * 0.08);

    for (let x = 0; x < width + 20; x++) {
      let h = baseHeight + Math.sin(x * freq1) * amp1 + Math.cos(x * freq2) * amp2;
      if (x < this.cannon.x + 90) {
        h = baseHeight + 10;
      }
      this.terrainHeights[x] = h;
    }

    this.cannon.y = this.getTerrainY(this.cannon.x) - 15;
    if (this.target) {
      this.target.y = this.getTerrainY(this.target.x) - 80;
    }
  }

  getTerrainY(x) {
    if (!this.terrainHeights || this.terrainHeights.length === 0) {
      return (this.displayHeight || 500) - 120;
    }
    const idx = Math.max(0, Math.min(Math.floor(x), this.terrainHeights.length - 1));
    return this.terrainHeights[idx] || ((this.displayHeight || 500) - 120);
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
      // Step 1: Lock Angle & start charging power
      this.gameState = 'CHARGING';
      this.power = 0;
      this.powerDir = 1;
      if (window.audioEngine) window.audioEngine.playClick();
      this.updateControlsUI();
    } else if (this.gameState === 'CHARGING') {
      // Step 2: Lock Power & Fire!
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
    // Lower velocity scale for high flight visibility (시인성 향상)
    const powerScale = 0.18;
    const totalPower = Math.max(12, this.power) * powerScale;

    // Mild, balanced wind effect
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
      gravity: 0.12, // Smooth, graceful flight arc
      weapon: weapon,
      trail: []
    };

    // Instant camera focus right on the launched projectile!
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
    // 1. Angle sweep in AIMING state
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

    // 2. Power sweep in CHARGING state
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

    // 3. Projectile physics & Active Projectile Camera Follow
    if (this.gameState === 'FLYING' && this.projectile) {
      const p = this.projectile;

      // Realistic forward drag (never reverses backwards)
      if (p.vx + p.ax < 0.9) {
        p.vx = Math.max(0.9, p.vx * 0.99);
      } else {
        p.vx += p.ax;
      }

      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      // Clean trail
      p.trail.push({ x: p.x, y: p.y, alpha: 1.0 });
      if (p.trail.length > 8) p.trail.shift();

      this.addSmokeParticle(p.x, p.y, p.weapon.color);

      // Camera tightly centers horizontally on projectile
      this.cameraTargetX = Math.max(0, Math.min(this.worldWidth - this.displayWidth, p.x - this.displayWidth * 0.48));

      // Camera smoothly pans vertically if projectile ascends high
      if (p.y < 100) {
        this.cameraTargetY = Math.max(0, 100 - p.y);
      } else {
        this.cameraTargetY = 0;
      }

      // Responsive camera tracking
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

      // Collision with Ground Terrain or screen bounds
      const groundY = this.getTerrainY(p.x);
      if (p.y >= groundY || p.x > this.worldWidth + 100 || p.x < -100) {
        this.triggerExplosion(p.x, p.y, false);
        return;
      }
    } else {
      // Smoothly return camera to cannon view when not flying
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

    // Clear projectile and lingering trail immediately
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
    const weaponGoldMult = 1.0;
    const upgradeGoldMult = window.shopManager ? window.shopManager.getGoldMultiplier() : 1.0;

    const totalReward = Math.floor(baseReward * weaponGoldMult * upgradeGoldMult);

    if (window.shopManager) window.shopManager.addGold(totalReward);
    if (window.profileManager) window.profileManager.recordStageClear(this.stage, totalReward);

    const rewardDisplay = document.getElementById('victory-reward-amount');
    if (rewardDisplay) rewardDisplay.textContent = `+${totalReward} G`;

    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal) victoryModal.classList.add('active');
  }

  nextStage() {
    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal) victoryModal.classList.remove('active');
    this.initStage(this.stage + 1);
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

    // Thoroughly clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // 1. Sky & Background gradient
    const skyGradient = this.ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#0f172a');
    skyGradient.addColorStop(0.6, '#1e1b4b');
    skyGradient.addColorStop(1, '#311042');
    this.ctx.fillStyle = skyGradient;
    this.ctx.fillRect(0, 0, width, height);

    // Moon with camera parallax
    const moonScreenX = (width - 80) - (camX * 0.08);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.beginPath();
    this.ctx.arc(moonScreenX, 60 + camY * 0.15, 20, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. Terrain & Objects Rendering (shifted by cameraX and cameraY)
    this.ctx.save();
    this.ctx.translate(-camX, camY);

    this.ctx.beginPath();
    this.ctx.moveTo(camX - 50, height - camY + 200);
    for (let x = Math.max(0, camX - 50); x <= Math.min(this.worldWidth, camX + width + 50); x += 4) {
      this.ctx.lineTo(x, this.terrainHeights[x] || (height - 120));
    }
    this.ctx.lineTo(camX + width + 50, height - camY + 200);
    this.ctx.closePath();

    const groundGrad = this.ctx.createLinearGradient(0, height - 160, 0, height + 200);
    groundGrad.addColorStop(0, '#334155');
    groundGrad.addColorStop(1, '#0f172a');
    this.ctx.fillStyle = groundGrad;
    this.ctx.fill();

    // Grass line
    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // 3. Cannon
    this.drawCannon();

    // 4. Target Dummy Scarecrow ("김현서" / "박수홍")
    this.drawTargetScarecrow();

    // 5. Trajectory Guide Line
    if (this.gameState === 'AIMING' || this.gameState === 'CHARGING') {
      this.drawTrajectoryGuide();
    }

    // 6. Projectile & Rotating Poop with High Visibility
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

      // Rotating Poop projectile aligned with flight path
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

    // 7. Particles
    this.particles.forEach(pt => {
      this.ctx.fillStyle = pt.color;
      this.ctx.globalAlpha = pt.alpha;
      this.ctx.beginPath();
      this.ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    });

    // 8. Floating Damage Text
    this.damageTexts.forEach(dt => {
      this.ctx.font = `900 ${dt.size}px Jua, sans-serif`;
      this.ctx.fillStyle = dt.color;
      this.ctx.globalAlpha = dt.alpha;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(dt.text, dt.x, dt.y);
      this.ctx.globalAlpha = 1.0;
    });

    this.ctx.restore();

    // 9. Render Minimap
    this.renderMinimap();
  }

  drawCannon() {
    const c = this.cannon;
    const rad = ((c.angle || 45) * Math.PI) / 180;

    this.ctx.save();
    this.ctx.translate(c.x, c.y);

    // Barrel
    this.ctx.rotate(-rad);
    const barrelGrad = this.ctx.createLinearGradient(0, -9, c.barrelLength, 9);
    barrelGrad.addColorStop(0, '#475569');
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

    // Angle indicator text
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

    // Clear Minimap
    mCtx.clearRect(0, 0, mW, mH);

    // Background
    mCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    mCtx.fillRect(0, 0, mW, mH);

    // World scale
    const scaleX = mW / this.worldWidth;
    const scaleY = mH / (this.displayHeight || 500);

    // Terrain silhouette
    mCtx.fillStyle = '#334155';
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
    mCtx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
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
