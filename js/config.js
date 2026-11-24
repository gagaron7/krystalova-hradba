/**
 * Krystalová hradba v3 — veškerá čísla na jednom místě.
 * Struktura: Cesta (stezky 1, 2, 3 …), každá stezka má 25 vln a na konci Vládce noci.
 * Věže: každá začíná jako neutrální Věž (úroveň 1–3), pak se promění ve specializaci
 * (úroveň 4–5) a s mistrovstvím ze stromu si vybere jednu ze dvou cest (úroveň 6–7).
 */
import { compilePath } from "./path.js";

export const CONFIG = {
  view: { w: 390, h: 844 },
  stageWaves: 25,

  economy: {
    startLives: 20,
    startCoins: 100,
    sellRefund: 0.7,
    gapTime: 6,
    firstGap: 4,
    earlyBonusPerSec: 2,
  },

  crystals: {
    base: 2,
    perWave: 2,
    perBoss: 6,
    perKill: 0.12,
    stageMult: 0.4,
    firstClear: 70,
    repeatClear: 25,
  },

  /** Životy nepřátel: vlna w na stezce s. */
  hpPower: 1.075,
  hpScale: 1.9,
  lateWave: 10,
  latePower: 1.16,
  stageHp: 1.6,
  stageArmor: 0.025,
  speedGrowth: 0.012,
  rewardGrowth: 0.03,

  base: {
    name: "Věž",
    role: "Neutrální základ",
    color: "#c8b48a",
    cost: 40,
    upgrades: [30, 45],
    levels: [
      { damage: 6, fireRate: 1.25, range: 118, projectileSpeed: 420 },
      { damage: 9, fireRate: 1.35, range: 126, projectileSpeed: 440 },
      { damage: 13, fireRate: 1.45, range: 134, projectileSpeed: 460 },
    ],
  },

  towers: {
    archer: {
      name: "Střelec", role: "Rychlé šípy", color: "#f0c14a",
      unlock: { start: true }, branchCost: 55, upgrade: 85,
      tiers: [
        { damage: 13, fireRate: 2.1, range: 148, projectileSpeed: 500 },
        { damage: 20, fireRate: 2.5, range: 160, projectileSpeed: 530 },
      ],
      paths: [
        { name: "Salva", desc: "Víc šípů naráz. Na roje a úlomky.", costs: [150, 320], levels: [
          { damage: 17, fireRate: 2.9, range: 172, projectileSpeed: 560, shots: 2 },
          { damage: 22, fireRate: 3.3, range: 184, projectileSpeed: 590, shots: 3 },
        ] },
        { name: "Lovecké oko", desc: "Dosah a drtivé kritické zásahy.", costs: [160, 340], levels: [
          { damage: 29, fireRate: 2.4, range: 205, projectileSpeed: 640, critBonus: 0.2, critMult: 2.5 },
          { damage: 43, fireRate: 2.6, range: 225, projectileSpeed: 680, critBonus: 0.3, critMult: 3 },
        ] },
      ],
    },
    cannon: {
      name: "Dělo", role: "Výbuch", color: "#e07a3d",
      unlock: { start: true }, branchCost: 85, upgrade: 125,
      tiers: [
        { damage: 26, fireRate: 0.6, range: 132, projectileSpeed: 240, splash: 54 },
        { damage: 42, fireRate: 0.68, range: 144, projectileSpeed: 255, splash: 64 },
      ],
      paths: [
        { name: "Hmoždíř", desc: "Obří výbuch, čistí celé skupiny.", costs: [200, 420], levels: [
          { damage: 52, fireRate: 0.7, range: 178, projectileSpeed: 250, splash: 92 },
          { damage: 88, fireRate: 0.74, range: 196, projectileSpeed: 260, splash: 112 },
        ] },
        { name: "Otřes", desc: "Rychlejší výbuchy, které brzdí.", costs: [190, 380], levels: [
          { damage: 39, fireRate: 0.86, range: 160, projectileSpeed: 280, splash: 76, slow: 0.35, slowDur: 1.1 },
          { damage: 60, fireRate: 0.96, range: 170, projectileSpeed: 300, splash: 86, slow: 0.5, slowDur: 1.4 },
        ] },
      ],
    },
    frost: {
      name: "Mrazák", role: "Zpomaluje", color: "#7ef6ff",
      unlock: { start: true }, branchCost: 65, upgrade: 95,
      tiers: [
        { damage: 4, fireRate: 1.3, range: 140, projectileSpeed: 330, slow: 0.36, slowDur: 1.8 },
        { damage: 7, fireRate: 1.5, range: 152, projectileSpeed: 350, slow: 0.46, slowDur: 2.1 },
      ],
      paths: [
        { name: "Ledová bouře", desc: "Mráz zasáhne okolí i netopýry.", costs: [160, 320], levels: [
          { damage: 7, fireRate: 1.7, range: 170, projectileSpeed: 380, slow: 0.56, slowDur: 2.4, slowFlying: true, splash: 46 },
          { damage: 10, fireRate: 1.9, range: 184, projectileSpeed: 400, slow: 0.62, slowDur: 2.8, slowFlying: true, splash: 64 },
        ] },
        { name: "Křehký led", desc: "Zmrzlí dostávají víc ode všech věží.", costs: [160, 320], levels: [
          { damage: 8, fireRate: 1.8, range: 166, projectileSpeed: 380, slow: 0.48, slowDur: 2.2, brittle: 0.25 },
          { damage: 13, fireRate: 2.0, range: 176, projectileSpeed: 400, slow: 0.54, slowDur: 2.6, brittle: 0.4, slowFlying: true },
        ] },
      ],
    },
    venom: {
      name: "Jedovka", role: "Jed na tuhé", color: "#9be36a",
      unlock: { meta: "un_venom" }, branchCost: 65, upgrade: 95,
      tiers: [
        { damage: 4, fireRate: 1.3, range: 134, projectileSpeed: 320, poison: 10, poisonDur: 2.8 },
        { damage: 6, fireRate: 1.45, range: 146, projectileSpeed: 340, poison: 15, poisonDur: 3.2 },
      ],
      paths: [
        { name: "Mor", desc: "Silný jed, při smrti přeskočí dál.", costs: [170, 340], levels: [
          { damage: 6.8, fireRate: 1.6, range: 160, projectileSpeed: 360, poison: 24, poisonDur: 3.6, poisonSpread: true },
          { damage: 8, fireRate: 1.8, range: 172, projectileSpeed: 380, poison: 38, poisonDur: 4, poisonSpread: true },
        ] },
        { name: "Kyselina", desc: "Rozleptá brnění i štíty.", costs: [160, 320], levels: [
          { damage: 6, fireRate: 1.55, range: 158, projectileSpeed: 360, poison: 18, poisonDur: 3.4, acid: 0.2 },
          { damage: 7, fireRate: 1.7, range: 170, projectileSpeed: 380, poison: 26, poisonDur: 4, acid: 0.35 },
        ] },
      ],
    },
    storm: {
      name: "Bouře", role: "Řetězový blesk", color: "#c9b6ff",
      unlock: { stage: 1 }, branchCost: 105, upgrade: 145,
      tiers: [
        { damage: 20, fireRate: 0.8, range: 136, chain: 3, chainFall: 0.66 },
        { damage: 31, fireRate: 0.9, range: 148, chain: 3, chainFall: 0.72 },
      ],
      paths: [
        { name: "Přetížení", desc: "Blesk přeskočí na mnohem víc stínů.", costs: [210, 420], levels: [
          { damage: 30, fireRate: 1.05, range: 164, chain: 5, chainFall: 0.78 },
          { damage: 44, fireRate: 1.15, range: 176, chain: 7, chainFall: 0.82 },
        ] },
        { name: "Statický šok", desc: "Každý zasažený skoro zastaví.", costs: [200, 400], levels: [
          { damage: 27, fireRate: 1.0, range: 160, chain: 3, chainFall: 0.75, slow: 0.5, slowDur: 0.6, shockAll: true },
          { damage: 40, fireRate: 1.1, range: 170, chain: 4, chainFall: 0.8, slow: 0.7, slowDur: 0.8, shockAll: true },
        ] },
      ],
    },
    sniper: {
      name: "Ostrostřelec", role: "Těžké zásahy", color: "#d2b0ff",
      unlock: { stage: 2 }, branchCost: 125, upgrade: 165,
      tiers: [
        { damage: 64, fireRate: 0.45, range: 260, hitscan: true },
        { damage: 100, fireRate: 0.5, range: 300, hitscan: true },
      ],
      paths: [
        { name: "Popravčí", desc: "Dorazí slabé naráz, drtí bosse.", costs: [250, 500], levels: [
          { damage: 117, fireRate: 0.6, range: 350, hitscan: true, bossBonus: 0.5, execute: 0.12 },
          { damage: 176, fireRate: 0.66, range: 380, hitscan: true, bossBonus: 0.8, execute: 0.2 },
        ] },
        { name: "Lovec odměn", desc: "Jeho zabití dají mnohem víc mincí.", costs: [230, 440], levels: [
          { damage: 98, fireRate: 0.62, range: 330, hitscan: true, bounty: 0.6 },
          { damage: 140, fireRate: 0.7, range: 360, hitscan: true, bounty: 1.0 },
        ] },
      ],
    },
    laser: {
      name: "Paprsek", role: "Sílí na jednom cíli", color: "#ff6ad5",
      unlock: { stage: 3 }, branchCost: 115, upgrade: 155,
      tiers: [
        { damage: 3, fireRate: 6, range: 140, beam: true, ramp: 0.1, rampMax: 3 },
        { damage: 5, fireRate: 6, range: 150, beam: true, ramp: 0.12, rampMax: 3.5 },
      ],
      paths: [
        { name: "Ohnisko", desc: "Obrovské zesílení na jeden cíl.", costs: [220, 440], levels: [
          { damage: 5.2, fireRate: 6, range: 160, beam: true, ramp: 0.16, rampMax: 5 },
          { damage: 6, fireRate: 6.5, range: 170, beam: true, ramp: 0.2, rampMax: 7 },
        ] },
        { name: "Hranol", desc: "Paprsek se láme na další stíny.", costs: [220, 440], levels: [
          { damage: 4.5, fireRate: 6, range: 160, beam: true, ramp: 0.1, rampMax: 3.5, chain: 2, chainFall: 0.8 },
          { damage: 6, fireRate: 6.5, range: 170, beam: true, ramp: 0.12, rampMax: 4, chain: 3, chainFall: 0.85 },
        ] },
      ],
    },
    bank: {
      name: "Pokladnice", role: "Mince po vlně", color: "#ffd56a",
      unlock: { stage: 4 }, branchCost: 90, upgrade: 140,
      tiers: [
        { damage: 0, fireRate: 0, range: 0, income: 18 },
        { damage: 0, fireRate: 0, range: 0, income: 32 },
      ],
      paths: [
        { name: "Banka", desc: "Velký příjem a úroky z mincí.", costs: [220, 440], levels: [
          { damage: 0, fireRate: 0, range: 0, income: 55, bankInterest: 0.03 },
          { damage: 0, fireRate: 0, range: 0, income: 85, bankInterest: 0.05 },
        ] },
        { name: "Lup", desc: "Všichni nepřátelé dávají víc mincí.", costs: [200, 400], levels: [
          { damage: 0, fireRate: 0, range: 0, income: 35, lootAura: 0.12 },
          { damage: 0, fireRate: 0, range: 0, income: 50, lootAura: 0.22 },
        ] },
      ],
    },
  },

  enemies: {
    shadow: { name: "Stín", hp: 30, speed: 54, reward: 4, leak: 1, radius: 14, armor: 0 },
    runner: { name: "Běžec", hp: 18, speed: 94, reward: 5, leak: 1, radius: 11, armor: 0 },
    brute: { name: "Obrněnec", hp: 160, speed: 32, reward: 12, leak: 2, radius: 18, armor: 0.45 },
    swarm: { name: "Roj", hp: 10, speed: 64, reward: 2, leak: 1, radius: 8, armor: 0 },
    bat: { name: "Netopýr", hp: 26, speed: 80, reward: 6, leak: 1, radius: 12, armor: 0, flying: true },
    split: { name: "Rozpadlík", hp: 46, speed: 46, reward: 7, leak: 1, radius: 14, armor: 0, splits: 2, child: "mite" },
    mite: { name: "Úlomek", hp: 12, speed: 68, reward: 2, leak: 1, radius: 8, armor: 0 },
    ward: { name: "Štítník", hp: 70, speed: 38, reward: 10, leak: 2, radius: 15, armor: 0.15, shield: 36, regen: 6 },
    healer: { name: "Šaman", hp: 60, speed: 42, reward: 11, leak: 1, radius: 14, armor: 0.05, heals: 0.1 },
    golem: { name: "Golem", hp: 320, speed: 25, reward: 20, leak: 3, radius: 19, armor: 0.6, slowImmune: true },
    ghost: { name: "Přízrak", hp: 55, speed: 68, reward: 9, leak: 1, radius: 13, armor: 0, phases: true },
    boss: { name: "Pán stínů", hp: 700, speed: 22, reward: 45, leak: 8, radius: 28, armor: 0.12, boss: true },
    brood: { name: "Matka roje", hp: 600, speed: 20, reward: 50, leak: 8, radius: 26, armor: 0.05, boss: true, splits: 6, child: "mite" },
    lord: { name: "Vládce noci", hp: 2600, speed: 15, reward: 150, leak: 50, radius: 32, armor: 0.2, boss: true, final: true, summons: true },
    chest: { name: "Truhla", hp: 18, speed: 44, reward: 18, leak: 0, radius: 13, armor: 0, chest: true, crystalDrop: 2 },
  },
};

/** Krátké představení nepřítele, když se objeví poprvé. */
export const ENEMY_INFO = {
  shadow: { text: "Obyčejný stín. Nic zvláštního, ale chodí ve velkém.", strong: "Ničím", weak: "Vším" },
  runner: { text: "Hodně rychlý a křehký. Proběhne, než se věže otočí.", strong: "Pomalé dělo", weak: "Mrazák, Střelec" },
  brute: { text: "Těžké brnění pohltí velkou část každého zásahu.", strong: "Slabé rychlé střely", weak: "Ostrostřelec, Kyselina, jed" },
  swarm: { text: "Celé hejno drobných. Jeden kus nic, dohromady nebezpečí.", strong: "Jednotlivé střely", weak: "Dělo, Bouře, Salva" },
  bat: { text: "Létá. Zpomalení na něj běžně nepůsobí.", strong: "Mrazák", weak: "Střelec, Ledová bouře" },
  split: { text: "Po smrti se rozpadne na dva rychlé úlomky.", strong: "Jedna velká rána", weak: "Výbuchy, Bouře" },
  mite: { text: "Úlomek z rozpadlíka. Malý a hbitý.", strong: "Pomalé věže", weak: "Výbuchy" },
  ward: { text: "Má obnovitelný štít, který spolkne první zásahy.", strong: "Slabé střely", weak: "Ostrostřelec, Kyselina" },
  healer: { text: "Šaman léčí stíny kolem sebe. Zabij ho jako prvního!", strong: "Pomalé zabíjení", weak: "Ostrostřelec, cíl Nejsilnější" },
  golem: { text: "Kamenný obr. Obrovské brnění a mráz ho nezpomalí.", strong: "Mrazák, slabé střely", weak: "Kyselina, Popravčí, Paprsek" },
  ghost: { text: "Občas zmizí a věže na něj nevidí.", strong: "Pomalé věže", weak: "Bouře, Dělo, rychlé střely" },
  boss: { text: "Boss. Hodně životů a únik bolí za 8.", strong: "Všechno slabé", weak: "Ostrostřelec, Paprsek, Zmrazení" },
  brood: { text: "Boss, který při smrti vypustí celé hejno.", strong: "Jedna linie obrany", weak: "Výbuchy za ním" },
  lord: { text: "Vládce noci, konec stezky. Svolává stíny. Porazíš ho a stezka je tvoje.", strong: "Skoro vše", weak: "Zmrazení času, Paprsek, Popravčí" },
  chest: { text: "Truhla s krystaly. Zabij ji, než uteče!", strong: "—", weak: "Cokoli" },
};

/* ===================== mapy a cesta ===================== */

const LAYOUTS = [
  { name: "Lesní stezka", path: [[-30, 120], [278, 120], [278, 240], [108, 240], [108, 360], [292, 360], [292, 480], [96, 480], [96, 600], [336, 600]] },
  { name: "Hadí soutěska", path: [[420, 140], [100, 140], [100, 270], [310, 270], [310, 400], [90, 400], [90, 530], [320, 530], [320, 640], [40, 640]] },
  { name: "Spirála", path: [[-30, 110], [355, 110], [355, 630], [35, 630], [35, 230], [245, 230], [245, 510], [140, 510], [140, 370]] },
  { name: "Křižovatka", path: [[-30, 300], [300, 300], [300, 120], [150, 120], [150, 620], [350, 620]] },
  { name: "Klikatice", path: [[-30, 110], [55, 110], [55, 630], [175, 630], [175, 110], [295, 110], [295, 630]] },
  { name: "Schody", path: [[-30, 110], [100, 110], [100, 220], [210, 220], [210, 330], [320, 330], [320, 440], [210, 440], [210, 550], [60, 550]] },
  { name: "Krystalová propast", path: [[-20, 150], [250, 150], [250, 230], [70, 230], [70, 320], [300, 320], [300, 410], [80, 410], [80, 500], [310, 500], [310, 590], [50, 590]] },
  { name: "Prstenec", path: [[-30, 630], [35, 630], [35, 110], [355, 110], [355, 630], [155, 630], [155, 250], [250, 250], [250, 500]] },
  { name: "Zrcadlový les", path: [[420, 120], [112, 120], [112, 240], [282, 240], [282, 360], [98, 360], [98, 480], [294, 480], [294, 600], [54, 600]] },
  { name: "Propast stínů", path: [[-30, 100], [345, 100], [345, 205], [45, 205], [45, 310], [345, 310], [345, 415], [45, 415], [45, 520], [345, 520], [345, 625], [60, 625]] },
];

const NAMES_EXTRA = ["Mlžná pláň", "Černý hvozd", "Ledová brána", "Rudá rokle", "Hvězdný most", "Popelavé pole", "Tichý močál", "Kamenný labyrint"];

function rng(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function proceduralPath(stage) {
  const r = rng(stage * 97 + 13);
  const rows = 4 + Math.floor(r() * 2);
  const top = 105;
  const bottom = 635;
  const gap = (bottom - top) / (rows - 1);
  const vertical = r() < 0.35;
  const pts = [];
  if (!vertical) {
    const left = () => 40 + Math.round(r() * 70);
    const right = () => 280 + Math.round(r() * 75);
    let fromLeft = true;
    pts.push([-30, top]);
    for (let i = 0; i < rows; i++) {
      const y = Math.round(top + gap * i);
      const x = fromLeft ? right() : left();
      if (i > 0) pts.push([pts[pts.length - 1][0], y]);
      pts.push([x, y]);
      fromLeft = !fromLeft;
    }
  } else {
    const cols = 3;
    const xs = [55, 175, 295];
    pts.push([-30, 110]);
    for (let i = 0; i < cols; i++) {
      const x = xs[i];
      const yTop = 110 + Math.round(r() * 60);
      const yBot = 560 + Math.round(r() * 70);
      const down = i % 2 === 0;
      if (i === 0) pts.push([x, 110]);
      else pts.push([x, pts[pts.length - 1][1]]);
      pts.push([x, down ? yBot : yTop]);
    }
  }
  if (r() < 0.5) return pts.map(([x, y]) => [390 - x, y]);
  return pts;
}

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Kameny pro věže se rozmístí samy podle tvaru stezky. */
export function generateSlots(points) {
  const segs = [];
  for (let i = 1; i < points.length; i++) segs.push([points[i - 1], points[i]]);
  const samples = [];
  const path = compilePath(points);
  for (let d = 0; d < path.total; d += 12) {
    let acc = 0;
    for (const s of path.segs) {
      if (d <= s.start + s.len) {
        const t = s.len ? (d - s.start) / s.len : 0;
        const x = s.ax + (s.bx - s.ax) * t;
        const y = s.ay + (s.by - s.ay) * t;
        if (x > -5 && x < 395) samples.push([x, y]);
        acc = 1;
        break;
      }
    }
    if (!acc) break;
  }
  const ys = points.map((p) => p.y);
  const minY = Math.max(70, Math.min(...ys) - 60);
  const maxY = Math.min(690, Math.max(...ys) + 60);
  const end = points[points.length - 1];
  const first = points.find((p) => p.x >= 0 && p.x <= 390) || points[1];
  const cands = [];
  for (let y = minY; y <= maxY; y += 6) {
    for (let x = 24; x <= 366; x += 6) {
      let d = Infinity;
      for (const [a, b] of segs) d = Math.min(d, distSeg(x, y, a.x, a.y, b.x, b.y));
      if (d < 46 || d > 66) continue;
      if (Math.hypot(x - end.x, y - end.y) < 56) continue;
      if (Math.hypot(x - first.x, y - first.y) < 40) continue;
      let cover = 0;
      for (const [sx, sy] of samples) if ((sx - x) * (sx - x) + (sy - y) * (sy - y) < 125 * 125) cover++;
      cands.push({ x, y, cover });
    }
  }
  cands.sort((a, b) => b.cover - a.cover || a.y - b.y || a.x - b.x);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= 20) break;
    if (picked.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 54)) continue;
    picked.push({ x: c.x, y: c.y, cover: c.cover });
  }
  picked.sort((a, b) => a.y - b.y || a.x - b.x);
  return picked;
}

const stageCache = {};

export function stageMap(stage) {
  const n = Math.max(1, stage | 0);
  if (stageCache[n]) return stageCache[n];
  const lay = n <= LAYOUTS.length ? LAYOUTS[n - 1] : null;
  const raw = lay ? lay.path : proceduralPath(n);
  const path = raw.map(([x, y]) => ({ x, y }));
  const first = path.find((p) => p.x >= 0 && p.x <= 390) || path[1];
  const crystal = path[path.length - 1];
  const name = lay ? lay.name : NAMES_EXTRA[(n - LAYOUTS.length - 1) % NAMES_EXTRA.length] + " " + romanize(Math.floor((n - LAYOUTS.length - 1) / NAMES_EXTRA.length) + 1);
  const map = {
    id: "s" + n,
    stage: n,
    name,
    path,
    portal: { x: Math.min(370, Math.max(20, first.x)), y: first.y },
    crystal: { x: crystal.x, y: crystal.y },
    slots: generateSlots(path),
    hpMult: stageHpMult(n),
    armorAdd: Math.min(0.3, CONFIG.stageArmor * (n - 1)),
    speedMult: 1 + Math.min(0.25, 0.025 * (n - 1)),
    crystalMult: 1 + CONFIG.crystals.stageMult * (n - 1),
  };
  stageCache[n] = map;
  return map;
}

function romanize(n) {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] || String(n);
}

/** Co dokončení stezky odemkne (poprvé). */
export function stageReward(stage) {
  const towers = Object.entries(CONFIG.towers).filter(([, t]) => t.unlock.stage === stage).map(([, t]) => t.name);
  const nodes = META.filter((m) => m.stage === stage).map((m) => m.name);
  const bits = [];
  if (towers.length) bits.push("věž " + towers.join(", "));
  if (nodes.length) bits.push(nodes.join(", "));
  bits.push("vyšší strop vylepšení");
  return bits.join(" · ");
}

/* ===================== vlny ===================== */

/** Násobek životů pro stezku (laděno simulací: plný strom N-1 projde stezku N). */
export const STAGE_HP = [1, 4.1, 13.4, 23.8, 63, 70, 200, 500, 520, 890];
export function stageHpMult(stage) {
  const n = Math.max(1, stage || 1);
  if (n <= STAGE_HP.length) return STAGE_HP[n - 1];
  return STAGE_HP[STAGE_HP.length - 1] * 1.5 * Math.pow(CONFIG.stageHp, n - STAGE_HP.length);
}

export function waveHp(wave, stage) {
  const w = Math.max(1, wave);
  let hp = Math.pow(CONFIG.hpPower, w - 1);
  if (w > CONFIG.lateWave) hp *= Math.pow(CONFIG.latePower, w - CONFIG.lateWave);
  const ramp = Math.min(1, Math.max(0, (w - 3) / 12));
  return hp * (1 + (CONFIG.hpScale - 1) * ramp) * stageHpMult(stage);
}

export function wavePlan(wave, stage) {
  const s = Math.max(1, stage || 1);
  const early = Math.min(4, s - 1);
  const ew = wave + early;
  const hp = waveHp(wave, s);
  const speed = 1 + (wave - 1) * CONFIG.speedGrowth;
  const reward = (1 + (wave - 1) * CONFIG.rewardGrowth) * (wave <= 3 ? 1.4 : 1);
  const groups = [];
  const final = wave >= CONFIG.stageWaves;
  const boss = wave % 5 === 0 && !final;
  const add = (type, count, interval) => {
    if (count > 0) groups.push({ type, count: Math.round(count), interval });
  };

  if (final) {
    add("shadow", 10, 0.45);
    add("brute", 3, 0.8);
    if (s >= 3) add("golem", 2, 1.2);
    add("lord", 1, 1.4);
    add("swarm", 12, 0.2);
    if (s >= 2) add("healer", 2, 0.8);
    add("bat", 6, 0.4);
    return { groups, hp, speed, reward, boss: true, final: true };
  }
  if (wave === 1) add("shadow", 6, 0.6);
  else if (wave === 2) {
    add("chest", 1, 0.3);
    add("shadow", 7, 0.55);
  } else if (wave === 3) {
    add("shadow", 6, 0.5);
    add("runner", 4, 0.45);
  } else if (boss) {
    const tier = wave / 5;
    add("shadow", 4 + tier * 2, 0.5);
    add("brute", Math.min(4, tier), 0.85);
    add(tier % 2 === 1 ? "boss" : "brood", 1, 1.1);
    if (tier >= 2) add("swarm", 4 + tier * 2, 0.2);
    if (tier >= 3) add("bat", 2 + tier, 0.4);
    if (s >= 2 && tier >= 2) add("healer", 1 + Math.floor(tier / 2), 0.9);
  } else {
    add("shadow", Math.min(18, 4 + ew * 0.7), Math.max(0.3, 0.7 - ew * 0.015));
    if (ew >= 3) add("runner", Math.min(12, 2 + ew * 0.45), 0.36);
    if (ew >= 4) add("brute", Math.min(7, 1 + (ew - 2) / 3), 0.8);
    if (ew >= 6) add("swarm", Math.min(16, 4 + ew * 0.7), 0.17);
    if (ew >= 7) add("split", Math.min(7, 1 + (ew - 5) / 2), 0.7);
    if (ew >= 9) add("bat", Math.min(10, 2 + (ew - 8) * 0.6), 0.42);
    if (ew >= 12) add("ward", Math.min(5, 1 + (ew - 11) / 3), 0.9);
    if (s >= 2 && ew >= 6) add("healer", Math.min(4, 1 + (ew - 6) / 5), 1.0);
    if (s >= 3 && ew >= 7) add("golem", Math.min(4, 1 + (ew - 7) / 5), 1.3);
    if (s >= 4 && ew >= 5) add("ghost", Math.min(8, 2 + (ew - 5) / 2), 0.55);
    if (wave % 4 === 2) add("chest", 1, 0.35);
  }
  return { groups, hp, speed, reward, boss, final: false };
}

export function crystalsForRun(run, bonuses) {
  const c = CONFIG.crystals;
  const cleared = run.cleared || 0;
  const kills = run.kills || 0;
  const bossKills = run.bossKills || 0;
  if (cleared <= 0 && kills <= 0) return run.bonusCrystals || 0;
  const raw = c.base + cleared * c.perWave + bossKills * c.perBoss + kills * c.perKill;
  const stage = run.stage || 1;
  const mult = (1 + ((bonuses && bonuses.crystalGain) || 0)) * (1 + c.stageMult * (stage - 1));
  let total = Math.max(1, Math.round(raw * mult)) + (run.bonusCrystals || 0);
  if (run.victory) total += Math.round((run.firstClear ? c.firstClear : c.repeatClear) * stage * (1 + ((bonuses && bonuses.crystalGain) || 0)));
  return total;
}

export function sellValue(spent, bonus) {
  return Math.max(0, Math.round((spent || 0) * Math.min(0.95, CONFIG.economy.sellRefund + (bonus || 0))));
}

/* ===================== strom vylepšení ===================== */

/**
 * Každý uzel má úrovně (ranky). Strop roste s dokončenými stezkami:
 * max = max + perStage × dokončené stezky (nejvýš hardMax).
 * cena další úrovně = cost × growth^úroveň.
 * stage: uzel se objeví až po dokončení té stezky.
 */
export const META = [
  // Útok
  { id: "atk", tab: "utok", name: "Ostří", unit: "% poškození", per: 10, mult: true, max: 4, perStage: 4, cost: 6, growth: 1.28 },
  { id: "rate", tab: "utok", name: "Kadence", unit: "% rychlost střelby", per: 5, mult: true, max: 3, perStage: 1, cost: 10, growth: 1.32, req: ["atk"] },
  { id: "range", tab: "utok", name: "Dalekozrakost", unit: "% dosah", per: 5, max: 4, cost: 12, growth: 1.45, req: ["atk"] },
  { id: "pen", tab: "utok", name: "Průraz", unit: "% ignorování brnění", per: 10, max: 3, perStage: 1, hardMax: 8, cost: 16, growth: 1.4, req: ["atk"] },
  { id: "crit", tab: "utok", name: "Kritický zásah", unit: "% šance na kritický zásah", per: 3, max: 5, perStage: 1, hardMax: 15, cost: 15, growth: 1.35, req: ["rate"] },
  { id: "critdmg", tab: "utok", name: "Drtivé kritiky", unit: "% síla kritického zásahu", per: 25, max: 4, perStage: 1, cost: 18, growth: 1.36, req: ["crit"] },
  { id: "boss", tab: "utok", name: "Zabiják titánů", unit: "% poškození bossům", per: 12, max: 3, perStage: 1, cost: 22, growth: 1.4, req: ["crit"] },
  { id: "spec", tab: "utok", name: "Mistrovské ruce", unit: "% poškození specializovaných věží", per: 8, max: 3, perStage: 1, cost: 26, growth: 1.4, req: ["atk"], stage: 1 },
  { id: "basedmg", tab: "utok", name: "Pevné základy", unit: "% poškození neutrální věže", per: 30, max: 3, cost: 8, growth: 1.6 },
  // Ekonomika
  { id: "start", tab: "zlato", name: "Měšec", unit: " mincí na začátku", per: 25, flat: true, max: 4, perStage: 2, cost: 5, growth: 1.3 },
  { id: "drop", tab: "zlato", name: "Kořist", unit: "% mincí z nepřátel", per: 7, max: 4, perStage: 2, cost: 8, growth: 1.3 },
  { id: "wavecoin", tab: "zlato", name: "Žold", unit: " mincí za každou vlnu", per: 5, flat: true, max: 3, perStage: 1, cost: 12, growth: 1.35, req: ["start"] },
  { id: "crys", tab: "zlato", name: "Krystalová daň", unit: "% krystalů", per: 10, max: 3, perStage: 1, cost: 15, growth: 1.45, req: ["drop"] },
  { id: "cheap", tab: "zlato", name: "Stavitelský cech", unit: "% levnější stavba i vylepšení", per: 4, max: 3, perStage: 1, hardMax: 8, cost: 20, growth: 1.45, req: ["drop"] },
  { id: "interest", tab: "zlato", name: "Spořivost", unit: "% úroky z mincí po vlně", per: 2, max: 3, hardMax: 3, cost: 18, growth: 1.6, req: ["wavecoin"] },
  { id: "sell", tab: "zlato", name: "Výkup", unit: "% víc za prodej", per: 6, max: 3, cost: 10, growth: 1.5, req: ["start"] },
  // Obrana
  { id: "life", tab: "srdce", name: "Srdce krystalu", unit: " životy", per: 3, flat: true, max: 3, perStage: 1, cost: 6, growth: 1.35 },
  { id: "slow", tab: "srdce", name: "Mlha", unit: "% pomalejší nepřátelé", per: 3, max: 3, perStage: 1, hardMax: 8, cost: 14, growth: 1.4, req: ["life"] },
  { id: "frostpow", tab: "srdce", name: "Hluboký mráz", unit: "% silnější zpomalení", per: 8, max: 3, perStage: 1, hardMax: 6, cost: 16, growth: 1.4, req: ["slow"] },
  { id: "heal", tab: "srdce", name: "Léčivý krystal", unit: " život po každém bossovi", per: 1, flat: true, max: 2, cost: 20, growth: 1.6, req: ["life"] },
  { id: "shield", tab: "srdce", name: "Krystalový štít", unit: " únik za vlnu bez ztráty", per: 1, flat: true, max: 2, cost: 30, growth: 1.8, req: ["heal"], stage: 1 },
  { id: "revive", tab: "srdce", name: "Druhá šance", unit: "× za tažení oživí s 10 životy", per: 1, flat: true, max: 1, cost: 60, growth: 1, req: ["life"], stage: 2 },
  // Věže
  { id: "train", tab: "veze", name: "Výcvik", unit: " úroveň navíc pro nové věže", per: 1, flat: true, max: 1, perStage: 1, hardMax: 2, cost: 30, growth: 3, stage: 1 },
  { id: "freeTower", tab: "veze", name: "Základní kámen", unit: " věž zdarma na začátku", per: 1, flat: true, max: 1, perStage: 1, hardMax: 3, cost: 30, growth: 2.2 },
  { id: "un_venom", tab: "veze", name: "Jedovka", desc: "Odemkne specializaci Jedovka", max: 1, cost: 15, growth: 1 },
  { id: "m_archer", tab: "veze", name: "Mistrovství: Střelec", desc: "Střelec může na 6. úrovni zvolit Salvu nebo Lovecké oko", max: 1, cost: 35, growth: 1, stage: 1, tower: "archer" },
  { id: "m_cannon", tab: "veze", name: "Mistrovství: Dělo", desc: "Dělo může zvolit Hmoždíř nebo Otřes", max: 1, cost: 40, growth: 1, stage: 2, tower: "cannon" },
  { id: "m_frost", tab: "veze", name: "Mistrovství: Mrazák", desc: "Mrazák může zvolit Ledovou bouři nebo Křehký led", max: 1, cost: 40, growth: 1, stage: 3, tower: "frost" },
  { id: "m_venom", tab: "veze", name: "Mistrovství: Jedovka", desc: "Jedovka může zvolit Mor nebo Kyselinu", max: 1, cost: 45, growth: 1, req: ["un_venom"], stage: 3, tower: "venom" },
  { id: "m_storm", tab: "veze", name: "Mistrovství: Bouře", desc: "Bouře může zvolit Přetížení nebo Statický šok", max: 1, cost: 55, growth: 1, stage: 4, tower: "storm" },
  { id: "m_sniper", tab: "veze", name: "Mistrovství: Ostrostřelec", desc: "Ostrostřelec může zvolit Popravčího nebo Lovce odměn", max: 1, cost: 65, growth: 1, stage: 5, tower: "sniper" },
  { id: "m_laser", tab: "veze", name: "Mistrovství: Paprsek", desc: "Paprsek může zvolit Ohnisko nebo Hranol", max: 1, cost: 75, growth: 1, stage: 6, tower: "laser" },
  { id: "m_bank", tab: "veze", name: "Mistrovství: Pokladnice", desc: "Pokladnice může zvolit Banku nebo Lup", max: 1, cost: 70, growth: 1, stage: 7, tower: "bank" },
  // Schopnosti a karty
  { id: "meteor", tab: "kouzla", name: "Meteorický déšť", desc: "Schopnost: 3 meteory samy dopadnou do největších skupin", max: 1, cost: 25, growth: 1 },
  { id: "meteorPow", tab: "kouzla", name: "Žhavé jádro", unit: "% síla meteorů", per: 35, max: 3, perStage: 1, cost: 18, growth: 1.4, req: ["meteor"] },
  { id: "meteorCd", tab: "kouzla", name: "Rychlé nebe", unit: "% kratší odpočinek meteorů", per: 12, max: 3, hardMax: 4, perStage: 1, cost: 22, growth: 1.5, req: ["meteor"] },
  { id: "freeze", tab: "kouzla", name: "Zmrazení času", desc: "Schopnost: všichni nepřátelé úplně zamrznou na 3 s", max: 1, cost: 30, growth: 1 },
  { id: "freezeDur", tab: "kouzla", name: "Dlouhá zima", unit: " s delší zmrazení", per: 0.75, flat: true, max: 4, cost: 20, growth: 1.45, req: ["freeze"] },
  { id: "freezeCd", tab: "kouzla", name: "Ledové hodiny", unit: "% kratší odpočinek zmrazení", per: 12, max: 3, hardMax: 4, perStage: 1, cost: 24, growth: 1.5, req: ["freeze"] },
  { id: "reroll", tab: "kouzla", name: "Šťastná ruka", unit: " přehození karet za tažení", per: 1, flat: true, max: 3, cost: 10, growth: 1.6 },
  { id: "startCard", tab: "kouzla", name: "Výbava", desc: "Na začátku tažení si vybereš kartu", max: 1, cost: 24, growth: 1, req: ["reroll"] },
  { id: "rare", tab: "kouzla", name: "Vzácné karty", unit: " stupeň vzácnějších karet", per: 1, flat: true, max: 2, cost: 26, growth: 1.8, req: ["reroll"] },
  { id: "cards4", tab: "kouzla", name: "Široký výběr", desc: "Nabídka 4 karet místo 3", max: 1, cost: 50, growth: 1, req: ["startCard"], stage: 1 },
];

export const META_TABS = [
  { id: "utok", name: "Útok" },
  { id: "zlato", name: "Zlato" },
  { id: "srdce", name: "Obrana" },
  { id: "veze", name: "Věže" },
  { id: "kouzla", name: "Kouzla" },
];

export function metaById(id) {
  return META.find((m) => m.id === id);
}

export function metaCap(node, cleared) {
  const cap = node.max + (node.perStage || 0) * Math.max(0, cleared || 0);
  return node.hardMax ? Math.min(node.hardMax, cap) : cap;
}

export function metaCost(node, rank) {
  const r = rank || 0;
  const g = node.growth || 1;
  if (r < node.max) return Math.round(node.cost * Math.pow(g, r));
  // nad základním stropem roste cena lineárně, aby šlo strom dohánět i na dalších stezkách
  const top = node.cost * Math.pow(g, Math.max(0, node.max - 1));
  return Math.round(top * (1 + 0.45 * (r - node.max + 1)));
}

export function metaAvailable(node, owned, cleared) {
  if (node.stage && (cleared || 0) < node.stage) return false;
  if (node.req && !node.req.every((r) => (owned[r] || 0) > 0)) return false;
  if (node.tower) {
    const unlock = CONFIG.towers[node.tower].unlock;
    if (unlock.stage && (cleared || 0) < unlock.stage) return false;
  }
  return true;
}

/** Plně vylepšený strom pro daný počet dokončených stezek (pro simulaci i test). */
export function maxedOwned(cleared) {
  const owned = {};
  for (const node of META) {
    if (node.stage && cleared < node.stage) continue;
    owned[node.id] = metaCap(node, cleared);
  }
  return owned;
}

export function metaValueText(node, rank) {
  if (!node.unit) return node.desc || "";
  const v = node.mult ? Math.round((Math.pow(1 + node.per / 100, rank) - 1) * 100) : Math.round(node.per * rank * 100) / 100;
  return (node.flat ? "+" : "+") + String(v).replace(".", ",") + node.unit;
}

export function emptyBonuses() {
  return {
    damage: 1, fireRate: 1, range: 1, crit: 0, critDmg: 0, armorPen: 0, bossDamage: 0, specDamage: 0, baseDamage: 0,
    startCoins: 0, coinDrop: 1, waveCoins: 0, crystalGain: 0, discount: 0, interest: 0, sellBonus: 0,
    lives: 0, enemySlow: 0, slowPower: 0, bossHeal: 0, leakShield: 0, revive: 0,
    train: 0, freeTowers: 0, mastery: {}, unlocks: {},
    abilities: {}, meteorPow: 0, meteorCd: 0, freezeDur: 0, freezeCd: 0,
    rerolls: 0, startCard: 0, rareLuck: 0, cardChoices: 3,
  };
}

export function computeBonuses(owned, cleared) {
  const b = emptyBonuses();
  const o = owned || {};
  const r = (id) => Math.max(0, Math.min(Number(o[id]) || 0, 999));
  b.damage *= Math.pow(1.1, r("atk"));
  b.fireRate *= Math.pow(1.05, r("rate"));
  b.range += 0.05 * r("range");
  b.armorPen += 0.1 * r("pen");
  b.crit += 0.03 * r("crit");
  b.critDmg += 0.25 * r("critdmg");
  b.bossDamage += 0.12 * r("boss");
  b.specDamage += 0.08 * r("spec");
  b.baseDamage += 0.3 * r("basedmg");
  b.startCoins += 25 * r("start");
  b.coinDrop += 0.07 * r("drop");
  b.waveCoins += 5 * r("wavecoin");
  b.crystalGain += 0.1 * r("crys");
  b.discount += 0.04 * r("cheap");
  b.interest += 0.02 * r("interest");
  b.sellBonus += 0.06 * r("sell");
  b.lives += 3 * r("life");
  b.enemySlow += 0.03 * r("slow");
  b.slowPower += 0.08 * r("frostpow");
  b.bossHeal += r("heal");
  b.leakShield += r("shield");
  b.revive += r("revive");
  b.train += Math.min(2, r("train"));
  b.freeTowers += r("freeTower");
  for (const node of META) if (node.tower && r(node.id)) b.mastery[node.tower] = true;
  if (r("un_venom")) b.unlocks.venom = true;
  for (const [id, t] of Object.entries(CONFIG.towers)) {
    if (t.unlock.start) b.unlocks[id] = true;
    if (t.unlock.stage && (cleared || 0) >= t.unlock.stage) b.unlocks[id] = true;
  }
  if (r("meteor")) b.abilities.meteor = true;
  if (r("freeze")) b.abilities.freeze = true;
  b.meteorPow += 0.35 * r("meteorPow");
  b.meteorCd += 0.12 * r("meteorCd");
  b.freezeDur += 0.75 * r("freezeDur");
  b.freezeCd += 0.12 * r("freezeCd");
  b.rerolls += r("reroll");
  b.startCard += r("startCard");
  b.rareLuck += r("rare");
  b.cardChoices += r("cards4");
  return b;
}

/* ===================== ostatní ===================== */

export const TOWER_ORDER = ["archer", "cannon", "frost", "venom", "storm", "sniper", "laser", "bank"];

export const TARGET_MODES = [
  { id: "first", name: "První" },
  { id: "strong", name: "Nejsilnější" },
  { id: "near", name: "Nejbližší" },
];

export const ACHIEVEMENTS = [
  { id: "wave10", name: "Pevná hradba", desc: "Dojdi na vlnu 10.", reward: 10, test: (s) => s.bestWave >= 10 },
  { id: "boss1", name: "První boss", desc: "Poraz bosse.", reward: 12, test: (s) => (s.bossKills || 0) >= 1 },
  { id: "branch", name: "Specialista", desc: "Proměň neutrální věž ve specializaci.", reward: 6, test: (s) => (s.branches || 0) >= 1 },
  { id: "master", name: "Mistr věže", desc: "Doveď věž na 7. úroveň.", reward: 20, test: (s) => (s.masteries || 0) >= 1 },
  { id: "kills500", name: "Lovec stínů", desc: "Zabij celkem 500 nepřátel.", reward: 15, test: (s) => (s.kills || 0) >= 500 },
  { id: "cards10", name: "Karbaník", desc: "Vyber celkem 10 karet.", reward: 10, test: (s) => (s.cardsPicked || 0) >= 10 },
  { id: "stage1", name: "První stezka", desc: "Dokonči 1. stezku.", reward: 30, test: (s) => (s.cleared || 0) >= 1 },
  { id: "stage3", name: "Poutník", desc: "Dokonči 3. stezku.", reward: 60, test: (s) => (s.cleared || 0) >= 3 },
  { id: "stage5", name: "Strážce cesty", desc: "Dokonči 5. stezku.", reward: 120, test: (s) => (s.cleared || 0) >= 5 },
  { id: "stage10", name: "Pán krystalu", desc: "Dokonči 10. stezku.", reward: 300, test: (s) => (s.cleared || 0) >= 10 },
];

export const CARDS = [
  { id: "dmg", rarity: "c", name: "Ostřejší noc", desc: "+12 % poškození všech věží" },
  { id: "rate", rarity: "c", name: "Horečná střelba", desc: "+10 % kadence všech věží" },
  { id: "coins", rarity: "c", name: "Měšec", desc: "Hned mince navíc (roste s vlnou)" },
  { id: "life", rarity: "c", name: "Druhý dech", desc: "+4 životy" },
  { id: "range", rarity: "c", name: "Daleký zrak", desc: "+8 % dosah věží" },
  { id: "interest", rarity: "c", name: "Úroky", desc: "Po každé vlně +6 % z nevyužitých mincí" },
  { id: "crit", rarity: "r", name: "Štěstěna", desc: "+8 % šance na kritický zásah" },
  { id: "slow", rarity: "r", name: "Hustá mlha", desc: "Všichni nepřátelé o 8 % pomalejší" },
  { id: "discount", rarity: "r", name: "Cech stavitelů", desc: "Stavba a vylepšení o 15 % levnější" },
  { id: "bounty", rarity: "r", name: "Lovci odměn", desc: "+15 % mincí z nepřátel" },
  { id: "archer", rarity: "r", tower: "archer", name: "Rychlé tětivy", desc: "Střelci +30 % kadence" },
  { id: "cannon", rarity: "r", tower: "cannon", name: "Větší nálože", desc: "Dělo +25 % výbuch a +15 % poškození" },
  { id: "frost", rarity: "r", tower: "frost", name: "Věčný mráz", desc: "Mrazák zpomaluje o 50 % déle" },
  { id: "storm", rarity: "r", tower: "storm", name: "Vodivý vzduch", desc: "Bouře skočí o 1 stína dál" },
  { id: "venom", rarity: "r", tower: "venom", name: "Silnější jed", desc: "Jedovka +40 % jedu" },
  { id: "sniper", rarity: "r", tower: "sniper", name: "Těžké náboje", desc: "Ostrostřelec +35 % poškození" },
  { id: "laser", rarity: "r", tower: "laser", name: "Čočky", desc: "Paprsek sílí o 40 % rychleji" },
  { id: "bank", rarity: "r", tower: "bank", name: "Zlaté cihly", desc: "Pokladnice +40 % příjmu" },
  { id: "frenzy", rarity: "e", name: "Bouřlivá noc", desc: "+18 % kadence a +10 % poškození" },
  { id: "smith", rarity: "e", name: "Kovářův dar", desc: "Nejslabší neutrální věž se zdarma vylepší" },
  { id: "glass", rarity: "e", name: "Skleněné dělo", desc: "+35 % poškození, ale −5 životů", trade: true },
  { id: "greed", rarity: "e", name: "Chamtivost", desc: "+40 % mincí, ale nepřátelé +10 % životů", trade: true },
];

export const SYNERGIES = [
  { id: "super", tower: "storm", with: "frost", name: "Supravodič", desc: "Bouře dává zpomaleným +40 %" },
  { id: "boom", tower: "cannon", with: "venom", name: "Výbušný jed", desc: "Dělo dává otráveným +30 %" },
  { id: "pierce", tower: "sniper", with: null, name: "Průraz", desc: "Ostrostřelec prostřelí štíty" },
  { id: "hunt", tower: "archer", with: "frost", name: "Lov na led", desc: "Střelec dává zpomaleným +20 %" },
  { id: "focus", tower: "laser", with: "frost", name: "Ledová čočka", desc: "Paprsek dává zpomaleným +25 %" },
];

export const RARITY = {
  c: { name: "Běžná", color: "#c3b8a6" },
  r: { name: "Vzácná", color: "#7ef6ff" },
  e: { name: "Epická", color: "#e2a6ff" },
};

/** Ceny uzlů staré verze (pro vrácení krystalů při převodu uložené hry). */
export const LEGACY_META_COSTS = {"dmg1":10,"rate1":24,"crit1":40,"sniper1":48,"pen1":28,"slow1":34,"splash1":32,"gold1":8,"gold2":30,"drop1":14,"drop2":34,"crys1":38,"life1":16,"life2":42,"life3":64,"dmg2":46,"range1":26,"boss1":52,"meteor1":58,"freeze1":58,"gold3":44,"drop3":48,"reroll1":14,"start1":26,"rare1":34,"cards4":52,"reroll2":40,"interest1":22,"heal1":28,"build1":36};

/** Zkrácený zápis velkých čísel: 12 500 → 12,5 tis., 3 400 000 → 3,4 mil. */
export function fmt(n) {
  const v = Math.round(Number(n) || 0);
  const a = Math.abs(v);
  const short = (x, unit) => (x >= 100 ? String(Math.round(x)) : String(Math.round(x * 10) / 10).replace(".", ",")) + unit;
  if (a < 10000) return String(v);
  if (a < 1e6) return short(v / 1e3, "k");
  if (a < 1e9) return short(v / 1e6, "M");
  return short(v / 1e9, "G");
}
