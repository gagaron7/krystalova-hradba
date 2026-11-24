/**
 * Ladění balance — věže, nepřátelé, vlny, ekonomika i meta strom.
 * Hra čte odsud všechna čísla, ať se dají měnit bez sahání do logiky.
 */

export const CONFIG = {
  view: { w: 390, h: 844, hud: 64, panel: 176 },

  economy: {
    startLives: 20,
    startCoins: 130,
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
  hpPower: 1.195,
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

  /**
   * Věže: úrovně 1–3 jsou společné, na 3. úrovni si hráč vybere jednu ze dvou
   * specializací (paths) a ta má úrovně 4 a 5. Úroveň 5 je drahý cíl na střed hry.
   */
  towers: {
    archer: {
      name: "Střelec",
      role: "Rychlé střely",
      icon: "🏹",
      color: "#f0c14a",
      cost: 50,
      unlock: null,
      upgrades: [40, 75],
      levels: [
        { damage: 9, fireRate: 2.05, range: 140, projectileSpeed: 480 },
        { damage: 14, fireRate: 2.4, range: 154, projectileSpeed: 510 },
        { damage: 22, fireRate: 2.8, range: 168, projectileSpeed: 540 },
      ],
      paths: [
        {
          name: "Salva",
          desc: "Víc šípů naráz. Skvělé na roje a úlomky.",
          costs: [120, 260],
          levels: [
            { damage: 26, fireRate: 3.0, range: 176, projectileSpeed: 560, shots: 2 },
            { damage: 34, fireRate: 3.4, range: 186, projectileSpeed: 590, shots: 3 },
          ],
        },
        {
          name: "Lovecké oko",
          desc: "Velký dosah a silné kritické zásahy na tuhé cíle.",
          costs: [130, 280],
          levels: [
            { damage: 44, fireRate: 2.5, range: 205, projectileSpeed: 640, critBonus: 0.2, critMult: 2.5 },
            { damage: 66, fireRate: 2.7, range: 225, projectileSpeed: 680, critBonus: 0.3, critMult: 3 },
          ],
        },
      ],
    },
    cannon: {
      name: "Dělo",
      role: "Výbuch",
      icon: "💣",
      color: "#e07a3d",
      cost: 100,
      unlock: null,
      upgrades: [80, 125],
      levels: [
        { damage: 24, fireRate: 0.58, range: 126, projectileSpeed: 230, splash: 48 },
        { damage: 38, fireRate: 0.66, range: 138, projectileSpeed: 245, splash: 58 },
        { damage: 56, fireRate: 0.74, range: 150, projectileSpeed: 260, splash: 68 },
      ],
      paths: [
        {
          name: "Hmoždíř",
          desc: "Obří výbuch a velký dosah. Čistí celé skupiny.",
          costs: [180, 380],
          levels: [
            { damage: 92, fireRate: 0.7, range: 178, projectileSpeed: 250, splash: 92 },
            { damage: 150, fireRate: 0.74, range: 196, projectileSpeed: 260, splash: 112 },
          ],
        },
        {
          name: "Otřes",
          desc: "Rychlejší střelba a výbuch, který stíny zbrzdí.",
          costs: [170, 340],
          levels: [
            { damage: 70, fireRate: 0.86, range: 160, projectileSpeed: 280, splash: 76, slow: 0.35, slowDur: 1.1 },
            { damage: 102, fireRate: 0.96, range: 170, projectileSpeed: 300, splash: 86, slow: 0.5, slowDur: 1.4 },
          ],
        },
      ],
    },
    frost: {
      name: "Mrazák",
      role: "Zpomaluje",
      icon: "❄️",
      color: "#7ef6ff",
      cost: 80,
      unlock: null,
      upgrades: [65, 100],
      levels: [
        { damage: 4, fireRate: 1.2, range: 132, projectileSpeed: 320, slow: 0.34, slowDur: 1.7 },
        { damage: 7, fireRate: 1.4, range: 146, projectileSpeed: 340, slow: 0.44, slowDur: 1.9 },
        { damage: 11, fireRate: 1.6, range: 158, projectileSpeed: 360, slow: 0.52, slowDur: 2.2 },
      ],
      paths: [
        {
          name: "Ledová bouře",
          desc: "Mráz se rozprskne do okolí a zasáhne i netopýry.",
          costs: [150, 300],
          levels: [
            { damage: 14, fireRate: 1.7, range: 170, projectileSpeed: 380, slow: 0.58, slowDur: 2.4, slowFlying: true, splash: 46 },
            { damage: 20, fireRate: 1.9, range: 184, projectileSpeed: 400, slow: 0.64, slowDur: 2.8, slowFlying: true, splash: 64 },
          ],
        },
        {
          name: "Křehký led",
          desc: "Zmrzlí stíni dostávají víc poškození od všech věží.",
          costs: [150, 300],
          levels: [
            { damage: 16, fireRate: 1.8, range: 166, projectileSpeed: 380, slow: 0.5, slowDur: 2.2, brittle: 0.25 },
            { damage: 24, fireRate: 2.0, range: 176, projectileSpeed: 400, slow: 0.55, slowDur: 2.6, brittle: 0.4, slowFlying: true },
          ],
        },
      ],
    },
    sniper: {
      name: "Ostrostřelec",
      role: "Těžké zásahy",
      icon: "🎯",
      color: "#d2b0ff",
      cost: 155,
      unlock: "sniper",
      upgrades: [120, 180],
      levels: [
        { damage: 58, fireRate: 0.42, range: 240, hitscan: true },
        { damage: 92, fireRate: 0.48, range: 275, hitscan: true },
        { damage: 140, fireRate: 0.54, range: 310, hitscan: true },
      ],
      paths: [
        {
          name: "Popravčí",
          desc: "Dorazí slabé stíny naráz a drtí bosse.",
          costs: [240, 480],
          levels: [
            { damage: 200, fireRate: 0.6, range: 350, hitscan: true, bossBonus: 0.5, execute: 0.12 },
            { damage: 300, fireRate: 0.66, range: 380, hitscan: true, bossBonus: 0.8, execute: 0.2 },
          ],
        },
        {
          name: "Lovec odměn",
          desc: "Každé jeho zabití dá mnohem víc mincí.",
          costs: [220, 420],
          levels: [
            { damage: 170, fireRate: 0.62, range: 330, hitscan: true, bounty: 0.6 },
            { damage: 240, fireRate: 0.7, range: 360, hitscan: true, bounty: 1.0 },
          ],
        },
      ],
    },
    storm: {
      name: "Bouře",
      role: "Řetězový blesk",
      icon: "⚡",
      color: "#c9b6ff",
      cost: 125,
      unlock: null,
      upgrades: [90, 140],
      levels: [
        { damage: 16, fireRate: 0.72, range: 128, chain: 2, chainFall: 0.65 },
        { damage: 26, fireRate: 0.82, range: 140, chain: 3, chainFall: 0.68 },
        { damage: 38, fireRate: 0.92, range: 152, chain: 3, chainFall: 0.72 },
      ],
      paths: [
        {
          name: "Přetížení",
          desc: "Blesk přeskočí na mnohem víc stínů.",
          costs: [200, 400],
          levels: [
            { damage: 52, fireRate: 1.05, range: 164, chain: 5, chainFall: 0.78 },
            { damage: 76, fireRate: 1.15, range: 176, chain: 7, chainFall: 0.82 },
          ],
        },
        {
          name: "Statický šok",
          desc: "Každý zasažený stín na chvíli skoro zastaví.",
          costs: [190, 380],
          levels: [
            { damage: 48, fireRate: 1.0, range: 160, chain: 3, chainFall: 0.75, slow: 0.5, slowDur: 0.6, shockAll: true },
            { damage: 70, fireRate: 1.1, range: 170, chain: 4, chainFall: 0.8, slow: 0.7, slowDur: 0.8, shockAll: true },
          ],
        },
      ],
    },
    venom: {
      name: "Jedovka",
      role: "Jedovatý dotek",
      icon: "🧪",
      color: "#9be36a",
      cost: 90,
      unlock: null,
      upgrades: [70, 110],
      levels: [
        { damage: 4, fireRate: 1.15, range: 124, projectileSpeed: 300, poison: 7, poisonDur: 2.4 },
        { damage: 6, fireRate: 1.3, range: 136, projectileSpeed: 320, poison: 11, poisonDur: 2.8 },
        { damage: 8, fireRate: 1.45, range: 148, projectileSpeed: 340, poison: 16, poisonDur: 3.2 },
      ],
      paths: [
        {
          name: "Mor",
          desc: "Silný jed, který při smrti přeskočí na sousedy.",
          costs: [160, 320],
          levels: [
            { damage: 10, fireRate: 1.6, range: 160, projectileSpeed: 360, poison: 24, poisonDur: 3.6, poisonSpread: true },
            { damage: 14, fireRate: 1.8, range: 172, projectileSpeed: 380, poison: 38, poisonDur: 4, poisonSpread: true },
          ],
        },
        {
          name: "Kyselina",
          desc: "Rozleptá brnění i štíty, zasažení berou víc ode všech.",
          costs: [150, 300],
          levels: [
            { damage: 9, fireRate: 1.55, range: 158, projectileSpeed: 360, poison: 18, poisonDur: 3.4, acid: 0.2 },
            { damage: 12, fireRate: 1.7, range: 170, projectileSpeed: 380, poison: 26, poisonDur: 4, acid: 0.35 },
          ],
        },
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

    { id: "reroll1", branch: "takt", name: "Šťastná ruka", desc: "2× za tažení přehodíš nabídku karet", cost: 14, req: [], effect: { rerolls: 2 } },
    { id: "start1", branch: "takt", name: "Výbava", desc: "Na začátku tažení si vybereš 1 kartu", cost: 26, req: ["reroll1"], effect: { startCard: 1 } },
    { id: "rare1", branch: "takt", name: "Vzácné karty", desc: "Vzácné a epické karty chodí častěji", cost: 34, req: ["reroll1"], effect: { rareLuck: 1 } },
    { id: "cards4", branch: "takt", name: "Široký výběr", desc: "Nabídka 4 karet místo 3", cost: 52, req: ["start1"], effect: { cardChoices: 1 } },
    { id: "reroll2", branch: "takt", name: "Karetní mistr", desc: "+2 další přehození za tažení", cost: 40, req: ["rare1"], effect: { rerolls: 2 } },
    { id: "interest1", branch: "zlato", name: "Spořivost", desc: "Po každé vlně +4 % z nevyužitých mincí (max 30)", cost: 22, req: ["gold1"], effect: { interest: 0.04 } },
    { id: "heal1", branch: "srdce", name: "Léčivý krystal", desc: "Po každém bossovi +2 životy", cost: 28, req: ["life1"], effect: { bossHeal: 2 } },
    { id: "build1", branch: "srdce", name: "Stavitelský cech", desc: "Stavba věží o 10 % levnější", cost: 36, req: ["life1"], effect: { discount: 0.1 } },
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
  { id: "master", name: "Mistr věže", desc: "Doveď věž na 5. úroveň.", reward: 14, test: (s) => (s.masteries || 0) >= 1 },
  { id: "path", name: "Specialista", desc: "Zvol věži specializaci na 3. úrovni.", reward: 6, test: (s) => (s.paths || 0) >= 1 },
  { id: "cards10", name: "Karbaník", desc: "Vyber celkem 10 karet.", reward: 10, test: (s) => (s.cardsPicked || 0) >= 10 },
  { id: "maps", name: "Tři stezky", desc: "Odemkni Krystalovou propast.", reward: 16, test: (s) => s.bestWave >= 14 },
];

/**
 * Karty v tažení: po vlně 3, 5, 8, 10, 13, 15… vybereš 1 ze 3.
 * rarity: c = běžná, r = vzácná, e = epická (často s háčkem).
 * tower: karta se nabízí jen, když tu věž máš postavenou.
 */
export const CARDS = [
  { id: "dmg", rarity: "c", name: "Ostřejší noc", desc: "+12 % poškození všech věží" },
  { id: "rate", rarity: "c", name: "Horečná střelba", desc: "+10 % kadence všech věží" },
  { id: "coins", rarity: "c", name: "Měšec", desc: "Hned mince navíc (roste s vlnou)" },
  { id: "life", rarity: "c", name: "Druhý dech", desc: "+3 životy" },
  { id: "range", rarity: "c", name: "Daleký zrak", desc: "+8 % dosah věží" },
  { id: "interest", rarity: "c", name: "Úroky", desc: "Po každé vlně +6 % z nevyužitých mincí" },
  { id: "crit", rarity: "r", name: "Štěstěna", desc: "+8 % šance na kritický zásah" },
  { id: "slow", rarity: "r", name: "Hustá mlha", desc: "Všichni stíni jsou o 8 % pomalejší" },
  { id: "discount", rarity: "r", name: "Cech stavitelů", desc: "Stavba a vylepšení o 15 % levnější" },
  { id: "bounty", rarity: "r", name: "Lovci odměn", desc: "+15 % mincí z nepřátel" },
  { id: "archer", rarity: "r", tower: "archer", name: "Rychlé tětivy", desc: "Střelci +30 % kadence" },
  { id: "cannon", rarity: "r", tower: "cannon", name: "Větší nálože", desc: "Dělo +25 % výbuch a +15 % poškození" },
  { id: "frost", rarity: "r", tower: "frost", name: "Věčný mráz", desc: "Mrazák zpomaluje o 50 % déle" },
  { id: "storm", rarity: "r", tower: "storm", name: "Vodivý vzduch", desc: "Bouře skočí o 1 stína dál" },
  { id: "venom", rarity: "r", tower: "venom", name: "Silnější jed", desc: "Jedovka +40 % jedu" },
  { id: "sniper", rarity: "r", tower: "sniper", name: "Těžké náboje", desc: "Ostrostřelec +35 % poškození" },
  { id: "frenzy", rarity: "e", name: "Bouřlivá noc", desc: "+18 % kadence a +10 % poškození" },
  { id: "smith", rarity: "e", name: "Kovářův dar", desc: "Nejslabší věž (do 3. úrovně) se zdarma vylepší" },
  { id: "glass", rarity: "e", name: "Skleněné dělo", desc: "+35 % poškození, ale −5 životů", trade: true },
  { id: "greed", rarity: "e", name: "Chamtivost", desc: "+40 % mincí, ale stíni mají +10 % životů", trade: true },
];

/** Souhry mezi věžemi — platí vždy, ukazují se v panelu věže. */
export const SYNERGIES = [
  { id: "super", tower: "storm", with: "frost", name: "Supravodič", desc: "Bouře dává zpomaleným stínům +40 %" },
  { id: "boom", tower: "cannon", with: "venom", name: "Výbušný jed", desc: "Dělo dává otráveným stínům +30 %" },
  { id: "pierce", tower: "sniper", with: null, name: "Průraz", desc: "Ostrostřelec prostřelí štíty" },
  { id: "hunt", tower: "archer", with: "frost", name: "Lov na led", desc: "Střelec dává zpomaleným stínům +20 %" },
];

export const RARITY = {
  c: { name: "Běžná", color: "#c3b8a6" },
  r: { name: "Vzácná", color: "#7ef6ff" },
  e: { name: "Epická", color: "#e2a6ff" },
};

export const BRANCHES = [
  { id: "sila", name: "Síla věží" },
  { id: "zlato", name: "Měšec a kořist" },
  { id: "srdce", name: "Srdce krystalu" },
  { id: "takt", name: "Taktika a karty" },
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
    rerolls: 0,
    startCard: 0,
    rareLuck: 0,
    cardChoices: 3,
    interest: 0,
    bossHeal: 0,
    discount: 0,
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
    if (e.rerolls) b.rerolls += e.rerolls;
    if (e.startCard) b.startCard += e.startCard;
    if (e.rareLuck) b.rareLuck += e.rareLuck;
    if (e.cardChoices) b.cardChoices += e.cardChoices;
    if (e.interest) b.interest += e.interest;
    if (e.bossHeal) b.bossHeal += e.bossHeal;
    if (e.discount) b.discount += e.discount;
    if (e.ability) b.abilities[e.ability] = true;
    if (e.unlock) b.unlocks[e.unlock] = true;
  }
  return b;
}

export function wavePlan(wave) {
  const hp = Math.pow(CONFIG.hpPower, wave - 1) * (wave > 7 ? Math.pow(1.15, wave - 7) : 1);
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
