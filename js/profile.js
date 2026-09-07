// Player Profile & Career Statistics Manager
class ProfileManager {
  constructor() {
    this.playerName = '대포왕';
    this.avatarEmoji = '🤠';
    this.stats = {
      highestStage: 1,
      totalDamage: 0,
      targetsHit: 0,
      shotsFired: 0,
      totalGoldEarned: 0
    };
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem('poop_fortress_profile');
      if (saved) {
        const data = JSON.parse(saved);
        this.playerName = data.playerName || '대포왕';
        this.avatarEmoji = data.avatarEmoji || '🤠';
        this.stats = { ...this.stats, ...(data.stats || {}) };
      }
    } catch (e) {
      console.warn('Failed to load profile:', e);
    }
  }

  save() {
    try {
      const data = {
        playerName: this.playerName,
        avatarEmoji: this.avatarEmoji,
        stats: this.stats
      };
      localStorage.setItem('poop_fortress_profile', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save profile:', e);
    }
    this.render();
  }

  recordShot() {
    this.stats.shotsFired++;
    this.save();
  }

  recordHit(damage) {
    this.stats.targetsHit++;
    this.stats.totalDamage += Math.floor(damage);
    this.save();
  }

  recordStageClear(stage, goldEarned) {
    if (stage > this.stats.highestStage) {
      this.stats.highestStage = stage;
    }
    this.stats.totalGoldEarned += Math.floor(goldEarned);
    this.save();
  }

  getAccuracy() {
    if (this.stats.shotsFired === 0) return 0;
    return Math.min(100, Math.round((this.stats.targetsHit / this.stats.shotsFired) * 100));
  }

  render() {
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) nameInput.value = this.playerName;

    const avatarEl = document.getElementById('avatar-display');
    if (avatarEl) avatarEl.textContent = this.avatarEmoji;

    const highestStageEl = document.getElementById('stat-highest-stage');
    if (highestStageEl) highestStageEl.textContent = `Stage ${this.stats.highestStage}`;

    const accuracyEl = document.getElementById('stat-accuracy');
    if (accuracyEl) accuracyEl.textContent = `${this.getAccuracy()}%`;

    const totalDamageEl = document.getElementById('stat-total-damage');
    if (totalDamageEl) totalDamageEl.textContent = this.stats.totalDamage.toLocaleString();

    const totalGoldEl = document.getElementById('stat-total-gold');
    if (totalGoldEl) totalGoldEl.textContent = this.stats.totalGoldEarned.toLocaleString();
  }
}

window.profileManager = new ProfileManager();
