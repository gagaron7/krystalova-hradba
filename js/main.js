import { ACHIEVEMENTS, BRANCHES, CONFIG, TARGET_MODES, TOWER_ORDER, mapById, sellValue } from "./config.js";
import { createAudio } from "./audio.js";
import { Game } from "./game.js";
import { render } from "./render.js";
import { defaultSave, loadSave, writeSave } from "./storage.js";

const VIEW = CONFIG.view;
const audio = createAudio();
let save = loadSave();
audio.setEnabled(save.sound);
audio.setVolume(save.volume == null ? 0.7 : save.volume);
audio.setMusic(save.music !== false);

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d", { alpha: false });

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* some browsers block vibration */
  }
}

const HINTS = {
  build: "Klepni na kamenný kruh u stezky a postav věž.",
  coins: "Mince přiletí samy. Můžeš je i sebrat klepnutím.",
  upgrade: "Klepni na věž a vylepši ji za mince.",
  early: "Další vlnu vyvolej dřív — čím dřív, tím víc mincí.",
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

let panelKey = "";
let lastBanner = "";
let treeToastTimer = 0;

function layout() {
  const vw = window.innerWidth || VIEW.w;
  const vh = window.innerHeight || VIEW.h;
  const scale = Math.max(0.2, Math.min(vw / VIEW.w, vh / VIEW.h));
  const stage = document.getElementById("stage");
  stage.style.transform = `scale(${scale})`;
  stage.style.left = `${(vw - VIEW.w * scale) / 2}px`;
  stage.style.top = `${(vh - VIEW.h * scale) / 2}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(VIEW.w * scale * dpr));
  canvas.height = Math.max(1, Math.round(VIEW.h * scale * dpr));
}

function finishTutorial() {
  save.tutorialDone = true;
  game.hintDone = true;
  writeSave(save);
}

function noteProgress(kind) {
  if (kind === "tower") save.maxTowers = Math.max(save.maxTowers || 0, game.towers.length);
  if (kind === "master") save.masteries = (save.masteries || 0) + 1;
  if (kind === "early") save.earlyCalls = (save.earlyCalls || 0) + 1;
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
  const pop = document.getElementById("ach-pop");
  if (!pop) return;
  pop.textContent = fresh.map((item) => `${item.name} +${item.reward}`).join(" · ");
  pop.classList.remove("hidden");
  window.clearTimeout(grantAchievements.timer);
  grantAchievements.timer = window.setTimeout(() => pop.classList.add("hidden"), 2200);
}

function renderAchievements() {
  const list = document.getElementById("ach-list");
  list.innerHTML = ACHIEVEMENTS.map((item) => {
    const done = !!(save.ach && save.ach[item.id]);
    return `<article class="node ${done ? "is-owned" : ""}">
      <span class="node-name">${item.name}</span>
      <span class="node-desc">${item.desc}</span>
      <span class="node-foot">${done ? "Splněno" : item.reward + " krystalů"}</span>
    </article>`;
  }).join("");
}

function syncTutorial() {
  const box = document.getElementById("tutorial");
  const text = HINTS[game.hint];
  if (game.mode === "play" && text && !save.tutorialDone) {
    box.classList.remove("hidden");
    document.getElementById("tutorial-text").textContent = text;
  } else {
    box.classList.add("hidden");
  }
}

function syncBless() {
  const layer = document.getElementById("bless-layer");
  if (game.mode === "play" && game.phase === "bless" && game.blessOffer.length) {
    const key = game.blessOffer.map((item) => item.id).join("-");
    if (layer.dataset.key !== key) {
      layer.dataset.key = key;
      document.getElementById("bless-cards").innerHTML = game.blessOffer.map((item, index) =>
        `<button type="button" class="bless-card" data-bless="${index}"><b>${item.name}</b><span>${item.desc}</span></button>`
      ).join("");
      document.querySelectorAll("[data-bless]").forEach((btn) => {
        btn.addEventListener("click", () => {
          game.pickBlessing(Number(btn.dataset.bless));
          layer.dataset.key = "";
          audio.play("ui");
        });
      });
    }
    layer.classList.remove("hidden");
  } else {
    layer.classList.add("hidden");
    layer.dataset.key = "";
  }
}

function showScreen(name) {
  for (const id of ["menu", "settings", "tree", "game", "summary", "ach"]) {
    document.getElementById("screen-" + id).classList.toggle("active", id === name);
  }
  if (name !== "game") document.getElementById("pause-layer").classList.add("hidden");
}

function refreshCrystals() {
  document.getElementById("menu-crystals").textContent = String(save.crystals);
  document.getElementById("tree-crystals").textContent = String(save.crystals);
  const word = document.getElementById("tree-crystal-word");
  if (word) word.textContent = crystalWord(save.crystals);
}

function refreshSoundLabels() {
  const text = save.sound ? "Zvuk: zapnutý" : "Zvuk: vypnutý";
  document.querySelectorAll("[data-sound-label]").forEach((el) => {
    el.textContent = text;
  });
  const music = document.getElementById("btn-music");
  if (music) music.textContent = save.music === false ? "Hudba: vypnutá" : "Hudba: zapnutá";
  const volume = document.getElementById("volume");
  if (volume) volume.value = String(Math.round((save.volume == null ? 0.7 : save.volume) * 100));
}

function toggleSound() {
  save.sound = !save.sound;
  audio.setEnabled(save.sound);
  writeSave(save);
  refreshSoundLabels();
  audio.play("ui");
}

function renderMaps() {
  const el = document.getElementById("map-picker");
  if (!el) return;
  el.innerHTML = CONFIG.maps.map((map) => {
    const best = (save.bestByMap && save.bestByMap[map.id]) || 0;
    const open = save.bestWave >= map.unlockWave;
    const on = save.mapId === map.id;
    const mult = String(map.crystalMult).replace(".", ",");
    const detail = open
      ? `×${mult} krystaly${best ? " · vlna " + best : ""}`
      : `od vlny ${map.unlockWave}`;
    return `<button type="button" class="map-chip${on ? " is-on" : ""}${open ? "" : " is-locked"}" data-map="${map.id}">
      <b>${map.name}</b>
      <small>${detail}</small>
    </button>`;
  }).join("");
  el.querySelectorAll("[data-map]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const map = mapById(btn.dataset.map);
      if (save.bestWave < map.unlockWave) {
        audio.play("deny");
        return;
      }
      save.mapId = map.id;
      writeSave(save);
      game.setMap(map.id);
      audio.play("ui");
      renderMaps();
    });
  });
}

function showMenu() {
  game.toMenu();
  if (!mapById(save.mapId) || save.bestWave < mapById(save.mapId).unlockWave) save.mapId = "les";
  game.setMap(save.mapId || "les");
  document.getElementById("menu-best").textContent = String(save.bestWave);
  refreshCrystals();
  renderMaps();
  const install = document.getElementById("install-hint");
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (install) install.classList.toggle("hidden", !(mobile && !standalone));
  showScreen("menu");
  panelKey = "";
}

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

function renderTree() {
  const roots = CONFIG.meta.map((node) => ({ ...node, children: [] }));
  const byId = Object.fromEntries(roots.map((node) => [node.id, node]));
  const forest = [];
  for (const node of roots) {
    if (!node.req.length) forest.push(node);
    else if (byId[node.req[0]]) byId[node.req[0]].children.push(node);
    else forest.push(node);
  }

  const html = BRANCHES.map((branch) => {
    const nodes = forest.filter((node) => node.branch === branch.id);
    return `<section class="branch"><h3 class="branch-name">${branch.name}</h3>${nodes.map(renderNode).join("")}</section>`;
  }).join("");

  const scroll = document.getElementById("tree-scroll");
  const top = scroll.scrollTop;
  scroll.innerHTML = html;
  scroll.scrollTop = top;
  scroll.querySelectorAll("[data-meta]").forEach((btn) => {
    btn.addEventListener("click", () => buyMeta(btn.dataset.meta, btn));
  });
}

function renderNode(node) {
  const owned = !!save.owned[node.id];
  const ready = node.req.every((id) => save.owned[id]);
  const afford = save.crystals >= node.cost;
  const cls = [
    "node",
    owned ? "is-owned" : "",
    !owned && !ready ? "is-locked" : "",
    !owned && ready && !afford ? "is-poor" : "",
  ].filter(Boolean).join(" ");
  let foot = node.cost + " krystalů";
  if (owned) foot = "Získáno";
  else if (!ready) {
    foot = "Vyžaduje: " + node.req.map((id) => metaById(id)?.name || id).join(", ");
  }
  const kids = node.children && node.children.length
    ? `<div class="tree-children">${node.children.map(renderNode).join("")}</div>`
    : "";
  return `<div class="tree-branch"><button type="button" class="${cls}" data-meta="${node.id}" ${owned ? "disabled" : ""}>
      <span class="node-name">${node.name}</span>
      <span class="node-desc">${node.desc}</span>
      <span class="node-foot">${foot}</span>
    </button>${kids}</div>`;
}

function treeToast(text) {
  const el = document.getElementById("tree-toast");
  el.textContent = text;
  el.classList.remove("hidden");
  window.clearTimeout(treeToastTimer);
  treeToastTimer = window.setTimeout(() => el.classList.add("hidden"), 1400);
}

function buyMeta(id, button) {
  const node = metaById(id);
  if (!node || save.owned[id]) return;
  if (!node.req.every((req) => save.owned[req])) {
    treeToast("Nejdřív: " + node.req.map((req) => metaById(req)?.name || req).join(", "));
    audio.play("deny");
    return;
  }
  if (save.crystals < node.cost) {
    treeToast("Máš málo krystalů");
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
  refreshCrystals();
  renderTree();
  treeToast("Získáno: " + node.name);
}

function showTree() {
  refreshCrystals();
  renderTree();
  showScreen("tree");
}

function showSettings() {
  refreshSoundLabels();
  document.getElementById("reset-dialog").classList.add("hidden");
  showScreen("settings");
}

function cardHtml(type) {
  const cfg = CONFIG.towers[type];
  const locked = !game.unlocked(type);
  const afford = game.coins >= cfg.cost;
  const cls = ["card", locked ? "is-locked" : "", !locked && !afford ? "is-broke" : ""].filter(Boolean).join(" ");
  const cost = locked ? "Zamčeno" : cfg.cost + " mincí";
  return `<button type="button" class="${cls}" data-build="${type}" style="--c:${cfg.color}" ${locked ? "disabled" : ""}>
    <span class="card-swatch"></span>
    <span class="card-name">${cfg.name}</span>
    <span class="card-role">${cfg.role}</span>
    <span class="card-cost">${cost}</span>
  </button>`;
}

function renderPanel() {
  const body = document.getElementById("panel-body");
  const toast = document.getElementById("panel-toast");
  if (game.toastT > 0 && game.toast) {
    toast.textContent = game.toast;
    toast.classList.remove("hidden");
  } else {
    toast.textContent = "";
    toast.classList.add("hidden");
  }

  const selected = game.selected;
  const key = JSON.stringify({
    kind: selected && selected.kind,
    i: selected && (selected.i ?? selected.id),
    coins: game.coins,
    levels: game.towers.map((t) => t.id + ":" + t.level + ":" + t.spent + ":" + (t.target || "first")).join(","),
    sniper: game.unlocked("sniper") ? 1 : 0,
    mode: game.mode,
  });
  if (key === panelKey) return;
  panelKey = key;

  if (game.mode !== "play") {
    body.innerHTML = "";
    return;
  }

  if (!selected) {
    body.innerHTML = `<p class="hint">Klepni na kamenný kruh vedle stezky.</p>`;
    return;
  }

  if (selected.kind === "slot") {
    body.innerHTML = `<p class="hint">Vyber věž</p><div class="cards">${TOWER_ORDER.map(cardHtml).join("")}</div>`;
    body.querySelectorAll("[data-build]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.unlock();
        game.build(btn.dataset.build);
        panelKey = "";
      });
    });
    return;
  }

  const tower = game.selectedTower();
  if (!tower) {
    body.innerHTML = "";
    return;
  }
  const cfg = CONFIG.towers[tower.type];
  const stats = game.statsFor(tower);
  const maxed = tower.level >= cfg.levels.length;
  const upCost = maxed ? 0 : cfg.upgrades[tower.level - 1];
  const dmg = stats.damage * game.bonuses.damage;
  const rate = stats.fireRate * game.bonuses.fireRate;
  const bits = [
    `<li>Poškození <b>${cz(dmg)}</b></li>`,
    `<li>Kadence <b>${cz(rate)}</b></li>`,
    `<li>Dosah <b>${Math.round(stats.range)}</b></li>`,
  ];
  if (stats.splash) bits.push(`<li>Výbuch <b>${Math.round(stats.splash)}</b></li>`);
  if (stats.slow) bits.push(`<li>Zpomalení <b>${Math.round(stats.slow * (1 + game.bonuses.slowPower) * 100)} %</b></li>`);
  if (stats.chain) bits.push(`<li>Řetěz <b>${stats.chain}</b></li>`);
  if (stats.poison) bits.push(`<li>Jed <b>${Math.round(stats.poison)}</b></li>`);
  const upLabel = maxed ? "Mistrovská" : tower.level === cfg.levels.length - 1 ? `Mistrovská · ${upCost}` : `Vylepšit · ${upCost}`;
  const poor = !maxed && game.coins < upCost;
  body.innerHTML = `<div class="tower-panel">
      <div class="tower-head"><strong>${cfg.name}</strong><span>Úroveň ${tower.level}/${cfg.levels.length}</span></div>
      <ul class="stats">${bits.join("")}</ul>
      <p class="hint">${cfg.mastery || ""}</p>
      <div class="tower-actions">
        <button id="btn-target" class="btn btn-ghost span-all" type="button">${(TARGET_MODES.find((m) => m.id === (tower.target || "first")) || TARGET_MODES[0]).name}</button>
        <button id="btn-upgrade" class="btn btn-gold ${poor ? "is-broke" : ""}" type="button" ${maxed ? "disabled" : ""}>${upLabel}</button>
        <button id="btn-sell" class="btn btn-ghost" type="button">Prodat +${sellValue(tower.spent)}</button>
      </div>
    </div>`;
  const up = document.getElementById("btn-upgrade");
  if (up) {
    up.addEventListener("click", () => {
      game.upgrade();
      panelKey = "";
    });
  }
  document.getElementById("btn-sell").addEventListener("click", () => {
    game.sell();
    panelKey = "";
  });
  const targetBtn = document.getElementById("btn-target");
  if (targetBtn) {
    targetBtn.addEventListener("click", () => {
      const order = TARGET_MODES.map((m) => m.id);
      const idx = order.indexOf(tower.target || "first");
      tower.target = order[(idx + 1) % order.length];
      audio.play("ui");
      panelKey = "";
    });
  }
}

let abilityKey = "";

function syncAbilities() {
  const bar = document.getElementById("ability-bar");
  if (!bar) return;
  const have = (game.bonuses && game.bonuses.abilities) || {};
  const meteor = !!have.meteor;
  const freeze = !!have.freeze;
  bar.classList.toggle("hidden", !(meteor || freeze));
  const key = `${meteor ? "m" : ""}${freeze ? "f" : ""}${game.aimMeteor ? "a" : ""}`;
  if (key !== abilityKey) {
    abilityKey = key;
    const bits = [];
    if (meteor) bits.push(`<button type="button" id="btn-meteor" class="btn btn-tiny${game.aimMeteor ? " is-on" : ""}">Meteorít</button>`);
    if (freeze) bits.push(`<button type="button" id="btn-freeze" class="btn btn-tiny">Čas</button>`);
    bar.innerHTML = bits.join("");
    const meteorBtn = document.getElementById("btn-meteor");
    if (meteorBtn) {
      meteorBtn.addEventListener("click", () => {
        if (game.abilityCd.meteor > 0) {
          audio.play("deny");
          return;
        }
        game.aimMeteor = !game.aimMeteor;
        game.toastMsg(game.aimMeteor ? "Klepni, kam má meteor spadnout" : "");
        audio.play("ui");
        abilityKey = "";
      });
    }
    const freezeBtn = document.getElementById("btn-freeze");
    if (freezeBtn) freezeBtn.addEventListener("click", () => game.castFreeze());
  }
  const meteorBtn = document.getElementById("btn-meteor");
  if (meteorBtn && game.abilityCd.meteor > 0.2) meteorBtn.textContent = "Meteor " + Math.ceil(game.abilityCd.meteor);
  const freezeBtn = document.getElementById("btn-freeze");
  if (freezeBtn && game.abilityCd.freeze > 0.2) freezeBtn.textContent = "Čas " + Math.ceil(game.abilityCd.freeze);
}

function syncHud() {
  document.getElementById("hud-lives-val").textContent = String(Math.max(0, game.lives | 0));
  document.getElementById("hud-coins-val").textContent = String(game.coins | 0);
  const coins = document.getElementById("hud-coins");
  coins.classList.toggle("pop", game.coinPulse > 0.45);
  const preparing = game.phase === "gap";
  document.getElementById("hud-wave-label").textContent = preparing ? "příprava" : "vlna";
  document.getElementById("hud-wave-val").textContent = String(preparing ? game.wave + 1 : Math.max(1, game.wave));
  document.getElementById("btn-speed").textContent = game.speed === 1 ? "1×" : "2×";

  const boss = game.bossEnemy();
  const bar = document.getElementById("bossbar");
  if (boss && game.mode === "play") {
    bar.classList.remove("hidden");
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    document.getElementById("boss-fill").style.width = `${ratio * 100}%`;
    document.getElementById("boss-name").textContent = boss.name || "Boss";
    document.getElementById("boss-hp").textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;
  } else {
    bar.classList.add("hidden");
  }

  const banner = document.getElementById("banner");
  const text = game.banner && game.banner.life > 0 ? game.banner.text : "";
  if (text !== lastBanner) {
    lastBanner = text;
    if (text) {
      banner.textContent = text;
      banner.classList.remove("hidden");
      banner.classList.remove("pop");
      void banner.offsetWidth;
      banner.classList.add("pop");
    } else {
      banner.classList.add("hidden");
    }
  }

  const next = document.getElementById("btn-next");
  if (game.mode === "play" && game.phase === "gap" && !game.paused) {
    const bonus = Math.max(0, Math.floor(game.gapLeft * CONFIG.economy.earlyBonusPerSec));
    next.textContent = (game.wave === 0 ? "Začít vlnu" : "Další vlna") + " · +" + bonus;
    next.classList.remove("hidden");
  } else {
    next.classList.add("hidden");
  }
}

function updateLootTarget() {
  const el = document.getElementById("hud-coins");
  const rect = canvas.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  if (!rect.width || !er.width) return;
  game.lootTarget.x = ((er.left + er.width / 2 - rect.left) / rect.width) * VIEW.w;
  game.lootTarget.y = ((er.top + er.height / 2 - rect.top) / rect.height) * VIEW.h;
}

function animateNumber(el, target) {
  const t0 = performance.now();
  function step(now) {
    const k = Math.min(1, (now - t0) / 700);
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

  document.getElementById("pause-layer").classList.add("hidden");
  document.getElementById("sum-title").textContent = result.died ? "Krystal pohasl" : "Tažení přerušeno";
  document.getElementById("sum-wave").textContent = String(result.wave);
  document.getElementById("sum-kills").textContent = String(result.kills);
  document.getElementById("sum-boss").textContent = String(result.bossKills);
  document.getElementById("sum-best").textContent = String(save.bestWave);
  document.getElementById("sum-record").classList.toggle("hidden", !record);
  showScreen("summary");
  animateNumber(document.getElementById("sum-crystals"), result.crystals);
  refreshCrystals();
}

function openPause() {
  if (game.mode !== "play" || game.paused) return;
  game.setPaused(true);
  refreshSoundLabels();
  document.getElementById("pause-layer").classList.remove("hidden");
}

function closePause() {
  document.getElementById("pause-layer").classList.add("hidden");
  if (game.mode === "play") game.setPaused(false);
}

function bind() {
  const click = (id, fn) => document.getElementById(id).addEventListener("click", (event) => {
    audio.unlock();
    fn(event);
  });

  click("btn-play", () => {
    audio.play("ui");
    panelKey = "";
    game.startRun();
    showScreen("game");
  });
  click("btn-tree", () => {
    audio.play("ui");
    showTree();
  });
  click("btn-settings", () => {
    audio.play("ui");
    showSettings();
  });
  click("btn-ach", () => {
    audio.play("ui");
    renderAchievements();
    showScreen("ach");
  });
  click("btn-ach-back", () => showMenu());
  click("tutorial-skip", () => {
    game.hint = "done";
    finishTutorial();
    audio.play("ui");
  });
  click("btn-music", () => {
    save.music = save.music === false;
    audio.setMusic(save.music);
    writeSave(save);
    refreshSoundLabels();
    audio.play("ui");
  });
  document.getElementById("volume").addEventListener("input", (event) => {
    save.volume = Number(event.target.value) / 100;
    audio.setVolume(save.volume);
    writeSave(save);
  });
  click("btn-settings-back", () => showMenu());
  click("btn-tree-back", () => showMenu());
  click("btn-tree-play", () => {
    audio.play("ui");
    panelKey = "";
    game.startRun();
    showScreen("game");
  });
  click("btn-sound", toggleSound);
  click("btn-pause-sound", toggleSound);
  click("btn-reset", () => document.getElementById("reset-dialog").classList.remove("hidden"));
  click("btn-reset-no", () => document.getElementById("reset-dialog").classList.add("hidden"));
  click("btn-reset-yes", () => {
    const sound = save.sound;
    save = defaultSave();
    save.sound = sound;
    writeSave(save);
    game.setOwned({});
    audio.play("ui");
    showMenu();
  });
  click("btn-speed", () => {
    if (game.mode !== "play") return;
    game.toggleSpeed();
    audio.play("ui");
  });
  click("btn-pause", () => openPause());
  click("btn-resume", () => {
    audio.play("ui");
    closePause();
  });
  click("btn-surrender", () => {
    audio.play("ui");
    closePause();
    game.surrender();
  });
  click("btn-next", () => {
    game.callWave();
    panelKey = "";
  });
  click("btn-again", () => {
    audio.play("ui");
    panelKey = "";
    game.startRun();
    showScreen("game");
  });
  click("btn-sum-tree", () => {
    audio.play("ui");
    showTree();
  });
  click("btn-sum-menu", () => showMenu());

  canvas.addEventListener("pointerdown", (event) => {
    if (game.mode !== "play" || game.paused) return;
    audio.unlock();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW.w;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW.h;
    game.pointer(x, y);
    panelKey = "";
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
  });

  document.addEventListener("touchmove", (event) => {
    if (event.target.closest(".scroll, .cards, .volume")) return;
    event.preventDefault();
  }, { passive: false });
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

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
  } else {
    acc = 0;
  }
  updateLootTarget();
  render(ctx, game, ts / 1000);
  if (game.mode === "play") {
    syncHud();
    renderPanel();
    syncAbilities();
    syncTutorial();
    syncBless();
  } else {
    syncTutorial();
    syncBless();
  }
  requestAnimationFrame(frame);
}

layout();
bind();
refreshSoundLabels();
showMenu();
window.addEventListener("resize", layout);
window.addEventListener("orientationchange", layout);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", layout);
}

try {
  const secureEnough = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (secureEnough && "serviceWorker" in navigator && navigator.serviceWorker && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
} catch {
  /* file:// or sandboxed iframe */
}

requestAnimationFrame(frame);
