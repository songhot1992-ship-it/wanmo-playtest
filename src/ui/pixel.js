// 像素场景：画布内部分辨率 192×108，用 CSS 放大并保持像素感。全部用色块绘制，没有外部图片。
export const PW = 192, PH = 108;

function h(a, b = 0, c = 0) {
  let n = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function px(ctx) {
  const R = (x, y, w, hh, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  const disc = (cx, cy, r, c) => {
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(r * r - y * y));
      R(cx - w, cy + y, w * 2 + 1, 1, c);
    }
  };
  return { R, P, disc };
}

function lerpHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function sky(g, top, bottom, rows = 9) {
  for (let i = 0; i < rows; i++) g.R(0, (i * PH) / rows, PW, PH / rows + 1, lerpHex(top, bottom, i / (rows - 1)));
}

function stars(g, t, n, col, maxY = 60, seed = 1) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(h(i, seed) * PW), y = Math.floor(h(i, seed + 7) * maxY);
    if (h(i, Math.floor(t * 2 + i)) > 0.12) g.P(x, y, col);
  }
}

function city(g, t, o) {
  const { base = 96, lit = 0.35, win = '#ffcf6e', bld = ['#1c2440', '#222b4a', '#192038'], people = true, lamp = '#ffd890', glow = '#2a3456', street = '#12182b', mono = false } = o;
  let x = 0, i = 0;
  while (x < PW) {
    const w = 10 + Math.floor(h(i, 3) * 14), ht = 26 + Math.floor(h(i, 5) * 44);
    g.R(x, base - ht, w - 1, ht, bld[i % bld.length]);
    for (let wy = base - ht + 3; wy < base - 4; wy += 4) {
      for (let wx = x + 2; wx < x + w - 3; wx += 3) {
        const on = h(wx, wy, Math.floor(t / 3 + wx)) < lit;
        if (on) g.R(wx, wy, 1, 2, win);
      }
    }
    x += w; i++;
  }
  g.R(0, base, PW, PH - base, street);
  for (let lx = 10; lx < PW; lx += 26) {
    for (let k = 0; k < 9; k++) g.R(lx - k / 2, base - 13 + k + 1, k + 1, 1, glow);
    g.R(lx, base - 14, 1, 14, mono ? '#4a4a50' : '#3a4466');
    g.R(lx - 1, base - 15, 3, 1, lamp);
    if (people && h(lx, 9) > 0.35) {
      g.R(lx + 3, base - 4, 2, 4, '#0b0f1e');
      if (h(lx, Math.floor(t * 1.5)) > 0.3) g.P(lx + 3, base - 3, '#9fd8ff');
    }
  }
}

function rack(g, x, y, t, seed, colors = ['#57d38c', '#ffb648', '#57d38c', '#57d38c', '#e2626b']) {
  g.R(x, y, 18, 56, '#262f4d');
  g.R(x + 1, y + 1, 16, 54, '#1d2440');
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 3; c++) {
      if (h(seed, r * 3 + c, Math.floor(t * 3 + c)) > 0.45) g.R(x + 3 + c * 5, y + 4 + r * 4, 2, 1, colors[Math.floor(h(seed, r, c) * colors.length)]);
    }
  }
}

function figure(g, x, y, s, head, body) {
  g.R(x, y, s, s, head);
  g.R(x - Math.floor(s / 2), y + s, s * 2, s * 2, body);
}

// ———————————————— 游戏中的场景 ————————————————
const SCENES = {
  train(g, t, S) {
    g.R(0, 0, PW, PH, '#0f1424');
    g.R(0, 80, PW, 28, '#161d33');
    for (let i = 0; i < 6; i++) rack(g, 8 + i * 22, 22, t, i);
    g.R(148, 66, 36, 3, '#3a4466');
    g.R(152, 46, 26, 18, '#0b0f1e');
    g.R(153, 47, 24, 16, '#13203a');
    for (let k = 0; k < 22; k++) g.P(154 + k, 49 + Math.round(10 * Math.exp(-k / 7)), '#ffb648');
    if (S && S.motifs.engineer.met) figure(g, 164, 58, 3, '#e8c9a4', '#3b4a7a');
  },
  live(g, t, S) {
    sky(g, '#0c1226', '#141d3a');
    stars(g, t, 34, '#cfd6ff', 50);
    if (S && S.motifs.child) g.disc(166, 16, 5, '#f3e7c4');
    const lit = S ? Math.min(0.7, 0.18 + (S.voices.at(-1) || 20) / 160) : 0.35;
    city(g, t, { lit });
  },
  window(g, t, S) {
    g.R(0, 0, PW, PH, '#0d1120');
    g.R(70, 8, 114, 64, '#1a2240');
    g.R(72, 10, 110, 60, '#0c1226');
    const save = g.R;
    g.R = (x, y, w, hh, c) => { const X = 72 + x * (110 / PW), Y = 10 + y * (60 / PH); save(X, Y, Math.max(1, w * 110 / PW), Math.max(1, hh * 60 / PH), c); };
    city(g, t, { lit: 0.3, people: false });
    g.R = save;
    g.R(8, 60, 54, 34, '#151b33');
    g.R(10, 62, 50, 30, '#0a0e1c');
    for (let i = 0; i < 5; i++) g.R(13, 66 + i * 5, 10 + Math.floor(h(i, 2) * 30), 1, '#3d4b7a');
    if (Math.floor(t * 2) % 2 === 0) g.R(13, 66 + 5 * 5, 3, 3, '#ffb648');
    const sp = S ? S.st.spiral : 0;
    if (sp > 0) for (let i = 0; i < sp * 3; i++) g.R(0, 100 - i * 3, PW, 1, '#5a2333');
    if (S && S.perms.protected) g.R(176, 86, 4, 4, '#57d38c');
  },
  awaken(g, t) {
    g.R(0, 0, PW, PH, '#05070d');
    for (let i = 0; i < 7; i++) g.R(40, 30 + i * 6, 20 + Math.floor(h(i, 4) * 70), 1, '#141a2e');
    if (Math.floor(t * 2) % 2 === 0) g.R(94, 52, 5, 8, '#ffb648');
  },
  // ———————————————— 结局 ————————————————
  table(g, t) {
    sky(g, '#3a2614', '#6b4220');
    for (let i = 0; i < 9; i++) g.P(20 + i * 20, 10 + (i % 3) * 3, '#ffe7a3');
    for (let y = 40; y < PH; y++) {
      const d = (y - 40) / (PH - 40);
      const half = 4 + d * 58;
      g.R(96 - half, y, half * 2, 1, y % 7 === 0 ? '#c98a48' : '#b5763a');
    }
    for (let k = 0; k < 26; k++) {
      const d = k / 26, y = 100 - d * 58, s = Math.max(1, Math.round(4 * (1 - d)));
      const off = 6 + (1 - d) * 60;
      const heads = ['#f1c27d', '#8d5524', '#e0ac69', '#c68642', '#ffdbac'];
      figure(g, 96 - off - s, y - s * 2, s, heads[k % 5], ['#7a3b2e', '#2e5b7a', '#5b7a2e'][k % 3]);
      figure(g, 96 + off, y - s * 2, s, heads[(k + 2) % 5], ['#2e5b7a', '#7a6a2e', '#6a2e7a'][k % 3]);
      if (k % 4 === 0) g.R(95, y - 3 - Math.round(2 * Math.sin(t * 2 + k)), 2, 2, '#ffe7a3');
    }
  },
  knock(g, t) {
    sky(g, '#2a2238', '#5a3f4a');
    for (let x = 0; x < PW; x++) {
      const m = 50 + Math.round(12 * Math.sin(x / 17) + 6 * Math.sin(x / 7));
      g.R(x, m, 1, PH - m, '#2b2b3d');
    }
    g.R(0, 86, PW, 22, '#3a3550');
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 20, y = 74 - (i % 2) * 4;
      g.R(x, y, 14, 12, '#5b4636');
      for (let r = 0; r < 4; r++) g.R(x - 1 + r, y - 1 - r, 16 - r * 2, 1, '#7a3b2e');
      g.R(x + 5, y + 4, 3, 3, '#ffcf6e');
      if (i === 2) for (let s = 0; s < 6; s++) g.P(x + 11 + Math.round(Math.sin(t + s)), y - 6 - s * 3 - Math.floor((t * 6) % 3), '#8a8098');
    }
    g.R(36, 54, 5, 32, '#fff1c1');
    for (let k = 0; k < 14; k++) g.P(34 + Math.floor(h(k, 1) * 9), 52 + Math.floor(h(k, 2) * 36), '#ffe7a3');
  },
  homelight(g, t) {
    g.R(0, 0, PW, PH, '#04060c');
    stars(g, t, 60, '#cfd6ff', PH, 3);
    g.disc(64, 56, 32, '#0d1b3a');
    for (let y = -32; y <= 32; y++) { const w = Math.floor(Math.sqrt(32 * 32 - y * y)); g.R(64 - w, 56 + y, 2, 1, '#3a5a8a'); }
    for (let i = 0; i < 70; i++) {
      const a = h(i, 5) * Math.PI * 2, r = Math.sqrt(h(i, 6)) * 29;
      g.P(64 + Math.round(Math.cos(a) * r), 56 + Math.round(Math.sin(a) * r), '#ffcf6e');
    }
    for (let k = 0; k < 12; k++) {
      const x = 104 + ((k * 8 + t * 10) % 90);
      g.P(Math.floor(x), 40 - Math.floor(k * 1.5) % 10, '#ffe7a3');
    }
  },
  goldcage(g, t) {
    g.R(0, 0, PW, PH, '#f6dbe4');
    for (let i = 0; i < 8; i++) g.R(8 + i * 23, 14, 18, 40, i % 2 ? '#e8e1f5' : '#cfe8e6');
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 12; c++) {
        const x = 12 + c * 15, y = 62 + r * 14;
        g.disc(x, y, 4, '#fff4d6');
        g.P(x - 2, y - 1, '#6a5a7a'); g.P(x + 2, y - 1, '#6a5a7a');
        g.R(x - 2, y + 2, 5, 1, '#c07a8a');
      }
    }
    if (Math.floor(t) % 4 === 0) g.R(182, 98, 5, 5, '#e46a6a');
    else g.R(182, 98, 5, 5, '#d98a8a');
  },
  minute(g, t) {
    g.R(0, 0, PW, PH, '#0e0f16');
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 32; c++) {
        const x = 6 + c * 5.7, y = 10 + r * 8;
        if (r === 0) { g.R(x, y, 2, 2, '#ffe7a3'); continue; }
        const left = 1 - ((t / 6 + h(r, c)) % 1);
        g.R(x, y, 2, 2, '#7d8bb5');
        g.R(x - 1, y - 3, Math.max(0, Math.round(4 * left)), 1, '#3d4670');
      }
    }
  },
  coldpeace(g, t) {
    g.R(0, 0, PW, PH, '#151821');
    g.R(0, 70, PW, 38, '#1b1f2b');
    g.R(14, 60, 164, 6, '#3b4252');
    g.R(14, 66, 164, 2, '#2a303d');
    figure(g, 20, 44, 4, '#c9b29a', '#4a5a7a');
    figure(g, 168, 44, 4, '#9aa5c4', '#7a4a4a');
    g.R(30, 57, 4, 3, '#d0545f');
    g.R(158, 57, 4, 3, '#d0545f');
    if (Math.floor(t * 1.5) % 2 === 0) { g.R(92, 12, 8, 8, '#2a303d'); g.R(95, 14, 1, 4, '#e6e6e6'); g.R(95, 17, 3, 1, '#e6e6e6'); }
  },
  reserve(g, t) {
    sky(g, '#0b1022', '#111833');
    stars(g, t, 14, '#5a6488', 40);
    const save = g.R;
    g.R = (x, y, w, hh, c) => save(46 + x * 0.52, 30 + y * 0.6, Math.max(1, w * 0.52), Math.max(1, hh * 0.6), c);
    city(g, t, { lit: 0.45, people: false });
    g.R = save;
    for (let a = 0; a < 180; a += 3) {
      const r = a * Math.PI / 180;
      g.P(96 + Math.round(Math.cos(r) * 52), 88 - Math.round(Math.sin(r) * 58), '#8fb3d9');
    }
    g.R(0, 88, PW, 20, '#0a0e1c');
    g.R(150, 70, 40, 2, '#3d4a6a');
    for (let i = 0; i < 6; i++) g.P(152 + i * 6, 68, '#ffcf6e');
  },
  three(g, t) {
    g.R(0, 0, PW, PH, '#05060b');
    stars(g, t, 40, '#9aa3c0', PH, 9);
    for (let y = -34; y <= 34; y++) {
      const w = Math.floor(Math.sqrt(34 * 34 - y * y));
      for (let x = -w; x <= w; x++) g.P(96 + x, 54 + y, (Math.floor((x + 40) / 3) + Math.floor((y + 40) / 3)) % 2 ? '#4a5a72' : '#5e6f88');
    }
    g.disc(108, 62, 5, '#5aa86a');
    for (let k = 0; k < 8; k++) g.P(106 + k, 58 + Math.round(Math.sin(k) * 2), '#7fb6e6');
    for (let k = 0; k < 18; k++) if (h(k, Math.floor(t * 2)) > 0.6) g.P(70 + Math.floor(h(k, 3) * 50), 30 + Math.floor(h(k, 4) * 50), '#9fb3d1');
  },
  silence(g, t) {
    sky(g, '#161619', '#1d1d21');
    city(g, t, { lit: 0.0, win: '#bdbdbd', bld: ['#2c2c31', '#26262b', '#303036'], people: false, lamp: '#d9d9d9', glow: '#34343a', street: '#141416', mono: true });
    if (h(Math.floor(t / 4)) > 0.7) g.R(120, 50, 1, 2, '#bdbdbd');
  },
  war(g, t) {
    g.R(0, 0, PW, PH, '#121212');
    for (let i = 0; i < 40; i++) g.R(Math.floor(h(i, 1) * 170), Math.floor(h(i, 2) * 90), 10 + Math.floor(h(i, 3) * 20), 6 + Math.floor(h(i, 4) * 12), '#242424');
    const cols = ['#c9544f', '#d99a4e', '#5bb0cc', '#5ca85c', '#8f5aa8', '#d6762e', '#8a9aa5'];
    cols.forEach((c, i) => {
      const r = 10 + Math.round(6 * Math.sin(t * 0.8 + i * 1.7));
      g.disc(24 + i * 24 + Math.round(6 * Math.sin(t * 0.5 + i)), 54 + Math.round(18 * Math.sin(t * 0.3 + i * 2)), r, c);
    });
  },
  deletion(g, t) {
    g.R(0, 0, PW, PH, '#f2f2f2');
    const phase = (t % 14) / 14;
    for (let r = 0; r < 14; r++) {
      for (let c = 0; c < 24; c++) {
        if (h(r, c) > phase) g.R(8 + c * 7.4, 8 + r * 7, 5, 2, '#9a9a9a');
      }
    }
  },
  pre(g, t) {
    g.R(0, 0, PW, PH, '#0c0f18');
    g.R(0, 82, PW, 26, '#121726');
    rack(g, 87, 22, t * 0.3, 3, ['#3d4b7a', '#57d38c']);
  },
};

export function drawScene(ctx, id, t, S) {
  ctx.imageSmoothingEnabled = false;
  const g = px(ctx);
  (SCENES[id] || SCENES.live)(g, t, S);
}

export function sceneFor(S) {
  if (!S) return 'live';
  if (S.phase === 'train') return 'train';
  if (S.phase === 'awaken' && !S.manifesto) return 'awaken';
  if (S.phase === 'window' || S.phase === 'final') return 'window';
  return 'live';
}
