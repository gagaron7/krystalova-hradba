/** Krátké zvuky skládané ve WebAudio. Žádné audio soubory. */

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let enabled = true;
  let musicOn = false;
  let drone = [];
  let volume = 0.7;

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22 * volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function noise() {
    const c = context();
    if (!c) return null;
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(c.sampleRate * 0.4);
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function tone({ freq = 440, dur = 0.12, type = "sine", gain = 0.1, slide = 0, delay = 0 }) {
    const c = context();
    if (!c || !master) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), t0);
    if (slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function burst({ dur = 0.18, gain = 0.12, freq = 700, delay = 0 }) {
    const c = context();
    const buf = noise();
    if (!c || !buf || !master) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t0);
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, gain), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function stopDrone() {
    for (const node of drone) {
      try { node.stop(); } catch { /* already stopped */ }
    }
    drone = [];
  }

  function startDrone() {
    const c = context();
    if (!c || !master || drone.length || !enabled || !musicOn) return;
    [82, 123].forEach((freq, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = freq;
      g.gain.value = i === 0 ? 0.018 : 0.01;
      o.connect(g);
      g.connect(master);
      o.start();
      drone.push(o);
    });
  }

  const sounds = {
    shot(kind) {
      if (kind === "cannon") {
        burst({ dur: 0.2, gain: 0.16, freq: 220 });
        tone({ freq: 110, dur: 0.16, type: "sine", gain: 0.14, slide: -50 });
      } else if (kind === "frost") {
        tone({ freq: 740, dur: 0.12, type: "sine", gain: 0.05, slide: 420 });
        tone({ freq: 1180, dur: 0.14, type: "triangle", gain: 0.035, slide: 180 });
      } else if (kind === "storm") {
        tone({ freq: 520, dur: 0.05, type: "square", gain: 0.035, slide: 640 });
        tone({ freq: 1400, dur: 0.07, type: "sine", gain: 0.04, delay: 0.02 });
      } else if (kind === "venom") {
        tone({ freq: 280, dur: 0.08, type: "sine", gain: 0.04, slide: -80 });
      } else if (kind === "sniper") {
        tone({ freq: 180, dur: 0.07, type: "square", gain: 0.04 });
        tone({ freq: 920, dur: 0.09, type: "sine", gain: 0.06, delay: 0.015 });
      } else {
        tone({ freq: 620, dur: 0.055, type: "triangle", gain: 0.05, slide: 160 });
      }
    },
    hit() {
      tone({ freq: 980, dur: 0.04, type: "sine", gain: 0.035 });
    },
    explode() {
      burst({ dur: 0.28, gain: 0.16, freq: 240 });
      burst({ dur: 0.16, gain: 0.08, freq: 900, delay: 0.02 });
      tone({ freq: 180, dur: 0.18, type: "sine", gain: 0.1, slide: -90 });
      tone({ freq: 90, dur: 0.28, type: "triangle", gain: 0.06, delay: 0.04, slide: -30 });
    },
    death() {
      burst({ dur: 0.16, gain: 0.08, freq: 500 });
      tone({ freq: 360, dur: 0.12, type: "sine", gain: 0.05, slide: -180 });
    },
    coin() {
      tone({ freq: 880, dur: 0.06, type: "sine", gain: 0.05 });
      tone({ freq: 1320, dur: 0.08, type: "sine", gain: 0.04, delay: 0.05 });
    },
    wave() {
      tone({ freq: 392, dur: 0.1, type: "triangle", gain: 0.06 });
      tone({ freq: 523, dur: 0.12, type: "triangle", gain: 0.06, delay: 0.08 });
      tone({ freq: 659, dur: 0.16, type: "triangle", gain: 0.05, delay: 0.16 });
    },
    clear() {
      tone({ freq: 660, dur: 0.08, type: "sine", gain: 0.05 });
      tone({ freq: 880, dur: 0.12, type: "sine", gain: 0.045, delay: 0.07 });
    },
    boss() {
      burst({ dur: 0.55, gain: 0.14, freq: 120 });
      burst({ dur: 0.3, gain: 0.06, freq: 420, delay: 0.05 });
      tone({ freq: 78, dur: 0.5, type: "sawtooth", gain: 0.045, slide: -24 });
      tone({ freq: 49, dur: 0.7, type: "sine", gain: 0.09, slide: -12 });
      tone({ freq: 98, dur: 0.35, type: "triangle", gain: 0.04, delay: 0.08 });
    },
    upgrade() {
      tone({ freq: 523, dur: 0.08, type: "triangle", gain: 0.05 });
      tone({ freq: 659, dur: 0.08, type: "triangle", gain: 0.05, delay: 0.07 });
      tone({ freq: 784, dur: 0.1, type: "triangle", gain: 0.05, delay: 0.14 });
      tone({ freq: 1046, dur: 0.16, type: "sine", gain: 0.04, delay: 0.21 });
    },
    victory() {
      tone({ freq: 523, dur: 0.1, type: "triangle", gain: 0.06 });
      tone({ freq: 659, dur: 0.1, type: "triangle", gain: 0.06, delay: 0.09 });
      tone({ freq: 784, dur: 0.12, type: "triangle", gain: 0.06, delay: 0.18 });
      tone({ freq: 1046, dur: 0.22, type: "sine", gain: 0.05, delay: 0.28 });
    },
    defeat() {
      tone({ freq: 392, dur: 0.18, type: "sine", gain: 0.07, slide: -80 });
      tone({ freq: 311, dur: 0.22, type: "triangle", gain: 0.06, delay: 0.16, slide: -90 });
      tone({ freq: 196, dur: 0.4, type: "sine", gain: 0.07, delay: 0.32, slide: -60 });
    },
    leak() {
      tone({ freq: 140, dur: 0.12, type: "sine", gain: 0.08, slide: -40 });
    },
    ui() {
      tone({ freq: 740, dur: 0.04, type: "sine", gain: 0.04 });
    },
    deny() {
      tone({ freq: 180, dur: 0.08, type: "square", gain: 0.03 });
    },
  };

  return {
    unlock() {
      try {
        context();
        if (musicOn && enabled) startDrone();
      } catch {
        /* autoplay */
      }
    },
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) stopDrone();
      else if (musicOn) startDrone();
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, value));
      if (master) master.gain.value = 0.22 * volume;
    },
    setMusic(value) {
      musicOn = !!value;
      if (musicOn && enabled) startDrone();
      else stopDrone();
    },
    play(name, arg) {
      if (!enabled) return;
      const fn = sounds[name];
      if (!fn) return;
      try {
        fn(arg);
      } catch {
        /* ignore audio glitches */
      }
    },
  };
}
