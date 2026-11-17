// EMBERKEEP — tuning constants. One place for every number the game
// balances on, so the waves, the shop and the feel can be tuned without
// touching the rules in world.js or the drawing in render.js.

// Logical playfield (canvas units). The page scales this to the window.
export const FIELD = { width: 960, height: 600 };
export const CENTER = { x: FIELD.width / 2, y: FIELD.height / 2 };

// The beacon the player defends. Enemies that reach it burst on it.
export const BEACON = { radius: 46, maxHp: 100 };

// The keeper (the player).
export const PLAYER = {
  radius: 14,
  speed: 235,
  maxHp: 5,
  boltSpeed: 640,
  boltRadius: 5,
  boltDamage: 1,
  fireInterval: 0.28, // seconds between bolts at base fire rate
  shockwaveRadius: 235,
  shockwaveDamage: 6,
  shockwaveMax: 3,
};

// A wisp that gets this close to the keeper veers at them instead of
// the beacon: the keeper can body-block, at the cost of a heart.
export const AGGRO_RADIUS = 145;

// Enemy kinds. hp in bolt-damage units; speed in units per second;
// beaconDamage is the beacon HP lost when one bursts on the beacon;
// embers is the currency dropped on death; score is the base points.
export const ENEMY_KINDS = {
  ember:    { hp: 5,  speed: 64,  radius: 13, score: 50,  embers: 1, beaconDamage: 5,  color: '#ff9a3c' },
  dart:     { hp: 4,  speed: 140, radius: 10, score: 80,  embers: 1, beaconDamage: 4,  color: '#ff5d73' },
  splitter: { hp: 8,  speed: 52,  radius: 16, score: 120, embers: 2, beaconDamage: 7,  color: '#b78cff' },
  mote:     { hp: 2,  speed: 108, radius: 8,  score: 30,  embers: 0, beaconDamage: 2,  color: '#d9b8ff' },
  brute:    { hp: 34, speed: 38,  radius: 24, score: 300, embers: 4, beaconDamage: 15, color: '#ff3d2e' },
  // The Night Herald, the wave-10 boss: slow, huge, and it will not
  // die on the beacon — it shoves back out and has to be killed.
  herald:   { hp: 120, speed: 34, radius: 32, score: 500, embers: 25, beaconDamage: 20, color: '#ff2e63', boss: true },
};

// What each wave may spawn. A wave's spawn budget grows with its number;
// the cost of each kind is its weight, so later waves field more and
// tougher wisps. Kinds unlock as the waves go on.
export const WAVES = {
  total: 10,
  budget: (wave) => 4 + wave * 6,
  spawnInterval: (wave) => Math.max(0.32, 1.05 - wave * 0.08),
  unlocks: (wave) => {
    const kinds = ['ember'];
    if (wave >= 2) kinds.push('dart');
    if (wave >= 3) kinds.push('splitter');
    if (wave >= 5) kinds.push('brute');
    return kinds;
  },
  cost: { ember: 1, dart: 2, splitter: 3, brute: 6 },
};

// The between-wave shop. cost(n) is the price of the (n+1)-th purchase
// of that item; apply(state) is what buying it does.
export const SHOP = [
  {
    key: '1', name: 'Sharpened Lens', desc: '+1 bolt damage',
    cost: (n) => 6 + n * 3,
    apply: (s) => { s.upgrades.damage += 1; },
  },
  {
    key: '2', name: 'Rapid Crank', desc: '+25% fire rate',
    cost: (n) => 6 + n * 3,
    apply: (s) => { s.upgrades.fireRate += 0.25; },
  },
  {
    key: '3', name: 'Swift Boots', desc: '+12% move speed',
    cost: (n) => 5 + n * 2,
    apply: (s) => { s.upgrades.speed += 0.12; },
  },
  {
    key: '4', name: 'Beacon Masonry', desc: 'Repair the beacon +30 HP',
    cost: (n) => 5 + n * 2,
    apply: (s) => { s.beaconHp = Math.min(BEACON.maxHp, s.beaconHp + 30); },
  },
  {
    key: '5', name: 'Heartwood Charm', desc: '+1 max heart, heal 1',
    cost: (n) => 8 + n * 4,
    apply: (s) => { s.maxHp += 1; s.hp = Math.min(s.maxHp, s.hp + 1); },
  },
  {
    key: '6', name: 'Shockwave Coil', desc: '+1 shockwave charge (max 5)',
    cost: (n) => 7 + n * 3,
    apply: (s) => { s.shockMax = Math.min(5, s.shockMax + 1); s.shock += 1; },
  },
];

// Combo: kills chained inside this window raise the multiplier.
export const COMBO_WINDOW = 2.5;
export const COMBO_STEP = 0.1; // +10% score per chained kill, capped below
export const COMBO_CAP = 20;

// Look: one palette for the whole game, so the night reads as one scene.
export const COLORS = {
  skyTop: '#0b1026',
  skyBottom: '#1a0f2e',
  ground: '#141a33',
  beaconGlow: 'rgba(255, 176, 66, 0.55)',
  beaconCore: '#ffc46b',
  bolt: '#ffe9a8',
  player: '#7fe7c4',
  playerDark: '#2e8f74',
  text: '#f4ead8',
  textDim: '#a89ec4',
  panel: 'rgba(12, 16, 38, 0.92)',
  panelEdge: '#4a3f78',
  danger: '#ff5d73',
  ember: '#ffb347',
};
