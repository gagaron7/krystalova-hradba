import { LEGACY_META_COSTS, META } from "./config.js";

const KEY = "krystalova-hradba-v1";
const META_IDS = new Set(META.map((m) => m.id));

let memory = null;

export function defaultSave() {
  return {
    v: 3,
    crystals: 0,
    bestWave: 0,
    bestByStage: {},
    cleared: 0,
    stage: 1,
    owned: {},
    seenEnemies: {},
    sound: true,
    volume: 0.7,
    music: true,
    tutorialDone: false,
    ach: {},
    bossKills: 0,
    maxTowers: 0,
    earlyCalls: 0,
    masteries: 0,
    paths: 0,
    branches: 0,
    cardsPicked: 0,
    runs: 0,
    kills: 0,
    victories: 0,
    migrationRefund: 0,
  };
}

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

function readRaw() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return null;
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeRaw(text) {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return false;
    localStorage.setItem(KEY, text);
    return true;
  } catch {
    return false;
  }
}

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/**
 * Převod starých uložených her: staré uzly stromu (v1/v2) nejdou přenést 1:1,
 * proto se za ně vrátí všechny utracené krystaly a hráč si nový strom koupí znovu.
 */
function migrate(source) {
  const out = { ...source };
  const v = num(source.v, 1);
  const owned = obj(source.owned);
  if (v < 3) {
    let refund = 0;
    for (const [id, value] of Object.entries(owned)) {
      if (value && LEGACY_META_COSTS[id]) refund += LEGACY_META_COSTS[id];
    }
    out.crystals = num(source.crystals) + refund;
    out.migrationRefund = refund;
    out.owned = {};
    out.cleared = 0;
    out.stage = 1;
    out.bestByStage = {};
    out.v = 3;
  }
  return out;
}

function normalize(data) {
  const base = defaultSave();
  const source = migrate(obj(data));
  const owned = {};
  for (const [id, value] of Object.entries(obj(source.owned))) {
    if (!META_IDS.has(id)) continue;
    const rank = Math.max(0, Math.floor(Number(value) || 0));
    if (rank > 0) owned[id] = rank;
  }
  const cleared = Math.max(0, Math.floor(num(source.cleared)));
  const stage = Math.min(cleared + 1, Math.max(1, Math.floor(num(source.stage, 1))));
  return {
    ...base,
    ...source,
    v: 3,
    owned,
    cleared,
    stage,
    bestByStage: obj(source.bestByStage),
    seenEnemies: obj(source.seenEnemies),
    ach: obj(source.ach),
    volume: Number.isFinite(source.volume) ? source.volume : 0.7,
    music: source.music !== false,
    tutorialDone: !!source.tutorialDone,
    crystals: Math.max(0, Math.floor(num(source.crystals))),
    bestWave: num(source.bestWave),
    sound: source.sound !== false,
    migrationRefund: num(source.migrationRefund),
  };
}

export function loadSave() {
  if (memory) return clone(memory);
  try {
    const raw = readRaw();
    if (!raw) {
      memory = defaultSave();
      return clone(memory);
    }
    memory = normalize(JSON.parse(raw));
    writeRaw(JSON.stringify(memory));
    return clone(memory);
  } catch {
    memory = defaultSave();
    return clone(memory);
  }
}

export function writeSave(save) {
  const clean = normalize(save);
  memory = clean;
  writeRaw(JSON.stringify(clean));
}

export const SAVE_KEY = KEY;
