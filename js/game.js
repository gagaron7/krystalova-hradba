import { BLESSINGS, CONFIG, computeBonuses, crystalsForRun, mapById, sellValue, wavePlan } from "./config.js";
import { compilePath, pointAt } from "./path.js";

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Game {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.owned = {};
    this.setMap("les");
    this.bonuses = computeBonuses({});
    this.lootTarget = { x: 250, y: 32 };
    this.mode = "menu";
    this.nextId = 1;
    this.soundAt = {};
    this.clearBattlefield();
  }

  setOwned(owned) {
    this.owned = owned || {};
    this.bonuses = computeBonuses(this.owned);
  }

  setMap(id) {
    const map = mapById(id);
    this.map = map;
    this.mapId = map.id;
    this.path = compilePath(map.path);
    this.slots = map.slots;
    this.portal = map.portal;
    this.crystal = map.crystal;
  }

  clearBattlefield() {
    this.lives = 0;
    this.maxLives = 0;
    this.coins = 0;
    this.wave = 0;
    this.cleared = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.texts = [];
    this.loot = [];
    this.beams = [];
    this.queue = [];
    this.selected = null;
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
    this.aimMeteor = false;
    this.freezeT = 0;
    this.slowMo = 0;
    this.combo = 0;
    this.comboT = 0;
    this.abilityCd = { meteor: 0, freeze: 0 };
    this.runBuff = { damage: 0, fireRate: 0, crit: 0, range: 0, enemySpeed: 1 };
    this.blessOffer = [];
    this.hint = "done";
    this.bonusCrystals = 0;
    this.result = null;
    this.runOver = false;
    this.elapsed = 0;
  }

  toMenu() {
    this.mode = "menu";
    this.paused = false;
    this.clearBattlefield();
  }

  startRun() {
    this.bonuses = computeBonuses(this.owned);
    this.clearBattlefield();
    this.mode = "play";
    this.runOver = false;
    const eco = CONFIG.economy;
    this.lives = eco.startLives + this.bonuses.lives;
    this.maxLives = this.lives;
    this.coins = eco.startCoins + this.bonuses.startCoins;
    this.phase = "gap";
    this.gapLeft = eco.firstGap;
    this.banner = { text: this.map.name, life: 2.2 };
    if (!this.hintDone) this.hint = "build";
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
  }

  setPaused(value) {
    if (this.mode !== "play") return;
    this.paused = !!value;
    if (this.paused) this.aimMeteor = false;
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
    this.toastT = 1.35;
  }

  pointAtDist(dist) {
    return pointAt(this.path, dist);
  }

  positionOf(enemy) {
    return this.pointAtDist(enemy.dist);
  }

  towerAtSlot(index) {
    return this.towers.find((t) => t.slot === index) || null;
  }

  selectedTower() {
    if (!this.selected || this.selected.kind !== "tower") return null;
    return this.towers.find((t) => t.id === this.selected.id) || null;
  }

  statsFor(tower) {
    const cfg = CONFIG.towers[tower.type];
    const lv = cfg.levels[Math.min(cfg.levels.length, tower.level) - 1];
    const splash = lv.splash ? lv.splash * (1 + this.bonuses.splash) : 0;
    const range = lv.range * (this.bonuses.range || 1) * (1 + (this.runBuff.range || 0));
    return { ...lv, splash, range, color: cfg.color };
  }

  unlocked(type) {
    const cfg = CONFIG.towers[type];
    if (!cfg || !cfg.unlock) return true;
    return !!this.bonuses.unlocks[cfg.unlock];
  }

  tick(dt) {
    dt = Math.min(0.05, Math.max(0, dt));
    if (this.mode === "play" && this.paused) return;
    this.elapsed += dt;
    this.decayFx(dt);
    if (this.mode !== "play") return;

    if (this.phase === "gap") {
      this.gapLeft -= dt;
      if (this.gapLeft <= 0) this.startWave();
    }
    if (this.phase === "combat") this.updateSpawns(dt);
    this.updateEnemies(dt);
    if (this.mode !== "play") return;
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateLoot(dt);
    this.cleanup();
    if (this.mode !== "play") return;
    if (this.phase === "combat" && this.queue.length === 0 && this.enemies.length === 0) {
      this.cleared += 1;
      this.phase = "gap";
      this.gapLeft = CONFIG.economy.gapTime;
      this.banner = { text: "Vlna " + this.wave + " odražena", life: 1.6 };
      this.sound("clear");
      if (this.wave % 5 === 0) this.openBlessings();
    }
  }

  openBlessings() {
    const pool = BLESSINGS.slice();
    const offer = [];
    while (offer.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      offer.push(pool.splice(i, 1)[0]);
    }
    this.blessOffer = offer;
    this.phase = "bless";
  }

  pickBlessing(index) {
    if (this.phase !== "bless") return;
    const pick = this.blessOffer[index] || this.blessOffer[0];
    if (!pick) {
      this.phase = "gap";
      this.gapLeft = CONFIG.economy.gapTime;
      return;
    }
    const b = this.runBuff;
    if (pick.id === "dmg") b.damage += 0.15;
    else if (pick.id === "rate") b.fireRate += 0.12;
    else if (pick.id === "coins") {
      this.coins += 45;
      this.coinPulse = 0.8;
    } else if (pick.id === "life") this.lives += 3;
    else if (pick.id === "slow") b.enemySpeed *= 0.92;
    else if (pick.id === "crit") b.crit += 0.06;
    else if (pick.id === "range") b.range += 0.08;
    this.blessOffer = [];
    this.phase = "gap";
    this.gapLeft = CONFIG.economy.gapTime;
    this.banner = { text: pick.name, life: 1.6 };
    this.sound("upgrade");
  }

  decayFx(dt) {
    if (this.toastT > 0) this.toastT -= dt;
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    this.shake = Math.max(0, this.shake - dt * 18);
    if (this.slowMo > 0) this.slowMo -= dt;
    if (this.freezeT > 0) this.freezeT -= dt;
    if (this.comboT > 0) this.comboT -= dt;
    else this.combo = 0;
    if (this.abilityCd) {
      this.abilityCd.meteor = Math.max(0, this.abilityCd.meteor - dt);
      this.abilityCd.freeze = Math.max(0, this.abilityCd.freeze - dt);
    }
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

  startWave() {
    if (this.mode !== "play" || this.phase === "combat") return;
    this.phase = "combat";
    this.wave += 1;
    this.plan = wavePlan(this.wave);
    this.queue = [];
    let first = true;
    for (const group of this.plan.groups) {
      const count = Math.max(0, group.count | 0);
      for (let i = 0; i < count; i++) {
        this.queue.push({
          type: group.type,
          wait: first ? 0.4 : Math.max(0.05, group.interval),
        });
        first = false;
      }
    }
    this.spawnTimer = this.queue.length ? this.queue[0].wait : 0;
    this.banner = {
      text: this.plan.boss ? "Temná vlna" : "Vlna " + this.wave,
      life: 1.7,
    };
    this.sound("wave");
  }

  callWave() {
    if (this.mode !== "play" || this.paused || this.phase !== "gap") return;
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
    while (this.queue.length && this.spawnTimer <= 0 && guard++ < 24) {
      const item = this.queue.shift();
      this.spawnEnemy(item.type);
      if (this.queue.length) this.spawnTimer += this.queue[0].wait;
    }
  }

  spawnEnemy(typeId) {
    const proto = CONFIG.enemies[typeId];
    if (!proto || !this.plan) return;
    const mapHp = this.map.hpMult || 1;
    const mapSpeed = this.map.speedMult || 1;
    let hp = proto.hp * this.plan.hp * mapHp;
    if (proto.boss) {
      hp *= 1 + Math.max(0, this.wave / 5 - 1) * CONFIG.bossHpGrowth;
    }
    hp = Math.max(1, Math.round(hp));
    const reward = Math.max(1, Math.round(proto.reward * this.plan.reward * this.bonuses.coinDrop));
    const enemy = {
      id: this.nextId++,
      type: typeId,
      dist: 0,
      hp,
      maxHp: hp,
      speed: proto.speed * this.plan.speed * mapSpeed * (this.runBuff.enemySpeed || 1),
      reward,
      leak: proto.leak,
      radius: proto.radius,
      armor: proto.armor || 0,
      flying: !!proto.flying,
      boss: !!proto.boss,
      chest: !!proto.chest,
      crystalDrop: proto.crystalDrop || 0,
      name: proto.name,
      shield: proto.shield ? Math.round(proto.shield * this.plan.hp * mapHp) : 0,
      maxShield: proto.shield ? Math.round(proto.shield * this.plan.hp * mapHp) : 0,
      regen: proto.regen || 0,
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
    this.enemies.push(enemy);
    if (proto.boss) {
      this.banner = { text: proto.name + " přichází!", life: 2.5 };
      this.shake = Math.max(this.shake, 12);
      this.sound("boss");
    }
  }

  updateEnemies(dt) {
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
      e.sinceHit = (e.sinceHit || 0) + dt;
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        e.poisonAcc = (e.poisonAcc || 0) + (e.poisonDps || 0) * dt;
        if (e.poisonAcc >= 1) {
          const whole = Math.floor(e.poisonAcc);
          e.poisonAcc -= whole;
          this.damageEnemy(e, { damage: whole, poisonTick: true, armorPen: 0.4, color: "#b6f58a" }, 1);
          if (e.dead) continue;
        }
      } else {
        e.poisonDps = 0;
      }
      if (e.regen && e.sinceHit > 0.85 && e.hp < e.maxHp && e.hp > 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
      }
      if (e.maxShield && e.sinceHit > 1.3 && e.shield < e.maxShield) {
        e.shield = Math.min(e.maxShield, e.shield + e.regen * 0.7 * dt);
      }
      const freeze = this.freezeT > 0 ? 0.08 : 1;
      e.dist += e.speed * e.slowFactor * freeze * dt;
      if (e.dist < this.path.total) continue;
      e.dead = true;
      this.lives -= e.leak;
      this.hurt = 1;
      this.shake = Math.max(this.shake, e.boss ? 12 : 5);
      const c = this.crystal;
      this.floatText(c.x, c.y - 36, "-" + e.leak, "#ff8b9a");
      this.fxSound("leak", 0.08);
      this.buzz(18);
      if (this.lives <= 0) {
        this.lives = 0;
        this.finishRun();
        return;
      }
    }
  }

  acquire(tower, range) {
    const mode = tower.target || "first";
    let best = null;
    let bestScore = mode === "first" ? -1 : Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.hp <= 0) continue;
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
    const lead = (dist / shotSpeed) * enemy.speed * enemy.slowFactor * 0.85;
    return this.pointAtDist(enemy.dist + lead);
  }

  updateTowers(dt) {
    for (const tower of this.towers) {
      const stats = this.statsFor(tower);
      tower.cooldown -= dt;
      const target = this.acquire(tower, stats.range);
      if (!target) continue;
      const aim = stats.hitscan
        ? this.positionOf(target)
        : this.aimPoint(tower, target, stats.projectileSpeed || 400);
      const desired = Math.atan2(aim.y - tower.y, aim.x - tower.x);
      tower.angle = lerpAngle(tower.angle, desired, 1 - Math.exp(-12 * dt));
      if (tower.cooldown > 0) continue;
      this.fire(tower, target, stats, aim);
      const rate = stats.fireRate * this.bonuses.fireRate * (1 + (this.runBuff.fireRate || 0));
      tower.cooldown = rate > 0 ? 1 / rate : 1;
      tower.recoil = 1;
    }
  }

  fire(tower, target, stats, aim) {
    const crit = Math.random() < this.bonuses.crit + (this.runBuff.crit || 0);
    const damage = stats.damage * this.bonuses.damage * (1 + (this.runBuff.damage || 0)) * (crit ? 2 : 1);
    const payload = {
      damage,
      crit,
      armorPen: this.bonuses.armorPen,
      splash: stats.splash || 0,
      slow: stats.slow || 0,
      slowDur: stats.slowDur || 0,
      slowFlying: !!stats.slowFlying,
      bossBonus: (stats.bossBonus || 0) + (this.bonuses.bossDamage || 0),
      color: stats.color,
    };
    if (stats.chain) {
      this.fireChain(tower, target, stats, payload);
      return;
    }
    if (stats.hitscan) {
      const pos = this.positionOf(target);
      const shot = { ...payload };
      if (stats.bossBonus && target.boss) shot.damage *= 1 + stats.bossBonus;
      this.damageEnemy(target, shot, 1);
      this.beams.push({
        x1: tower.x,
        y1: tower.y,
        x2: pos.x,
        y2: pos.y,
        life: 0.12,
        max: 0.12,
        color: "#e7d2ff",
      });
      this.sound("shot", "sniper");
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
        bossBonus: stats.bossBonus || 0,
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
    this.sound("shot", tower.type);
  }

  fireChain(tower, target, stats, payload) {
    const hit = [target];
    let guard = 0;
    while (hit.length < stats.chain && guard++ < 8) {
      const last = hit[hit.length - 1];
      const origin = this.positionOf(last);
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
      this.beams.push({
        x1: prev.x, y1: prev.y, x2: pos.x, y2: pos.y,
        life: 0.16, max: 0.16, color: index === 0 ? "#efe6ff" : "#c9b6ff",
      });
      this.damageEnemy(enemy, {
        ...payload,
        damage: dmg,
        slow: index === hit.length - 1 ? (stats.slow || 0) : 0,
        slowDur: stats.slowDur || 0,
      }, 1);
      dmg *= stats.chainFall || 0.7;
      prev = pos;
    });
    this.sound("shot", "storm");
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.ox = p.x;
      p.oy = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      let struck = false;
      const target = this.enemies.find((e) => e.id === p.targetId && !e.dead && e.hp > 0);
      if (target) {
        const pos = this.positionOf(target);
        if (Math.hypot(pos.x - p.x, pos.y - p.y) <= target.radius + p.hit) {
          this.impact(p, pos.x, pos.y);
          struck = true;
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || e.hp <= 0) continue;
          const pos = this.positionOf(e);
          if (Math.hypot(pos.x - p.x, pos.y - p.y) <= e.radius + p.hit) {
            this.impact(p, pos.x, pos.y);
            struck = true;
            break;
          }
        }
      }
      if (struck) {
        p.dead = true;
        continue;
      }
      if (p.life <= 0) {
        if (p.splash) this.impact(p, p.x, p.y);
        p.dead = true;
      }
    }
  }

  impact(p, x, y) {
    if (p.splash) {
      for (const e of this.enemies) {
        if (e.dead || e.hp <= 0) continue;
        const pos = this.positionOf(e);
        const d = Math.hypot(pos.x - x, pos.y - y);
        if (d <= p.splash) {
          const fall = 1 - (d / Math.max(1, p.splash)) * 0.55;
          this.damageEnemy(e, p, fall);
        }
      }
      this.burst(x, y, "#ffb15a", 16, 90, 0.32);
      this.shake = Math.max(this.shake, 4.5);
      this.beams.push({
        x1: x, y1: y, x2: x, y2: y,
        life: 0.2, max: 0.2, color: "#ffd2a4", ring: p.splash,
      });
      this.fxSound("explode", 0.07);
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
    this.burst(x, y, p.color || "#fff", 5, 36, 0.18);
    this.fxSound("hit", 0.035);
  }

  damageEnemy(enemy, hit, fall) {
    if (!enemy || enemy.dead || enemy.hp <= 0) return;
    const pen = Math.min(0.85, hit.armorPen || 0);
    const armor = Math.min(0.8, (enemy.armor || 0) * (1 - pen));
    let amount = hit.damage * Math.max(0.2, fall) * (1 - armor);
    if (hit.bossBonus && enemy.boss) amount *= 1 + hit.bossBonus;
    amount = Math.max(1, Math.round(amount));
    enemy.sinceHit = 0;
    if (enemy.shield > 0) {
      const blocked = Math.min(enemy.shield, amount);
      enemy.shield -= blocked;
      amount -= blocked;
      enemy.flash = 0.08;
      if (amount <= 0) {
        this.floatText(this.positionOf(enemy).x, this.positionOf(enemy).y - enemy.radius, "štít", "#9be7ff");
        return;
      }
    }
    enemy.hp -= amount;
    enemy.flash = 0.1;
    const pos = this.positionOf(enemy);
    this.floatText(
      pos.x + (Math.random() - 0.5) * 8,
      pos.y - enemy.radius - 2,
      hit.crit ? amount + "!" : String(amount),
      hit.crit ? "#ffe27a" : "#f6f3ff",
      !!hit.crit,
    );
    const allowSlow = hit.slow && (!enemy.flying || hit.slowFlying);
    if (allowSlow) {
      const reduction = Math.min(0.72, hit.slow * (1 + this.bonuses.slowPower));
      const factor = 1 - reduction;
      if (factor < enemy.slowFactor) enemy.slowFactor = factor;
      enemy.slowT = Math.max(enemy.slowT, hit.slowDur || 1.4);
    }
    if (hit.poison && !hit.poisonTick) {
      enemy.poisonDps = Math.max(enemy.poisonDps || 0, hit.poison);
      enemy.poisonT = Math.max(enemy.poisonT || 0, hit.poisonDur || 2);
      enemy.poisonSpread = enemy.poisonSpread || !!hit.poisonSpread;
    }
    if (enemy.hp > 0) return;
    enemy.hp = 0;
    enemy.dead = true;
    this.kills += 1;
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
    } else {
      this.buzz(12);
    }
    if (enemy.poisonSpread && enemy.poisonDps) {
      const here = this.positionOf(enemy);
      for (const other of this.enemies) {
        if (other.dead || other.id === enemy.id) continue;
        const op = this.positionOf(other);
        if (Math.hypot(op.x - here.x, op.y - here.y) < 72) {
          other.poisonDps = Math.max(other.poisonDps || 0, enemy.poisonDps * 0.7);
          other.poisonT = Math.max(other.poisonT || 0, 1.6);
          break;
        }
      }
    }
    this.spawnSplit(enemy);
    this.spawnLoot(enemy, pos);
    const tint = {
      shadow: "#c9b6ff", runner: "#d6f25a", brute: "#d5deea", swarm: "#ff6a4a",
      bat: "#7aa2ff", split: "#e07ad4", mite: "#ffb08a", ward: "#9be7ff",
      boss: "#ff5a7a", brood: "#ff8ad4",
    };
    this.burst(
      pos.x,
      pos.y,
      tint[enemy.type] || "#c9b6ff",
      enemy.boss ? 22 : 8,
      enemy.boss ? 110 : 55,
      enemy.boss ? 0.45 : 0.26,
    );
    this.fxSound("death", 0.05);
  }

  spawnSplit(enemy) {
    const proto = CONFIG.enemies[enemy.type];
    if (!proto || !proto.splits || !proto.child || enemy.child || !this.plan) return;
    const child = CONFIG.enemies[proto.child];
    if (!child) return;
    const mapHp = this.map.hpMult || 1;
    const mapSpeed = this.map.speedMult || 1;
    for (let i = 0; i < proto.splits; i++) {
      const hp = Math.max(1, Math.round(child.hp * this.plan.hp * mapHp));
      this.enemies.push({
        id: this.nextId++,
        type: proto.child,
        name: child.name,
        dist: Math.max(0, enemy.dist - 6 - i * 4),
        hp,
        maxHp: hp,
        speed: child.speed * this.plan.speed * mapSpeed,
        reward: Math.max(1, Math.round(child.reward * this.plan.reward * this.bonuses.coinDrop)),
        leak: child.leak,
        radius: child.radius,
        armor: child.armor || 0,
        flying: false,
        boss: false,
        child: true,
        shield: 0,
        maxShield: 0,
        regen: 0,
        sinceHit: 0,
        poisonT: 0,
        poisonDps: 0,
        poisonAcc: 0,
        slowFactor: 1,
        slowT: 0,
        flash: 0,
        wobble: Math.random() * Math.PI * 2,
        dead: false,
      });
    }
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
      this.loot.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        value,
        age: 0,
        flying: false,
        fly: 0,
        done: false,
      });
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
  }

  burst(x, y, color, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.5),
        max: life,
        color,
        size: 1.6 + Math.random() * 2.2,
      });
    }
    if (this.particles.length > 180) {
      this.particles.splice(0, this.particles.length - 180);
    }
  }

  floatText(x, y, text, color, big) {
    const life = big ? 1 : 0.7;
    this.texts.push({ x, y, text, color, life, max: life, big: !!big });
    if (this.texts.length > 48) this.texts.splice(0, this.texts.length - 48);
  }

  noteCombo(pos) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = 2.3;
    if (this.combo >= 3) {
      this.floatText(pos.x, pos.y - 28, "Série " + this.combo, "#ffd56a", true);
    }
    if (this.combo > 0 && this.combo % 5 === 0) {
      this.banner = { text: "Série " + this.combo + "!", life: 1.2 };
      this.buzz(16);
    }
  }

  buzz(pattern) {
    if (this.hooks.buzz) this.hooks.buzz(pattern);
  }

  castMeteor(x, y) {
    if (this.mode !== "play") return;
    if (this.paused) {
      this.toastMsg("Nejdřív pokračuj ve hře");
      return;
    }
    if (!this.bonuses.abilities.meteor || this.abilityCd.meteor > 0) return;
    this.aimMeteor = false;
    this.abilityCd.meteor = 28;
    const payload = { damage: 160 * this.bonuses.damage, splash: 78, armorPen: 0.4, color: "#ffb15a" };
    for (const e of this.enemies) {
      if (e.dead || e.hp <= 0) continue;
      const pos = this.positionOf(e);
      const d = Math.hypot(pos.x - x, pos.y - y);
      if (d <= 78) this.damageEnemy(e, payload, 1 - (d / 78) * 0.45);
    }
    this.burst(x, y, "#ffb15a", 28, 120, 0.45);
    this.beams.push({ x1: x, y1: y, x2: x, y2: y, life: 0.28, max: 0.28, color: "#ffe1a8", ring: 78 });
    this.shake = Math.max(this.shake, 9);
    this.sound("explode");
    this.buzz([20, 30, 20]);
    this.toastMsg("Meteorít");
  }

  castFreeze() {
    if (this.mode !== "play") return;
    if (this.paused) {
      this.toastMsg("Nejdřív pokračuj ve hře");
      return;
    }
    if (!this.bonuses.abilities.freeze || this.abilityCd.freeze > 0) return;
    this.abilityCd.freeze = 36;
    this.freezeT = 3;
    this.banner = { text: "Čas zamrzl", life: 1.4 };
    this.sound("shot", "frost");
    this.buzz(22);
  }

  pointer(x, y) {
    if (this.mode !== "play" || this.paused) return;
    if (this.aimMeteor) {
      this.castMeteor(x, y);
      return;
    }
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
      return;
    }
    let slot = null;
    let slotD = 32;
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
      return;
    }
    this.selected = null;
  }

  build(type) {
    if (this.mode !== "play" || this.paused) return;
    const cfg = CONFIG.towers[type];
    if (!cfg) return;
    const sel = this.selected;
    if (!sel || sel.kind !== "slot") {
      this.toastMsg("Nejdřív vyber kámen");
      this.sound("deny");
      return;
    }
    if (this.towerAtSlot(sel.i)) {
      this.toastMsg("Tady už věž stojí");
      return;
    }
    if (!this.unlocked(type)) {
      this.toastMsg("Zamčeno ve stromu vylepšení");
      this.sound("deny");
      return;
    }
    if (this.coins < cfg.cost) {
      this.toastMsg("Máš málo mincí");
      this.sound("deny");
      return;
    }
    this.coins -= cfg.cost;
    const s = this.slots[sel.i];
    const tower = {
      id: this.nextId++,
      type,
      slot: sel.i,
      x: s.x,
      y: s.y,
      level: 1,
      spent: cfg.cost,
      cooldown: 0.12,
      recoil: 1,
      angle: -Math.PI / 2,
      born: 1,
    };
    this.towers.push(tower);
    this.selected = { kind: "tower", id: tower.id };
    this.burst(s.x, s.y, cfg.color, 14, 55, 0.32);
    this.sound("upgrade");
    this.buzz(12);
    this.toastMsg(cfg.name + " stojí");
    if (this.hooks.progress) this.hooks.progress("tower");
    this.advanceHint("build");
  }

  upgrade() {
    if (this.mode !== "play" || this.paused) return;
    const tower = this.selectedTower();
    if (!tower) return;
    const cfg = CONFIG.towers[tower.type];
    if (tower.level >= cfg.levels.length) {
      this.toastMsg("Nejvyšší úroveň");
      return;
    }
    const cost = cfg.upgrades[tower.level - 1];
    if (this.coins < cost) {
      this.toastMsg("Máš málo mincí");
      this.sound("deny");
      return;
    }
    this.coins -= cost;
    tower.spent += cost;
    tower.level += 1;
    tower.recoil = 1;
    tower.born = 1;
    if (tower.level >= cfg.levels.length && this.hooks.progress) this.hooks.progress("master");
    this.advanceHint("upgrade");
    this.burst(tower.x, tower.y, "#9af7ff", 16, 70, 0.36);
    this.sound("upgrade");
    this.toastMsg("Věž vylepšena");
  }

  sell() {
    if (this.mode !== "play" || this.paused) return;
    const tower = this.selectedTower();
    if (!tower) return;
    const refund = sellValue(tower.spent);
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
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.boss && !e.dead && e.hp > 0) return e;
    }
    return null;
  }

  finishRun() {
    if (this.runOver) return;
    this.runOver = true;
    this.paused = false;
    const died = this.lives <= 0;
    const reward = crystalsForRun({
      cleared: this.cleared,
      kills: this.kills,
      bossKills: this.bossKills,
      mapMult: this.map.crystalMult || 1,
      bonusCrystals: this.bonusCrystals || 0,
    }, this.bonuses);
    this.result = {
      wave: this.wave,
      cleared: this.cleared,
      kills: this.kills,
      bossKills: this.bossKills,
      crystals: reward,
      died,
      mapId: this.mapId,
    };
    this.mode = "summary";
    this.sound(died ? "defeat" : "clear");
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
    this.finishRun();
  }
}
