const KEY = "krystalova-hradba-v1";

let memory = null;

export function defaultSave() {
  return {
    v: 1,
    crystals: 0,
    bestWave: 0,
    bestByMap: { les: 0, had: 0, propast: 0 },
    mapId: "les",
    owned: {},
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
    cardsPicked: 0,
    runs: 0,
    kills: 0,
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

function normalize(data) {
  const base = defaultSave();
  const source = data && typeof data === "object" ? data : {};
  const owned = source.owned && typeof source.owned === "object" && !Array.isArray(source.owned)
    ? source.owned
    : {};
  const bestByMap = {
    ...base.bestByMap,
    ...(source.bestByMap && typeof source.bestByMap === "object" ? source.bestByMap : {}),
  };
  if (!source.bestByMap && Number.isFinite(source.bestWave)) bestByMap.les = source.bestWave;
  return {
    ...base,
    ...source,
    owned,
    bestByMap,
    mapId: source.mapId || "les",
    ach: source.ach && typeof source.ach === "object" ? source.ach : {},
    volume: Number.isFinite(source.volume) ? source.volume : 0.7,
    music: source.music !== false,
    tutorialDone: !!source.tutorialDone,
    crystals: Number.isFinite(source.crystals) ? source.crystals : 0,
    bestWave: Number.isFinite(source.bestWave) ? source.bestWave : 0,
    sound: source.sound !== false,
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
