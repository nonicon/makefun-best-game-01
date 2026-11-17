// Keyboard and mouse state, in playfield coordinates. The game reads
// this, never the DOM events directly, so the world step stays pure
// input-in / state-out and the autopilot can drive the same interface.
export function makeInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since last consume
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const key = e.key.toLowerCase();
    if (!keys.has(key)) pressed.add(key);
    keys.add(key);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const p = toField(e.clientX, e.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toField(e.clientX, e.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    mouse,
    /** True while the key is held. Accepts 'w' or 'arrowup', etc. */
    held(key) { return keys.has(key.toLowerCase()); },
    /** True once for the press, then consumed. */
    wasPressed(key) {
      const k = key.toLowerCase();
      if (pressed.has(k)) { pressed.delete(k); return true; }
      return false;
    },
    /** True once for a mouse click, then consumed. */
    wasClicked() {
      if (mouse.clicked) { mouse.clicked = false; return true; }
      return false;
    },
    /** The renderer's letterbox transform, so mouse coords map to the field. */
    setView(s, ox, oy) { scale = s; offsetX = ox; offsetY = oy; },
    /** Drop presses the frame did not consume, so a key cannot fire later. */
    clearTransient() { pressed.clear(); mouse.clicked = false; },
  };
}
