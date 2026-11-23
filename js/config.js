/**
 * Ladění balance — věže, nepřátelé, vlny, ekonomika i meta strom.
 * Hra čte odsud všechna čísla, ať se dají měnit bez sahání do logiky.
 */

export const CONFIG = {
  view: { w: 390, h: 844, hud: 64, panel: 176 },

  economy: {
    startLives: 20,
    startCoins: 145,
    sellRefund: 0.6,
    gapTime: 6,
    firstGap: 2.4,
    earlyBonusPerSec: 2,
  },

  crystals: {
    base: 3,
    perWave: 4,
    perBoss: 10,
    perKill: 0.25,
  },

  /**
   * Životy nepřátel rostou exponenciálně: vlna 1 = 1×, dál hpPower^(vlna-1).
   * Kolem vlny 8–12 má první běh padnout, meta ho posouvá dál.
   */
  hpPower: 1.18,
  speedGrowth: 0.02,
  rewardGrowth: 0.035,
  /** Každý další boss (vlna 10, 15, …) je o tolik tužší. */
  bossHpGrowth: 0.7,

  maps: [
    {
      id: "les",
      name: "Lesní stezka",
      blurb: "Klidnější začátek",
      unlockWave: 0,
      crystalMult: 1,
      hpMult: 1,
      speedMult: 1,
      portal: { x: 26, y: 120 },
      crystal: { x: 336, y: 600 },
      path: [
        { x: -30, y: 120 }, { x: 278, y: 120 }, { x: 278, y: 240 }, { x: 108, y: 240 },
        { x: 108, y: 360 }, { x: 292, y: 360 }, { x: 292, y: 480 }, { x: 96, y: 480 },
        { x: 96, y: 600 }, { x: 336, y: 600 },
      ],
      slots: [
        { x: 340, y: 104 }, { x: 340, y: 170 }, { x: 100, y: 182 }, { x: 166, y: 182 },
        { x: 46, y: 224 }, { x: 340, y: 254 }, { x: 46, y: 290 }, { x: 352, y: 338 },
        { x: 46, y: 374 }, { x: 358, y: 404 }, { x: 94, y: 422 }, { x: 160, y: 422 },
        { x: 34, y: 464 }, { x: 358, y: 470 }, { x: 34, y: 530 }, { x: 328, y: 536 },
        { x: 154, y: 542 }, { x: 34, y: 614 },
      ],
    },
    {
      id: "had",
      name: "Hadí soutěska",
      blurb: "Delší stezka, tužší stíny",
      unlockWave: 8,
      crystalMult: 1.4,
      hpMult: 1.12,
      speedMult: 1.04,
      portal: { x: 364, y: 140 },
      crystal: { x: 40, y: 640 },
      path: [
        { x: 410, y: 140 }, { x: 100, y: 140 }, { x: 100, y: 270 }, { x: 310, y: 270 },
        { x: 310, y: 400 }, { x: 90, y: 400 }, { x: 90, y: 530 }, { x: 320, y: 530 },
        { x: 320, y: 640 }, { x: 40, y: 640 },
      ],
      slots: [
        { x: 52, y: 98 }, { x: 34, y: 164 }, { x: 166, y: 206 }, { x: 232, y: 206 },
        { x: 298, y: 206 }, { x: 34, y: 230 }, { x: 370, y: 248 }, { x: 142, y: 332 },
        { x: 208, y: 332 }, { x: 76, y: 338 }, { x: 28, y: 386 }, { x: 370, y: 422 },
        { x: 28, y: 452 }, { x: 154, y: 464 }, { x: 220, y: 464 }, { x: 286, y: 464 },
        { x: 370, y: 488 }, { x: 34, y: 560 },
      ],
    },
    {
      id: "propast",
      name: "Krystalová propast",
      blurb: "Těsné zatáčky, víc krystalů",
      unlockWave: 14,
      crystalMult: 1.75,
      hpMult: 1.28,
      speedMult: 1.08,
      portal: { x: 24, y: 150 },
      crystal: { x: 50, y: 590 },
      path: [
        { x: -20, y: 150 }, { x: 250, y: 150 }, { x: 250, y: 230 }, { x: 70, y: 230 },
        { x: 70, y: 320 }, { x: 300, y: 320 }, { x: 300, y: 410 }, { x: 80, y: 410 },
        { x: 80, y: 500 }, { x: 310, y: 500 }, { x: 310, y: 590 }, { x: 50, y: 590 },
      ],
      slots: [
        { x: 28, y: 92 }, { x: 94, y: 92 }, { x: 160, y: 92 }, { x: 226, y: 92 },
        { x: 310, y: 128 }, { x: 316, y: 194 }, { x: 28, y: 200 }, { x: 322, y: 260 },
        { x: 364, y: 320 }, { x: 28, y: 368 }, { x: 364, y: 386 }, { x: 28, y: 434 },
        { x: 352, y: 452 }, { x: 370, y: 518 }, { x: 28, y: 530 }, { x: 358, y: 632 },
      ],
    },
  ],

  towers: {
    archer: {
      name: "Střelec",
      role: "Rychlé střely",
      color: "#f0c14a",
      cost: 50,
      unlock: null,
      mastery: "Mistrovská: každý výstřel vyšle i druhý šíp.",
      upgrades: [40, 75, 120],
      levels: [
        { damage: 9, fireRate: 2.05, range: 140, projectileSpeed: 480 },
        { damage: 14, fireRate: 2.4, range: 154, projectileSpeed: 510 },
        { damage: 22, fireRate: 2.8, range: 168, projectileSpeed: 540 },
        { damage: 30, fireRate: 3.15, range: 180, projectileSpeed: 560, shots: 2 },
      ],
    },
    cannon: {
      name: "Dělo",
      role: "Výbuch",
      color: "#e07a3d",
      cost: 100,
      unlock: null,
      mastery: "Mistrovská: výbuch navíc zpomalí.",
      upgrades: [80, 125, 180],
      levels: [
        { damage: 24, fireRate: 0.58, range: 126, projectileSpeed: 230, splash: 48 },
        { damage: 38, fireRate: 0.66, range: 138, projectileSpeed: 245, splash: 58 },
        { damage: 56, fireRate: 0.74, range: 150, projectileSpeed: 260, splash: 68 },
        { damage: 78, fireRate: 0.82, range: 162, projectileSpeed: 270, splash: 82, slow: 0.28, slowDur: 1.1 },
      ],
    },
    frost: {
      name: "Mrazák",
      role: "Zpomaluje",
      color: "#7ef6ff",
      cost: 80,
      unlock: null,
      mastery: "Mistrovská: mráz bere i netopýry.",
      upgrades: [65, 100, 150],
      levels: [
        { damage: 4, fireRate: 1.2, range: 132, projectileSpeed: 320, slow: 0.34, slowDur: 1.7 },
        { damage: 7, fireRate: 1.4, range: 146, projectileSpeed: 340, slow: 0.44, slowDur: 1.9 },
        { damage: 11, fireRate: 1.6, range: 158, projectileSpeed: 360, slow: 0.52, slowDur: 2.2 },
        { damage: 15, fireRate: 1.8, range: 172, projectileSpeed: 380, slow: 0.62, slowDur: 2.5, slowFlying: true },
      ],
    },
    sniper: {
      name: "Ostrostřelec",
      role: "Těžké zásahy",
      color: "#d2b0ff",
      cost: 155,
      unlock: "sniper",
      mastery: "Mistrovská: proti bossům +50 % poškození.",
      upgrades: [120, 180, 240],
      levels: [
        { damage: 58, fireRate: 0.42, range: 240, hitscan: true },
        { damage: 92, fireRate: 0.48, range: 275, hitscan: true },
        { damage: 140, fireRate: 0.54, range: 310, hitscan: true },
        { damage: 200, fireRate: 0.6, range: 350, hitscan: true, bossBonus: 0.5 },
      ],
    },
    storm: {
      name: "Bouře",
      role: "Řetězový blesk",
      color: "#c9b6ff",
      cost: 125,
      unlock: null,
      mastery: "Mistrovská: blesk skočí na dalšího stína.",
      upgrades: [90, 140, 200],
      levels: [
        { damage: 16, fireRate: 0.72, range: 128, chain: 2, chainFall: 0.65 },
        { damage: 26, fireRate: 0.82, range: 140, chain: 3, chainFall: 0.68 },
        { damage: 38, fireRate: 0.92, range: 152, chain: 3, chainFall: 0.72 },
        { damage: 52, fireRate: 1.05, range: 164, chain: 4, chainFall: 0.75, slow: 0.2, slowDur: 0.6 },
      ],
    },
    venom: {
      name: "Jedovka",
      role: "Jedovatý dotek",
      color: "#9be36a",
      cost: 90,
      unlock: null,
      mastery: "Mistrovská: jed přeskočí na souseda.",
      upgrades: [70, 110, 160],
      levels: [
        { damage: 4, fireRate: 1.15, range: 124, projectileSpeed: 300, poison: 7, poisonDur: 2.4 },
        { damage: 6, fireRate: 1.3, range: 136, projectileSpeed: 320, poison: 11, poisonDur: 2.8 },
        { damage: 8, fireRate: 1.45, range: 148, projectileSpeed: 340, poison: 16, poisonDur: 3.2 },
        { damage: 10, fireRate: 1.6, range: 160, projectileSpeed: 360, poison: 22, poisonDur: 3.6, poisonSpread: true },
      ],
    },
  },

  enemies: {
    shadow: { name: "Stín", hp: 30, speed: 56, reward: 5, leak: 1, radius: 14, armor: 0 },
    runner: { name: "Běžec", hp: 18, speed: 96, reward: 6, leak: 1, radius: 11, armor: 0 },
    brute: { name: "Obrněnec", hp: 170, speed: 32, reward: 14, leak: 2, radius: 18, armor: 0.5 },
    swarm: { name: "Roj", hp: 10, speed: 64, reward: 2, leak: 1, radius: 8, armor: 0 },
    bat: { name: "Netopýr", hp: 26, speed: 82, reward: 7, leak: 1, radius: 12, armor: 0, flying: true },
    split: { name: "Rozpadlík", hp: 46, speed: 46, reward: 8, leak: 1, radius: 14, armor: 0, splits: 2, child: "mite" },
    mite: { name: "Úlomek", hp: 12, speed: 68, reward: 2, leak: 1, radius: 8, armor: 0 },
    ward: { name: "Štítník", hp: 70, speed: 38, reward: 12, leak: 2, radius: 15, armor: 0.15, shield: 36, regen: 6 },
    boss: { name: "Pán stínů", hp: 780, speed: 22, reward: 55, leak: 8, radius: 28, armor: 0.12, boss: true },
    brood: { name: "Matka roje", hp: 640, speed: 20, reward: 60, leak: 8, radius: 26, armor: 0.05, boss: true, splits: 6, child: "mite" },
    chest: { name: "Truhla", hp: 18, speed: 44, reward: 22, leak: 0, radius: 13, armor: 0, chest: true, crystalDrop: 2 },
  },

  /**
   * Meta strom. effect se sčítá:
   * damage/fireRate/coinDrop/slowPower/splash/crystalGain jsou přírůstky (0.1 = +10 %),
   * startCoins a lives jsou ploché bonusy, crit a armorPen jsou šance / podíl,
   * unlock odemkne věž.
   */
  meta: [
    { id: "dmg1", branch: "sila", name: "Ostřejší hroty", desc: "+15 % poškození všech věží", cost: 10, req: [], effect: { damage: 0.15 } },
    { id: "rate1", branch: "sila", name: "Rychlejší střelba", desc: "+12 % kadence", cost: 24, req: ["dmg1"], effect: { fireRate: 0.12 } },
    { id: "crit1", branch: "sila", name: "Kritický zásah", desc: "8 % šance na dvojnásobné poškození", cost: 40, req: ["rate1"], effect: { crit: 0.08 } },
    { id: "sniper1", branch: "sila", name: "Oko ostrostřelce", desc: "Odemkne věž Ostrostřelec", cost: 48, req: ["rate1"], effect: { unlock: "sniper" } },
    { id: "pen1", branch: "sila", name: "Průrazné střely", desc: "Střely ignorují 30 % brnění", cost: 28, req: ["dmg1"], effect: { armorPen: 0.3 } },
    { id: "slow1", branch: "sila", name: "Hluboký mráz", desc: "Mrazák zpomaluje o 30 % silněji", cost: 34, req: ["pen1"], effect: { slowPower: 0.3 } },
    { id: "splash1", branch: "sila", name: "Širší výbuch", desc: "+22 % poloměr výbuchu děla", cost: 32, req: ["pen1"], effect: { splash: 0.22 } },

    { id: "gold1", branch: "zlato", name: "Plný měšec", desc: "+40 mincí na začátku tažení", cost: 8, req: [], effect: { startCoins: 40 } },
    { id: "gold2", branch: "zlato", name: "Královská pokladna", desc: "+70 mincí na začátku tažení", cost: 30, req: ["gold1"], effect: { startCoins: 70 } },
    { id: "drop1", branch: "zlato", name: "Štědrá kořist", desc: "+15 % mincí z nepřátel", cost: 14, req: [], effect: { coinDrop: 0.15 } },
    { id: "drop2", branch: "zlato", name: "Zlatá žíla", desc: "+20 % mincí z nepřátel", cost: 34, req: ["drop1"], effect: { coinDrop: 0.2 } },
    { id: "crys1", branch: "zlato", name: "Krystalová daň", desc: "+25 % získaných krystalů", cost: 38, req: ["drop2"], effect: { crystalGain: 0.25 } },

    { id: "life1", branch: "srdce", name: "Krystalové srdce", desc: "+1 život", cost: 16, req: [], effect: { lives: 1 } },
    { id: "life2", branch: "srdce", name: "Opevněné srdce", desc: "+1 další život", cost: 42, req: ["life1"], effect: { lives: 1 } },
    { id: "life3", branch: "srdce", name: "Třetí tep", desc: "+1 další život", cost: 64, req: ["life2"], effect: { lives: 1 } },

    { id: "dmg2", branch: "sila", name: "Ostří osudu", desc: "+12 % poškození všech věží", cost: 46, req: ["crit1"], effect: { damage: 0.12 } },
    { id: "range1", branch: "sila", name: "Dlouhé paže", desc: "+10 % dosah věží", cost: 26, req: ["dmg1"], effect: { range: 0.1 } },
    { id: "boss1", branch: "sila", name: "Proti titánům", desc: "+25 % poškození bossům", cost: 52, req: ["sniper1"], effect: { bossDamage: 0.25 } },
    { id: "meteor1", branch: "sila", name: "Meteorít", desc: "Ve hře klepni a sešli meteor. Odpočinek 28 s.", cost: 58, req: ["splash1"], effect: { ability: "meteor" } },
    { id: "freeze1", branch: "sila", name: "Zmrazení času", desc: "Na 3 s téměř zastaví stíny. Odpočinek 36 s.", cost: 58, req: ["slow1"], effect: { ability: "freeze" } },
    { id: "gold3", branch: "zlato", name: "Truhlice", desc: "+60 mincí na začátku tažení", cost: 44, req: ["gold2"], effect: { startCoins: 60 } },
    { id: "drop3", branch: "zlato", name: "Královská kořist", desc: "+15 % mincí z nepřátel", cost: 48, req: ["crys1"], effect: { coinDrop: 0.15 } },
  ],
};

export const TOWER_ORDER = ["archer", "cannon", "frost", "storm", "venom", "sniper"];

export const TARGET_MODES = [
  { id: "first", name: "První" },
  { id: "strong", name: "Nejsilnější" },
  { id: "near", name: "Nejbližší" },
];

export const ACHIEVEMENTS = [
  { id: "wave8", name: "První hradba", desc: "Dojdi na vlnu 8.", reward: 8, test: (s) => s.bestWave >= 8 },
  { id: "boss1", name: "Poraz prvního bosse", desc: "Slož Pána stínů nebo Matku roje.", reward: 12, test: (s) => (s.bossKills || 0) >= 1 },
  { id: "wave15", name: "Vlna 15", desc: "Dojdi alespoň na vlnu 15.", reward: 20, test: (s) => s.bestWave >= 15 },
  { id: "towers6", name: "Šest věží", desc: "Postav v jednom tažení 6 věží.", reward: 10, test: (s) => (s.maxTowers || 0) >= 6 },
  { id: "kills100", name: "Lovec stínů", desc: "Zabij celkem 100 nepřátel.", reward: 10, test: (s) => (s.kills || 0) >= 100 },
  { id: "early", name: "Netrpělivost", desc: "Vyvolej vlnu dřív pětkrát.", reward: 8, test: (s) => (s.earlyCalls || 0) >= 5 },
  { id: "master", name: "Mistr věže", desc: "Doveď věž na mistrovskou úroveň.", reward: 14, test: (s) => (s.masteries || 0) >= 1 },
  { id: "maps", name: "Tři stezky", desc: "Odemkni Krystalovou propast.", reward: 16, test: (s) => s.bestWave >= 14 },
];

export const BLESSINGS = [
  { id: "dmg", name: "Ostřejší noc", desc: "+15 % poškození do konce tažení" },
  { id: "rate", name: "Horečná střelba", desc: "+12 % kadence do konce tažení" },
  { id: "coins", name: "Měšec z hlíny", desc: "Hned 45 mincí" },
  { id: "life", name: "Druhý dech", desc: "+3 životy" },
  { id: "slow", name: "Hustá mlha", desc: "Stíny jsou o 8 % pomalejší" },
  { id: "crit", name: "Štěstěna", desc: "+6 % šance na kritický zásah" },
  { id: "range", name: "Daleký zrak", desc: "+8 % dosah věží" },
];

export const BRANCHES = [
  { id: "sila", name: "Síla věží" },
  { id: "zlato", name: "Měšec a kořist" },
  { id: "srdce", name: "Srdce krystalu" },
];

export function emptyBonuses() {
  return {
    damage: 1,
    fireRate: 1,
    startCoins: 0,
    lives: 0,
    coinDrop: 1,
    crit: 0,
    slowPower: 0,
    splash: 0,
    armorPen: 0,
    crystalGain: 0,
    range: 1,
    bossDamage: 0,
    abilities: {},
    unlocks: {},
  };
}

export function computeBonuses(owned) {
  const b = emptyBonuses();
  const have = owned || {};
  for (const node of CONFIG.meta) {
    if (!have[node.id]) continue;
    const e = node.effect || {};
    if (e.damage) b.damage += e.damage;
    if (e.fireRate) b.fireRate += e.fireRate;
    if (e.startCoins) b.startCoins += e.startCoins;
    if (e.lives) b.lives += e.lives;
    if (e.coinDrop) b.coinDrop += e.coinDrop;
    if (e.crit) b.crit += e.crit;
    if (e.slowPower) b.slowPower += e.slowPower;
    if (e.splash) b.splash += e.splash;
    if (e.armorPen) b.armorPen += e.armorPen;
    if (e.crystalGain) b.crystalGain += e.crystalGain;
    if (e.range) b.range += e.range;
    if (e.bossDamage) b.bossDamage += e.bossDamage;
    if (e.ability) b.abilities[e.ability] = true;
    if (e.unlock) b.unlocks[e.unlock] = true;
  }
  return b;
}

export function wavePlan(wave) {
  const hp = Math.pow(CONFIG.hpPower, wave - 1) * (wave > 7 ? Math.pow(1.14, wave - 7) : 1);
  const speed = 1 + (wave - 1) * CONFIG.speedGrowth;
  const reward = (1 + (wave - 1) * CONFIG.rewardGrowth) * (wave <= 3 ? 1.55 : 1);
  const groups = [];
  const boss = wave % 5 === 0;

  if (wave === 1) {
    groups.push({ type: "shadow", count: 7, interval: 0.48 });
  } else if (wave === 2) {
    groups.push({ type: "chest", count: 1, interval: 0.25 });
    groups.push({ type: "shadow", count: 7, interval: 0.5 });
    groups.push({ type: "runner", count: 3, interval: 0.42 });
  } else if (wave === 3) {
    groups.push({ type: "chest", count: 1, interval: 0.3 });
    groups.push({ type: "shadow", count: 6, interval: 0.46 });
    groups.push({ type: "runner", count: 4, interval: 0.4 });
  } else if (wave === 4) {
    groups.push({ type: "runner", count: 5, interval: 0.46 });
    groups.push({ type: "shadow", count: 5, interval: 0.58 });
    groups.push({ type: "brute", count: 1, interval: 0.8 });
  } else if (boss) {
    const tier = wave / 5;
    groups.push({ type: "shadow", count: Math.min(12, 4 + tier), interval: 0.55 });
    groups.push({ type: "brute", count: tier >= 3 ? 2 : 1, interval: 0.85 });
    groups.push({ type: (wave / 5) % 2 === 1 ? "boss" : "brood", count: 1, interval: 1.1 });
    if (wave >= 10) {
      groups.push({ type: "swarm", count: Math.min(10, 3 + tier), interval: 0.2 });
      groups.push({ type: "bat", count: Math.min(6, 1 + Math.floor(tier / 2)), interval: 0.4 });
    }
  } else {
    groups.push({
      type: "shadow",
      count: Math.min(16, 4 + Math.floor(wave * 0.8)),
      interval: Math.max(0.32, 0.7 - wave * 0.02),
    });
    if (wave >= 3) {
      groups.push({
        type: "runner",
        count: Math.min(12, 2 + Math.floor(wave * 0.55)),
        interval: 0.38,
      });
    }
    if (wave >= 4) {
      groups.push({
        type: "brute",
        count: Math.min(6, 1 + Math.floor((wave - 2) / 3)),
        interval: 0.8,
      });
    }
    if (wave >= 6) {
      groups.push({
        type: "swarm",
        count: Math.min(14, 4 + Math.floor(wave * 0.8)),
        interval: 0.18,
      });
    }
    if (wave >= 7) {
      groups.push({
        type: "bat",
        count: Math.min(10, 2 + Math.floor((wave - 6) * 0.7)),
        interval: 0.42,
      });
    }
    if (wave >= 5) {
      groups.push({
        type: "split",
        count: Math.min(6, 1 + Math.floor((wave - 4) / 2)),
        interval: 0.72,
      });
    }
    if (wave >= 6) {
      groups.push({
        type: "ward",
        count: Math.min(4, 1 + Math.floor((wave - 5) / 3)),
        interval: 0.9,
      });
    }
    if (wave % 4 === 0) groups.push({ type: "chest", count: 1, interval: 0.35 });
  }

  return { groups, hp, speed, reward, boss };
}

export function crystalsForRun(run, bonuses) {
  const cleared = run.cleared || 0;
  const kills = run.kills || 0;
  const bossKills = run.bossKills || 0;
  const c = CONFIG.crystals;
  const raw = c.base + cleared * c.perWave + bossKills * c.perBoss + kills * c.perKill;
  const mult = (1 + ((bonuses && bonuses.crystalGain) || 0)) * (run.mapMult || 1);
  const bonus = run.bonusCrystals || 0;
  if (cleared <= 0 && kills <= 0 && bossKills <= 0 && bonus <= 0) return 0;
  return Math.max(bonus > 0 || cleared > 0 || kills > 0 ? 1 : 0, Math.round(raw * mult)) + bonus;
}

export function mapById(id) {
  return CONFIG.maps.find((map) => map.id === id) || CONFIG.maps[0];
}

export function sellValue(spent) {
  return Math.max(0, Math.round((spent || 0) * CONFIG.economy.sellRefund));
}
