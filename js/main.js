import {
  ACHIEVEMENTS, CARDS, CONFIG, ENEMY_INFO, META, META_TABS, RARITY, SYNERGIES, TARGET_MODES, TOWER_ORDER,
  fmt, metaAvailable, metaById, metaCap, metaCost, metaValueText, sellValue, stageMap, stageReward,
} from "./config.js";
import { createAudio } from "./audio.js";
import { Game } from "./game.js";
import { render, drawTowerIcon, drawEnemyIcon } from "./render.js";
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
  build: "Klepni na kamenný kruh u stezky a pak na Postavit věž.",
  coins: "Mince přiletí samy. Můžeš je i sebrat klepnutím.",
  upgrade: "Klepni na věž a vylepši ji. Na úrovni 3 si vybereš specializaci.",
  early: "Další vlnu vyvolej dřív tlačítkem vpravo — dostaneš bonus.",
};

const game = new Game({
  sound: (name, arg) => audio.play(name, arg),
  buzz,
  onRunEnd: (result) => onRunEnd(result),
  hintDone: () => finishTutorial(),
  progress: (kind) => noteProgress(kind),
  firstSeen: (type) => {
    if (save.seenEnemies[type]) return false;
    save.seenEnemies[type] = true;
    writeSave(save);
    return true;
  },
});
game.hintDone = !!save.tutorialDone;
game.setOwned(save.owned, save.cleared);
game.setStage(save.stage);
window.__game = game;

let currentScreen = "menu";
let treeTab = "utok";
let treeToastTimer = 0;
let lastBanner = "";
let campaignSel = save.stage;

/* ================= helpers ================= */

function cz(n) {
  if (Math.abs(n) >= 10000) return fmt(n);
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

function setText(el, text) {
  if (el && el.textContent !== text) el.textContent = text;
}

function setHtml(el, html) {
  if (el && el.__html !== html) {
    el.__html = html;
    el.innerHTML = html;
  }
}

function towerCfg(type) {
  return type === "base" ? CONFIG.base : CONFIG.towers[type];
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
  if (kind === "branch") save.branches = (save.branches || 0) + 1;
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

const SCREENS = ["menu", "campaign", "settings", "tree", "game", "ach"];

function showScreen(name) {
  currentScreen = name;
  for (const id of SCREENS) $("screen-" + id).classList.toggle("active", id === name);
  if (name !== "game") {
    $("pause-layer").classList.add("hidden");
    $("summary-layer").classList.add("hidden");
    $("intro-layer").classList.add("hidden");
  }
  syncFsButtons();
  requestAnimationFrame(layout);
}

function refreshCrystals() {
  const text = fmt(save.crystals);
  setText($("menu-crystals"), text);
  setText($("tree-crystals"), text);
  setText($("campaign-crystals"), text);
}

/* ---- cíle ve stromu ---- */

function nodeState(node) {
  const rank = save.owned[node.id] || 0;
  const cap = metaCap(node, save.cleared);
  const open = metaAvailable(node, save.owned, save.cleared);
  const cost = rank < cap ? metaCost(node, rank) : 0;
  return { rank, cap, open, cost, maxed: rank >= cap };
}

function goalInfo() {
  const buyable = [];
  let next = null;
  for (const node of META) {
    const st = nodeState(node);
    if (!st.open || st.maxed) continue;
    if (st.cost <= save.crystals) buyable.push({ node, st });
    if (!next || st.cost < next.st.cost) next = { node, st };
  }
  buyable.sort((a, b) => a.st.cost - b.st.cost);
  return { buyable, next };
}

function goalHtml() {
  const { buyable, next } = goalInfo();
  if (!next) return `<div class="goal-row"><b>Strom je pro tuhle stezku naplno!</b></div><small class="prose small">Dobyj další stezku a stropy vylepšení se zvednou.</small>`;
  if (buyable.length) {
    const names = buyable.slice(0, 3).map((x) => x.node.name).join(", ");
    return `<div class="goal-row"><b>Můžeš koupit ${buyable.length} ${csPlural(buyable.length, "vylepšení", "vylepšení", "vylepšení")}</b><span><i class="gem-dot"></i> ${fmt(save.crystals)}</span></div>
      <div class="goal-bar"><i style="width:100%"></i></div><small class="prose small">Třeba: ${names}</small>`;
  }
  const pct = Math.min(100, Math.round((save.crystals / next.st.cost) * 100));
  const miss = next.st.cost - save.crystals;
  return `<div class="goal-row"><b>Další cíl: ${next.node.name}</b><span>${fmt(save.crystals)} / ${fmt(next.st.cost)}</span></div>
    <div class="goal-bar"><i style="width:${pct}%"></i></div><small class="prose small">Chybí ${fmt(miss)} ${crystalWord(miss)}</small>`;
}

function refreshBadges() {
  const n = goalInfo().buyable.length;
  for (const id of ["tree-badge", "sum-badge"]) {
    const el = $(id);
    el.textContent = String(n);
    el.classList.toggle("hidden", n === 0);
  }
}

/* ---- náhled mapy ---- */

function drawMapPreview(cv, map) {
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = cv.clientWidth || 96;
  const h = cv.clientHeight || 72;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const c = cv.getContext("2d");
  const b = mapBounds(map);
  const s = Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0));
  const ox = (w - (b.x1 - b.x0) * s) / 2 - b.x0 * s;
  const oy = (h - (b.y1 - b.y0) * s) / 2 - b.y0 * s;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = "#13201a";
  c.fillRect(0, 0, w, h);
  c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  c.strokeStyle = "#8a7356";
  c.lineWidth = 30;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.beginPath();
  map.path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
  c.fillStyle = "rgba(200, 180, 138, 0.7)";
  for (const sl of map.slots) {
    c.beginPath();
    c.arc(sl.x, sl.y, 11, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#7ef6ff";
  c.beginPath();
  c.arc(map.crystal.x, map.crystal.y, 18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#c9b6ff";
  c.beginPath();
  c.arc(map.portal.x, map.portal.y, 14, 0, Math.PI * 2);
  c.fill();
}

function stageStatus(n) {
  if (n <= save.cleared) return "done";
  if (n === save.cleared + 1) return "open";
  return "locked";
}

function stageLine(n) {
  const best = save.bestByStage[n] || 0;
  const st = stageStatus(n);
  if (st === "done") return `✓ Dobyto${best ? " · rekord vlna " + best : ""}`;
  if (st === "open") return best ? `Rekord: vlna ${best} / 25` : "Nová stezka · 25 vln a Vládce noci";
  return "🔒 Nejdřív dobyj předchozí stezku";
}

/* ================= menu ================= */

function showMenu() {
  game.toMenu();
  save.stage = Math.min(save.cleared + 1, Math.max(1, save.stage || 1));
  game.setOwned(save.owned, save.cleared);
  game.setStage(save.stage);
  const map = stageMap(save.stage);
  setText($("menu-cleared"), String(save.cleared));
  refreshCrystals();
  $("menu-stage").innerHTML = `<canvas class="stage-prev"></canvas>
    <span class="stage-txt"><small>Stezka ${save.stage}</small><b>${map.name}</b><em>${stageLine(save.stage)}</em></span>
    <span class="stage-go">🗺</span>`;
  drawMapPreview($("menu-stage").querySelector("canvas"), map);
  setText($("btn-play"), `Hrát · stezka ${save.stage}`);
  $("menu-goal").innerHTML = goalHtml();
  refreshBadges();
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  $("install-hint").classList.toggle("hidden", !(mobile && !isStandalone()));
  showScreen("menu");
  if (save.migrationRefund > 0) {
    $("notice-text").innerHTML = `Hra dostala velkou aktualizaci: <b>Cestu</b> se stezkami, neutrální věže se specializacemi a úplně nový, hlubší strom vylepšení.<br><br>Stará vylepšení se do nového stromu nedají přenést, proto ti vracím všech <b>${save.migrationRefund} ${crystalWord(save.migrationRefund)}</b>, které jsi za ně utratil.`;
    $("notice-layer").classList.remove("hidden");
  }
}

function startRun(stage) {
  audio.unlock();
  audio.play("ui");
  const n = Math.min(save.cleared + 1, Math.max(1, stage || save.stage || 1));
  save.stage = n;
  writeSave(save);
  $("summary-layer").classList.add("hidden");
  game.setOwned(save.owned, save.cleared);
  game.setStage(n);
  game.startRun();
  sellArm = 0;
  stripKey = "";
  sheetKey = "";
  showScreen("game");
}

/* ================= campaign ================= */

function renderCampaign() {
  const last = Math.max(save.cleared + 4, 6);
  const items = [];
  for (let n = 1; n <= last; n++) {
    const map = stageMap(n);
    const st = stageStatus(n);
    const reward = st === "locked" || st === "open" ? `<span class="cnode-reward">Odměna: ${stageReward(n)}</span>` : "";
    items.push(`<button type="button" class="cnode is-${st}${n === campaignSel ? " is-sel" : ""}" data-stage="${n}" style="--off:${[0, 22, 44, 22][(n - 1) % 4]}px">
      <span class="cnode-num">${st === "done" ? "✓" : st === "locked" ? "🔒" : n}</span>
      <span class="cnode-txt"><b>${n}. ${map.name}</b><small>${stageLine(n)}</small>${reward}</span>
    </button>`);
  }
  $("campaign-list").innerHTML = `<div class="campaign-trail">${items.join("")}</div>`;
  syncCampaignFoot();
  const sel = $("campaign-list").querySelector(".is-sel");
  if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "center" });
}

function syncCampaignFoot() {
  const map = stageMap(campaignSel);
  setText($("campaign-name"), `Stezka ${campaignSel}: ${map.name}`);
  setText($("campaign-sub"), stageLine(campaignSel));
  drawMapPreview($("campaign-preview"), map);
  const open = stageStatus(campaignSel) !== "locked";
  $("btn-campaign-play").disabled = !open;
  setText($("btn-campaign-play"), open ? "Hrát" : "🔒");
}

function showCampaign() {
  campaignSel = Math.min(save.cleared + 1, save.stage);
  refreshCrystals();
  showScreen("campaign");
  renderCampaign();
}

/* ================= meta tree ================= */

function renderTree() {
  $("tree-goal").innerHTML = goalHtml();
  $("tree-tabs").innerHTML = META_TABS.map((tab) => {
    const nodes = META.filter((n) => n.tab === tab.id);
    const ready = nodes.some((n) => {
      const st = nodeState(n);
      return st.open && !st.maxed && st.cost <= save.crystals;
    });
    const ranks = nodes.reduce((sum, n) => sum + (save.owned[n.id] || 0), 0);
    return `<button type="button" class="tab${treeTab === tab.id ? " is-on" : ""}" data-tab="${tab.id}">
      <span>${tab.name}${ready ? '<i class="dot"></i>' : ""}</span><small>${ranks}</small></button>`;
  }).join("");
  const nodes = META.filter((n) => n.tab === treeTab);
  const scroll = $("tree-scroll");
  const top = scroll.scrollTop;
  scroll.innerHTML = nodes.map(nodeHtml).join("") + `<p class="prose small tree-note">Každá dobytá stezka zvedne stropy vylepšení a odemkne nové uzly.</p>`;
  scroll.scrollTop = top;
}

function nodeHtml(node) {
  const st = nodeState(node);
  const cls = ["node"];
  let cost;
  let desc;
  if (node.unit) {
    const cur = st.rank ? metaValueText(node, st.rank) : "zatím nic";
    desc = st.maxed ? `Teď ${cur}` : `${cur} → <b>${metaValueText(node, st.rank + 1)}</b>`;
  } else desc = node.desc;
  if (!st.open) {
    cls.push("is-locked");
    if (node.stage && save.cleared < node.stage) cost = `🔒 stezka ${node.stage}`;
    else cost = "🔒";
    const need = (node.req || []).filter((r) => !(save.owned[r] > 0)).map((r) => metaById(r)?.name || r);
    if (node.stage && save.cleared < node.stage) desc += ` · odemkne dobytí ${node.stage}. stezky`;
    else if (need.length) desc += ` · nejdřív ${need.join(", ")}`;
  } else if (st.maxed) {
    cls.push("is-owned");
    const more = node.hardMax ? st.cap < node.hardMax : !!node.perStage;
    cost = st.cap > 1 ? "MAX" : "✓ Máš";
    if (more) desc += " · víc po další stezce";
  } else if (st.cost <= save.crystals) {
    cls.push("is-ready");
    cost = `<i class="gem-dot"></i>${fmt(st.cost)}`;
  } else {
    cls.push("is-poor");
    cost = `<i class="gem-dot"></i>${fmt(st.cost)}`;
  }
  const pips = st.cap > 1
    ? `<span class="node-rank">${st.rank}/${st.cap}</span>`
    : "";
  return `<button type="button" class="${cls.join(" ")}" data-meta="${node.id}">
    <span class="node-name">${node.name}${pips}</span>
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
  const st = nodeState(node);
  if (!st.open) {
    if (node.stage && save.cleared < node.stage) treeToast(`Odemkne se po dobytí ${node.stage}. stezky`);
    else treeToast("Nejdřív: " + (node.req || []).map((r) => metaById(r)?.name || r).join(", "));
    audio.play("deny");
    return;
  }
  if (st.maxed) {
    treeToast(node.perStage || node.hardMax ? "Na víc úrovní dobyj další stezku" : "Už máš: " + node.name);
    return;
  }
  if (save.crystals < st.cost) {
    treeToast(`Chybí ${fmt(st.cost - save.crystals)} ${crystalWord(st.cost - save.crystals)}`);
    audio.play("deny");
    shake(button);
    return;
  }
  save.crystals -= st.cost;
  save.owned[id] = st.rank + 1;
  writeSave(save);
  game.setOwned(save.owned, save.cleared);
  audio.play("upgrade");
  buzz(14);
  refreshCrystals();
  renderTree();
  refreshBadges();
  treeToast(st.cap > 1 ? `${node.name}: úroveň ${st.rank + 1}` : "Získáno: " + node.name);
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

/* ================= dock: build bar ================= */

let stripKey = "";
let sheetKey = "";
let sellArm = 0;

function specsUnlocked() {
  return TOWER_ORDER.filter((t) => game.unlocked(t));
}

function buildStrip() {
  const strip = $("strip");
  const slotSel = game.selected && game.selected.kind === "slot" && !game.towerAtSlot(game.selected.i);
  const price = game.buildCost();
  const key = [slotSel ? 1 : 0, game.armed ? 1 : 0, price, specsUnlocked().length].join("|");
  if (key !== stripKey) {
    stripKey = key;
    const label = slotSel ? "Postavit věž sem" : game.armed ? "Stavíš… klepej na kameny" : "Postavit věž";
    const sub = slotSel ? "Neutrální věž, na úrovni 3 vybereš specializaci" : game.armed ? "Klepni sem pro zrušení" : "Vyber kámen, nebo klepni sem a pak na kameny";
    strip.innerHTML = `<button type="button" class="buildbtn${game.armed ? " is-armed" : ""}${slotSel ? " is-target" : ""}" data-build="1">
        <canvas width="40" height="40"></canvas>
        <span class="buildbtn-txt"><b>${label}</b><small>${sub}</small></span>
        <span class="buildbtn-cost"><i class="coin"></i><span data-price>${price}</span></span>
      </button>
      <button type="button" class="specpill" data-specs="1"><small>Specializace</small><b>${specsUnlocked().length}/${TOWER_ORDER.length}</b></button>`;
    drawTowerIcon(strip.querySelector("canvas"), "base", 1, 0);
  }
  const btn = strip.querySelector("[data-build]");
  if (btn) btn.classList.toggle("is-broke", game.coins < price);
}

function onBuild(btn) {
  audio.unlock();
  if (game.mode !== "play" || game.halted) return;
  const sel = game.selected;
  if (sel && sel.kind === "slot" && !game.towerAtSlot(sel.i)) {
    if (!game.build()) shake(btn);
    stripKey = "";
    return;
  }
  game.armed = !game.armed;
  game.selected = null;
  if (game.armed) game.toastMsg("Klepej na zářící kameny");
  audio.play("ui");
  stripKey = "";
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
  if (tower.type === "bank") {
    const chips = [`<span class="stat">💰 <b>+${stats.income}</b> / vlna</span>`];
    if (stats.bankInterest) chips.push(`<span class="stat">% <b>${Math.round(stats.bankInterest * 100)} %</b> úroky</span>`);
    if (stats.lootAura) chips.push(`<span class="stat">✦ <b>+${Math.round(stats.lootAura * 100)} %</b> kořist</span>`);
    return chips.join("");
  }
  const eff = game.effective(stats);
  const chips = [
    `<span class="stat">⚔ <b>${cz(eff.damage)}</b></span>`,
    `<span class="stat">⏱ <b>${cz(eff.fireRate)}</b>/s</span>`,
    `<span class="stat">◎ <b>${Math.round(stats.range)}</b></span>`,
  ];
  if (stats.splash) chips.push(`<span class="stat">💥 <b>${Math.round(stats.splash)}</b></span>`);
  if (stats.slow) chips.push(`<span class="stat">❄ <b>${Math.round(Math.min(0.75, stats.slow * (1 + game.bonuses.slowPower)) * 100)} %</b></span>`);
  if (stats.chain) chips.push(`<span class="stat">⚡ <b>${stats.chain}×</b></span>`);
  if (stats.poison) chips.push(`<span class="stat">☠ <b>${cz(stats.poison * game.bonuses.damage)}</b>/s</span>`);
  if (stats.shots && stats.shots > 1) chips.push(`<span class="stat">🏹 <b>${stats.shots}×</b></span>`);
  if (stats.ramp) chips.push(`<span class="stat">🔥 až <b>${cz(stats.rampMax)}×</b></span>`);
  const syn = SYNERGIES.filter((s) => s.tower === tower.type && (!s.with || game.towers.some((t) => t.type === s.with)));
  for (const s of syn) chips.push(`<span class="stat syn">✦ ${s.name}</span>`);
  return chips.join("");
}

function deltaText(next, cur) {
  if (next.income) return `💰 +${cur.income || 0} → +${next.income} / vlna`;
  const a = game.effective(cur);
  const b = game.effective(next);
  const bits = [];
  if (Math.round(b.damage) !== Math.round(a.damage)) bits.push(`⚔ ${cz(a.damage)} → ${cz(b.damage)}`);
  if (Math.abs(b.fireRate - a.fireRate) > 0.04) bits.push(`⏱ ${cz(a.fireRate)} → ${cz(b.fireRate)}`);
  if (Math.round(next.range) - Math.round(cur.range) >= 4) bits.push(`◎ +${Math.round(next.range - cur.range)}`);
  return bits.slice(0, 2).join(" · ");
}

function lockText(type) {
  const u = CONFIG.towers[type].unlock;
  if (u.meta) return "ve stromu";
  if (u.stage) return `stezka ${u.stage}`;
  return "";
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
  const key = [tower.id, tower.type, tower.level, tower.branch, tower.target || "first", sellArm ? 1 : 0, game.bonuses.damage, game.runBuff.damage, game.runBuff.fireRate, game.towers.length, game.priceCut()].join("|");
  if (key !== sheetKey) {
    sheetKey = key;
    sheet.innerHTML = sheetHtml(tower);
    sheet.querySelectorAll("canvas[data-icon]").forEach((cv) => {
      drawTowerIcon(cv, cv.dataset.icon, Number(cv.dataset.level || 1), Number(cv.dataset.branch || 0));
    });
  }
  sheet.classList.remove("hidden");
  sheet.querySelectorAll("[data-cost]").forEach((btn) => {
    btn.classList.toggle("is-broke", game.coins < Number(btn.dataset.cost));
  });
}

function sheetHtml(tower) {
  const cfg = towerCfg(tower.type);
  const max = tower.type === "base" ? 3 : 7;
  const stats = game.statsFor(tower);
  const target = (TARGET_MODES.find((m) => m.id === (tower.target || "first")) || TARGET_MODES[0]).name;
  const pathName = tower.level >= 6 ? ` · <em>${cfg.paths[tower.branch || 0].name}</em>` : "";
  const refund = sellValue(tower.spent, game.bonuses.sellBonus);
  const sellBtn = `<button type="button" class="btn btn-ghost sell${sellArm ? " is-armed" : ""}" data-sell>${sellArm ? "Opravdu?" : "Prodat"}<small>+${refund}</small></button>`;
  const targetBtn = tower.type === "bank" ? "" : `<button type="button" class="btn btn-ghost btn-target" data-target>Cíl: ${target}</button>`;
  let actions;
  let showStats = true;
  if (tower.type === "base" && tower.level >= 3) {
    showStats = false;
    const specs = TOWER_ORDER.map((type) => {
      const sc = CONFIG.towers[type];
      const open = game.unlocked(type);
      const cost = game.upgradeCost(tower, type);
      return `<button type="button" class="spec${open ? "" : " is-locked"}" style="--c:${sc.color}" data-spec="${type}" ${open ? `data-cost="${cost}"` : ""}>
        <canvas data-icon="${type}" data-level="4"></canvas>
        <b>${sc.name}</b>
        <small>${open ? `<i class="coin"></i>${cost}` : "🔒 " + lockText(type)}</small>
      </button>`;
    }).join("");
    actions = `<div class="spec-grid">${specs}</div>`;
  } else if (tower.type !== "base" && tower.level === 5) {
    if (game.bonuses.mastery[tower.type]) {
      actions = `<div class="path-row">${cfg.paths.map((p, i) => {
        const cost = game.upgradeCost(tower, i);
        return `<button type="button" class="btn up path" style="--pc:${PATH_COLORS[i]}" data-up="${i}" data-cost="${cost}">
          <b>${p.name}<span class="price"><i class="coin"></i>${cost}</span></b><span>${p.desc}</span></button>`;
      }).join("")}${sellBtn}</div>`;
    } else {
      actions = `<div class="sheet-actions single"><button type="button" class="btn up btn-ghost" disabled><b>Mistrovství zamčeno</b><span>Odemkni „Mistrovství: ${cfg.name}“ ve stromu (Věže)</span></button>${sellBtn}</div>`;
    }
  } else if (tower.level >= max) {
    actions = `<div class="sheet-actions single"><button type="button" class="btn up btn-ghost" disabled><b>Mistrovská úroveň ✓</b><span>${cfg.paths[tower.branch || 0].desc}</span></button>${sellBtn}</div>`;
  } else {
    const cost = game.upgradeCost(tower, 0);
    const next = game.statsFor(tower, tower.level + 1);
    const label = tower.type === "base" ? `Úroveň ${tower.level + 1}` : tower.level === 6 ? "Mistrovská úroveň" : `Úroveň ${tower.level + 1}`;
    const extra = tower.type === "base" && tower.level === 2 ? " · pak specializace" : "";
    const sub = (deltaText(next, stats) || "Silnější věž") + extra;
    actions = `<div class="sheet-actions single">
      <button type="button" class="btn btn-gold up" data-up="0" data-cost="${cost}"><b>${label}<span class="price"><i class="coin"></i>${cost}</span></b><span>${sub}</span></button>
      ${sellBtn}</div>`;
  }
  const role = tower.type === "base" ? (showStats ? `Úroveň ${tower.level}/3 · neutrální` : "Vyber specializaci ↓") : `Úroveň ${tower.level}/${game.maxLevel(tower)}${pathName}`;
  const headBtn = showStats ? targetBtn : sellBtn.replace('class="btn btn-ghost sell', 'class="btn btn-ghost sell sell-sm');
  return `<div class="sheet-head">
      <canvas data-icon="${tower.type}" data-level="${tower.level}" data-branch="${tower.branch || 0}"></canvas>
      <div class="sheet-title"><b>${cfg.name}</b><small>${role}</small></div>
      ${headBtn}
      <button type="button" class="ibtn" data-close aria-label="Zavřít">✕</button>
    </div>
    ${showStats ? `<div class="stats">${statChips(tower, stats)}</div>` : ""}
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
    if (have.meteor) bits.push(`<button type="button" class="abtn" data-ability="meteor" aria-label="Meteorický déšť">☄<span class="cd hidden"></span></button>`);
    if (have.freeze) bits.push(`<button type="button" class="abtn frz" data-ability="freeze" aria-label="Zmrazení času">❄<span class="cd hidden"></span></button>`);
    bar.innerHTML = bits.join("");
  }
  bar.querySelectorAll("[data-ability]").forEach((btn) => {
    const id = btn.dataset.ability;
    const cd = game.abilityCd[id] || 0;
    const max = game.abilityMax[id] || 1;
    const cdEl = btn.querySelector(".cd");
    const active = id === "freeze" && game.freezeT > 0;
    cdEl.classList.toggle("hidden", cd <= 0.05 && !active);
    if (active) setText(cdEl, game.freezeT.toFixed(1).replace(".", ","));
    else if (cd > 0.05) setText(cdEl, String(Math.ceil(cd)));
    btn.classList.toggle("is-active", active);
    btn.classList.toggle("is-ready", cd <= 0.05);
    btn.style.setProperty("--cdp", `${Math.round((cd / max) * 100)}%`);
  });
}

function onAbility(id, btn) {
  if (game.mode !== "play" || game.halted) return;
  if (id === "meteor") {
    if (!game.castMeteor()) {
      audio.play("deny");
      shake(btn);
    }
  } else if (id === "freeze") {
    if (!game.castFreeze()) {
      audio.play("deny");
      shake(btn);
    }
  }
}

function enemiesLeft() {
  return game.queue.length + game.enemies.filter((e) => !e.dead && !e.chest).length;
}

function syncHud() {
  setText($("hud-lives-val"), String(Math.max(0, game.lives | 0)));
  setText($("hud-coins-val"), fmt(game.coins | 0));
  $("hud-coins").classList.toggle("pop", game.coinPulse > 0.45);
  const preparing = game.phase !== "combat";
  const shown = Math.min(CONFIG.stageWaves, preparing ? game.wave + 1 : Math.max(1, game.wave));
  setText($("hud-wave-val"), `Vlna ${shown}/${CONFIG.stageWaves}`);
  const toBoss = (5 - (shown % 5)) % 5;
  setText($("hud-wave-sub"), shown >= CONFIG.stageWaves ? "👑 Vládce noci" : toBoss === 0 ? "☠ boss" : `S${game.stage} · boss za ${toBoss}`);
  setText($("btn-speed"), game.speed + "×");
  $("btn-speed").classList.toggle("is-on", game.speed !== 1);

  const boss = game.bossEnemy();
  const bar = $("bossbar");
  if (boss) {
    bar.classList.remove("hidden");
    $("boss-fill").style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
    setText($("boss-name"), boss.name || "Boss");
    setText($("boss-hp"), `${fmt(Math.ceil(boss.hp))} / ${fmt(boss.maxHp)}`);
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
  if (game.armed) status = `Stavíš <b>věže</b> — klepej na zářící kameny`;
  else if (game.selected && game.selected.kind === "slot") status = "Kámen vybrán — <b>postav věž</b> dole";
  else if (game.freezeT > 0) status = `❄ <b>Čas zamrzl</b> · ${game.freezeT.toFixed(1).replace(".", ",")} s`;
  else if (game.phase === "gap") status = `Příprava · vlna ${game.wave + 1} za <b>${Math.max(0, Math.ceil(game.gapLeft))} s</b>`;
  else if (game.phase === "combat") status = `Vlna ${game.wave} · zbývá <b>${enemiesLeft()}</b> stínů`;
  else status = "Vyber kartu";
  const tip = game.mode === "play" && HINTS[game.hint] && !save.tutorialDone && !game.armed && !(game.selected && game.selected.kind === "slot");
  if (tip) status = "💡 " + HINTS[game.hint];
  const st = $("dock-status");
  st.classList.toggle("tip", !!tip);
  setHtml(st, status);
}

/* ================= overlays ================= */

function syncBless() {
  const layer = $("bless-layer");
  if (game.mode === "play" && game.phase === "bless" && game.blessOffer.length && !game.intro) {
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

function syncIntro() {
  const layer = $("intro-layer");
  const type = game.mode === "play" ? game.intro : null;
  if (!type) {
    if (!layer.classList.contains("hidden")) layer.classList.add("hidden");
    layer.dataset.type = "";
    return;
  }
  if (layer.dataset.type !== type) {
    layer.dataset.type = type;
    const info = ENEMY_INFO[type] || { text: "", strong: "", weak: "" };
    const proto = CONFIG.enemies[type] || {};
    setText($("intro-name"), proto.name || type);
    setText($("intro-text"), info.text);
    setText($("intro-weak"), info.weak);
    setText($("intro-strong"), info.strong);
    layer.classList.remove("hidden");
    drawEnemyIcon($("intro-icon"), type);
  }
}

function dismissIntro() {
  if (!game.intro) return;
  game.intro = null;
  $("intro-layer").classList.add("hidden");
  $("intro-layer").dataset.type = "";
  audio.play("ui");
}

/* ================= run end ================= */

function animateNumber(el, target) {
  const t0 = performance.now();
  function step(now) {
    const k = Math.min(1, (now - t0) / 800);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = "+" + fmt(Math.round(target * eased));
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function onRunEnd(result) {
  const stage = result.stage || game.stage;
  const prevBest = save.bestByStage[stage] || 0;
  const record = result.wave > prevBest && result.wave > 0 && !result.victory;
  save.crystals += result.crystals;
  save.bestByStage[stage] = Math.max(prevBest, result.victory ? CONFIG.stageWaves : result.wave);
  save.bestWave = Math.max(save.bestWave, result.wave);
  save.runs += 1;
  save.kills += result.kills;
  save.bossKills = (save.bossKills || 0) + result.bossKills;
  let unlockedNew = false;
  if (result.victory) {
    save.victories = (save.victories || 0) + 1;
    if (stage > save.cleared) {
      save.cleared = stage;
      unlockedNew = true;
    }
    save.stage = Math.min(save.cleared + 1, stage + 1);
  }
  grantAchievements();
  writeSave(save);
  game.setOwned(save.owned, save.cleared);
  window.__lastResult = { ...result, record, totalCrystals: save.crystals };

  $("pause-layer").classList.add("hidden");
  $("bless-layer").classList.add("hidden");
  $("intro-layer").classList.add("hidden");
  const title = result.victory ? `Stezka ${stage} dobyta!` : result.died ? "Krystal pohasl" : "Tažení přerušeno";
  setText($("sum-title"), title);
  const unlock = $("sum-unlock");
  if (result.victory) {
    unlock.innerHTML = unlockedNew ? `Odemčeno: <b>${stageReward(stage)}</b>` : "Stezka znovu ubráněna";
    unlock.classList.remove("hidden");
  } else unlock.classList.add("hidden");
  setText($("sum-wave"), `${result.wave}/${CONFIG.stageWaves}`);
  setText($("sum-kills"), String(result.kills));
  setText($("sum-boss"), String(result.bossKills));
  setText($("sum-best"), String(save.bestByStage[stage] || 0));
  $("sum-record").classList.toggle("hidden", !record);
  $("btn-next-stage").classList.toggle("hidden", !result.victory);
  setText($("btn-next-stage"), `Na stezku ${stage + 1} ›`);
  $("btn-again").classList.toggle("btn-gold", !result.victory);
  $("btn-again").classList.toggle("btn-ghost", !!result.victory);
  setText($("btn-again"), result.victory ? "Hrát tuhle znovu" : "Hrát znovu");
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

const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

function bind() {
  const on = (id, fn) => $(id).addEventListener("click", (event) => {
    audio.unlock();
    fn(event);
  });

  on("btn-play", () => startRun(save.stage));
  on("btn-tree-play", () => startRun(save.stage));
  on("btn-again", () => startRun(game.stage));
  on("btn-next-stage", () => startRun(Math.min(save.cleared + 1, game.stage + 1)));
  on("btn-campaign", () => { audio.play("ui"); showCampaign(); });
  on("menu-stage", () => { audio.play("ui"); showCampaign(); });
  on("btn-campaign-back", showMenu);
  on("btn-campaign-play", () => {
    if (stageStatus(campaignSel) === "locked") return;
    startRun(campaignSel);
  });
  $("campaign-list").addEventListener("click", (event) => {
    const btn = event.target.closest("[data-stage]");
    if (!btn) return;
    const n = Number(btn.dataset.stage);
    if (stageStatus(n) === "locked") {
      audio.play("deny");
      shake(btn);
      return;
    }
    campaignSel = n;
    save.stage = n;
    writeSave(save);
    audio.play("ui");
    $("campaign-list").querySelectorAll(".cnode").forEach((el) => el.classList.toggle("is-sel", Number(el.dataset.stage) === n));
    syncCampaignFoot();
  });
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
    game.setOwned({}, 0);
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
  on("btn-intro-ok", (event) => { event.stopPropagation(); dismissIntro(); });
  $("intro-layer").addEventListener("click", () => dismissIntro());
  on("btn-notice-ok", () => {
    $("notice-layer").classList.add("hidden");
    save.migrationRefund = 0;
    writeSave(save);
    audio.play("ui");
  });
  on("btn-fs-ok", () => {
    $("fs-layer").classList.add("hidden");
    if (game.mode === "play" && $("pause-layer").classList.contains("hidden")) game.setPaused(false);
  });
  document.querySelectorAll("[data-fs]").forEach((btn) => btn.addEventListener("click", toggleFullscreen));
  document.addEventListener("fullscreenchange", () => { syncFsButtons(); setTimeout(layout, 60); });
  document.addEventListener("webkitfullscreenchange", () => { syncFsButtons(); setTimeout(layout, 60); });

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
    if (build) return onBuild(build);
    if (t.closest("[data-specs]")) {
      const names = specsUnlocked().map((x) => CONFIG.towers[x].name).join(", ");
      game.toastMsg("Máš: " + names);
      audio.play("ui");
      return;
    }
    const ability = t.closest("[data-ability]");
    if (ability) return onAbility(ability.dataset.ability, ability);
    const spec = t.closest("[data-spec]");
    if (spec) {
      if (!game.upgrade(spec.dataset.spec)) shake(spec);
      sheetKey = "";
      return;
    }
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
      sheetKey = "";
      audio.play("ui");
      return;
    }
    if (t.closest("[data-close]")) {
      game.selected = null;
      audio.play("ui");
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || game.mode !== "play" || game.halted) return;
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
    if (game.intro && (event.key === " " || event.key === "Enter" || event.key === "Escape")) {
      event.preventDefault();
      dismissIntro();
      return;
    }
    if (event.key === " " || event.key === "Escape") {
      if (game.mode !== "play") return;
      event.preventDefault();
      if (game.paused) closePause();
      else openPause();
    } else if (["1", "2", "3", "4"].includes(event.key) && game.mode === "play") game.speed = Number(event.key);
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
    if (document.hidden && game.mode === "play" && !game.halted) openPause();
  });
}

/* ================= loop ================= */

let last = 0;
let acc = 0;
const STEP = 1 / 60;

function frame(ts) {
  const raw = last ? Math.min(0.1, (ts - last) / 1000) : 0;
  last = ts;
  if (game.mode === "play" && !game.halted) {
    const timeScale = game.slowMo > 0 ? 0.35 : 1;
    acc += raw * game.speed * timeScale;
    // Pevný krok 1/60 s: i při 4× se simulace počítá ve stejných malých krocích.
    const cap = 0.1 * game.speed + STEP;
    if (acc > cap) acc = cap;
    let guard = 0;
    while (acc >= STEP && guard++ < 40) {
      game.tick(STEP);
      acc -= STEP;
      if (game.halted || game.mode !== "play") break;
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
      renderSheet();
      syncAbilities();
    }
    syncIntro();
    syncBless();
  }
  requestAnimationFrame(frame);
}

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

window.__ui = { layout, view, toggleFullscreen, save: () => save };
requestAnimationFrame(frame);
