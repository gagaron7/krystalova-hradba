import { ACHIEVEMENTS, BRANCHES, CARDS, CONFIG, RARITY, SYNERGIES, TARGET_MODES, TOWER_ORDER, mapById, sellValue } from "./config.js";
import { createAudio } from "./audio.js";
import { Game } from "./game.js";
import { render, drawTowerIcon } from "./render.js";
import { defaultSave, loadSave, writeSave } from "./storage.js";

const $ = (id) => document.getElementById(id);
const audio = createAudio();
let save = loadSave();
audio.setEnabled(save.sound);
audio.setVolume(save.volume == null ? 0.7 : save.volume);
audio.setMusic(save.music !== false);

const app = $("app");
const board = $("board");
const canvas = $("view");
const ctx = canvas.getContext("2d", { alpha: false });
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, cw: 390, ch: 600 };

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* some browsers block vibration */
  }
}

const HINTS = {
  build: "Klepni na kamenný kruh u stezky a dole vyber věž.",
  coins: "Mince přiletí samy. Můžeš je i sebrat klepnutím.",
  upgrade: "Klepni na postavenou věž a vylepši ji.",
  early: "Další vlnu vyvolej dřív tlačítkem vpravo dole — dostaneš bonus.",
};

const game = new Game({
  sound: (name, arg) => audio.play(name, arg),
  buzz,
  onRunEnd: (result) => onRunEnd(result),
  hintDone: () => finishTutorial(),
  progress: (kind) => noteProgress(kind),
});
game.hintDone = !!save.tutorialDone;
game.setOwned(save.owned);
window.__game = game;

let currentScreen = "menu";
let treeTab = "sila";
let treeToastTimer = 0;
let lastBanner = "";

/* ================= helpers ================= */

function cz(n) {
  const rounded = Math.round(n * 10) / 10;
  return String(rounded).replace(".", ",");
}

function csPlural(n, one, few, many) {
  const value = Math.abs(n) | 0;
  if (value === 1) return one;
  if (value >= 2 && value <= 4) return few;
  return many;
}

function crystalWord(n) {
  return csPlural(n, "krystal", "krystaly", "krystalů");
}

function metaById(id) {
  return CONFIG.meta.find((node) => node.id === id);
}

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setHtml(el, html) {
  if (el && el.__html !== html) {
    el.__html = html;
    el.innerHTML = html;
  }
}

/* ================= layout ================= */

function mapBounds(map) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of map.slots) {
    minY = Math.min(minY, p.y - 26);
    maxY = Math.max(maxY, p.y + 28);
  }
  for (const p of map.path) {
    if (p.x < -5 || p.x > 395) continue;
    minY = Math.min(minY, p.y - 28);
    maxY = Math.max(maxY, p.y + 28);
  }
  minY = Math.min(minY, map.crystal.y - 42, map.portal.y - 30);
  maxY = Math.max(maxY, map.crystal.y + 42);
  return { x0: 0, x1: CONFIG.view.w, y0: minY, y1: maxY };
}

function appHeight() {
  return Math.round(window.innerHeight || document.documentElement.clientHeight || 700);
}

function layout() {
  app.style.height = appHeight() + "px";
  const bw = board.clientWidth;
  const bh = board.clientHeight;
  if (!bw || !bh) return;
  const b = mapBounds(game.map);
  const ww = b.x1 - b.x0;
  const wh = b.y1 - b.y0;
  const scale = Math.min(bw / ww, bh / wh);
  view.scale = scale;
  view.ox = (bw - ww * scale) / 2 - b.x0 * scale;
  view.oy = (bh - wh * scale) / 2 - b.y0 * scale;
  view.dpr = Math.min(window.devicePixelRatio || 1, 3);
  view.cw = bw;
  view.ch = bh;
  const w = Math.max(1, Math.round(bw * view.dpr));
  const h = Math.max(1, Math.round(bh * view.dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.ox) / view.scale,
    y: (clientY - rect.top - view.oy) / view.scale,
  };
}

function updateLootTarget() {
  const el = $("hud-coins");
  if (!el || currentScreen !== "game") return;
  const er = el.getBoundingClientRect();
  if (!er.width) return;
  const p = toWorld(er.left + er.width / 2, er.top + er.height / 2);
  game.lootTarget.x = p.x;
  game.lootTarget.y = p.y;
}

/* ================= fullscreen ================= */

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || navigator.standalone === true;
}

function fsElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function fsSupported() {
  const el = document.documentElement;
  const can = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  const enabled = document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false;
  return can && enabled;
}

async function toggleFullscreen() {
  audio.unlock();
  audio.play("ui");
  if (fsElement()) {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch {
      /* ignore */
    }
    return;
  }
  if (isStandalone()) {
    flashToast("Hra už běží přes celou obrazovku");
    return;
  }
  if (fsSupported()) {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else el.webkitRequestFullscreen();
      try {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock("portrait").catch(() => {});
      } catch {
        /* not supported */
      }
      return;
    } catch {
      /* fall through to hint */
    }
  }
  if (game.mode === "play" && !game.paused) game.setPaused(true);
  $("fs-layer").classList.remove("hidden");
}

function syncFsButtons() {
  const on = !!fsElement() || isStandalone();
  document.querySelectorAll("[data-fs]").forEach((btn) => {
    btn.classList.toggle("is-on", on);
    if (btn.classList.contains("ibtn")) btn.textContent = on && fsElement() ? "✕" : "⛶";
    else btn.textContent = fsElement() ? "⛶ Ukončit celou obr." : btn.closest("#pause-layer") ? "⛶ Celá obr." : "⛶ Celá obrazovka";
  });
}

function flashToast(text) {
  if (currentScreen === "game") game.toastMsg(text);
  else treeToast(text);
}

/* ================= save / progress ================= */

function finishTutorial() {
  save.tutorialDone = true;
  game.hintDone = true;
  writeSave(save);
}

function noteProgress(kind) {
  if (kind === "tower") save.maxTowers = Math.max(save.maxTowers || 0, game.towers.length);
  if (kind === "master") save.masteries = (save.masteries || 0) + 1;
  if (kind === "early") save.earlyCalls = (save.earlyCalls || 0) + 1;
  if (kind === "path") save.paths = (save.paths || 0) + 1;
  if (kind === "card") save.cardsPicked = (save.cardsPicked || 0) + 1;
  writeSave(save);
  grantAchievements();
}

function grantAchievements() {
  save.ach = save.ach || {};
  const fresh = [];
  for (const item of ACHIEVEMENTS) {
    if (save.ach[item.id]) continue;
    if (!item.test(save)) continue;
    save.ach[item.id] = true;
    save.crystals += item.reward;
    fresh.push(item);
  }
  if (!fresh.length) return;
  writeSave(save);
  refreshCrystals();
  const pop = $("ach-pop");
  pop.textContent = "Úspěch: " + fresh.map((item) => `${item.name} +${item.reward}`).join(" · ");
  pop.classList.remove("hidden");
  window.clearTimeout(grantAchievements.timer);
  grantAchievements.timer = window.setTimeout(() => pop.classList.add("hidden"), 2600);
}

/* ================= screens ================= */

function showScreen(name) {
  currentScreen = name;
  for (const id of ["menu", "settings", "tree", "game", "ach"]) {
    $("screen-" + id).classList.toggle("active", id === name);
  }
  if (name !== "game") {
    $("pause-layer").classList.add("hidden");
    $("summary-layer").classList.add("hidden");
  }
  syncFsButtons();
  requestAnimationFrame(layout);
}

function refreshCrystals() {
  setText($("menu-crystals"), String(save.crystals));
  setText($("tree-crystals"), String(save.crystals));
}

function goalInfo() {
  const avail = CONFIG.meta.filter((n) => !save.owned[n.id] && n.req.every((r) => save.owned[r]));
  const affordable = avail.filter((n) => n.cost <= save.crystals).sort((a, b) => a.cost - b.cost);
  const next = avail.slice().sort((a, b) => a.cost - b.cost)[0] || null;
  return { avail, affordable, next };
}

function goalHtml() {
  const { affordable, next } = goalInfo();
  if (!next) return `<div class="goal-row"><b>Strom vylepšení je kompletní!</b></div>`;
  if (affordable.length) {
    const names = affordable.slice(0, 2).map((n) => n.name).join(", ");
    return `<div class="goal-row"><b>Můžeš koupit ${affordable.length} ${csPlural(affordable.length, "vylepšení", "vylepšení", "vylepšení")}</b><span><i class="gem-dot"></i> ${save.crystals}</span></div>
      <div class="goal-bar"><i style="width:100%"></i></div><small class="prose small">Třeba: ${names}</small>`;
  }
  const pct = Math.min(100, Math.round((save.crystals / next.cost) * 100));
  return `<div class="goal-row"><b>Další cíl: ${next.name}</b><span>${save.crystals} / ${next.cost}</span></div>
    <div class="goal-bar"><i style="width:${pct}%"></i></div><small class="prose small">${next.desc} · chybí ${next.cost - save.crystals} ${crystalWord(next.cost - save.crystals)}</small>`;
}

function refreshBadges() {
  const n = goalInfo().affordable.length;
  for (const id of ["tree-badge", "sum-badge"]) {
    const el = $(id);
    el.textContent = String(n);
    el.classList.toggle("hidden", n === 0);
  }
}

function renderMaps() {
  const el = $("map-picker");
  el.innerHTML = CONFIG.maps.map((map) => {
    const best = (save.bestByMap && save.bestByMap[map.id]) || 0;
    const open = save.bestWave >= map.unlockWave;
    const on = save.mapId === map.id;
    const mult = String(map.crystalMult).replace(".", ",");
    const detail = open
      ? `×${mult} krystaly${best ? "<br>rekord: vlna " + best : ""}`
      : `🔒 od vlny ${map.unlockWave}`;
    return `<button type="button" class="map-chip${on ? " is-on" : ""}${open ? "" : " is-locked"}" data-map="${map.id}">
      <span><b>${map.name}</b><br><small style="text-align:left">${map.blurb}</small></span>
      <small>${detail}</small>
    </button>`;
  }).join("");
}

function showMenu() {
  game.toMenu();
  if (!mapById(save.mapId) || save.bestWave < mapById(save.mapId).unlockWave) save.mapId = "les";
  game.setMap(save.mapId || "les");
  setText($("menu-best"), String(save.bestWave));
  refreshCrystals();
  renderMaps();
  $("menu-goal").innerHTML = goalHtml();
  refreshBadges();
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  $("install-hint").classList.toggle("hidden", !(mobile && !isStandalone()));
  showScreen("menu");
}

function startRun() {
  audio.unlock();
  audio.play("ui");
  $("summary-layer").classList.add("hidden");
  game.startRun();
  sellArm = 0;
  stripKey = "";
  sheetKey = "";
  showScreen("game");
  buildStrip();
}

/* ================= meta tree ================= */

const TAB_NAMES = { sila: "Síla", zlato: "Zlato", srdce: "Srdce", takt: "Karty" };

function renderTree() {
  $("tree-goal").innerHTML = goalHtml();
  $("tree-tabs").innerHTML = BRANCHES.map((branch) => {
    const nodes = CONFIG.meta.filter((n) => n.branch === branch.id);
    const owned = nodes.filter((n) => save.owned[n.id]).length;
    const ready = nodes.some((n) => !save.owned[n.id] && n.req.every((r) => save.owned[r]) && n.cost <= save.crystals);
    return `<button type="button" class="tab${treeTab === branch.id ? " is-on" : ""}" data-tab="${branch.id}">
      <span>${TAB_NAMES[branch.id] || branch.name}${ready ? '<i class="dot"></i>' : ""}</span><small>${owned}/${nodes.length}</small></button>`;
  }).join("");

  const nodes = CONFIG.meta.filter((n) => n.branch === treeTab);
  const ids = new Set(nodes.map((n) => n.id));
  const kids = {};
  const roots = [];
  for (const n of nodes) {
    const parent = n.req.find((r) => ids.has(r));
    if (parent) (kids[parent] = kids[parent] || []).push(n);
    else roots.push(n);
  }
  const out = [];
  const walk = (n, depth) => {
    out.push(nodeHtml(n, Math.min(3, depth)));
    for (const k of kids[n.id] || []) walk(k, depth + 1);
  };
  roots.forEach((n) => walk(n, 0));
  const scroll = $("tree-scroll");
  const top = scroll.scrollTop;
  scroll.innerHTML = `<h3 class="label">${(BRANCHES.find((b) => b.id === treeTab) || {}).name || ""}</h3>` + out.join("");
  scroll.scrollTop = top;
}

function nodeHtml(node, depth) {
  const owned = !!save.owned[node.id];
  const ready = node.req.every((id) => save.owned[id]);
  const afford = save.crystals >= node.cost;
  const cls = ["node", "depth-" + depth];
  let cost = `<i class="gem-dot"></i>${node.cost}`;
  if (owned) {
    cls.push("is-owned");
    cost = "✓ Máš";
  } else if (!ready) {
    cls.push("is-locked");
    cost = `🔒 ${node.cost}`;
  } else if (afford) cls.push("is-ready");
  else cls.push("is-poor");
  let desc = node.desc;
  if (!owned && !ready) desc += ` · nejdřív ${node.req.map((id) => metaById(id)?.name || id).join(", ")}`;
  return `<button type="button" class="${cls.join(" ")}" data-meta="${node.id}">
    <span class="node-name">${node.name}</span>
    <span class="node-desc">${desc}</span>
    <span class="node-cost">${cost}</span>
  </button>`;
}

function treeToast(text) {
  const el = $("tree-toast");
  el.textContent = text;
  el.classList.remove("hidden");
  window.clearTimeout(treeToastTimer);
  treeToastTimer = window.setTimeout(() => el.classList.add("hidden"), 1600);
}

function buyMeta(id, button) {
  const node = metaById(id);
  if (!node) return;
  if (save.owned[id]) {
    treeToast("Už máš: " + node.name);
    return;
  }
  if (!node.req.every((req) => save.owned[req])) {
    treeToast("Nejdřív: " + node.req.map((req) => metaById(req)?.name || req).join(", "));
    audio.play("deny");
    return;
  }
  if (save.crystals < node.cost) {
    treeToast(`Chybí ${node.cost - save.crystals} ${crystalWord(node.cost - save.crystals)}`);
    audio.play("deny");
    button.classList.remove("is-shaking");
    void button.offsetWidth;
    button.classList.add("is-shaking");
    return;
  }
  save.crystals -= node.cost;
  save.owned[id] = true;
  writeSave(save);
  game.setOwned(save.owned);
  audio.play("upgrade");
  buzz(14);
  refreshCrystals();
  renderTree();
  refreshBadges();
  treeToast("Získáno: " + node.name);
}

function showTree() {
  refreshCrystals();
  renderTree();
  showScreen("tree");
}

function renderAchievements() {
  $("ach-list").innerHTML = ACHIEVEMENTS.map((item) => {
    const done = !!(save.ach && save.ach[item.id]);
    return `<div class="node ach ${done ? "is-owned" : ""}">
      <span class="node-name">${item.name}</span>
      <span class="node-desc">${item.desc}</span>
      <span class="node-cost">${done ? "✓ Splněno" : `<i class="gem-dot"></i>${item.reward}`}</span>
    </div>`;
  }).join("");
}

function refreshSoundLabels() {
  const text = save.sound ? "Zvuk: zapnutý" : "Zvuk: vypnutý";
  document.querySelectorAll("[data-sound-label]").forEach((el) => {
    el.textContent = text;
  });
  $("btn-music").textContent = save.music === false ? "Hudba: vypnutá" : "Hudba: zapnutá";
  $("volume").value = String(Math.round((save.volume == null ? 0.7 : save.volume) * 100));
}

function toggleSound() {
  save.sound = !save.sound;
  audio.setEnabled(save.sound);
  writeSave(save);
  refreshSoundLabels();
  audio.play("ui");
}

/* ================= dock: tower strip ================= */

let stripKey = "";
let sheetKey = "";
let sellArm = 0;

function buildStrip() {
  const strip = $("strip");
  const key = TOWER_ORDER.map((t) => (game.unlocked(t) ? 1 : 0)).join("");
  if (key === stripKey) return;
  stripKey = key;
  strip.innerHTML = TOWER_ORDER.map((type) => {
    const cfg = CONFIG.towers[type];
    const locked = !game.unlocked(type);
    return `<button type="button" role="listitem" class="tcard${locked ? " is-locked" : ""}" data-build="${type}" style="--c:${cfg.color}">
      <canvas width="40" height="40"></canvas>
      <span class="tcard-name">${cfg.name}</span>
      <span class="tcard-cost">${locked ? "🔒 strom" : `<i class="coin"></i><span data-price>${game.buildCost(type)}</span>`}</span>
    </button>`;
  }).join("");
  strip.querySelectorAll("[data-build]").forEach((btn) => {
    drawTowerIcon(btn.querySelector("canvas"), btn.dataset.build, 1, 0);
  });
}

function syncStrip() {
  const strip = $("strip");
  const slotSel = game.selected && game.selected.kind === "slot";
  strip.classList.toggle("is-target", !!slotSel);
  strip.querySelectorAll("[data-build]").forEach((btn) => {
    const type = btn.dataset.build;
    if (btn.classList.contains("is-locked")) return;
    const price = game.buildCost(type);
    btn.classList.toggle("is-broke", game.coins < price);
    btn.classList.toggle("is-armed", game.armed === type);
    const priceEl = btn.querySelector("[data-price]");
    if (priceEl) setText(priceEl, String(price));
  });
}

function onCard(type, btn) {
  audio.unlock();
  if (game.mode !== "play" || game.paused) return;
  if (!game.unlocked(type)) {
    game.toastMsg("Odemkni ve stromu vylepšení");
    audio.play("deny");
    shake(btn);
    return;
  }
  const sel = game.selected;
  if (sel && sel.kind === "slot" && !game.towerAtSlot(sel.i)) {
    const before = game.towers.length;
    game.build(type);
    if (game.towers.length === before) shake(btn);
    return;
  }
  game.armed = game.armed === type ? null : type;
  game.selected = null;
  if (game.armed) game.toastMsg("Klepni na zářící kámen");
  audio.play("ui");
}

function shake(el) {
  if (!el) return;
  el.classList.remove("is-shaking");
  void el.offsetWidth;
  el.classList.add("is-shaking");
}

/* ================= dock: tower sheet ================= */

const PATH_COLORS = ["#ffd56a", "#7ef6ff"];

function statChips(tower, stats) {
  const eff = game.effective(stats);
  const chips = [
    `<span class="stat">⚔ <b>${cz(eff.damage)}</b></span>`,
    `<span class="stat">⏱ <b>${cz(eff.fireRate)}</b>/s</span>`,
    `<span class="stat">◎ <b>${Math.round(stats.range)}</b></span>`,
  ];
  if (stats.splash) chips.push(`<span class="stat">💥 <b>${Math.round(stats.splash)}</b></span>`);
  if (stats.slow) chips.push(`<span class="stat">❄ <b>${Math.round(Math.min(0.72, stats.slow * (1 + game.bonuses.slowPower)) * 100)} %</b></span>`);
  if (stats.chain) chips.push(`<span class="stat">⚡ <b>${stats.chain}×</b></span>`);
  if (stats.poison) chips.push(`<span class="stat">☠ <b>${Math.round(stats.poison)}</b>/s</span>`);
  if (stats.shots && stats.shots > 1) chips.push(`<span class="stat">🏹 <b>${stats.shots}×</b></span>`);
  const syn = SYNERGIES.filter((s) => s.tower === tower.type && (!s.with || game.towers.some((t) => t.type === s.with)));
  for (const s of syn) chips.push(`<span class="stat syn">✦ ${s.name}</span>`);
  return chips.join("");
}

function deltaText(tower, nextStats, cur) {
  const a = game.effective(cur);
  const b = game.effective(nextStats);
  const bits = [];
  if (Math.round(b.damage) !== Math.round(a.damage)) bits.push(`⚔ ${cz(a.damage)} → ${cz(b.damage)}`);
  if (Math.abs(b.fireRate - a.fireRate) > 0.04) bits.push(`⏱ ${cz(a.fireRate)} → ${cz(b.fireRate)}`);
  if (Math.round(nextStats.range) - Math.round(cur.range) >= 4) bits.push(`◎ +${Math.round(nextStats.range - cur.range)}`);
  return bits.slice(0, 2).join(" · ");
}

function renderSheet() {
  const sheet = $("sheet");
  const strip = $("strip");
  const head = document.querySelector(".dock-head");
  const tower = game.mode === "play" ? game.selectedTower() : null;
  if (!tower) {
    if (!sheet.classList.contains("hidden")) {
      sheet.classList.add("hidden");
      sheet.innerHTML = "";
      sheetKey = "";
    }
    strip.classList.remove("hidden");
    head.classList.remove("hidden");
    sellArm = 0;
    return;
  }
  if (sellArm && performance.now() > sellArm) sellArm = 0;
  const key = [tower.id, tower.level, tower.branch, tower.target || "first", sellArm ? 1 : 0, game.bonuses.damage, game.runBuff.damage, game.runBuff.fireRate, game.towers.length].join("|");
  if (key !== sheetKey) {
    sheetKey = key;
    sheet.innerHTML = sheetHtml(tower);
    drawTowerIcon(sheet.querySelector("canvas"), tower.type, tower.level, tower.branch || 0);
  }
  sheet.classList.remove("hidden");
  sheet.querySelectorAll("[data-cost]").forEach((btn) => {
    btn.classList.toggle("is-broke", game.coins < Number(btn.dataset.cost));
  });
}

function sheetHtml(tower) {
  const cfg = CONFIG.towers[tower.type];
  const max = game.maxLevel(tower.type);
  const stats = game.statsFor(tower);
  const target = (TARGET_MODES.find((m) => m.id === (tower.target || "first")) || TARGET_MODES[0]).name;
  const pathName = tower.level > cfg.levels.length ? ` · <em>${cfg.paths[tower.branch || 0].name}</em>` : "";
  const refund = sellValue(tower.spent);
  const sellBtn = (cls) => `<button type="button" class="btn btn-ghost sell ${cls || ""}${sellArm ? " is-armed" : ""}" data-sell>${sellArm ? "Opravdu?" : "Prodat"}<small>+${refund}</small></button>`;
  let actions;
  if (tower.level === cfg.levels.length) {
    actions = `<div class="path-row">${cfg.paths.map((p, i) => {
      const cost = game.upgradeCost(tower, i);
      return `<button type="button" class="btn up path" style="--pc:${PATH_COLORS[i]}" data-up="${i}" data-cost="${cost}">
        <b>${p.name}<span class="price"><i class="coin"></i>${cost}</span></b><span>${p.desc}</span></button>`;
    }).join("")}${sellBtn()}</div>`;
  } else if (tower.level >= max) {
    actions = `<div class="sheet-actions single"><button type="button" class="btn up btn-ghost" disabled><b>Mistrovská úroveň ✓</b><span>${cfg.paths[tower.branch || 0].desc}</span></button>${sellBtn()}</div>`;
  } else {
    const cost = game.upgradeCost(tower);
    const next = game.statsFor(tower, tower.level + 1);
    const label = tower.level + 1 === max ? "Mistrovská" : `Úroveň ${tower.level + 1}`;
    const sub = deltaText(tower, next, stats) || (tower.level >= cfg.levels.length ? cfg.paths[tower.branch || 0].desc : "Silnější věž");
    actions = `<div class="sheet-actions single">
      <button type="button" class="btn btn-gold up" data-up="0" data-cost="${cost}"><b>${label}<span class="price"><i class="coin"></i>${cost}</span></b><span>${sub}</span></button>
      ${sellBtn()}</div>`;
  }
  return `<div class="sheet-head">
      <canvas width="40" height="40"></canvas>
      <div class="sheet-title"><b>${cfg.name}</b><small>Úroveň ${tower.level}/${max}${pathName}</small></div>
      <button type="button" class="btn btn-ghost btn-target" data-target>Cíl: ${target}</button>
      <button type="button" class="ibtn" data-close aria-label="Zavřít">✕</button>
    </div>
    <div class="stats">${statChips(tower, stats)}</div>
    ${actions}`;
}

/* ================= dock: status, next wave, abilities ================= */

let abilityKey = "";

function syncAbilities() {
  const bar = $("ability-bar");
  const have = (game.bonuses && game.bonuses.abilities) || {};
  const key = `${have.meteor ? "m" : ""}${have.freeze ? "f" : ""}`;
  if (key !== abilityKey) {
    abilityKey = key;
    const bits = [];
    if (have.meteor) bits.push(`<button type="button" class="abtn" data-ability="meteor" aria-label="Meteorít">☄<span class="cd hidden"></span></button>`);
    if (have.freeze) bits.push(`<button type="button" class="abtn frz" data-ability="freeze" aria-label="Zmrazení času">❄<span class="cd hidden"></span></button>`);
    bar.innerHTML = bits.join("");
  }
  bar.querySelectorAll("[data-ability]").forEach((btn) => {
    const id = btn.dataset.ability;
    const cd = game.abilityCd[id] || 0;
    const cdEl = btn.querySelector(".cd");
    cdEl.classList.toggle("hidden", cd <= 0.05);
    if (cd > 0.05) setText(cdEl, String(Math.ceil(cd)));
    btn.classList.toggle("is-on", id === "meteor" && game.aimMeteor);
  });
}

function onAbility(id) {
  if (game.mode !== "play" || game.paused) return;
  if (id === "meteor") {
    if (game.abilityCd.meteor > 0) {
      audio.play("deny");
      return;
    }
    game.aimMeteor = !game.aimMeteor;
    game.selected = null;
    game.armed = null;
    game.toastMsg(game.aimMeteor ? "Klepni, kam má meteor spadnout" : "Meteor zrušen");
    audio.play("ui");
  } else if (id === "freeze") {
    if (game.abilityCd.freeze > 0) audio.play("deny");
    else game.castFreeze();
  }
}

function enemiesLeft() {
  return game.queue.length + game.enemies.filter((e) => !e.dead && !e.chest).length;
}

function syncHud() {
  setText($("hud-lives-val"), String(Math.max(0, game.lives | 0)));
  setText($("hud-coins-val"), String(game.coins | 0));
  $("hud-coins").classList.toggle("pop", game.coinPulse > 0.45);
  const preparing = game.phase !== "combat";
  const shown = preparing ? game.wave + 1 : Math.max(1, game.wave);
  setText($("hud-wave-val"), "Vlna " + shown);
  const toBoss = (5 - (shown % 5)) % 5;
  setText($("hud-wave-sub"), toBoss === 0 ? "☠ boss" : `boss za ${toBoss}`);
  setText($("btn-speed"), game.speed === 1 ? "1×" : "2×");
  $("btn-speed").classList.toggle("is-on", game.speed !== 1);

  const boss = game.bossEnemy();
  const bar = $("bossbar");
  if (boss) {
    bar.classList.remove("hidden");
    $("boss-fill").style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
    setText($("boss-name"), boss.name || "Boss");
    setText($("boss-hp"), `${Math.ceil(boss.hp)} / ${boss.maxHp}`);
  } else bar.classList.add("hidden");

  const banner = $("banner");
  const text = game.banner && game.banner.life > 0 ? game.banner.text : "";
  if (text !== lastBanner) {
    lastBanner = text;
    if (text) {
      banner.textContent = text;
      banner.classList.remove("hidden", "pop");
      void banner.offsetWidth;
      banner.classList.add("pop");
    } else banner.classList.add("hidden");
  }

  const toast = $("panel-toast");
  if (game.toastT > 0 && game.toast) {
    setText(toast, game.toast);
    toast.classList.remove("hidden");
  } else toast.classList.add("hidden");

  const next = $("btn-next");
  if (game.phase === "gap" && !game.paused) {
    const bonus = Math.max(0, Math.floor(game.gapLeft * CONFIG.economy.earlyBonusPerSec));
    setHtml(next, `${game.wave === 0 ? "Start" : "Další vlna"} <small>+${bonus}</small>`);
    next.classList.remove("hidden");
  } else next.classList.add("hidden");

  let status;
  if (game.aimMeteor) status = "<b>Meteorít:</b> klepni na stezku";
  else if (game.armed) status = `Stavíš <b>${CONFIG.towers[game.armed].name}</b> — klepni na zářící kámen`;
  else if (game.selected && game.selected.kind === "slot") status = "<b>Vyber věž</b> pro označený kámen";
  else if (game.phase === "gap") status = `Příprava · vlna ${game.wave + 1} za <b>${Math.max(0, Math.ceil(game.gapLeft))} s</b>`;
  else if (game.phase === "combat") status = `Vlna ${game.wave} · zbývá <b>${enemiesLeft()}</b> stínů`;
  else status = "Vyber kartu";
  const tip = game.mode === "play" && HINTS[game.hint] && !save.tutorialDone && !game.armed && !game.aimMeteor && !(game.selected && game.selected.kind === "slot");
  if (tip) status = "💡 " + HINTS[game.hint];
  const st = $("dock-status");
  st.classList.toggle("tip", !!tip);
  setHtml(st, status);
}

/* ================= cards overlay ================= */

function syncBless() {
  const layer = $("bless-layer");
  if (game.mode === "play" && game.phase === "bless" && game.blessOffer.length) {
    const key = game.blessOffer.map((item) => item.id).join("-") + ":" + game.rerollsLeft;
    if (layer.dataset.key !== key) {
      layer.dataset.key = key;
      setText($("bless-eyebrow"), game.blessAtStart ? "Výbava na cestu" : `Vlna ${game.wave} odražena`);
      $("bless-cards").innerHTML = game.blessOffer.map((item, index) => {
        const r = RARITY[item.rarity] || RARITY.c;
        const desc = item.id === "coins" ? `Hned +${game.cardCoins()} mincí` : item.desc;
        return `<button type="button" class="bcard${item.trade ? " trade" : ""}" style="--rc:${r.color}" data-bless="${index}">
          <b>${item.name}</b><em>${r.name}</em><span>${desc}</span></button>`;
      }).join("");
      const rr = $("btn-reroll");
      rr.classList.toggle("hidden", game.rerollsLeft <= 0);
      rr.textContent = `↻ Přehodit (${game.rerollsLeft})`;
    }
    layer.classList.remove("hidden");
  } else {
    layer.classList.add("hidden");
    layer.dataset.key = "";
  }
}

function syncTutorial() {
  /* Tip se ukazuje ve spodní liště (syncHud), aby nezakrýval hrací plochu. */
}

/* ================= run end ================= */

function animateNumber(el, target) {
  const t0 = performance.now();
  function step(now) {
    const k = Math.min(1, (now - t0) / 800);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = "+" + Math.round(target * eased);
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function onRunEnd(result) {
  const record = result.wave > save.bestWave && result.wave > 0;
  save.crystals += result.crystals;
  save.bestByMap = save.bestByMap || { les: 0, had: 0, propast: 0 };
  const mapKey = result.mapId || save.mapId || "les";
  save.bestByMap[mapKey] = Math.max(save.bestByMap[mapKey] || 0, result.wave);
  save.bestWave = Math.max(save.bestWave, result.wave);
  save.runs += 1;
  save.kills += result.kills;
  save.bossKills = (save.bossKills || 0) + result.bossKills;
  grantAchievements();
  writeSave(save);
  window.__lastResult = { ...result, record, totalCrystals: save.crystals };

  $("pause-layer").classList.add("hidden");
  $("bless-layer").classList.add("hidden");
  setText($("sum-title"), result.died ? "Krystal pohasl" : "Tažení přerušeno");
  setText($("sum-wave"), String(result.wave));
  setText($("sum-kills"), String(result.kills));
  setText($("sum-boss"), String(result.bossKills));
  setText($("sum-best"), String(save.bestWave));
  $("sum-record").classList.toggle("hidden", !record);
  $("sum-goal").innerHTML = goalHtml();
  refreshBadges();
  $("summary-layer").classList.remove("hidden");
  animateNumber($("sum-crystals"), result.crystals);
  refreshCrystals();
}

function openPause() {
  if (game.mode !== "play" || game.paused) return;
  game.setPaused(true);
  refreshSoundLabels();
  $("pause-cards").innerHTML = game.cardsTaken.map((id) => {
    const card = CARDS_BY_ID[id];
    if (!card) return "";
    return `<span style="--rc:${(RARITY[card.rarity] || RARITY.c).color}">${card.name}</span>`;
  }).join("");
  syncFsButtons();
  $("pause-layer").classList.remove("hidden");
}

function closePause() {
  $("pause-layer").classList.add("hidden");
  if (game.mode === "play") game.setPaused(false);
}

/* ================= input ================= */

let CARDS_BY_ID = {};

function bind() {
  const on = (id, fn) => $(id).addEventListener("click", (event) => {
    audio.unlock();
    fn(event);
  });

  on("btn-play", startRun);
  on("btn-tree-play", startRun);
  on("btn-again", startRun);
  on("btn-tree", () => { audio.play("ui"); showTree(); });
  on("btn-sum-tree", () => { audio.play("ui"); $("summary-layer").classList.add("hidden"); showTree(); });
  on("btn-sum-menu", () => { audio.play("ui"); showMenu(); });
  on("btn-settings", () => {
    audio.play("ui");
    refreshSoundLabels();
    $("reset-dialog").classList.add("hidden");
    showScreen("settings");
  });
  on("btn-ach", () => { audio.play("ui"); renderAchievements(); showScreen("ach"); });
  on("btn-ach-back", showMenu);
  on("btn-settings-back", showMenu);
  on("btn-tree-back", showMenu);
  on("tutorial-skip", () => { game.hint = "done"; finishTutorial(); audio.play("ui"); });
  on("btn-music", () => {
    save.music = save.music === false;
    audio.setMusic(save.music);
    writeSave(save);
    refreshSoundLabels();
    audio.play("ui");
  });
  $("volume").addEventListener("input", (event) => {
    save.volume = Number(event.target.value) / 100;
    audio.setVolume(save.volume);
    writeSave(save);
  });
  on("btn-sound", toggleSound);
  on("btn-pause-sound", toggleSound);
  on("btn-reset", () => $("reset-dialog").classList.remove("hidden"));
  on("btn-reset-no", () => $("reset-dialog").classList.add("hidden"));
  on("btn-reset-yes", () => {
    const sound = save.sound;
    save = defaultSave();
    save.sound = sound;
    writeSave(save);
    game.setOwned({});
    audio.play("ui");
    showMenu();
  });
  on("btn-speed", () => {
    if (game.mode !== "play") return;
    game.toggleSpeed();
    audio.play("ui");
  });
  on("btn-pause", () => { audio.play("ui"); openPause(); });
  on("btn-resume", () => { audio.play("ui"); closePause(); });
  on("btn-surrender", () => { audio.play("ui"); closePause(); game.surrender(); });
  on("btn-next", () => game.callWave());
  on("btn-reroll", () => game.rerollCards());
  on("btn-fs-ok", () => {
    $("fs-layer").classList.add("hidden");
    if (game.mode === "play" && $("pause-layer").classList.contains("hidden")) game.setPaused(false);
  });
  document.querySelectorAll("[data-fs]").forEach((btn) => btn.addEventListener("click", toggleFullscreen));
  document.addEventListener("fullscreenchange", () => { syncFsButtons(); setTimeout(layout, 60); });
  document.addEventListener("webkitfullscreenchange", () => { syncFsButtons(); setTimeout(layout, 60); });

  $("map-picker").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-map]");
    if (!btn) return;
    const map = mapById(btn.dataset.map);
    if (save.bestWave < map.unlockWave) {
      audio.play("deny");
      shake(btn);
      return;
    }
    save.mapId = map.id;
    writeSave(save);
    game.setMap(map.id);
    audio.play("ui");
    renderMaps();
  });

  $("tree-tabs").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tab]");
    if (!btn) return;
    treeTab = btn.dataset.tab;
    audio.play("ui");
    $("tree-scroll").scrollTop = 0;
    renderTree();
  });
  $("tree-scroll").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-meta]");
    if (btn) buyMeta(btn.dataset.meta, btn);
  });

  $("bless-cards").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-bless]");
    if (!btn) return;
    game.pickBlessing(Number(btn.dataset.bless));
    $("bless-layer").dataset.key = "";
    buzz(14);
  });

  $("dock").addEventListener("click", (event) => {
    audio.unlock();
    const t = event.target;
    if (t.closest("#dock-status.tip")) {
      game.hint = "done";
      finishTutorial();
      audio.play("ui");
      return;
    }
    const build = t.closest("[data-build]");
    if (build) return onCard(build.dataset.build, build);
    const ability = t.closest("[data-ability]");
    if (ability) return onAbility(ability.dataset.ability);
    const up = t.closest("[data-up]");
    if (up) {
      if (!game.upgrade(Number(up.dataset.up))) shake(up);
      sheetKey = "";
      return;
    }
    if (t.closest("[data-sell]")) {
      if (sellArm && performance.now() < sellArm) {
        sellArm = 0;
        game.sell();
      } else {
        sellArm = performance.now() + 2500;
        audio.play("ui");
      }
      sheetKey = "";
      return;
    }
    if (t.closest("[data-target]")) {
      const tower = game.selectedTower();
      if (!tower) return;
      const order = TARGET_MODES.map((m) => m.id);
      tower.target = order[(order.indexOf(tower.target || "first") + 1) % order.length];
      audio.play("ui");
      return;
    }
    if (t.closest("[data-close]")) {
      game.selected = null;
      audio.play("ui");
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || game.mode !== "play" || game.paused || game.phase === "bless") return;
    event.preventDefault();
    audio.unlock();
    const p = toWorld(event.clientX, event.clientY);
    const before = game.selected;
    game.pointer(p.x, p.y);
    if (game.selected !== before) audio.play("ui");
    sellArm = 0;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.key === " " || event.key === "Escape") {
      if (game.mode !== "play") return;
      event.preventDefault();
      if (game.paused) closePause();
      else openPause();
    } else if (event.key === "1") game.speed = 1;
    else if (event.key === "2" && game.mode === "play") game.speed = 2;
    else if (event.key === "f") toggleFullscreen();
  });

  // Žádné posouvání stránky, zoom ani gumový efekt mimo scrollovací oblasti.
  document.addEventListener("touchmove", (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
      return;
    }
    if (event.target.closest && event.target.closest(".scroll, .scroll-x, .dialog, .volume")) return;
    event.preventDefault();
  }, { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("dblclick", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("selectstart", (event) => event.preventDefault());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.mode === "play" && !game.paused && game.phase !== "bless") openPause();
  });
}

/* ================= loop ================= */

let last = 0;
let acc = 0;
const STEP = 1 / 60;

function frame(ts) {
  const raw = last ? Math.min(0.1, (ts - last) / 1000) : 0;
  last = ts;
  if (game.mode === "play" && !game.paused) {
    const timeScale = game.slowMo > 0 ? 0.35 : 1;
    acc += raw * game.speed * timeScale;
    if (acc > 0.12) acc = 0.12;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      game.tick(STEP);
      acc -= STEP;
    }
  } else if (game.mode === "summary") {
    game.tick(Math.min(0.05, raw));
    acc = 0;
  } else acc = 0;

  if (currentScreen === "game") {
    updateLootTarget();
    render(ctx, game, ts / 1000, view);
    if (game.mode === "play") {
      buildStrip();
      syncHud();
      syncStrip();
      renderSheet();
      syncAbilities();
    }
    syncTutorial();
    syncBless();
  }
  requestAnimationFrame(frame);
}

CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

bind();
refreshSoundLabels();
showMenu();
layout();
window.addEventListener("resize", layout);
window.addEventListener("orientationchange", () => setTimeout(layout, 120));
if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
if (window.ResizeObserver) new ResizeObserver(() => layout()).observe(board);

try {
  const secureEnough = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (secureEnough && "serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
} catch {
  /* file:// or sandboxed iframe */
}

window.__ui = { layout, view, toggleFullscreen };
requestAnimationFrame(frame);
