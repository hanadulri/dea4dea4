// Shop & Upgrade Management System
const POOP_CATALOG = [
  {
    id: 'classic',
    name: '기본 똥',
    icon: '💩',
    price: 0,
    damage: 30,
    radius: 25,
    color: '#8B4513',
    desc: '기본적이고 익숙한 클래식 brown 똥입니다.',
    unlocked: true
  },
  {
    id: 'golden',
    name: '황금 똥',
    icon: '✨💩',
    price: 500,
    damage: 55,
    radius: 35,
    color: '#FFD700',
    goldMult: 1.5,
    desc: '적중 시 클리어 골드를 1.5배 획득하는 반짝이는 황금 똥!',
    unlocked: false
  },
  {
    id: 'chili',
    name: '매운 불똥',
    icon: '🔥💩',
    price: 1200,
    damage: 85,
    radius: 45,
    color: '#EF4444',
    trailEffect: 'fire',
    desc: '허수아비를 태워버리는 강력한 화염 폭발 특수 똥.',
    unlocked: false
  },
  {
    id: 'rainbow',
    name: '무지개 똥',
    icon: '🌈💩',
    price: 2500,
    damage: 120,
    radius: 55,
    color: '#A855F7',
    trailEffect: 'rainbow',
    clusterCount: 3,
    desc: '화려한 무지개빛과 함께 적중시 3갈래 파편 폭발을 일으킵니다.',
    unlocked: false
  },
  {
    id: 'poison',
    name: '독 슬라임 똥',
    icon: '☣️💩',
    price: 4500,
    damage: 160,
    radius: 50,
    color: '#10B981',
    trailEffect: 'poison',
    desc: '지독한 부식 가스와 넓은 폭발 스플래시 데미지를 줍니다.',
    unlocked: false
  },
  {
    id: 'cosmic',
    name: '우주 핵똥',
    icon: '🌌💩',
    price: 8000,
    damage: 260,
    radius: 85,
    color: '#3B82F6',
    trailEffect: 'cosmic',
    desc: '화면 전체를 흔드는 우주급 대폭발 똥!',
    unlocked: false
  }
];

class ShopManager {
  constructor() {
    this.gold = 100;
    this.equippedPoop = 'classic';
    this.unlockedPoops = ['classic'];
    this.upgrades = {
      cannon_dmg: 1,  // Max 10
      cannon_wind: 1, // Max 5
      cannon_crit: 0, // Max 5
      gold_boost: 0   // Max 5
    };
    this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem('poop_fortress_save');
      if (saved) {
        const data = JSON.parse(saved);
        this.gold = data.gold ?? 100;
        this.equippedPoop = data.equippedPoop || 'classic';
        this.unlockedPoops = data.unlockedPoops || ['classic'];
        this.upgrades = { ...this.upgrades, ...(data.upgrades || {}) };
      }
    } catch (e) {
      console.warn('Failed to load save:', e);
    }
  }

  saveState() {
    try {
      const data = {
        gold: this.gold,
        equippedPoop: this.equippedPoop,
        unlockedPoops: this.unlockedPoops,
        upgrades: this.upgrades
      };
      localStorage.setItem('poop_fortress_save', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
    this.updateHUD();
  }

  addGold(amount) {
    this.gold += Math.floor(amount);
    this.saveState();
  }

  getEquippedPoop() {
    return POOP_CATALOG.find(p => p.id === this.equippedPoop) || POOP_CATALOG[0];
  }

  buyPoop(id) {
    const item = POOP_CATALOG.find(p => p.id === id);
    if (!item) return false;

    if (this.unlockedPoops.includes(id)) {
      this.equippedPoop = id;
      this.saveState();
      if (window.audioEngine) window.audioEngine.playClick();
      return true;
    }

    if (this.gold >= item.price) {
      this.gold -= item.price;
      this.unlockedPoops.push(id);
      this.equippedPoop = id;
      this.saveState();
      if (window.audioEngine) window.audioEngine.playCoin();
      return true;
    }

    return false;
  }

  getUpgradeCost(type) {
    const lvl = this.upgrades[type] || 0;
    const baseCosts = {
      cannon_dmg: 150,
      cannon_wind: 200,
      cannon_crit: 300,
      gold_boost: 250
    };
    return Math.floor((baseCosts[type] || 200) * Math.pow(1.6, lvl));
  }

  buyUpgrade(type) {
    const maxLvls = { cannon_dmg: 10, cannon_wind: 5, cannon_crit: 5, gold_boost: 5 };
    const curLvl = this.upgrades[type] || 0;
    if (curLvl >= maxLvls[type]) return false;

    const cost = this.getUpgradeCost(type);
    if (this.gold >= cost) {
      this.gold -= cost;
      this.upgrades[type] = curLvl + 1;
      this.saveState();
      if (window.audioEngine) window.audioEngine.playCoin();
      return true;
    }
    return false;
  }

  getDamageMultiplier() {
    return 1 + (this.upgrades.cannon_dmg - 1) * 0.15; // +15% per lvl
  }

  getWindFactor() {
    return Math.max(0.2, 1 - (this.upgrades.cannon_wind - 1) * 0.18); // wind resistance
  }

  getCritChance() {
    return (this.upgrades.cannon_crit || 0) * 0.10; // +10% per lvl
  }

  getGoldMultiplier() {
    return 1 + (this.upgrades.gold_boost || 0) * 0.25; // +25% per lvl
  }

  updateHUD() {
    const goldEl = document.getElementById('hud-gold-count');
    if (goldEl) goldEl.textContent = this.gold.toLocaleString();
  }
}

window.shopManager = new ShopManager();
