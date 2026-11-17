// Drawing: everything the player sees, from the night sky to the shop
// panel. The renderer reads the world and never changes it (except for
// the shop button rects, which it reports back so clicks can buy).
// One palette, one type scale, drawn at the field's own 960x600 units
// and letterboxed to the window.
import { BEACON, CENTER, COLORS, FIELD, PLAYER, SHOP, WAVES } from './config.js';
import { comboMultiplier } from './world.js';
import { makeRng, range } from './random.js';

const TITLE_FONT = 'Georgia, "Times New Roman", serif';
const UI_FONT = '"Trebuchet MS", Verdana, sans-serif';

// Stars, fixed once so the sky never twinkles differently per frame.
const STARS = (() => {
  const rng = makeRng(77);
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({ x: range(rng, 0, FIELD.width), y: range(rng, 0, FIELD.height), r: range(rng, 0.6, 1.8), a: range(rng, 0.25, 0.9) });
  }
  return stars;
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBackground(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(1, COLORS.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  for (const s of STARS) {
    ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(world.time * 1.3 + s.x));
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Faint ground rings around the beacon, so distance reads at a glance.
  ctx.strokeStyle = 'rgba(126, 140, 220, 0.13)';
  ctx.lineWidth = 1.5;
  for (const r of [120, 200, 280]) {
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBeacon(ctx, world) {
  const pulse = 1 + 0.05 * Math.sin(world.time * 2.2);
  const glow = ctx.createRadialGradient(CENTER.x, CENTER.y, 10, CENTER.x, CENTER.y, 190 * pulse);
  glow.addColorStop(0, COLORS.beaconGlow);
  glow.addColorStop(1, 'rgba(255, 176, 66, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 190 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // On the end screens the beacon is only a soft glow behind the
  // results: the spire would poke through the score lines.
  if (world.screen === 'victory' || world.screen === 'gameover') return;

  // The rotating beam, sweeping the dark.
  const beamAngle = world.time * 0.5;
  ctx.save();
  ctx.translate(CENTER.x, CENTER.y);
  ctx.rotate(beamAngle);
  const beam = ctx.createLinearGradient(0, 0, 300, 0);
  beam.addColorStop(0, 'rgba(255, 220, 140, 0.30)');
  beam.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(300, -52);
  ctx.lineTo(300, 52);
  ctx.lineTo(0, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // The crystal spire.
  ctx.fillStyle = '#3a2f5e';
  ctx.beginPath();
  ctx.moveTo(CENTER.x - 26, CENTER.y + 34);
  ctx.lineTo(CENTER.x - 12, CENTER.y - 18);
  ctx.lineTo(CENTER.x + 12, CENTER.y - 18);
  ctx.lineTo(CENTER.x + 26, CENTER.y + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.beaconCore;
  ctx.beginPath();
  ctx.moveTo(CENTER.x, CENTER.y - 40);
  ctx.lineTo(CENTER.x + 13, CENTER.y - 8);
  ctx.lineTo(CENTER.x, CENTER.y + 6);
  ctx.lineTo(CENTER.x - 13, CENTER.y - 8);
  ctx.closePath();
  ctx.fill();

  // Beacon HP as a ring around the spire — only while the game is on,
  // so it never crowds the title or end screens.
  if (world.screen === 'play' || world.screen === 'shop') {
    const frac = world.beaconHp / BEACON.maxHp;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, BEACON.radius + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = frac > 0.5 ? '#ffc46b' : frac > 0.25 ? '#ff9a3c' : '#ff5d73';
    ctx.beginPath();
    ctx.arc(CENTER.x, CENTER.y, BEACON.radius + 12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 13px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`BEACON ${Math.ceil(world.beaconHp)}`, CENTER.x, CENTER.y + BEACON.radius + 32);
  }
}

function drawEnemy(ctx, e, world) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = e.color;
  ctx.shadowColor = e.color;
  ctx.shadowBlur = 14;
  if (e.kind === 'herald') {
    // The Night Herald: a pulsing aura, a rotating spiked crown, and a
    // dark heart — the one wisp that reads as a boss at a glance.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 46, 99, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 9 + Math.sin(world.time * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(world.time * 0.6 + e.phase);
    ctx.fillStyle = '#ff2e63';
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? e.radius + 8 : e.radius * 0.62;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#2a0613';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd7e2';
    ctx.beginPath();
    ctx.arc(-e.radius * 0.18, -4, 3, 0, Math.PI * 2);
    ctx.arc(e.radius * 0.18, -4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'dart') {
    const a = Math.atan2(CENTER.y - e.y, CENTER.x - e.x);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(e.radius + 6, 0);
    ctx.lineTo(-e.radius, e.radius * 0.8);
    ctx.lineTo(-e.radius * 0.4, 0);
    ctx.lineTo(-e.radius, -e.radius * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'splitter') {
    ctx.rotate(world.time * 0.8 + e.phase);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'brute') {
    ctx.rotate(Math.sin(world.time + e.phase) * 0.12);
    roundRect(ctx, -e.radius, -e.radius, e.radius * 2, e.radius * 2, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-e.radius * 0.5, -e.radius * 0.3);
    ctx.lineTo(0, e.radius * 0.2);
    ctx.lineTo(e.radius * 0.5, -e.radius * 0.4);
    ctx.stroke();
  } else if (e.kind === 'mote') {
    ctx.rotate(Math.PI / 4 + world.time * 2);
    ctx.fillRect(-e.radius * 0.7, -e.radius * 0.7, e.radius * 1.4, e.radius * 1.4);
  } else {
    // Ember: a flame teardrop, flickering.
    const flick = 1 + 0.12 * Math.sin(world.time * 9 + e.phase);
    ctx.beginPath();
    ctx.moveTo(0, -e.radius * flick);
    ctx.bezierCurveTo(e.radius, -e.radius * 0.2, e.radius * 0.8, e.radius, 0, e.radius);
    ctx.bezierCurveTo(-e.radius * 0.8, e.radius, -e.radius, -e.radius * 0.2, 0, -e.radius * flick);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  // A white flash on a fresh hit. (A circle, so the shape's rotation
  // above cannot skew it.)
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(1, e.flash * 6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // A thin HP bar on hurt brutes — drawn after the restore, so the
  // shape's rotation never turns it diagonal.
  if (e.maxHp > 3 && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 4);
    ctx.fillStyle = '#ff5d73';
    ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, (e.radius * 2 * e.hp) / e.maxHp, 4);
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (p.invulnerable > 0 && Math.floor(world.time * 14) % 2 === 0) return; // blink while hurt
  ctx.save();
  ctx.translate(p.x, p.y);
  // Lantern glow.
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
  glow.addColorStop(0, 'rgba(127, 231, 196, 0.35)');
  glow.addColorStop(1, 'rgba(127, 231, 196, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.fill();
  // Cloak, pointing where the keeper walks.
  ctx.fillStyle = COLORS.playerDark;
  ctx.beginPath();
  ctx.moveTo(0, -p.radius - 2);
  ctx.lineTo(p.radius, p.radius);
  ctx.lineTo(-p.radius, p.radius);
  ctx.closePath();
  ctx.fill();
  // Hood and face.
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(0, -2, p.radius * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b1026';
  ctx.beginPath();
  ctx.arc(0, -2, p.radius * 0.34, 0, Math.PI * 2);
  ctx.fill();
  // The aim: a short bright wand toward the mouse.
  ctx.strokeStyle = COLORS.bolt;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(p.aim) * p.radius, Math.sin(p.aim) * p.radius);
  ctx.lineTo(Math.cos(p.aim) * (p.radius + 16), Math.sin(p.aim) * (p.radius + 16));
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, world) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Top-left: wave and score.
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 22px ${UI_FONT}`;
  ctx.fillText(`WAVE ${world.wave} / ${WAVES.total}`, 18, 34);
  ctx.font = `bold 30px ${UI_FONT}`;
  ctx.fillText(`${world.score}`, 18, 68);
  ctx.font = `15px ${UI_FONT}`;
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('SCORE', 18, 88);
  if (world.combo > 1) {
    ctx.fillStyle = COLORS.ember;
    ctx.font = `bold 18px ${UI_FONT}`;
    ctx.fillText(`COMBO x${comboMultiplier(world).toFixed(1)} (${world.combo})`, 18, 112);
  }
  // Top-right: embers and best (best only once a score exists).
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.ember;
  ctx.font = `bold 22px ${UI_FONT}`;
  ctx.fillText(`◆ ${world.embers} embers`, FIELD.width - 18, 34);
  if (world.best > 0) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `15px ${UI_FONT}`;
    ctx.fillText(`BEST ${world.best}`, FIELD.width - 18, 56);
  }
  // Bottom-left: hearts.
  ctx.textAlign = 'left';
  for (let i = 0; i < world.player.maxHp; i += 1) {
    ctx.fillStyle = i < world.player.hp ? '#ff5d73' : 'rgba(255,255,255,0.16)';
    const x = 24 + i * 26;
    const y = FIELD.height - 24;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.bezierCurveTo(x - 9, y - 5, x - 4, y - 12, x, y - 5);
    ctx.bezierCurveTo(x + 4, y - 12, x + 9, y - 5, x, y + 4);
    ctx.fill();
  }
  // Bottom-right: shockwave charges and the wave's remaining wisps.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = `15px ${UI_FONT}`;
  const remaining = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(`${remaining} wisps remain`, FIELD.width - 18, FIELD.height - 48);
  ctx.fillStyle = world.shock > 0 ? '#ffe9a8' : COLORS.textDim;
  ctx.fillText(`SPACE shockwave ${'●'.repeat(world.shock)}${'○'.repeat(Math.max(0, world.shockMax - world.shock))}`, FIELD.width - 18, FIELD.height - 24);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `13px ${UI_FONT}`;
  ctx.fillText('WASD move · mouse aim · hold click to fire · P pause · M mute', FIELD.width - 18, FIELD.height - 8);
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(5, 8, 22, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.ember;
  ctx.font = `15px ${UI_FONT}`;
  ctx.fillText('— A WAVE-DEFENSE TALE IN ONE NIGHT —', FIELD.width / 2, 128);
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 84px ${TITLE_FONT}`;
  ctx.fillText('EMBERKEEP', FIELD.width / 2, 216);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `italic 22px ${TITLE_FONT}`;
  ctx.fillText('Last light of the beacon', FIELD.width / 2, 252);
  ctx.fillStyle = COLORS.text;
  ctx.font = `17px ${UI_FONT}`;
  ctx.fillText('Wisps of ash drift in from the dark to swallow the beacon.', FIELD.width / 2, 306);
  ctx.fillText('Hold the line for 10 waves. Spend embers between waves.', FIELD.width / 2, 332);
  ctx.fillStyle = COLORS.ember;
  ctx.font = `bold 20px ${UI_FONT}`;
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText(
    world.pausedFromPlay ? 'Paused — press ENTER or click to resume' : 'Press ENTER or click to begin',
    FIELD.width / 2, 392,
  );
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.textDim;
  ctx.font = `15px ${UI_FONT}`;
  ctx.fillText('WASD / arrows — move      Mouse — aim      Hold click — fire      SPACE — shockwave', FIELD.width / 2, 440);
  ctx.fillText('1–6 — buy in the shop      P — pause      M — mute', FIELD.width / 2, 464);
  if (world.best > 0) {
    ctx.fillStyle = COLORS.ember;
    ctx.fillText(`Best score: ${world.best}`, FIELD.width / 2, 500);
  }
}

function drawShop(ctx, world) {
  ctx.fillStyle = 'rgba(5, 8, 22, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const panelW = 620;
  const panelH = 430;
  const px = (FIELD.width - panelW) / 2;
  const py = (FIELD.height - panelH) / 2;
  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, px, py, panelW, panelH, 14);
  ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = `bold 30px ${TITLE_FONT}`;
  ctx.fillText(`Wave ${world.wave} cleared`, FIELD.width / 2, py + 46);
  ctx.fillStyle = COLORS.ember;
  ctx.font = `bold 19px ${UI_FONT}`;
  ctx.fillText(`◆ ${world.embers} embers to spend`, FIELD.width / 2, py + 76);

  world.shopButtons = [];
  const rowH = 44;
  const rowW = panelW - 72;
  SHOP.forEach((item, i) => {
    const owned = world.bought[i] ?? 0;
    const price = item.cost(owned);
    const y = py + 96 + i * rowH;
    const x = px + 36;
    const afford = world.embers >= price;
    ctx.fillStyle = afford ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)';
    roundRect(ctx, x, y, rowW, rowH - 8, 8);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = afford ? COLORS.text : COLORS.textDim;
    ctx.font = `bold 16px ${UI_FONT}`;
    ctx.fillText(`${i + 1}  ${item.name}${owned > 0 ? `  (x${owned})` : ''}`, x + 12, y + 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = afford ? COLORS.ember : '#7a6a55';
    ctx.font = `bold 16px ${UI_FONT}`;
    ctx.fillText(`◆ ${price}`, x + rowW - 12, y + 22);
    world.shopButtons.push({ kind: 'buy', index: i, x, y, w: rowW, h: rowH - 8 });
  });
  // Fix the description: draw it after the name, on the same row.
  SHOP.forEach((item, i) => {
    const y = py + 96 + i * rowH;
    const x = px + 36;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `bold 16px ${UI_FONT}`;
    const nameW = ctx.measureText(`${i + 1}  ${item.name}${(world.bought[i] ?? 0) > 0 ? `  (x${world.bought[i]})` : ''}`).width;
    ctx.font = `14px ${UI_FONT}`;
    ctx.fillText(`— ${item.desc}`, x + 12 + nameW + 10, y + 22);
  });

  const btnW = 260;
  const btnH = 42;
  const bx = FIELD.width / 2 - btnW / 2;
  const by = py + panelH - 58;
  ctx.fillStyle = COLORS.ember;
  roundRect(ctx, bx, by, btnW, btnH, 10);
  ctx.fill();
  ctx.fillStyle = '#241a05';
  ctx.textAlign = 'center';
  ctx.font = `bold 18px ${UI_FONT}`;
  ctx.fillText(`Begin wave ${world.wave + 1}  (Enter)`, FIELD.width / 2, by + 27);
  world.shopButtons.push({ kind: 'next', index: -1, x: bx, y: by, w: btnW, h: btnH });
}

function drawEnd(ctx, world, won) {
  ctx.fillStyle = won ? 'rgba(10, 20, 8, 0.55)' : 'rgba(22, 5, 10, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? COLORS.ember : COLORS.danger;
  ctx.font = `bold 58px ${TITLE_FONT}`;
  ctx.fillText(won ? 'THE LIGHT ENDURES' : 'THE LIGHT GOES OUT', FIELD.width / 2, 200);
  ctx.fillStyle = COLORS.text;
  ctx.font = `italic 21px ${TITLE_FONT}`;
  ctx.fillText(
    won ? 'Ten waves, and the beacon still burns. The night retreats.' : `The wisps took the beacon on wave ${world.wave}.`,
    FIELD.width / 2, 240,
  );
  const acc = world.stats.shots > 0 ? Math.round((100 * world.stats.hits) / world.stats.shots) : 0;
  ctx.font = `19px ${UI_FONT}`;
  ctx.fillText(`Score  ${world.score}      Best  ${world.best}`, FIELD.width / 2, 300);
  ctx.fillText(`Wisps banished  ${world.kills}      Bolt accuracy  ${acc}%`, FIELD.width / 2, 330);
  ctx.fillText(`Waves held  ${world.stats.wavesCleared} / ${WAVES.total}`, FIELD.width / 2, 360);
  ctx.fillStyle = COLORS.ember;
  ctx.font = `bold 20px ${UI_FONT}`;
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('Press ENTER or R to play again', FIELD.width / 2, 420);
  ctx.globalAlpha = 1;
}

/**
 * Draw one frame. `view` is {scale, ox, oy} for the letterbox fit;
 * the caller (main.js) computes it from the canvas size.
 */
export function render(ctx, world, view, canvasW, canvasH) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, canvasW, canvasH);
  const shakeX = world.shake > 0 ? (Math.sin(world.time * 61) * world.shake) / 4 : 0;
  const shakeY = world.shake > 0 ? (Math.cos(world.time * 53) * world.shake) / 4 : 0;
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + shakeX * view.scale, view.oy + shakeY * view.scale);
  // Nothing the world draws may spill past the field: wisps walk in
  // from outside the edge, and without this they paint over the
  // letterbox bars. The 16px margin covers the screen shake.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-16, -16, FIELD.width + 32, FIELD.height + 32);
  ctx.clip();

  drawBackground(ctx, world);
  drawBeacon(ctx, world);

  for (const orb of world.orbs) {
    ctx.save();
    ctx.translate(orb.x, orb.y);
    ctx.rotate(world.time * 3 + orb.x);
    ctx.fillStyle = COLORS.ember;
    ctx.shadowColor = COLORS.ember;
    ctx.shadowBlur = 8;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  for (const e of world.enemies) drawEnemy(ctx, e, world);
  for (const b of world.bolts) {
    ctx.strokeStyle = COLORS.bolt;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = COLORS.bolt;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (world.screen === 'play' || world.screen === 'shop') drawPlayer(ctx, world);
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.font = `bold 15px ${UI_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;

  if (world.screen === 'play' || world.screen === 'shop') drawHud(ctx, world);
  if (world.screen === 'title') drawTitle(ctx, world);
  if (world.screen === 'shop') drawShop(ctx, world);
  if (world.screen === 'victory') drawEnd(ctx, world, true);
  if (world.screen === 'gameover') drawEnd(ctx, world, false);

  // A wave announcement (the Herald), fading out over its timer.
  if (world.banner && world.banner.timer > 0) {
    ctx.globalAlpha = Math.min(1, world.banner.timer / 0.6);
    ctx.fillStyle = '#ff2e63';
    ctx.font = `bold 30px ${TITLE_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(world.banner.text, FIELD.width / 2, 132);
    ctx.globalAlpha = 1;
  }

  // Red flash after the beacon (or the keeper) is hit.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 60, ${world.flash * 0.28})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
