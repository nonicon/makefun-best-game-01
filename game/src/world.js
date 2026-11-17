// The game world: one state object, one step function. Screens are
// 'title', 'play', 'shop', 'victory' and 'gameover'. The world owns the
// rules — movement, bolts, waves, the shop, the score — and knows
// nothing about the canvas; render.js draws whatever state this holds.
// Every random roll comes from the seeded rng, so a fixed seed replays
// the same game.
import { BEACON, CENTER, COLORS, COMBO_CAP, COMBO_STEP, COMBO_WINDOW, FIELD, PLAYER, SHOP, WAVES } from './config.js';
import { makeRng, pick, range } from './random.js';
import { spawnEnemy, spawnHeraldMotes, splitIntoMotes, steerEnemy } from './enemies.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_SHOP = 'shop';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_GAMEOVER = 'gameover';

export const EVENT_NONE = 0;
export const EVENT_WAVE_CLEAR = 1;
export const EVENT_VICTORY = 2;
export const EVENT_GAMEOVER = 4;

const BOLT_LIFE = 1.2;

/** The best score, kept in the browser only. Never throws. */
export function loadBest() {
  try { return Number(window.localStorage.getItem('emberkeep-best')) || 0; } catch { return 0; }
}
function saveBest(score) {
  try { window.localStorage.setItem('emberkeep-best', String(score)); } catch { /* private mode */ }
}

/** A fresh world. `seed` fixes every roll the game will make. */
export function makeWorld(seed = 20261116) {
  return {
    rng: makeRng(seed),
    screen: SCREEN_TITLE,
    time: 0,
    wave: 0,
    score: 0,
    best: loadBest(),
    embers: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    player: {
      x: CENTER.x, y: CENTER.y + 150, radius: PLAYER.radius,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      aim: -Math.PI / 2, fireCooldown: 0, invulnerable: 0,
    },
    upgrades: { damage: 0, fireRate: 0, speed: 0 },
    bought: {}, // shop item index -> times bought
    beaconHp: BEACON.maxHp,
    shock: 1,
    shockMax: PLAYER.shockwaveMax,
    enemies: [],
    bolts: [],
    orbs: [], // ember pickups drifting to the keeper
    particles: [],
    floaters: [],
    spawnQueue: [],
    spawnTimer: 0,
    shake: 0,
    flash: 0, // red vignette after the beacon is hit
    shopButtons: [], // filled in by the renderer each frame
    stats: { shots: 0, hits: 0, wavesCleared: 0 },
    endAt: 0, // time the end screen appeared; guards accidental restarts
    banner: null, // { text, timer } — a big announcement, e.g. the Herald
  };
}

/** Build the spawn list for a wave from its budget and unlocks. */
function buildSpawnQueue(world, wave) {
  const kinds = WAVES.unlocks(wave);
  const queue = [];
  // Wave 10 spends part of its budget on the Night Herald instead.
  let budget = WAVES.budget(wave) - (wave === WAVES.total ? 16 : 0);
  while (budget > 0) {
    const affordable = kinds.filter((k) => WAVES.cost[k] <= budget);
    const kind = pick(world.rng, affordable);
    queue.push(kind);
    budget -= WAVES.cost[kind];
  }
  if (wave === WAVES.total) {
    // The Herald walks in partway through the final wave, not first.
    queue.splice(Math.floor(queue.length * 0.35), 0, 'herald');
  }
  return queue;
}

export function beginWave(world, wave, audio) {
  world.wave = wave;
  world.spawnQueue = buildSpawnQueue(world, wave);
  world.spawnTimer = 0.8;
  world.screen = SCREEN_PLAY;
  if (audio) audio.horn();
}

export function startGame(world, audio) {
  const seed = Math.floor(world.rng() * 1e9);
  const fresh = makeWorld(seed);
  fresh.best = world.best;
  Object.assign(world, fresh);
  world.rng = makeRng(seed);
  beginWave(world, 1, audio);
}

/** The keeper's current damage, fire rate and speed with upgrades. */
export function boltDamage(world) { return PLAYER.boltDamage + world.upgrades.damage; }
export function fireInterval(world) { return PLAYER.fireInterval / (1 + world.upgrades.fireRate); }
export function moveSpeed(world) { return PLAYER.speed * (1 + world.upgrades.speed); }
export function comboMultiplier(world) { return 1 + Math.min(world.combo, COMBO_CAP) * COMBO_STEP; }

function addParticles(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    const v = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
      life: range(world.rng, 0.3, 0.7), maxLife: 0.7,
      size: range(world.rng, 2, 5), color,
    });
  }
}

function addFloater(world, x, y, text, color) {
  world.floaters.push({ x, y, text, color: color ?? COLORS.text, life: 0.9, maxLife: 0.9 });
}

function killEnemy(world, enemy, audio) {
  const mult = comboMultiplier(world);
  const points = Math.round(enemy.score * mult);
  world.score += points;
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = COMBO_WINDOW;
  addFloater(world, enemy.x, enemy.y - enemy.radius - 6, `+${points}`, enemy.color);
  addParticles(world, enemy.x, enemy.y, enemy.color, enemy.kind === 'brute' ? 26 : 12, 160);
  for (let i = 0; i < enemy.embers; i += 1) {
    world.orbs.push({
      x: enemy.x + range(world.rng, -8, 8), y: enemy.y + range(world.rng, -8, 8),
      vx: 0, vy: 0, life: 8, value: 1,
    });
  }
  if (enemy.kind === 'splitter') {
    const motes = splitIntoMotes(enemy, world.rng);
    world.enemies.push(...motes);
    addFloater(world, enemy.x, enemy.y + enemy.radius + 10, 'It splits!', '#d9b8ff');
  }
  if (audio) audio.burst();
}

function damageBeacon(world, enemy, audio) {
  world.beaconHp -= enemy.beaconDamage;
  world.flash = 0.55;
  world.shake = 9;
  addParticles(world, enemy.x, enemy.y, '#ff5d73', 16, 200);
  if (audio) audio.beaconHit();
  if (world.beaconHp <= 0) {
    world.beaconHp = 0;
    endGame(world, false, audio);
  }
}

function damagePlayer(world, enemy, audio) {
  if (world.player.invulnerable > 0) return;
  world.player.hp -= 1;
  world.player.invulnerable = 1.1;
  world.shake = 10;
  world.flash = 0.35;
  const dx = world.player.x - enemy.x;
  const dy = world.player.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  world.player.x += (dx / d) * 26;
  world.player.y += (dy / d) * 26;
  if (audio) audio.hurt();
  if (world.player.hp <= 0) {
    world.player.hp = 0;
    endGame(world, false, audio);
  }
}

function endGame(world, won, audio) {
  world.screen = won ? SCREEN_VICTORY : SCREEN_GAMEOVER;
  world.endAt = world.time;
  world.enemies = [];
  world.bolts = [];
  world.orbs = [];
  world.floaters = [];
  if (world.score > world.best) {
    world.best = world.score;
    saveBest(world.score);
  }
  if (audio) {
    if (won) audio.win();
    else audio.lose();
  }
}

function fireShockwave(world, audio) {
  if (world.shock <= 0) return;
  world.shock -= 1;
  world.shake = 12;
  addParticles(world, world.player.x, world.player.y, '#ffe9a8', 30, 320);
  for (const enemy of world.enemies) {
    const d = Math.hypot(enemy.x - world.player.x, enemy.y - world.player.y);
    if (d < PLAYER.shockwaveRadius + enemy.radius) {
      enemy.hp -= PLAYER.shockwaveDamage;
      enemy.flash = 0.15;
      const dx = enemy.x - world.player.x;
      const dy = enemy.y - world.player.y;
      const len = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / len) * 60;
      enemy.y += (dy / len) * 60;
    }
  }
  world.enemies = world.enemies.filter((e) => {
    if (e.hp > 0) return true;
    killEnemy(world, e, null);
    return false;
  });
  if (audio) audio.shockwave();
}

/** Buy shop item `index` (0-based) if the keeper can afford it. */
export function buyItem(world, index, audio) {
  const item = SHOP[index];
  if (!item || world.screen !== SCREEN_SHOP) return false;
  const owned = world.bought[index] ?? 0;
  const price = item.cost(owned);
  if (world.embers < price) return false;
  world.embers -= price;
  world.bought[index] = owned + 1;
  item.apply(world);
  if (audio) audio.buy();
  return true;
}

function updateParticles(world, dt) {
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const f of world.floaters) {
    f.y -= 34 * dt;
    f.life -= dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
}

function updateOrbs(world, dt, audio) {
  const p = world.player;
  for (const orb of world.orbs) {
    const dx = p.x - orb.x;
    const dy = p.y - orb.y;
    const d = Math.hypot(dx, dy) || 1;
    // Home straight at the keeper, speeding up with age, so an ember
    // never slingshots past into a wide orbit it cannot come back from.
    const speed = Math.min(460, 240 + (8 - orb.life) * 45);
    orb.vx = (dx / d) * speed;
    orb.vy = (dy / d) * speed;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    orb.life -= dt;
    if (d < p.radius + 12) {
      orb.life = 0;
      world.embers += orb.value;
      addFloater(world, orb.x, orb.y - 10, `+${orb.value} ember`, COLORS.ember);
      if (audio) audio.pickup();
    }
  }
  world.orbs = world.orbs.filter((o) => o.life > 0);
}

/**
 * One fixed step. `input` is the input state, `audio` the sound maker
 * (or null to stay silent, as the screenshot autopilot does). Returns an
 * event bitmask for the frame.
 */
export function stepWorld(world, dt, input, audio) {
  world.time += dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  if (world.flash > 0) world.flash = Math.max(0, world.flash - dt * 1.6);
  if (world.banner && world.banner.timer > 0) world.banner.timer -= dt;
  updateParticles(world, dt);

  if (world.screen === SCREEN_TITLE) {
    // Ambient embers drift up behind the title; the keeper waits.
    if (world.rng() < dt * 6) {
      world.particles.push({
        x: range(world.rng, 0, FIELD.width), y: FIELD.height + 6,
        vx: range(world.rng, -8, 8), vy: range(world.rng, -46, -18),
        life: range(world.rng, 2, 4), maxLife: 4, size: range(world.rng, 1.5, 3.5), color: COLORS.ember,
      });
    }
    if (input.wasPressed('enter') || input.wasClicked()) {
      if (audio) audio.unlock();
      if (world.pausedFromPlay) {
        // P paused mid-wave: Enter resumes where the keeper stood.
        world.pausedFromPlay = false;
        world.screen = SCREEN_PLAY;
      } else {
        startGame(world, audio);
      }
    }
    return EVENT_NONE;
  }

  if (world.screen === SCREEN_SHOP) {
    if (input.wasPressed('enter') || input.wasPressed(' ')) {
      beginWave(world, world.wave + 1, audio);
      return EVENT_NONE;
    }
    for (let i = 0; i < SHOP.length; i += 1) {
      if (input.wasPressed(String(i + 1))) buyItem(world, i, audio);
    }
    return EVENT_NONE;
  }

  if (world.screen === SCREEN_VICTORY || world.screen === SCREEN_GAMEOVER) {
    if (world.time - world.endAt > 0.8 && (input.wasPressed('enter') || input.wasPressed('r') || input.wasClicked())) {
      startGame(world, audio);
    }
    return EVENT_NONE;
  }

  // ---- play ----
  const p = world.player;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Move with WASD or arrows; the beacon's glow pushes the keeper out.
  let mx = 0;
  let my = 0;
  if (input.held('a') || input.held('arrowleft')) mx -= 1;
  if (input.held('d') || input.held('arrowright')) mx += 1;
  if (input.held('w') || input.held('arrowup')) my -= 1;
  if (input.held('s') || input.held('arrowdown')) my += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const speed = moveSpeed(world);
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
  }
  p.x = Math.max(20, Math.min(FIELD.width - 20, p.x));
  p.y = Math.max(20, Math.min(FIELD.height - 20, p.y));
  const bdx = p.x - CENTER.x;
  const bdy = p.y - CENTER.y;
  const bd = Math.hypot(bdx, bdy);
  const minDist = BEACON.radius + p.radius + 4;
  if (bd < minDist && bd > 0) {
    p.x = CENTER.x + (bdx / bd) * minDist;
    p.y = CENTER.y + (bdy / bd) * minDist;
  }

  // Aim at the mouse; hold click (or hold J) to fire.
  p.aim = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  if ((input.mouse.down || input.held('j')) && p.fireCooldown <= 0) {
    p.fireCooldown = fireInterval(world);
    world.stats.shots += 1;
    world.bolts.push({
      x: p.x + Math.cos(p.aim) * (p.radius + 6),
      y: p.y + Math.sin(p.aim) * (p.radius + 6),
      vx: Math.cos(p.aim) * PLAYER.boltSpeed,
      vy: Math.sin(p.aim) * PLAYER.boltSpeed,
      life: BOLT_LIFE,
      damage: boltDamage(world),
    });
    if (audio) audio.shoot();
  }
  if (input.wasPressed(' ') && world.shock > 0) fireShockwave(world, audio);
  if (input.wasPressed('m') && audio) audio.toggleMute();
  if (input.wasPressed('p')) {
    // Pause is a title-screen breather: freeze play until Enter.
    world.screen = SCREEN_TITLE;
    world.pausedFromPlay = true;
    return EVENT_NONE;
  }

  // Spawn the wave's queue, a few at a time.
  if (world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = WAVES.spawnInterval(world.wave);
      const kind = world.spawnQueue.shift();
      world.enemies.push(spawnEnemy(world.rng, kind, world.wave));
    }
  }

  // Steer enemies; burst on the beacon or on the keeper.
  for (const enemy of world.enemies) {
    steerEnemy(enemy, dt, world.time, p);
    // The Herald pulses out motes toward the beacon as it advances.
    if (enemy.kind === 'herald') {
      // Announce it the moment it crosses into the field, so the
      // banner is up while the boss is actually visible.
      if (!enemy.announced && enemy.x > 0 && enemy.x < FIELD.width && enemy.y > 0 && enemy.y < FIELD.height) {
        enemy.announced = true;
        world.banner = { text: 'THE NIGHT HERALD APPROACHES', timer: 3 };
      }
      enemy.spawnTimer -= dt;
      if (enemy.spawnTimer <= 0) {
        enemy.spawnTimer = 4.0;
        const base = Math.atan2(CENTER.y - enemy.y, CENTER.x - enemy.x);
        world.enemies.push(...spawnHeraldMotes(world.rng, enemy.x, enemy.y, base));
        addParticles(world, enemy.x, enemy.y, '#ff2e63', 10, 120);
      }
    }
    const toBeacon = Math.hypot(enemy.x - CENTER.x, enemy.y - CENTER.y);
    if (toBeacon < BEACON.radius + enemy.radius * 0.6) {
      if (enemy.kind === 'herald') {
        // The Herald does not die on the beacon: it hits it, then is
        // shoved back out and has to be killed for good.
        damageBeacon(world, enemy, audio);
        const d = Math.hypot(enemy.x - CENTER.x, enemy.y - CENTER.y) || 1;
        const push = BEACON.radius + enemy.radius * 0.6 + 55;
        enemy.x = CENTER.x + ((enemy.x - CENTER.x) / d) * push;
        enemy.y = CENTER.y + ((enemy.y - CENTER.y) / d) * push;
        continue;
      }
      enemy.hp = 0;
      damageBeacon(world, enemy, audio);
      continue;
    }
    const toPlayer = Math.hypot(enemy.x - p.x, enemy.y - p.y);
    if (toPlayer < enemy.radius + p.radius) {
      enemy.hp = 0;
      damagePlayer(world, enemy, audio);
      addParticles(world, enemy.x, enemy.y, enemy.color, 10, 140);
    }
  }

  // Bolts fly, and die on the first wisp they touch.
  for (const bolt of world.bolts) {
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    if (bolt.x < 0 || bolt.x > FIELD.width || bolt.y < 0 || bolt.y > FIELD.height) bolt.life = 0;
    for (const enemy of world.enemies) {
      if (enemy.hp <= 0) continue;
      const d = Math.hypot(enemy.x - bolt.x, enemy.y - bolt.y);
      if (d < enemy.radius + PLAYER.boltRadius) {
        enemy.hp -= bolt.damage;
        enemy.flash = 0.12;
        bolt.life = 0;
        world.stats.hits += 1;
        addParticles(world, bolt.x, bolt.y, '#ffe9a8', 4, 90);
        if (audio) audio.hit();
        break;
      }
    }
  }
  world.bolts = world.bolts.filter((b) => b.life > 0);

  // The dead pay out, then leave.
  const dead = world.enemies.filter((e) => e.hp <= 0);
  for (const enemy of dead) {
    // Enemies that burst on the beacon or the keeper already paid their
    // price in damage; they drop nothing.
    const onBeacon = Math.hypot(enemy.x - CENTER.x, enemy.y - CENTER.y) < BEACON.radius + enemy.radius;
    const onPlayer = Math.hypot(enemy.x - p.x, enemy.y - p.y) < enemy.radius + p.radius + 4;
    if (!onBeacon && !onPlayer) killEnemy(world, enemy, audio);
  }
  world.enemies = world.enemies.filter((e) => e.hp > 0);

  updateOrbs(world, dt, audio);

  // Wave cleared: the shop opens, or the light endures and the game is won.
  // Only while still playing — the beacon or the keeper may have fallen
  // in this same step, and that ending stands.
  if (world.screen === SCREEN_PLAY && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    world.stats.wavesCleared += 1;
    world.shock = Math.min(world.shockMax, world.shock + 1);
    // Ungathered embers fly to the keeper as a wave-clear bonus.
    if (world.orbs.length > 0) {
      const bonus = world.orbs.reduce((sum, o) => sum + o.value, 0);
      world.embers += bonus;
      addFloater(world, world.player.x, world.player.y - 30, `+${bonus} embers`, COLORS.ember);
      world.orbs = [];
    }
    if (world.wave >= WAVES.total) {
      endGame(world, true, audio);
      return EVENT_VICTORY;
    }
    world.screen = SCREEN_SHOP;
    return EVENT_WAVE_CLEAR;
  }
  return EVENT_NONE;
}

/** A mouse click on a screen that has buttons (shop, end screens). */
export function clickWorld(world, x, y, audio) {
  if (world.screen === SCREEN_SHOP) {
    for (const b of world.shopButtons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.kind === 'buy') buyItem(world, b.index, audio);
        if (b.kind === 'next') beginWave(world, world.wave + 1, audio);
        return true;
      }
    }
  }
  return false;
}
