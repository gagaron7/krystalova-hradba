import { CONFIG } from "./config.js";
import { pointAt } from "./path.js";

function hash01(a, b) {
  let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function trace(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawGround(ctx, w, h, now) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#141a28");
  g.addColorStop(0.42, "#14241c");
  g.addColorStop(1, "#10161a");
  ctx.fillStyle = g;
  ctx.fillRect(-30, -30, w + 60, h + 60);

  for (let i = 0; i < 42; i++) {
    const x = hash01(i, 1) * w;
    const y = hash01(i, 2) * 210;
    const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(now * 1.7 + i));
    ctx.globalAlpha = 0.25 + tw * 0.55;
    ctx.fillStyle = i % 5 === 0 ? "#fff4d2" : "#d5e2ff";
    ctx.fillRect(x, y, i % 4 === 0 ? 2.2 : 1.4, i % 4 === 0 ? 2.2 : 1.4);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 70; i++) {
    const x = hash01(i, 5) * w;
    const y = 70 + hash01(i, 6) * (h - 120);
    ctx.fillStyle = hash01(i, 7) > 0.5 ? "rgba(70, 120, 80, 0.18)" : "rgba(30, 50, 40, 0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + hash01(i, 8) * 16, 3 + hash01(i, 9) * 4, hash01(i, 10) * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 16; i++) {
    const x = hash01(i, 11) * w;
    const y = 90 + hash01(i, 12) * (h - 220);
    const ox = Math.sin(now * 0.45 + i) * 8;
    const oy = Math.cos(now * 0.33 + i * 1.6) * 6;
    ctx.globalAlpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(now * 2.2 + i));
    ctx.fillStyle = i % 3 === 0 ? "#9af7ff" : "#d8ffb0";
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPath(ctx, points, now) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  trace(ctx, points);
  ctx.strokeStyle = `rgba(255, 214, 140, ${0.1 + 0.08 * (0.5 + 0.5 * Math.sin(now * 1.6))})`;
  ctx.lineWidth = 58;
  ctx.stroke();
  trace(ctx, points);
  ctx.strokeStyle = "#1a1612";
  ctx.lineWidth = 46;
  ctx.stroke();
  trace(ctx, points);
  ctx.strokeStyle = "#5c5146";
  ctx.lineWidth = 34;
  ctx.stroke();
  trace(ctx, points);
  ctx.strokeStyle = "rgba(214, 196, 164, 0.28)";
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.save();
  trace(ctx, points);
  ctx.strokeStyle = "rgba(255, 236, 206, 0.38)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 16]);
  ctx.lineDashOffset = -now * 32;
  ctx.stroke();
  ctx.restore();
}

function drawPortal(ctx, x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 36);
  glow.addColorStop(0, "rgba(150, 90, 255, 0.55)");
  glow.addColorStop(1, "rgba(150, 90, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(196, 150, 255, ${0.35 + i * 0.15})`;
    ctx.lineWidth = 2;
    ctx.ellipse(0, 0, 10 + i * 5, 16 + i * 6, now * 0.7 + i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(74, 30, 130, 0.75)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrystal(ctx, x, y, now) {
  const pulse = 1 + Math.sin(now * 2.2) * 0.045;
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 78);
  glow.addColorStop(0, "rgba(180, 255, 255, 0.55)");
  glow.addColorStop(0.45, "rgba(120, 90, 255, 0.16)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(pulse, pulse);
  ctx.rotate(Math.sin(now * 0.7) * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(18, -8);
  ctx.lineTo(13, 22);
  ctx.lineTo(0, 34);
  ctx.lineTo(-13, 22);
  ctx.lineTo(-18, -8);
  ctx.closePath();
  const gem = ctx.createLinearGradient(-16, -34, 16, 34);
  gem.addColorStop(0, "#f7ffff");
  gem.addColorStop(0.35, "#7ef6ff");
  gem.addColorStop(0.72, "#8d6bff");
  gem.addColorStop(1, "#241448");
  ctx.fillStyle = gem;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(0, 34);
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.stroke();
  ctx.restore();
}

function drawSlot(ctx, slot, state, now) {
  ctx.save();
  ctx.translate(slot.x, slot.y);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 9, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fillStyle = state === "selected" ? "#4a4032" : "#2c291f";
  ctx.fill();
  ctx.lineWidth = state === "selected" ? 2.5 : 1.4;
  ctx.strokeStyle = state === "selected" ? "#ffd56a" : "rgba(190, 230, 220, 0.55)";
  if (state !== "filled") {
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -now * 14;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (state !== "filled") {
    ctx.strokeStyle = "rgba(126, 246, 255, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 6, now * 0.8, now * 0.8 + 2.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawArcher(ctx, tower) {
  const lv = tower.level;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.translate(-tower.recoil * 6, 0);
  ctx.strokeStyle = "#2a1c10";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(4, 0, 12 + lv * 2, -1.15, 1.15);
  ctx.stroke();
  ctx.strokeStyle = lv >= 3 ? "#fff1c4" : "#f0c14a";
  ctx.lineWidth = 3.2;
  ctx.stroke();
  const br = 12 + lv * 2;
  ctx.strokeStyle = "#fff8e8";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(4 + Math.cos(-1.15) * br, Math.sin(-1.15) * br);
  ctx.lineTo(4 + Math.cos(1.15) * br, Math.sin(1.15) * br);
  ctx.stroke();
  ctx.strokeStyle = lv >= 2 ? "#7ef6ff" : "#ffe7a3";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(20 + lv * 3, 0);
  ctx.stroke();
  ctx.fillStyle = lv >= 3 ? "#7ef6ff" : "#fff";
  ctx.beginPath();
  ctx.moveTo(22 + lv * 3, 0);
  ctx.lineTo(14 + lv * 2, 4);
  ctx.lineTo(14 + lv * 2, -4);
  ctx.fill();
  if (lv >= 2) {
    ctx.fillStyle = "#7ef6ff";
    ctx.beginPath();
    ctx.arc(-2, 0, 3 + lv, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCannon(ctx, tower) {
  const lv = tower.level;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.translate(-tower.recoil * 7, 0);
  const len = 20 + lv * 5;
  const thick = 8 + lv * 1.4;
  ctx.fillStyle = "#4a2e22";
  roundRect(ctx, 2, -thick / 2 - 2, len + 4, thick + 4, 3);
  ctx.fill();
  ctx.fillStyle = lv >= 3 ? "#f0c14a" : "#e07a3d";
  roundRect(ctx, 4, -thick / 2, len, thick, 3);
  ctx.fill();
  ctx.fillStyle = "#2a140e";
  roundRect(ctx, 4 + len - 4, -thick / 2 - 2, 7, thick + 4, 2);
  ctx.fill();
  if (lv >= 2) {
    ctx.fillStyle = "#ffe1a0";
    ctx.fillRect(10, -thick / 2, 3, thick);
    if (lv >= 3) ctx.fillRect(18, -thick / 2, 3, thick);
  }
  ctx.restore();
}

function drawFrost(ctx, tower, now) {
  const lv = tower.level;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.fillStyle = "rgba(126, 246, 255, 0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, 18 + lv * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(now * 0.5);
  const shards = 3 + lv;
  for (let i = 0; i < shards; i++) {
    ctx.rotate((Math.PI * 2) / shards);
    ctx.fillStyle = i % 2 ? "#f4ffff" : "#7ee7ff";
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(5, -16 - lv * 3);
    ctx.lineTo(0, -24 - lv * 4);
    ctx.lineTo(-5, -16 - lv * 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-2, 6);
  ctx.lineTo(-2, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStorm(ctx, tower, now) {
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.translate(-tower.recoil * 4, 0);
  ctx.strokeStyle = "#efe6ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.lineTo(2, -2);
  ctx.lineTo(-1, -2);
  ctx.lineTo(10 + tower.level * 2, -10);
  ctx.stroke();
  ctx.fillStyle = tower.level >= 4 ? "#fff" : "#c9b6ff";
  ctx.beginPath();
  ctx.arc(10 + tower.level * 2, -10, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void now;
}

function drawVenom(ctx, tower) {
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.fillStyle = tower.level >= 4 ? "#d8ff9a" : "#9be36a";
  ctx.beginPath();
  ctx.arc(8, 0, 5 + tower.level * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#214018";
  ctx.beginPath();
  ctx.arc(9, -1, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSniper(ctx, tower) {
  const lv = tower.level;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.rotate(tower.angle);
  ctx.translate(-tower.recoil * 5, 0);
  const len = 26 + lv * 7;
  ctx.fillStyle = "#1a1028";
  roundRect(ctx, -2, -4, len + 4, 8, 3);
  ctx.fill();
  ctx.fillStyle = lv >= 2 ? "#b388ff" : "#6c4d96";
  roundRect(ctx, 0, -2.4, len, 4.8, 2);
  ctx.fill();
  ctx.fillStyle = lv >= 3 ? "#ffffff" : "#f0e4ff";
  ctx.beginPath();
  ctx.arc(len, 0, 4.2 + lv * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d2b0ff";
  ctx.beginPath();
  ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTower(ctx, tower, now) {
  const pop = tower.born > 0 ? 1 + Math.sin((1 - tower.born) * Math.PI) * 0.28 : 1;
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.scale(pop, pop);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3a3428";
  ctx.strokeStyle = "#c8b48a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 14 + tower.level, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2a241c";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(tower.x, tower.y);
  ctx.scale(pop, pop);
  ctx.translate(-tower.x, -tower.y);
  if (tower.type === "cannon") drawCannon(ctx, tower);
  else if (tower.type === "frost") drawFrost(ctx, tower, now);
  else if (tower.type === "sniper") drawSniper(ctx, tower);
  else if (tower.type === "storm") drawStorm(ctx, tower, now);
  else if (tower.type === "venom") drawVenom(ctx, tower);
  else drawArcher(ctx, tower);
  ctx.restore();
}

function drawEnemy(ctx, e, x, y, now) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#140c12";
  const r = e.radius;
  if (e.type === "runner") {
    ctx.fillStyle = "#d6f25a";
    ctx.beginPath();
    ctx.moveTo(r + 2, 0);
    ctx.lineTo(-r, r * 0.7);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r, -r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.type === "brute") {
    ctx.fillStyle = "#8e97aa";
    roundRect(ctx, -r, -r * 0.85, r * 2, r * 1.7, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5e687c";
    ctx.beginPath();
    ctx.arc(r * 0.15, 0, r * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd0a8";
    ctx.fillRect(-4, -2, 8, 3);
  } else if (e.type === "swarm") {
    ctx.fillStyle = "#ff6a4a";
    for (let i = 0; i < 3; i++) {
      const a = now * 5 + e.wobble + i * 2.1;
      const ox = Math.cos(a) * 4;
      const oy = Math.sin(a) * 3;
      ctx.beginPath();
      ctx.moveTo(ox + 4, oy);
      ctx.lineTo(ox - 4, oy + 3);
      ctx.lineTo(ox - 4, oy - 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (e.type === "bat") {
    const flap = Math.sin(now * 14 + e.wobble) * 5;
    ctx.fillStyle = "#7aa2ff";
    ctx.beginPath();
    ctx.moveTo(-r - 4, flap);
    ctx.quadraticCurveTo(-r, -r, 0, 0);
    ctx.quadraticCurveTo(r, -r, r + 4, flap);
    ctx.quadraticCurveTo(0, 4, -r - 4, flap);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e8f0ff";
    ctx.fillRect(-3, -2, 2, 2);
    ctx.fillRect(2, -2, 2, 2);
  } else if (e.type === "split") {
    ctx.fillStyle = "#e07ad4";
    ctx.beginPath();
    ctx.arc(-4, 0, r * 0.62, 0, Math.PI * 2);
    ctx.arc(5, 1, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === "chest") {
    ctx.fillStyle = "#e6b34a";
    roundRect(ctx, -r, -r * 0.55, r * 2, r * 1.25, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff6d0";
    ctx.fillRect(-r * 0.85, -2, r * 1.7, 3);
    ctx.fillStyle = "#7ef6ff";
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.15);
    ctx.lineTo(4, r * 0.35);
    ctx.lineTo(-4, r * 0.35);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === "mite") {
    ctx.fillStyle = "#ff8f6a";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === "ward") {
    ctx.fillStyle = "#7f93b8";
    roundRect(ctx, -r, -r * 0.8, r * 2, r * 1.6, 5);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#9be7ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  } else if (e.type === "brood") {
    ctx.fillStyle = "#3a1848";
    ctx.beginPath();
    ctx.ellipse(0, 2, r, r * 0.86, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffd0e8";
    for (const ox of [-8, 0, 8]) {
      ctx.beginPath();
      ctx.arc(ox, -2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (e.type === "boss") {
    ctx.fillStyle = "#2a1038";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ff4d6a";
    ctx.beginPath();
    ctx.moveTo(-8, -r + 2);
    ctx.lineTo(-14, -r - 10);
    ctx.lineTo(-2, -r + 4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -r + 2);
    ctx.lineTo(14, -r - 10);
    ctx.lineTo(2, -r + 4);
    ctx.fill();
    ctx.fillStyle = "#f0c14a";
    ctx.beginPath();
    ctx.moveTo(0, -r - 2);
    ctx.lineTo(6, -r + 6);
    ctx.lineTo(-6, -r + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd0e0";
    ctx.beginPath();
    ctx.arc(-6, -2, 2.4, 0, Math.PI * 2);
    ctx.arc(6, -2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7ef6ff";
    ctx.beginPath();
    ctx.arc(0, 6, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#6d4ea8";
    ctx.beginPath();
    ctx.ellipse(0, 2, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f0e6ff";
    ctx.beginPath();
    ctx.arc(-4, -1, 2, 0, Math.PI * 2);
    ctx.arc(4, -1, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.shield > 0) {
    ctx.strokeStyle = "rgba(155, 231, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, -0.4, Math.PI * 1.2);
    ctx.stroke();
  }
  if (e.poisonT > 0) {
    ctx.fillStyle = "rgba(155, 227, 106, 0.45)";
    ctx.beginPath();
    ctx.arc(r * 0.4, r * 0.3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.slowFactor < 0.98) {
    ctx.strokeStyle = "rgba(170, 235, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, now, now + 1.4);
    ctx.stroke();
  }
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, e.flash / 0.1);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (e.hp < e.maxHp || e.boss) {
    const bw = Math.max(16, r * 2.3);
    const bx = x - bw / 2;
    const by = y - r - (e.flying ? 16 : 12);
    ctx.fillStyle = "rgba(8,6,10,0.8)";
    ctx.fillRect(bx, by, bw, 4);
    const ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = e.boss ? "#ff3358" : ratio < 0.35 ? "#ffb15a" : "#ff5d73";
    ctx.fillRect(bx, by, bw * ratio, 4);
  }
}

function drawProjectile(ctx, p, now) {
  if (p.ox != null) {
    ctx.strokeStyle = p.kind === "venom" ? "rgba(182,245,138,0.55)" : p.kind === "cannon" ? "rgba(255,177,90,0.55)" : "rgba(255,231,168,0.45)";
    ctx.lineWidth = p.kind === "cannon" ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(p.ox, p.oy);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  ctx.save();
  if (p.kind === "cannon") {
    ctx.fillStyle = "#ffb15a";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff1d0";
    ctx.beginPath();
    ctx.arc(p.x - 1, p.y - 1, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "venom") {
    ctx.translate(p.x, p.y);
    ctx.fillStyle = "#b6f58a";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === "frost") {
    ctx.translate(p.x, p.y);
    ctx.rotate(now * 8);
    ctx.fillStyle = "#d9fbff";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    const ang = Math.atan2(p.vy, p.vx);
    ctx.translate(p.x, p.y);
    ctx.rotate(ang);
    ctx.strokeStyle = "#ffe7a8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2, 2.5);
    ctx.lineTo(2, -2.5);
    ctx.fill();
  }
  ctx.restore();
}

function drawRange(ctx, x, y, range, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.08;
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 6]);
  ctx.stroke();
  ctx.restore();
}

export function render(ctx, game, now) {
  const { w, h } = CONFIG.view;
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.height / h, 0, 0);
  ctx.fillStyle = "#0c1014";
  ctx.fillRect(-40, -40, w + 80, h + 80);

  const mag = game.shake || 0;
  const sx = Math.sin(now * 52) * mag;
  const sy = Math.cos(now * 41) * mag;
  ctx.save();
  ctx.translate(sx, sy);

  drawGround(ctx, w, h, now);
  drawPath(ctx, game.path.points, now);
  drawPortal(ctx, game.portal.x, game.portal.y, now);

  const selectedSlot = game.selected && game.selected.kind === "slot" ? game.selected.i : -1;
  const selectedTower = game.selected && game.selected.kind === "tower"
    ? game.towers.find((t) => t.id === game.selected.id)
    : null;

  for (let i = 0; i < game.slots.length; i++) {
    const filled = game.towers.some((t) => t.slot === i);
    const state = filled ? "filled" : i === selectedSlot ? "selected" : "empty";
    if (state === "filled") continue;
    drawSlot(ctx, game.slots[i], state, now);
  }

  if (selectedTower) {
    const stats = game.statsFor(selectedTower);
    const cfg = CONFIG.towers[selectedTower.type];
    drawRange(ctx, selectedTower.x, selectedTower.y, stats.range, cfg.color);
  }

  const enemies = game.enemies.slice().sort((a, b) => a.dist - b.dist);
  for (const e of enemies) {
    const p = pointAt(game.path, e.dist);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + (e.flying ? 14 : 8), e.radius * 0.7, e.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const tower of game.towers) drawTower(ctx, tower, now);

  for (const e of enemies) {
    const p = pointAt(game.path, e.dist);
    const bob = Math.sin(now * (e.flying ? 6 : 8) + e.wobble) * (e.flying ? 8 : 2.4);
    drawEnemy(ctx, e, p.x, p.y + bob, now);
  }

  for (const p of game.projectiles) drawProjectile(ctx, p, now);

  for (const b of game.beams) {
    const alpha = Math.max(0, b.life / b.max);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (b.ring) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x1, b.y1, b.ring * (1 - alpha * 0.15), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCrystal(ctx, game.crystal.x, game.crystal.y, now);

  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  for (const c of game.loot) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = "#e2a82a";
    ctx.beginPath();
    ctx.arc(0, 0, c.value >= 12 ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe9a0";
    ctx.beginPath();
    ctx.arc(-1.5, -1.5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.textAlign = "center";
  for (const t of game.texts) {
    const big = t.big || String(t.text).includes("!");
    ctx.font = big ? "700 20px Georgia, Palatino, serif" : "700 13px Georgia, Palatino, serif";
    ctx.globalAlpha = Math.max(0, t.life / t.max);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  if (game.freezeT > 0) {
    ctx.fillStyle = "rgba(140, 220, 255, 0.13)";
    ctx.fillRect(0, 0, w, h);
  }
  if (game.slowMo > 0) {
    ctx.fillStyle = `rgba(255, 220, 160, ${0.16 * Math.min(1, game.slowMo / 0.4)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (game.hurt > 0) {
    ctx.fillStyle = `rgba(160, 16, 36, ${0.28 * Math.min(1, game.hurt)})`;
    ctx.fillRect(0, 0, w, h);
  }

  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.25, w / 2, h * 0.5, h * 0.72);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}
