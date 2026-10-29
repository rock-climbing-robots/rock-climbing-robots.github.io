// The animated background of the landing page and of the practical pages: a
// low-poly mesh breathing slowly behind the text, the same idea as the one
// behind the slides (engine/background.js).
//
// It is drawn here, with its own few lines, rather than by the engine: these
// pages switch theme WITHOUT reloading, while the engine's palette is fixed
// at load. So the ink is read again at every frame, and the mesh follows the
// button at once.
//
// Seeded, never Math.random: the page looks the same on every visit.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function backgroundSketch(canvas, { cols = 7, rows = 4, seed = 20260918 } = {}) {
  const ctx = canvas.getContext("2d");
  const rand = rng(seed);
  const over = 0.12;                        // the mesh overhangs the page
  const nodes = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      nodes.push({
        x: -over + (i + (rand() - 0.5) * 0.84) * (1 + 2 * over) / cols,
        y: -over + (j + (rand() - 0.5) * 0.84) * (1 + 2 * over) / rows,
        ax: 0.012 * (0.5 + rand()), ay: 0.012 * (0.5 + rand()),
        wx: 0.006 + rand() * 0.012, wy: 0.006 + rand() * 0.012,
        px: rand() * Math.PI * 2, py: rand() * Math.PI * 2,
      });
    }
  }
  const at = (i, j) => nodes[j * (cols + 1) + i];
  const faces = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const [a, b, c, d] = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const pair = rand() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      for (const tri of pair) faces.push({ tri, w: 0.004 + rand() * 0.010, p: rand() * Math.PI * 2 });
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }
  window.addEventListener("resize", resize);
  resize();

  function draw(t) {
    const light = document.documentElement.dataset.theme === "light";
    const ink = light ? "0,0,0" : "255,255,255";
    const [lo, hi] = light ? [0.010, 0.042] : [0.012, 0.055];
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    for (const n of nodes) {
      n.cx = (n.x + n.ax * Math.sin(t * n.wx * Math.PI * 2 + n.px)) * W;
      n.cy = (n.y + n.ay * Math.sin(t * n.wy * Math.PI * 2 + n.py)) * H;
    }
    for (const f of faces) {
      const [a, b, c] = f.tri;
      const k = 0.5 + 0.5 * Math.sin(t * f.w * Math.PI * 2 + f.p);
      ctx.beginPath();
      ctx.moveTo(a.cx, a.cy);
      ctx.lineTo(b.cx, b.cy);
      ctx.lineTo(c.cx, c.cy);
      ctx.closePath();
      ctx.fillStyle = `rgba(${ink},${(lo + (hi - lo) * k).toFixed(4)})`;
      ctx.fill();
    }
  }

  const frame = (now) => {
    if (!document.hidden) draw(now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
