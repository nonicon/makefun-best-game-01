// Synthesized sound effects, made with the Web Audio API only — no
// audio files, no network. The context is created lazily on the first
// user gesture (browsers block audio before one), and every effect is a
// short oscillator/noise envelope. M toggles mute.
export function makeAudio() {
  let ctx = null;
  let noiseBuf = null;
  let muted = false;

  function ensure() {
    if (ctx !== null) return ctx;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure();
    if (!c || !noiseBuf) return;
    const t0 = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    shoot() { tone(880, 0.07, 'square', 0.05, 440); },
    hit() { noise(0.06, 0.08, 2400); },
    burst() { noise(0.28, 0.22, 900); tone(160, 0.25, 'sine', 0.16, 50); },
    pickup() { tone(1320, 0.09, 'sine', 0.07, 1760); },
    hurt() { tone(220, 0.22, 'sawtooth', 0.14, 90); },
    beaconHit() { tone(110, 0.3, 'sawtooth', 0.18, 55); noise(0.2, 0.14, 700); },
    shockwave() { noise(0.4, 0.2, 1400); tone(320, 0.35, 'sine', 0.12, 60); },
    buy() { tone(660, 0.08, 'triangle', 0.1); setTimeout(() => tone(990, 0.1, 'triangle', 0.1), 70); },
    horn() { tone(196, 0.7, 'sawtooth', 0.1, 196); tone(294, 0.7, 'sawtooth', 0.07, 294); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.12), i * 130));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.4, 'triangle', 0.12), i * 170));
    },
  };
}
