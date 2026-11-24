import { CARDS, CONFIG, computeBonuses, crystalsForRun, fmt, sellValue, stageMap, wavePlan } from "./config.js";
import { compilePath, pointAt } from "./path.js";

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const TINT = {
  shadow: "#c9b6ff", runner: "#d6f25a", brute: "#d5deea", swarm: "#ff6a4a", bat: "#7aa2ff", split: "#e07ad4",
  mite: "#ffb08a", ward: "#9be7ff", healer: "#8dffb0", golem: "#b9a58c", ghost: "#e8f4ff", boss: "#ff5a7a",
  brood: "#ff8ad4", lord: "#ff3358", chest: "#ffd56a",
};

export class Game {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.owned = {};
    this.cleared = 0;
    this.stage = 1;
    this.setStage(1);
    this.bonuses = computeBonuses({}, 0);
    this.lootTarget = { x: 250, y: 32 };
    this.mode = "menu";
    this.nextId = 1;
    this.soundAt = {};
    this.clearBattlefield();
  }

  setOwned(owned, cleared) {
    this.owned = owned || {};
    if (cleared != null) this.stagesCleared = cleared;
    this.bonuses = computeBonuses(this.owned, this.stagesCleared || 0);
  }

  setStage(n) {
    const map = stageMap(n);
    this.stage = map.stage;
    this.map = map;
    this.mapId = map.id;
    this.path = compilePath(map.path);
    this.slots = map.slots;
    this.portal = map.portal;
    this.crystal = map.crystal;
  }

  clearBattlefield() {
    this.lives = 0;
    this.coins = 0;
    this.wave = 0;
    this.wavesCleared = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.loot = [];
    this.beams = [];
    this.meteors = [];
    this.queue = [];
    this.selected = null;
    this.armed = false;
    this.phase = "gap";
    this.gapLeft = 0;
    this.spawnTimer = 0;
    this.plan = null;
    this.banner = null;
    this.toast = "";
    this.toastT = 0;
    this.shake = 0;
    this.hurt = 0;
    this.paused = false;
    this.speed = 1;
    this.coinPulse = 0;
    this.freezeT = 0;
    this.freezeMax = 0;
    this.slowMo = 0;
    this.combo = 0;
    this.comboT = 0;
    this.abilityCd = { meteor: 0, freeze: 0 };
    this.abilityMax = { meteor: 1, freeze: 1 };
    this.runBuff = {
      damage: 0, fireRate: 0, crit: 0, range: 0, enemySpeed: 1, enemyHp: 1,
      coinDrop: 0, interest: 0, discount: 0, lives: 0,
      tower: { base: {}, archer: {}, cannon: {}, frost: {}, storm: {}, venom: {}, sniper: {}, laser: {}, bank: {} },
    };
    this.blessOffer = [];
    this.blessAtStart = false;
    this.cardsTaken = [];
    this.rerollsLeft = 0;
    this.intro = null;
    this.hint = "done";
    this.bonusCrystals = 0;
    this.result = null;
    this.runOver = false;
    this.elapsed = 0;
    this.leaksBlocked = 0;
    this.reviveLeft = 0;
  }

  toMenu() {
    this.mode = "menu";
    this.paused = false;
    this.clearBattlefield();
  }

  startRun() {
    this.bonuses = computeBonuses(this.owned, this.stagesCleared || 0);
    this.clearBattlefield();
    this.mode = "play";
    const eco = CONFIG.economy;
    this.lives = eco.startLives + this.bonuses.lives;
    this.coins = eco.startCoins + this.bonuses.startCoins;
    this.phase = "gap";
    this.gapLeft = eco.firstGap;
    this.banner = { text: `Stezka ${this.stage}: ${this.map.name}`, life: 2.4 };
    this.rerollsLeft = this.bonuses.rerolls || 0;
    this.reviveLeft = this.bonuses.revive || 0;
    this.abilityMax.meteor = this.meteorCooldown();
    this.abilityMax.freeze = this.freezeCooldown();
    this.firstClear = this.stage > (this.stagesCleared || 0);
    const free = this.bonuses.freeTowers || 0;
    if (free > 0) {
      const best = this.slots.map((s, i) => ({ i, c: s.cover || 0 })).sort((a, b) => b.c - a.c);
      for (let k = 0; k < free && k < best.length; k++) this.placeTower(best[k].i, 0);
    }
    if (!this.hintDone) this.hint = "build";
    if (this.bonuses.startCard > 0) this.openBlessings(true);
  }

  toggleSpeed() {
    this.speed = this.speed >= 4 ? 1 : this.speed + 1;
  }

  setPaused(value) {
    if (this.mode !== "play") return;
    this.paused = !!value;
  }

  get halted() {
    return this.paused || !!this.intro || this.phase === "bless";
  }

  sound(name, arg) {
    if (this.hooks.sound) this.hooks.sound(name, arg);
  }

  fxSound(name, gap, arg) {
    const now = this.elapsed;
    if (this.soundAt[name] && now - this.soundAt[name] < gap) return;
    this.soundAt[name] = now;
    this.sound(name, arg);
  }

  toastMsg(text) {
    this.toast = text;
    this.toastT = 1.5;
  }

  pointAtDist(dist) {
    return pointAt(this.path, dist);
  }

  positionOf(enemy) {
    if (enemy._d !== enemy.dist || !enemy._p) {
      enemy._p = pointAt(this.path, enemy.dist);
      enemy._d = enemy.dist;
    }
    return enemy._p;
  }

  towerAtSlot(index) {
    return this.towers.find((t) => t.slot === index) || null;
  }

  selectedTower() {
    if (!this.selected || this.selected.kind !== "tower") return null;
    return this.towers.find((t) => t.id === this.selected.id) || null;
  }

  /* ---------------- tower stats & prices ---------------- */

  cfgOf(type) {
    return type === "base" ? CONFIG.base : CONFIG.towers[type];
  }

  levelStats(type, level, branch) {
    if (type === "base") return CONFIG.base.levels[Math.min(3, Math.max(1, level)) - 1];
    const cfg = CONFIG.towers[type];
    if (level <= 5) return cfg.tiers[Math.max(4, level) - 4];
    const path = cfg.paths[branch || 0] || cfg.paths[0];
    return path.levels[Math.min(7, level) - 6];
  }

  maxLevel(tower) {
    if (tower.type === "base") return 3;
    return this.bonuses.mastery[tower.type] ? 7 : 5;
  }

  statsFor(tower, levelOverride, typeOverride, branchOverride) {
    const type = typeOverride || tower.type;
    const cfg = this.cfgOf(type);
    const level = levelOverride || tower.level;
    const branch = branchOverride != null ? branchOverride : tower.branch;
    const lv = this.levelStats(type, level, branch);
    const mod = (this.runBuff.tower && this.runBuff.tower[type]) || {};
    const splash = lv.splash ? lv.splash * (1 + (mod.splash || 0)) : 0;
    const range = (lv.range || 0) * (this.bonuses.range || 1) * (1 + (this.runBuff.range || 0));
    const out = { ...lv, splash, range, color: cfg.color };
    if (out.slowDur) out.slowDur *= 1 + (mod.slowDur || 0);
    if (out.chain) out.chain += mod.chain || 0;
    if (out.poison) out.poison *= 1 + (mod.poison || 0);
    if (out.ramp) out.ramp *= 1 + (mod.ramp || 0);
    if (out.income) out.income = Math.round(out.income * (1 + (mod.income || 0)));
    out.damage = (out.damage || 0) * (1 + (mod.damage || 0)) * (1 + (type === "base" ? this.bonuses.baseDamage : this.bonuses.specDamage));
    out.fireRate = (out.fireRate || 0) * (1 + (mod.rate || 0));
    return out;
  }

  effective(stats) {
    return {
      damage: stats.damage * this.bonuses.damage * (1 + (this.runBuff.damage || 0)),
      fireRate: stats.fireRate * this.bonuses.fireRate * (1 + (this.runBuff.fireRate || 0)),
    };
  }

  priceCut() {
    return Math.min(0.6, (this.runBuff.discount || 0) + (this.bonuses.discount || 0));
  }

  buildCost() {
    return Math.max(1, Math.round(CONFIG.base.cost * (1 - this.priceCut())));
  }

  upgradeCost(tower, choice) {
    let base = 0;
    if (tower.type === "base") {
      if (tower.level < 3) base = CONFIG.base.upgrades[tower.level - 1];
      else {
        const spec = CONFIG.towers[choice];
        if (!spec) return 0;
        base = spec.branchCost;
      }
    } else {
      const cfg = CONFIG.towers[tower.type];
      if (tower.level === 4) base = cfg.upgrade;
      else if (tower.level === 5) base = cfg.paths[choice === 1 ? 1 : 0].costs[0];
      else if (tower.level === 6) base = cfg.paths[tower.branch || 0].costs[1];
      else return 0;
    }
    return Math.max(1, Math.round(base * (1 - this.priceCut())));
  }

  unlocked(type) {
    return !!this.bonuses.unlocks[type];
  }

  /* ---------------- main tick ---------------- */

  tick(dt) {
    dt = Math.min(0.05, Math.max(0, dt));
    if (this.mode === "play" && this.halted) return;
    this.elapsed += dt;
    this.decayFx(dt);
    if (this.mode !== "play") return;

    if (this.phase === "gap") {
      this.gapLeft -= dt;
      if (this.gapLeft <= 0) this.startWave();
    }
    if (this.phase === "combat" && this.freezeT <= 0) this.updateSpawns(dt);
    if (this.intro) return;
    this.updateEnemies(dt);
    if (this.mode !== "play") return;
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateMeteors(dt);
    this.updateLoot(dt);
    this.cleanup();
    if (this.mode !== "play") return;
    if (this.phase === "combat" && this.queue.length === 0 && this.enemies.length === 0) this.waveCleared();
  }

  waveCleared() {
    this.wavesCleared += 1;
    this.sound("clear");
    if (this.wave >= CONFIG.stageWaves) {
      this.finishRun(true);
      return;
    }
    this.phase = "gap";
    this.gapLeft = CONFIG.economy.gapTime;
    this.banner = { text: "Vlna " + this.wave + " odražena", life: 1.6 };
    this.leaksBlocked = 0;
    this.payWave();
    if (this.wave % 5 === 0 && this.bonuses.bossHeal) {
      this.lives += this.bonuses.bossHeal;
      this.floatText(this.crystal.x, this.crystal.y - 40, "+" + this.bonuses.bossHeal + " ♥", "#ff8b9a", true);
    }
    if (this.wave % 5 === 0 || this.wave % 5 === 3) this.openBlessings();
  }

  payWave() {
    let gain = this.bonuses.waveCoins || 0;
    let bankRate = 0;
    for (const t of this.towers) {
      if (t.type !== "bank") continue;
      const st = this.statsFor(t);
      gain += st.income || 0;
      bankRate += st.bankInterest || 0;
      this.floatText(t.x, t.y - 22, "+" + (st.income || 0), "#ffd56a", true);
    }
    const rate = (this.runBuff.interest || 0) + (this.bonuses.interest || 0) + bankRate;
    if (rate > 0 && this.coins > 0) {
      const cap = 30 + Math.round(rate * 1000);
      const interest = Math.min(cap, Math.floor(this.coins * rate));
      if (interest > 0) {
        gain += interest;
        this.floatText(this.lootTarget.x, this.lootTarget.y + 30, "Úroky +" + interest, "#ffd56a", true);
      }
    }
    if (gain > 0) {
      this.coins += gain;
      this.coinPulse = 0.8;
    }
  }

  /* ---------------- cards ---------------- */

  rollCards() {
    const owned = new Set(this.towers.map((t) => t.type));
    const luck = this.bonuses.rareLuck || 0;
    const weight = { c: 60 - luck * 18, r: 30 + luck * 10, e: 10 + luck * 8 };
    const pool = CARDS.filter((card) => {
      if (card.tower && !owned.has(card.tower)) return false;
      if (card.id === "smith" && !this.towers.some((t) => t.type === "base" && t.level < 3)) return false;
      if (card.id === "glass" && this.lives <= 6) return false;
      return true;
    }).map((card) => ({ card, w: weight[card.rarity] * (card.tower ? 1.4 : 1) }));
    const count = Math.max(3, this.bonuses.cardChoices || 3);
    const offer = [];
    while (offer.length < count && pool.length) {
      const total = pool.reduce((sum, item) => sum + item.w, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (; idx < pool.length - 1; idx++) {
        r -= pool[idx].w;
        if (r <= 0) break;
      }
      offer.push(pool.splice(idx, 1)[0].card);
    }
    return offer;
  }

  openBlessings(atStart) {
    this.blessOffer = this.rollCards();
    this.blessAtStart = !!atStart;
    this.phase = "bless";
    this.selected = null;
    this.armed = false;
  }

  rerollCards() {
    if (this.phase !== "bless" || this.rerollsLeft <= 0) return false;
    this.rerollsLeft -= 1;
    this.blessOffer = this.rollCards();
    this.sound("ui");
    return true;
  }

  cardCoins() {
    return 40 + this.wave * 10;
  }

  pickBlessing(index) {
    if (this.phase !== "bless") return;
    const pick = this.blessOffer[index] || this.blessOffer[0];
    const resume = () => {
      this.phase = "gap";
      this.gapLeft = this.blessAtStart ? CONFIG.economy.firstGap + 2 : CONFIG.economy.gapTime;
      this.blessAtStart = false;
    };
    if (!pick) {
      resume();
      return;
    }
    const b = this.runBuff;
    const tw = b.tower;
    switch (pick.id) {
      case "dmg": b.damage += 0.12; break;
      case "rate": b.fireRate += 0.1; break;
      case "coins": this.coins += this.cardCoins(); this.coinPulse = 0.8; break;
      case "life": this.lives += 4; break;
      case "range": b.range += 0.08; break;
      case "interest": b.interest += 0.06; break;
      case "crit": b.crit += 0.08; break;
      case "slow": b.enemySpeed *= 0.92; for (const e of this.enemies) e.speed *= 0.92; break;
      case "discount": b.discount += 0.15; break;
      case "bounty": b.coinDrop += 0.15; break;
      case "archer": tw.archer.rate = (tw.archer.rate || 0) + 0.3; break;
      case "cannon": tw.cannon.splash = (tw.cannon.splash || 0) + 0.25; tw.cannon.damage = (tw.cannon.damage || 0) + 0.15; break;
      case "frost": tw.frost.slowDur = (tw.frost.slowDur || 0) + 0.5; break;
      case "storm": tw.storm.chain = (tw.storm.chain || 0) + 1; break;
      case "venom": tw.venom.poison = (tw.venom.poison || 0) + 0.4; break;
      case "sniper": tw.sniper.damage = (tw.sniper.damage || 0) + 0.35; break;
      case "laser": tw.laser.ramp = (tw.laser.ramp || 0) + 0.4; break;
      case "bank": tw.bank.income = (tw.bank.income || 0) + 0.4; break;
      case "frenzy": b.fireRate += 0.18; b.damage += 0.1; break;
      case "smith": {
        const weak = this.towers.filter((t) => t.type === "base" && t.level < 3).sort((x, y) => x.level - y.level)[0];
        if (weak) {
          weak.level += 1;
          weak.born = 1;
          this.burst(weak.x, weak.y, "#9af7ff", 16, 70, 0.36);
        } else this.coins += this.cardCoins();
        break;
      }
      case "glass": b.damage += 0.35; this.lives = Math.max(1, this.lives - 5); break;
      case "greed": b.coinDrop += 0.4; b.enemyHp *= 1.1; break;
      default: break;
    }
    this.cardsTaken.push(pick.id);
    this.blessOffer = [];
    resume();
    this.banner = { text: pick.name, life: 1.6 };
    this.sound("upgrade");
    if (this.hooks.progress) this.hooks.progress("card");
  }

  /* ---------------- fx ---------------- */

  decayFx(dt) {
    if (this.toastT > 0) this.toastT -= dt;
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.slowMo > 0) this.slowMo -= dt;
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      if (this.freezeT <= 0) {
        this.freezeT = 0;
        this.banner = { text: "Čas se znovu rozběhl", life: 1 };
      }
    }
    if (this.comboT > 0) this.comboT -= dt;
    else this.combo = 0;
    this.abilityCd.meteor = Math.max(0, this.abilityCd.meteor - dt);
    this.abilityCd.freeze = Math.max(0, this.abilityCd.freeze - dt);
    this.hurt = Math.max(0, this.hurt - dt * 1.35);
    this.coinPulse = Math.max(0, this.coinPulse - dt);
    for (const b of this.beams) b.life -= dt;
    if (this.beams.length) this.beams = this.beams.filter((b) => b.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 28 * dt;
    }
    if (this.particles.length) this.particles = this.particles.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
    }
    if (this.texts.length) this.texts = this.texts.filter((t) => t.life > 0);
    for (const tw of this.towers) {
      tw.recoil = Math.max(0, tw.recoil - dt * 3.4);
      if (tw.born > 0) tw.born = Math.max(0, tw.born - dt * 2.4);
    }
  }

  /* ---------------- waves & enemies ---------------- */

  startWave() {
    if (this.mode !== "play" || this.phase === "combat") return;
    this.phase = "combat";
    this.wave += 1;
    this.plan = wavePlan(this.wave, this.stage);
    this.queue = [];
    let first = true;
    for (const group of this.plan.groups) {
      for (let i = 0; i < group.count; i++) {
        this.queue.push({ type: group.type, wait: first ? 0.4 : Math.max(0.05, group.interval) });
        first = false;
      }
    }
    this.spawnTimer = this.queue.length ? this.queue[0].wait : 0;
    this.banner = {
      text: this.plan.final ? "Poslední vlna!" : this.plan.boss ? "Temná vlna" : "Vlna " + this.wave,
      life: 1.7,
    };
    this.sound("wave");
  }

  callWave() {
    if (this.mode !== "play" || this.halted || this.phase !== "gap") return;
    const bonus = Math.max(0, Math.floor(this.gapLeft * CONFIG.economy.earlyBonusPerSec));
    if (bonus > 0) {
      this.coins += bonus;
      this.coinPulse = 0.8;
      this.floatText(this.lootTarget.x, this.lootTarget.y + 16, "+" + bonus, "#ffd56a");
      this.fxSound("coin", 0.05);
      if (this.hooks.progress) this.hooks.progress("early");
      this.advanceHint("early");
    }
    this.startWave();
  }

  updateSpawns(dt) {
    if (!this.queue.length) return;
    this.spawnTimer -= dt;
    let guard = 0;
    while (this.queue.length && this.spawnTimer <= 0 && guard++ < 24 && !this.intro) {
      const item = this.queue.shift();
      this.spawnEnemy(item.type);
      if (this.queue.length) this.spawnTimer += this.queue[0].wait;
    }
  }

  checkIntro(type) {
    if (this.hooks.firstSeen && this.hooks.firstSeen(type)) {
      this.intro = type;
      this.sound("boss");
    }
  }

  makeEnemy(typeId, dist) {
    const proto = CONFIG.enemies[typeId];
    const plan = this.plan || wavePlan(Math.max(1, this.wave), this.stage);
    let hp = proto.hp * plan.hp * (this.runBuff.enemyHp || 1);
    hp = Math.max(1, Math.round(hp));
    const coinMult = this.bonuses.coinDrop + (this.runBuff.coinDrop || 0);
    const reward = Math.max(1, Math.round(proto.reward * plan.reward * coinMult));
    const slow = Math.max(0.5, 1 - (this.bonuses.enemySlow || 0));
    const shield = proto.shield ? Math.round(proto.shield * plan.hp) : 0;
    return {
      id: this.nextId++,
      type: typeId,
      dist: dist || 0,
      hp,
      maxHp: hp,
      speed: proto.speed * plan.speed * (this.map.speedMult || 1) * (this.runBuff.enemySpeed || 1) * slow,
      reward,
      leak: proto.leak,
      radius: proto.radius,
      armor: Math.min(0.85, (proto.armor || 0) + (this.map.armorAdd || 0)),
      flying: !!proto.flying,
      boss: !!proto.boss,
      final: !!proto.final,
      chest: !!proto.chest,
      crystalDrop: proto.crystalDrop || 0,
      name: proto.name,
      shield,
      maxShield: shield,
      regen: proto.regen || 0,
      heals: proto.heals || 0,
      healT: 1.5,
      slowImmune: !!proto.slowImmune,
      phases: !!proto.phases,
      phaseT: 1.5 + Math.random(),
      hidden: false,
      summons: !!proto.summons,
      summonT: 3,
      sinceHit: 0,
      poisonT: 0,
      poisonDps: 0,
      poisonAcc: 0,
      slowFactor: 1,
      slowT: 0,
      flash: 0,
      wobble: Math.random() * Math.PI * 2,
      dead: false,
    };
  }

  spawnEnemy(typeId) {
    const proto = CONFIG.enemies[typeId];
    if (!proto || !this.plan) return;
    const enemy = this.makeEnemy(typeId, 0);
    this.enemies.push(enemy);
    this.checkIntro(typeId);
    if (proto.boss) {
      this.banner = { text: proto.name + " přichází!", life: 2.5 };
      this.shake = Math.max(this.shake, 12);
      this.sound("boss");
    }
  }

  updateEnemies(dt) {
    const frozen = this.freezeT > 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) {
          e.slowT = 0;
          e.slowFactor = 1;
        }
      }
      if (e.flash > 0) e.flash -= dt;
      if (e.brittleT > 0) e.brittleT -= dt;
      if (e.acidT > 0) e.acidT -= dt;
      e.sinceHit = (e.sinceHit || 0) + dt;
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        e.poisonAcc = (e.poisonAcc || 0) + (e.poisonDps || 0) * dt;
        if (e.poisonAcc >= 1) {
          const whole = Math.floor(e.poisonAcc);
          e.poisonAcc -= whole;
          this.damageEnemy(e, { damage: whole, poisonTick: true, armorPen: 0.4, quiet: true }, 1);
          if (e.dead) continue;
        }
      } else e.poisonDps = 0;
      if (frozen) continue;
      if (e.regen && e.sinceHit > 0.85 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
      if (e.maxShield && e.sinceHit > 1.3 && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.regen * 0.7 * dt);
      if (e.phases) {
        e.phaseT -= dt;
        if (e.phaseT <= 0) {
          e.hidden = !e.hidden;
          e.phaseT = e.hidden ? 1.1 : 2.2;
        }
      }
      if (e.heals) {
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 2;
          const here = this.positionOf(e);
          for (const o of this.enemies) {
            if (o.dead || o.hp >= o.maxHp) continue;
            const p = this.positionOf(o);
            if (Math.hypot(p.x - here.x, p.y - here.y) < 85) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.heals);
          }
          this.beams.push({ x1: here.x, y1: here.y, x2: here.x, y2: here.y, life: 0.3, max: 0.3, color: "#8dffb0", ring: 85 });
        }
      }
      if (e.summons) {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 3.5;
          for (let i = 0; i < 3; i++) this.enemies.push({ ...this.makeEnemy("swarm", Math.max(0, e.dist - 10 - i * 8)), child: true });
        }
      }
      e.dist += e.speed * e.slowFactor * dt;
      if (e.dist < this.path.total) continue;
      e.dead = true;
      if (this.leaksBlocked < (this.bonuses.leakShield || 0) && !e.boss) {
        this.leaksBlocked += 1;
        this.floatText(this.crystal.x, this.crystal.y - 36, "Štít!", "#7ef6ff", true);
        continue;
      }
      this.lives -= e.leak;
      this.hurt = 1;
      this.shake = Math.max(this.shake, e.boss ? 12 : 5);
      this.floatText(this.crystal.x, this.crystal.y - 36, "-" + e.leak, "#ff8b9a");
      this.fxSound("leak", 0.08);
      this.buzz(18);
      if (this.lives <= 0) {
        if (this.reviveLeft > 0) {
          this.reviveLeft -= 1;
          this.lives = 10;
          this.freezeT = Math.max(this.freezeT, 2);
          this.freezeMax = Math.max(this.freezeMax, 2);
          this.banner = { text: "Druhá šance!", life: 2 };
          this.sound("victory");
          continue;
        }
        this.lives = 0;
        this.finishRun(false);
        return;
      }
    }
  }

  acquire(tower, range) {
    const mode = tower.target || "first";
    let best = null;
    let bestScore = mode === "first" ? -1 : Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.hp <= 0 || e.hidden) continue;
      const pos = this.positionOf(e);
      const d = Math.hypot(pos.x - tower.x, pos.y - tower.y);
      if (d > range + e.radius * 0.35) continue;
      let score = e.dist;
      if (mode === "near") score = d;
      else if (mode === "strong") score = -(e.hp + (e.shield || 0));
      const better = mode === "first" ? score > bestScore : score < bestScore;
      if (better) {
        best = e;
        bestScore = score;
      }
    }
    return best;
  }

  aimPoint(tower, enemy, shotSpeed) {
    const pos = this.positionOf(enemy);
    if (!shotSpeed) return pos;
    const dist = Math.hypot(pos.x - tower.x, pos.y - tower.y);
    const moving = this.freezeT > 0 ? 0 : 1;
    const lead = (dist / shotSpeed) * enemy.speed * enemy.slowFactor * 0.85 * moving;
    return this.pointAtDist(enemy.dist + lead);
  }

  updateTowers(dt) {
    for (const tower of this.towers) {
      if (tower.type === "bank") continue;
      const stats = this.statsFor(tower);
      tower.cooldown -= dt;
      const target = this.acquire(tower, stats.range);
      if (!target) {
        tower.ramp = 1;
        tower.rampTarget = 0;
        continue;
      }
      const aim = stats.hitscan || stats.beam ? this.positionOf(target) : this.aimPoint(tower, target, stats.projectileSpeed || 400);
      tower.angle = lerpAngle(tower.angle, Math.atan2(aim.y - tower.y, aim.x - tower.x), 1 - Math.exp(-12 * dt));
      if (tower.cooldown > 0) continue;
      this.fire(tower, target, stats, aim);
      const rate = this.effective(stats).fireRate;
      tower.cooldown += rate > 0 ? 1 / rate : 1;
      if (tower.cooldown < 0) tower.cooldown = 0;
      tower.recoil = 1;
    }
  }

  fire(tower, target, stats, aim) {
    const crit = Math.random() < this.bonuses.crit + (this.runBuff.crit || 0) + (stats.critBonus || 0);
    const critMult = (stats.critMult || 2) + (this.bonuses.critDmg || 0);
    const damage = stats.damage * this.bonuses.damage * (1 + (this.runBuff.damage || 0)) * (crit ? critMult : 1);
    const payload = {
      damage, crit, kind: tower.type,
      brittle: stats.brittle || 0, acid: stats.acid || 0, execute: stats.execute || 0, bounty: stats.bounty || 0,
      armorPen: this.bonuses.armorPen, splash: stats.splash || 0, slow: stats.slow || 0, slowDur: stats.slowDur || 0,
      slowFlying: !!stats.slowFlying, bossBonus: (stats.bossBonus || 0) + (this.bonuses.bossDamage || 0), color: stats.color,
    };
    if (stats.beam) {
      if (tower.rampTarget === target.id) tower.ramp = Math.min(stats.rampMax || 3, (tower.ramp || 1) + (stats.ramp || 0.1));
      else {
        tower.ramp = 1;
        tower.rampTarget = target.id;
      }
      const hits = [target];
      for (let k = 1; k < (stats.chain || 1); k++) {
        const last = this.positionOf(hits[hits.length - 1]);
        let next = null;
        let nd = 80;
        for (const e of this.enemies) {
          if (e.dead || e.hp <= 0 || hits.includes(e)) continue;
          const p = this.positionOf(e);
          const d = Math.hypot(p.x - last.x, p.y - last.y);
          if (d < nd) {
            nd = d;
            next = e;
          }
        }
        if (!next) break;
        hits.push(next);
      }
      let prev = { x: tower.x, y: tower.y };
      let dmg = damage * tower.ramp;
      hits.forEach((e) => {
        const p = this.positionOf(e);
        this.beams.push({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, life: 0.12, max: 0.12, color: "#ff8ee0", width: 2 + tower.ramp });
        this.damageEnemy(e, { ...payload, damage: dmg, quiet: !crit }, 1);
        dmg *= stats.chainFall || 0.8;
        prev = p;
      });
      this.fxSound("shot", 0.12, "storm");
      return;
    }
    if (stats.chain) {
      this.fireChain(tower, target, stats, payload);
      return;
    }
    if (stats.hitscan) {
      const pos = this.positionOf(target);
      this.damageEnemy(target, payload, 1);
      this.beams.push({ x1: tower.x, y1: tower.y, x2: pos.x, y2: pos.y, life: 0.12, max: 0.12, color: "#e7d2ff" });
      this.fxSound("shot", 0.05, "sniper");
      return;
    }
    const shots = stats.shots || 1;
    for (let s = 0; s < shots; s++) {
      const spread = (s - (shots - 1) / 2) * 0.18;
      const base = Math.atan2(aim.y - tower.y, aim.x - tower.x) + spread;
      const dx = Math.cos(base);
      const dy = Math.sin(base);
      const dist = Math.hypot(aim.x - tower.x, aim.y - tower.y) || 1;
      const sp = stats.projectileSpeed || 360;
      this.projectiles.push({
        ...payload,
        poison: stats.poison || 0,
        poisonDur: stats.poisonDur || 0,
        poisonSpread: !!stats.poisonSpread,
        x: tower.x + dx * 14,
        y: tower.y + dy * 14,
        vx: dx * sp,
        vy: dy * sp,
        targetId: s === 0 ? target.id : 0,
        life: dist / sp + 0.45,
        hit: stats.splash ? 12 : 8,
        kind: tower.type,
        dead: false,
      });
    }
    this.fxSound("shot", 0.04, tower.type);
  }

  fireChain(tower, target, stats, payload) {
    const hit = [target];
    let guard = 0;
    while (hit.length < stats.chain && guard++ < 10) {
      const origin = this.positionOf(hit[hit.length - 1]);
      let next = null;
      let nextD = 86;
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0 || hit.includes(e)) continue;
        const pos = this.positionOf(e);
        const d = Math.hypot(pos.x - origin.x, pos.y - origin.y);
        if (d < nextD) {
          nextD = d;
          next = e;
        }
      }
      if (!next) break;
      hit.push(next);
    }
    let prev = { x: tower.x, y: tower.y };
    let dmg = payload.damage;
    hit.forEach((enemy, index) => {
      const pos = this.positionOf(enemy);
      this.beams.push({ x1: prev.x, y1: prev.y, x2: pos.x, y2: pos.y, life: 0.16, max: 0.16, color: index === 0 ? "#efe6ff" : "#c9b6ff" });
      this.damageEnemy(enemy, { ...payload, damage: dmg, slow: stats.shockAll || index === hit.length - 1 ? (stats.slow || 0) : 0, slowDur: stats.slowDur || 0 }, 1);
      dmg *= stats.chainFall || 0.7;
      prev = pos;
    });
    this.fxSound("shot", 0.05, "storm");
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      // Podkroky: rychlá střela nepřeskočí cíl ani při vysoké rychlosti.
      const stepLen = Math.hypot(p.vx, p.vy) * dt;
      const sub = Math.max(1, Math.ceil(stepLen / 8));
      const sdt = dt / sub;
      for (let k = 0; k < sub && !p.dead; k++) {
        p.x += p.vx * sdt;
        p.y += p.vy * sdt;
        p.life -= sdt;
        const target = p.targetId ? this.enemies.find((e) => e.id === p.targetId && !e.dead && e.hp > 0) : null;
        let struck = false;
        if (target) {
          const pos = this.positionOf(target);
          if (Math.hypot(pos.x - p.x, pos.y - p.y) <= target.radius + p.hit) {
            this.impact(p, pos.x, pos.y);
            struck = true;
          }
        } else {
          for (const e of this.enemies) {
            if (e.dead || e.hp <= 0 || e.hidden) continue;
            const pos = this.positionOf(e);
            if (Math.hypot(pos.x - p.x, pos.y - p.y) <= e.radius + p.hit) {
              this.impact(p, pos.x, pos.y);
              struck = true;
              break;
            }
          }
        }
        if (struck) p.dead = true;
        else if (p.life <= 0) {
          if (p.splash) this.impact(p, p.x, p.y);
          p.dead = true;
        }
      }
    }
  }

  impact(p, x, y) {
    if (p.splash) {
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0) continue;
        const pos = this.positionOf(e);
        const d = Math.hypot(pos.x - x, pos.y - y);
        if (d <= p.splash) this.damageEnemy(e, p, 1 - (d / Math.max(1, p.splash)) * 0.55);
      }
      const icy = p.kind === "frost";
      this.burst(x, y, icy ? "#bff8ff" : "#ffb15a", icy ? 10 : 14, 90, 0.32);
      if (!icy) this.shake = Math.max(this.shake, 3.5);
      this.beams.push({ x1: x, y1: y, x2: x, y2: y, life: 0.2, max: 0.2, color: icy ? "#bff8ff" : "#ffd2a4", ring: p.splash });
      if (icy) this.fxSound("hit", 0.05);
      else this.fxSound("explode", 0.08);
      return;
    }
    let victim = this.enemies.find((e) => e.id === p.targetId && !e.dead && e.hp > 0);
    if (!victim) {
      let best = 20;
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0) continue;
        const pos = this.positionOf(e);
        const d = Math.hypot(pos.x - x, pos.y - y);
        if (d < best) {
          best = d;
          victim = e;
        }
      }
    }
    if (victim) this.damageEnemy(victim, p, 1);
    this.burst(x, y, p.color || "#fff", 4, 36, 0.18);
    this.fxSound("hit", 0.035);
  }

  damageEnemy(enemy, hit, fall) {
    if (!enemy || enemy.dead || enemy.hp <= 0) return;
    const pen = Math.min(0.85, hit.armorPen || 0);
    const acid = enemy.acidT > 0;
    const armor = acid ? 0 : Math.min(0.85, (enemy.armor || 0) * (1 - pen));
    let amount = hit.damage * Math.max(0.2, fall) * (1 - armor);
    if (hit.bossBonus && enemy.boss) amount *= 1 + hit.bossBonus;
    let combo = false;
    if (!hit.poisonTick) {
      const slowed = (enemy.slowT > 0 && enemy.slowFactor < 1) || this.freezeT > 0;
      if (hit.kind === "storm" && slowed) { amount *= 1.4; combo = true; }
      if (hit.kind === "archer" && slowed) { amount *= 1.2; combo = true; }
      if (hit.kind === "laser" && slowed) { amount *= 1.25; combo = true; }
      if (hit.kind === "cannon" && enemy.poisonT > 0) { amount *= 1.3; combo = true; }
    }
    if (enemy.brittleT > 0) { amount *= 1 + (enemy.brittle || 0); combo = true; }
    if (acid) amount *= 1 + (enemy.acid || 0);
    amount = Math.max(1, Math.round(amount));
    if (hit.execute && !enemy.boss && enemy.hp - amount <= enemy.maxHp * hit.execute) {
      amount = Math.max(amount, Math.ceil(enemy.hp + (enemy.shield || 0)));
      combo = true;
    }
    enemy.sinceHit = 0;
    if (hit.brittle) {
      enemy.brittle = Math.max(enemy.brittle || 0, hit.brittle);
      enemy.brittleT = Math.max(enemy.brittleT || 0, hit.slowDur || 2);
    }
    if (hit.acid) {
      enemy.acid = Math.max(enemy.acid || 0, hit.acid);
      enemy.acidT = Math.max(enemy.acidT || 0, hit.poisonDur || 3);
    }
    const pierce = hit.kind === "sniper" || acid;
    if (enemy.shield > 0 && !pierce) {
      const blocked = Math.min(enemy.shield, amount);
      enemy.shield -= blocked;
      amount -= blocked;
      enemy.flash = 0.08;
      if (amount <= 0) {
        if (!hit.quiet) this.floatText(this.positionOf(enemy).x, this.positionOf(enemy).y - enemy.radius, "štít", "#9be7ff");
        return;
      }
    }
    enemy.hp -= amount;
    enemy.flash = 0.1;
    const pos = this.positionOf(enemy);
    if (!hit.quiet || hit.crit) {
      this.floatText(
        pos.x + (Math.random() - 0.5) * 8,
        pos.y - enemy.radius - 2,
        hit.crit ? fmt(amount) + "!" : fmt(amount),
        hit.crit ? "#ffe27a" : combo ? "#7ef6ff" : "#f6f3ff",
        !!hit.crit,
      );
    }
    const allowSlow = hit.slow && (!enemy.flying || hit.slowFlying) && !enemy.slowImmune;
    if (allowSlow) {
      const reduction = Math.min(0.75, hit.slow * (1 + this.bonuses.slowPower));
      const factor = 1 - reduction;
      if (factor < enemy.slowFactor) enemy.slowFactor = factor;
      enemy.slowT = Math.max(enemy.slowT, hit.slowDur || 1.4);
    }
    if (hit.poison && !hit.poisonTick) {
      enemy.poisonDps = Math.max(enemy.poisonDps || 0, hit.poison * this.bonuses.damage * (1 + (this.runBuff.damage || 0)));
      enemy.poisonT = Math.max(enemy.poisonT || 0, hit.poisonDur || 2);
      enemy.poisonSpread = enemy.poisonSpread || !!hit.poisonSpread;
    }
    if (enemy.hp > 0) return;
    this.killEnemy(enemy, hit, pos);
  }

  killEnemy(enemy, hit, pos) {
    enemy.hp = 0;
    enemy.dead = true;
    this.kills += 1;
    let aura = 0;
    for (const t of this.towers) if (t.type === "bank") aura += this.statsFor(t).lootAura || 0;
    enemy.reward = Math.round(enemy.reward * (1 + aura) * (1 + (hit.bounty || 0)));
    this.noteCombo(pos);
    if (enemy.chest) {
      const drop = enemy.crystalDrop || 2;
      this.bonusCrystals += drop;
      this.banner = { text: "Truhla! +" + drop + " krystaly", life: 1.6 };
      this.floatText(pos.x, pos.y - 26, "+" + drop + " krystaly", "#7ef6ff", true);
      this.buzz([10, 24, 10]);
    }
    if (enemy.boss) {
      this.bossKills += 1;
      this.shake = Math.max(this.shake, 14);
      this.slowMo = Math.max(this.slowMo, 0.55);
      this.banner = { text: (enemy.name || "Boss") + " padl", life: 1.8 };
      this.sound("victory");
      this.buzz([28, 40, 28]);
    }
    if (enemy.poisonSpread && enemy.poisonDps) {
      for (const other of this.enemies) {
        if (other.dead || other.id === enemy.id) continue;
        const op = this.positionOf(other);
        if (Math.hypot(op.x - pos.x, op.y - pos.y) < 72) {
          other.poisonDps = Math.max(other.poisonDps || 0, enemy.poisonDps * 0.7);
          other.poisonT = Math.max(other.poisonT || 0, 1.6);
          break;
        }
      }
    }
    this.spawnSplit(enemy);
    this.spawnLoot(enemy, pos);
    this.burst(pos.x, pos.y, TINT[enemy.type] || "#c9b6ff", enemy.boss ? 22 : 7, enemy.boss ? 110 : 55, enemy.boss ? 0.45 : 0.26);
    this.fxSound("death", 0.05);
  }

  spawnSplit(enemy) {
    const proto = CONFIG.enemies[enemy.type];
    if (!proto || !proto.splits || !proto.child || enemy.child) return;
    for (let i = 0; i < proto.splits; i++) {
      const child = this.makeEnemy(proto.child, Math.max(0, enemy.dist - 6 - i * 4));
      child.child = true;
      this.enemies.push(child);
    }
    this.checkIntro(proto.child);
  }

  spawnLoot(enemy, pos) {
    const n = enemy.boss ? 6 : enemy.reward >= 15 ? 3 : 1;
    let left = enemy.reward;
    const each = Math.max(1, Math.floor(enemy.reward / n));
    for (let i = 0; i < n; i++) {
      const value = i === n - 1 ? left : Math.min(each, left);
      left -= value;
      if (value <= 0) continue;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const sp = 50 + Math.random() * 50;
      this.loot.push({ x: pos.x, y: pos.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, value, age: 0, flying: false, fly: 0, done: false });
    }
  }

  updateLoot(dt) {
    for (const c of this.loot) {
      if (c.done) continue;
      if (!c.flying) {
        c.age += dt;
        c.vy += 240 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.age > 0.4) {
          c.flying = true;
          c.fly = 0;
          c.sx = c.x;
          c.sy = c.y;
        }
      } else {
        c.fly += dt / 0.38;
        const k = Math.min(1, c.fly);
        const ease = k * k;
        c.x = c.sx + (this.lootTarget.x - c.sx) * ease;
        c.y = c.sy + (this.lootTarget.y - c.sy) * ease - Math.sin(Math.PI * k) * 26;
        if (k >= 1) {
          c.done = true;
          this.coins += c.value;
          this.coinPulse = 0.85;
          this.fxSound("coin", 0.06);
          this.advanceHint("coins");
        }
      }
    }
  }

  cleanup() {
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.projectiles.some((p) => p.dead)) this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (this.loot.some((c) => c.done)) this.loot = this.loot.filter((c) => !c.done);
    if (this.meteors.some((m) => m.done)) this.meteors = this.meteors.filter((m) => !m.done);
  }

  burst(x, y, color, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.5), max: life, color, size: 1.6 + Math.random() * 2.2 });
    }
    if (this.particles.length > 200) this.particles.splice(0, this.particles.length - 200);
  }

  floatText(x, y, text, color, big) {
    const life = big ? 1 : 0.7;
    this.texts.push({ x, y, text, color, life, max: life, big: !!big });
    if (this.texts.length > 48) this.texts.splice(0, this.texts.length - 48);
  }

  noteCombo(pos) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 2.3;
    if (this.combo >= 3 && this.combo % 3 === 0) this.floatText(pos.x, pos.y - 28, "Série " + this.combo, "#ffd56a", true);
    if (this.combo > 0 && this.combo % 10 === 0) {
      this.banner = { text: "Série " + this.combo + "!", life: 1.2 };
      this.buzz(16);
    }
  }

  buzz(pattern) {
    if (this.hooks.buzz) this.hooks.buzz(pattern);
  }

  /* ---------------- abilities ---------------- */

  meteorCooldown() {
    return 30 * Math.max(0.4, 1 - (this.bonuses.meteorCd || 0));
  }

  freezeCooldown() {
    return 40 * Math.max(0.4, 1 - (this.bonuses.freezeCd || 0));
  }

  freezeDuration() {
    return 3 + (this.bonuses.freezeDur || 0);
  }

  /** Meteorický déšť: 3 meteory samy míří do největších skupin (boss má přednost). */
  castMeteor() {
    if (this.mode !== "play" || this.halted) return false;
    if (!this.bonuses.abilities.meteor || this.abilityCd.meteor > 0) return false;
    const alive = this.enemies.filter((e) => !e.dead && e.hp > 0);
    if (!alive.length) {
      this.toastMsg("Zatím není do čeho střílet");
      this.sound("deny");
      return false;
    }
    const pts = alive.map((e) => ({ e, p: this.positionOf(e) }));
    const used = new Set();
    const plan = this.plan || wavePlan(Math.max(1, this.wave), this.stage);
    const dmg = 100 * (this.map.hpMult || 1) * (1 + (this.bonuses.meteorPow || 0));
    for (let k = 0; k < 3; k++) {
      let best = null;
      let bestScore = -1;
      for (const a of pts) {
        let score = 0;
        for (const b of pts) {
          if (Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) > 80) continue;
          score += used.has(b.e.id) ? 0.25 : 1 + (b.e.boss ? 4 : 0) + b.e.hp / Math.max(1, b.e.maxHp);
        }
        if (score > bestScore) {
          bestScore = score;
          best = a;
        }
      }
      if (!best) break;
      for (const b of pts) if (Math.hypot(best.p.x - b.p.x, best.p.y - b.p.y) <= 80) used.add(b.e.id);
      const lead = best.e.speed * best.e.slowFactor * (0.45 + k * 0.22) * (this.freezeT > 0 ? 0 : 1);
      const at = this.pointAtDist(best.e.dist + lead);
      this.meteors.push({ x: at.x, y: at.y, t: 0, delay: k * 0.22, fall: 0.45, r: 80, dmg, done: false });
    }
    this.abilityCd.meteor = this.meteorCooldown();
    this.abilityMax.meteor = this.abilityCd.meteor;
    this.banner = { text: "Meteorický déšť!", life: 1.2 };
    this.sound("boss");
    return true;
  }

  updateMeteors(dt) {
    for (const m of this.meteors) {
      if (m.done) continue;
      m.t += dt;
      if (m.t < m.delay + m.fall) continue;
      m.done = true;
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0) continue;
        const pos = this.positionOf(e);
        const d = Math.hypot(pos.x - m.x, pos.y - m.y);
        if (d <= m.r) this.damageEnemy(e, { damage: m.dmg * (e.boss ? 0.6 : 1), armorPen: 0.5, kind: "meteor" }, 1 - (d / m.r) * 0.45);
      }
      this.burst(m.x, m.y, "#ffb15a", 26, 130, 0.5);
      this.beams.push({ x1: m.x, y1: m.y, x2: m.x, y2: m.y, life: 0.3, max: 0.3, color: "#ffe1a8", ring: m.r });
      this.shake = Math.max(this.shake, 9);
      this.sound("explode");
      this.buzz([18, 20, 18]);
    }
  }

  /** Zmrazení času: úplně zastaví všechny nepřátele i nové příchozí, i bosse. */
  castFreeze() {
    if (this.mode !== "play" || this.halted) return false;
    if (!this.bonuses.abilities.freeze || this.abilityCd.freeze > 0) return false;
    this.freezeMax = this.freezeDuration();
    this.freezeT = this.freezeMax;
    this.abilityCd.freeze = this.freezeCooldown();
    this.abilityMax.freeze = this.abilityCd.freeze;
    this.banner = { text: "Čas zamrzl", life: 1.4 };
    this.sound("shot", "frost");
    this.buzz(22);
    return true;
  }

  /* ---------------- input & building ---------------- */

  pointer(x, y) {
    if (this.mode !== "play" || this.halted) return;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const c = this.loot[i];
      if (c.flying || c.done) continue;
      if (Math.hypot(c.x - x, c.y - y) <= 28) {
        c.flying = true;
        c.fly = 0;
        c.sx = c.x;
        c.sy = c.y;
        return;
      }
    }
    let best = null;
    let bestD = 32;
    for (const t of this.towers) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) {
      this.selected = { kind: "tower", id: best.id };
      this.armed = false;
      return true;
    }
    let slot = null;
    let slotD = 34;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.towerAtSlot(i)) continue;
      const s = this.slots[i];
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < slotD) {
        slotD = d;
        slot = i;
      }
    }
    if (slot !== null) {
      this.selected = { kind: "slot", i: slot };
      if (this.armed) {
        if (this.coins >= this.buildCost()) {
          this.build();
          if (this.coins < this.buildCost()) this.armed = false;
          return true;
        }
        this.armed = false;
        this.toastMsg("Máš málo mincí");
        this.sound("deny");
      }
      return true;
    }
    this.selected = null;
    this.armed = false;
  }

  placeTower(slotIndex, spent) {
    const s = this.slots[slotIndex];
    const tower = {
      id: this.nextId++,
      type: "base",
      slot: slotIndex,
      x: s.x,
      y: s.y,
      level: Math.min(3, 1 + (this.bonuses.train || 0)),
      branch: null,
      spent,
      cooldown: 0.12,
      recoil: 1,
      angle: -Math.PI / 2,
      born: 1,
      ramp: 1,
      rampTarget: 0,
    };
    this.towers.push(tower);
    return tower;
  }

  build() {
    if (this.mode !== "play" || this.halted) return false;
    const sel = this.selected;
    if (!sel || sel.kind !== "slot") {
      this.toastMsg("Nejdřív vyber kámen");
      this.sound("deny");
      return false;
    }
    if (this.towerAtSlot(sel.i)) return false;
    const price = this.buildCost();
    if (this.coins < price) {
      this.toastMsg("Máš málo mincí");
      this.sound("deny");
      return false;
    }
    this.coins -= price;
    const tower = this.placeTower(sel.i, price);
    this.selected = this.armed ? null : { kind: "tower", id: tower.id };
    this.burst(tower.x, tower.y, CONFIG.base.color, 14, 55, 0.32);
    this.sound("upgrade");
    this.buzz(12);
    if (this.hooks.progress) this.hooks.progress("tower");
    this.advanceHint("build");
    return true;
  }

  /** choice: id specializace (při proměně neutrální věže) nebo 0/1 (volba mistrovské cesty). */
  upgrade(choice) {
    if (this.mode !== "play" || this.halted) return false;
    const tower = this.selectedTower();
    if (!tower) return false;
    const fail = (msg) => {
      this.toastMsg(msg);
      this.sound("deny");
      return false;
    };
    if (tower.type === "base" && tower.level >= 3) {
      if (!CONFIG.towers[choice]) return fail("Vyber specializaci");
      if (!this.unlocked(choice)) return fail("Tahle věž je ještě zamčená");
    } else if (tower.type !== "base" && tower.level >= 5) {
      if (tower.level >= this.maxLevel(tower)) return fail(this.bonuses.mastery[tower.type] ? "Nejvyšší úroveň" : "Mistrovství odemkneš ve stromu");
    }
    const cost = this.upgradeCost(tower, choice);
    if (this.coins < cost) return fail("Máš málo mincí");
    this.coins -= cost;
    tower.spent += cost;
    let msg = "Věž vylepšena";
    let big = false;
    if (tower.type === "base" && tower.level >= 3) {
      tower.type = choice;
      tower.level = 4;
      msg = CONFIG.towers[choice].name + "!";
      big = true;
      if (this.hooks.progress) this.hooks.progress("branch");
    } else if (tower.type !== "base" && tower.level === 5) {
      tower.branch = choice === 1 ? 1 : 0;
      tower.level = 6;
      msg = CONFIG.towers[tower.type].paths[tower.branch].name + "!";
      big = true;
      if (this.hooks.progress) this.hooks.progress("path");
    } else tower.level += 1;
    if (tower.level >= 7 && this.hooks.progress) this.hooks.progress("master");
    tower.recoil = 1;
    tower.born = 1;
    tower.ramp = 1;
    this.advanceHint("upgrade");
    this.burst(tower.x, tower.y, big ? "#ffd56a" : "#9af7ff", big ? 26 : 16, 80, 0.4);
    this.sound("upgrade");
    this.buzz(big ? [12, 30, 12] : 12);
    this.toastMsg(msg);
    return true;
  }

  sell() {
    if (this.mode !== "play" || this.halted) return;
    const tower = this.selectedTower();
    if (!tower) return;
    const refund = sellValue(tower.spent, this.bonuses.sellBonus);
    this.coins += refund;
    this.coinPulse = 0.6;
    this.towers = this.towers.filter((t) => t.id !== tower.id);
    this.selected = null;
    this.burst(tower.x, tower.y, "#ffd56a", 10, 48, 0.28);
    this.floatText(tower.x, tower.y - 18, "+" + refund, "#ffd56a");
    this.sound("coin");
    this.toastMsg("Prodáno za " + refund);
  }

  bossEnemy() {
    let best = null;
    for (const e of this.enemies) {
      if (!e.boss || e.dead || e.hp <= 0) continue;
      if (!best || e.final) best = e;
    }
    return best;
  }

  finishRun(victory) {
    if (this.runOver) return;
    this.runOver = true;
    this.paused = false;
    this.intro = null;
    const died = !victory;
    const reward = crystalsForRun({
      cleared: this.wavesCleared,
      kills: this.kills,
      bossKills: this.bossKills,
      stage: this.stage,
      bonusCrystals: this.bonusCrystals || 0,
      victory: !!victory,
      firstClear: !!(victory && this.firstClear),
    }, this.bonuses);
    this.result = {
      wave: this.wave,
      cleared: this.wavesCleared,
      kills: this.kills,
      bossKills: this.bossKills,
      crystals: reward,
      died: died && this.lives <= 0,
      victory: !!victory,
      firstClear: !!(victory && this.firstClear),
      stage: this.stage,
      mapId: this.mapId,
    };
    this.mode = "summary";
    this.sound(victory ? "victory" : died ? "defeat" : "clear");
    if (this.hooks.onRunEnd) this.hooks.onRunEnd(this.result);
  }

  advanceHint(step) {
    if (this.hintDone || this.hint === "done") return;
    if (this.hint !== step) return;
    const order = ["build", "coins", "upgrade", "early"];
    const idx = order.indexOf(step);
    this.hint = order[idx + 1] || "done";
    if (this.hint === "done") {
      this.hintDone = true;
      if (this.hooks.hintDone) this.hooks.hintDone();
    }
  }

  surrender() {
    if (this.mode !== "play") return;
    this.finishRun(false);
  }
}
