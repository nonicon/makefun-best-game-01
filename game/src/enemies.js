// Enemies: the ember wisps that drift in from the dark and burst on the
// beacon. Each kind has its own shape of movement; all of them steer
// toward the beacon unless the keeper is close enough to distract them.
import { AGGRO_RADIUS, CENTER, ENEMY_KINDS, FIELD } from './config.js';
import { range } from './random.js';

let nextId = 1;

/**
 * A spawn point just outside one edge of the field, so a wisp walks in
 * from the dark the player can see, instead of materialising mid-field.
 */
function edgeSpawn(rng) {
  const edge = Math.floor(rng() * 4);
  const margin = range(rng, 30, 70);
  if (edge === 0) return { x: range(rng, 0, FIELD.width), y: -margin };
  if (edge === 1) return { x: FIELD.width + margin, y: range(rng, 0, FIELD.height) };
  if (edge === 2) return { x: range(rng, 0, FIELD.width), y: FIELD.height + margin };
  return { x: -margin, y: range(rng, 0, FIELD.height) };
}

/** Make one enemy of `kind` at a spawn point outside the field edge. */
export function spawnEnemy(rng, kind, wave) {
  const def = ENEMY_KINDS[kind];
  const at = edgeSpawn(rng);
  return {
    id: nextId,
    kind,
    x: at.x,
    y: at.y,
    // Later waves drift a little faster; brutes stay slow by design.
    speed: def.speed * (1 + (wave - 1) * 0.05),
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    score: def.score,
    embers: def.embers,
    beaconDamage: def.beaconDamage,
    color: def.color,
    boss: def.boss ?? false,
    spawnTimer: kind === 'herald' ? 2.0 : 0, // the Herald's mote pulse
    // Per-enemy wobble so a wave never marches in lockstep.
    phase: rng() * Math.PI * 2,
    wobble: range(rng, 0.6, 1.4),
    flash: 0, // counts down after a hit; the renderer draws it white
  };
}

/**
 * Steer one enemy for `dt` seconds. Returns nothing; mutates in place.
 * `keeper` is the player state, used for the dart's feint and for the
 * brute's slow shove. Darts zigzag; motes dart straight; the rest drift
 * with a slow sine wobble toward the beacon.
 */
export function steerEnemy(enemy, dt, time, keeper) {
  const dx = CENTER.x - enemy.x;
  const dy = CENTER.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  let vx = (dx / dist) * enemy.speed;
  let vy = (dy / dist) * enemy.speed;

  if (enemy.kind === 'dart') {
    // Zigzag: a sideways sine, strongest when far from the beacon.
    const sway = Math.sin(time * 5 + enemy.phase) * 60;
    vx += (-dy / dist) * sway;
    vy += (dx / dist) * sway;
  } else if (enemy.kind === 'herald') {
    // The Herald sways slowly side to side as it bears down, so
    // lead-aim has to track it instead of firing down a straight lane.
    const sway = Math.sin(time * 1.4 + enemy.phase) * 28;
    vx += (-dy / dist) * sway;
    vy += (dx / dist) * sway;
  } else if (enemy.kind !== 'mote') {
    vx += (-dy / dist) * Math.sin(time * 1.6 + enemy.phase) * 14 * enemy.wobble;
    vy += (dx / dist) * Math.sin(time * 1.6 + enemy.phase) * 14 * enemy.wobble;
  }

  // A wisp that gets close to the keeper veers at them instead — the
  // keeper can body-block for the beacon, at the cost of a heart.
  // Brutes are too heavy to turn, and the Herald never leaves its lane.
  const kdx = keeper.x - enemy.x;
  const kdy = keeper.y - enemy.y;
  const kdist = Math.hypot(kdx, kdy) || 1;
  if (kdist < AGGRO_RADIUS && enemy.kind !== 'brute' && enemy.kind !== 'herald') {
    vx = (kdx / kdist) * enemy.speed;
    vy = (kdy / kdist) * enemy.speed;
  }

  enemy.x += vx * dt;
  enemy.y += vy * dt;
  if (enemy.flash > 0) enemy.flash -= dt;
}

/** The Herald's pulse: three motes fanning out toward the beacon. */
export function spawnHeraldMotes(rng, x, y, baseAngle) {
  const def = ENEMY_KINDS.mote;
  const motes = [];
  for (const off of [-0.6, 0, 0.6]) {
    const a = baseAngle + off;
    motes.push({
      id: nextId,
      kind: 'mote',
      x: x + Math.cos(a) * 46,
      y: y + Math.sin(a) * 46,
      speed: def.speed,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      score: def.score,
      embers: def.embers,
      beaconDamage: def.beaconDamage,
      color: def.color,
      phase: rng() * Math.PI * 2,
      wobble: 1,
      flash: 0,
    });
  }
  return motes;
}

/** Split a splitter into two motes at its position. */
export function splitIntoMotes(enemy, rng) {
  const motes = [];
  for (let i = 0; i < 2; i += 1) {
    const def = ENEMY_KINDS.mote;
    motes.push({
      id: nextId,
      kind: 'mote',
      x: enemy.x + range(rng, -10, 10),
      y: enemy.y + range(rng, -10, 10),
      speed: def.speed,
      hp: def.hp,
      maxHp: def.hp,
      radius: def.radius,
      score: def.score,
      embers: def.embers,
      beaconDamage: def.beaconDamage,
      color: def.color,
      phase: rng() * Math.PI * 2,
      wobble: 1,
      flash: 0,
    });
  }
  return motes;
}
