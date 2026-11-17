// EMBERKEEP bootstrap: wires the canvas, the input and the loop, and
// stages the screenshot scenes when the page is opened with ?shot=.
// Live play runs on requestAnimationFrame with a clamped delta; the
// screenshot scenes step the world at a fixed 1/60 and freeze on one
// frame, so the shot is the same every time it is taken.
import { FIELD } from './config.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { clickWorld, makeWorld, stepWorld } from './world.js';
import { render } from './render.js';
import { stageShot } from './autopilot.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
const audio = makeAudio();
const input = makeInput(canvas);
const world = makeWorld();

let view = { scale: 1, ox: 0, oy: 0 };

/** Fit the 960x600 field into the window, letterboxed. */
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  view = {
    scale,
    ox: (canvas.width - FIELD.width * scale) / 2,
    oy: (canvas.height - FIELD.height * scale) / 2,
  };
  input.setView(scale / dpr, view.ox / dpr, view.oy / dpr);
}
window.addEventListener('resize', resize);
resize();

/** Keep the screen-reader status line in step with the game. */
function announce() {
  const lines = {
    title: 'Emberkeep. Press Enter to begin.',
    play: `Wave ${world.wave} of 10. Score ${world.score}. Beacon ${Math.ceil(world.beaconHp)} health, ${world.player.hp} hearts.`,
    shop: `Wave ${world.wave} cleared. ${world.embers} embers. Press 1 to 6 to buy, Enter for the next wave.`,
    victory: `Victory. The light endures. Score ${world.score}.`,
    gameover: `Game over on wave ${world.wave}. Score ${world.score}.`,
  };
  const line = lines[world.screen] ?? '';
  if (statusEl.textContent !== line) statusEl.textContent = line;
}

// A click in the shop buys or advances; everywhere else the world
// itself reads the click (start on the title, restart on the end).
canvas.addEventListener('click', (e) => {
  if (world.screen !== 'shop') return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const x = ((e.clientX - rect.left) * dpr - view.ox) / view.scale;
  const y = ((e.clientY - rect.top) * dpr - view.oy) / view.scale;
  clickWorld(world, x, y, audio);
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // Screenshot mode: stage the scene, draw one frame, signal readiness.
  // Audio stays off; the world runs silent.
  stageShot(shot, world);
  render(ctx, world, view, canvas.width, canvas.height);
  announce();
  window.__shotReady = true;
} else {
  // Live play.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    stepWorld(world, dt, input, audio);
    input.clearTransient();
    render(ctx, world, view, canvas.width, canvas.height);
    announce();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
