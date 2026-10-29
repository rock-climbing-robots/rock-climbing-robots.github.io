// A real robot on a slide, drawn by the browser.
//
// The meshes of an industrial arm, lit and shaded, cannot be drawn with the
// engine's strokes -- but they do not have to be filmed either. This is the
// answer to that: tools/robot_webgl.py writes the robot as DATA (the
// kinematic tree, the visual meshes as MuJoCo compiles them, a motion as
// joint configurations, a camera), and this module
//   - computes the forward kinematics of a configuration, as MuJoCo does,
//   - draws the meshes with WebGL2 in an offscreen canvas, lit by a headlight
//     like MuJoCo's, on a transparent background,
//   - and hands that picture to the engine's canvas (drawImage), where the
//     course's frames, arrows and labels are drawn over it, projected through
//     the very same camera.
//
// What it changes for a lecture: the camera is OURS (it can turn and close
// in, as an ordinary animation), the pose is ours (a joint can be set, not
// only played back), and a single body can be picked out by colour instead of
// being filmed a second time. The instant `t`, the configuration and the
// camera are plain fields of the mobject, so every one of those is replayed
// exactly when the player jumps between slides.
//
// Everything a lecture draws over the machine goes through points it asks
// for: `at`, `middle`, `axes`, `joint` answer in SLIDE coordinates, so an
// arrow that names a link, a frame drawn on a body or a ring round a joint
// follow the robot without the lecture knowing any 3D at all.

import { Mobject } from "./mobject.js";
import { add } from "./math.js";

const BASE = "assets/robots/";
const loaded = new Map();      // name -> { data, blob, buffers }

/** Load a robot once (its model and its meshes); a lecture awaits it before
    laying out anything that hangs on the robot. */
export async function loadRobot(name) {
  if (loaded.has(name)) return loaded.get(name);
  const [res, bin] = await Promise.all([
    fetch(`${BASE}${name}3d.json`),
    fetch(`${BASE}${name}3d.bin`),
  ]);
  if (!res.ok || !bin.ok) throw new Error(`no 3d data for ${name}`);
  const entry = { data: await res.json(), blob: await bin.arrayBuffer(), buffers: null };
  loaded.set(name, entry);
  return entry;
}

// --- small 3D maths ---------------------------------------------------------

const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qnorm = (q) => { const n = Math.hypot(...q) || 1; return q.map((v) => v / n); };
/** Rotation matrix (row-major 3x3) of a unit quaternion w, x, y, z. */
function qmat([w, x, y, z]) {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
          2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
          2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}
const mv = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
                      R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
                      R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
                    a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; },
};

/**
 * Forward kinematics, MuJoCo's way: each body placed in its parent, then
 * turned by its joints (a hinge about its axis through its anchor; a free
 * joint sets the pose outright). Returns, per body, its position and
 * orientation, and per joint its anchor and axis in the world.
 */
export function kinematics(data, q) {
  const { bodies } = data.model;
  const out = [], joints = {};
  for (let b = 0; b < bodies.length; b++) {
    const body = bodies[b];
    if (b === 0) {
      out.push({ p: [0, 0, 0], quat: [1, 0, 0, 0], R: qmat([1, 0, 0, 0]) });
      continue;
    }
    const par = out[body.parent];
    let p = v3.add(par.p, mv(par.R, body.pos));
    let quat = qnorm(qmul(par.quat, body.quat));
    for (const j of body.joints) {
      if (j.type === 0) {                              // free
        p = [q[j.qpos], q[j.qpos + 1], q[j.qpos + 2]];
        quat = qnorm(q.slice(j.qpos + 3, j.qpos + 7));
        joints[j.name] = { anchor: p, axis: [0, 0, 1] };
      } else if (j.type === 3) {                       // hinge
        const R = qmat(quat);
        const anchor = v3.add(p, mv(R, j.pos)), axis = mv(R, j.axis);
        joints[j.name] = { anchor, axis };
        const h = q[j.qpos] / 2, s = Math.sin(h);
        quat = qnorm(qmul(quat, [Math.cos(h), j.axis[0] * s, j.axis[1] * s, j.axis[2] * s]));
        p = v3.sub(anchor, mv(qmat(quat), j.pos));
      }
    }
    out.push({ p, quat, R: qmat(quat) });
  }
  return { bodies: out, joints };
}

// --- cameras ----------------------------------------------------------------

/** MuJoCo's free camera: where it is and the way it looks. */
export function cameraFrame(cam) {
  const az = (cam.azimuth * Math.PI) / 180, el = (cam.elevation * Math.PI) / 180;
  const fwd = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  const right = v3.norm(v3.cross(fwd, [0, 0, 1])), up = v3.cross(right, fwd);
  return { pos: v3.sub(cam.lookat, v3.mul(fwd, cam.distance)), fwd, right, up };
}

/** A world point as (u, v) of the picture, origin top left. */
export function projectUV(data, cam, p) {
  const { pos, fwd, right, up } = cameraFrame(cam);
  const d = v3.sub(p, pos), z = v3.dot(d, fwd);
  const f = 1 / Math.tan((data.fovy * Math.PI) / 360);
  return [0.5 + (v3.dot(d, right) / z) * f / data.aspect / 2,
          0.5 - (v3.dot(d, up) / z) * f / 2];
}

const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

/** Between two cameras, eased in and out; the distance moves geometrically,
    so a long approach does not rush at the end. */
export function cameraBetween(a, b, s) {
  s = s * s * (3 - 2 * s);
  return {
    lookat: lerp(a.lookat, b.lookat, s),
    distance: a.distance * (b.distance / a.distance) ** s,
    azimuth: a.azimuth + (b.azimuth - a.azimuth) * s,
    elevation: a.elevation + (b.elevation - a.elevation) * s,
  };
}

// --- WebGL ------------------------------------------------------------------

const VS = `#version 300 es
in vec3 position;
uniform mat4 viewProj, model;
out vec3 world;
void main() {
  vec4 w = model * vec4(position, 1.0);
  world = w.xyz;
  gl_Position = viewProj * w;
}`;
// Flat shading (a CAD model is made of facets), lit by a light at the eye,
// like MuJoCo's headlight: ambient + diffuse + a touch of specular.
const FS = `#version 300 es
precision highp float;
in vec3 world;
uniform vec3 eye, color;
out vec4 frag;
void main() {
  vec3 n = normalize(cross(dFdx(world), dFdy(world)));
  vec3 l = normalize(eye - world);
  if (dot(n, l) < 0.0) n = -n;
  float d = max(dot(n, l), 0.0);
  float s = pow(max(dot(reflect(-l, n), l), 0.0), 24.0);
  vec3 c = color * (0.5 + 0.7 * d) + vec3(0.15 * s);
  frag = vec4(min(c, vec3(1.0)), 1.0);
}`;

let GL = null;
/** The offscreen WebGL canvas and its program, made once for every robot. */
function gl() {
  if (GL) return GL;
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("webgl2", {
    antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true,
  });
  if (!g) throw new Error("WebGL2 is not available");
  const shader = (type, src) => {
    const s = g.createShader(type);
    g.shaderSource(s, src);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
    return s;
  };
  const prog = g.createProgram();
  g.attachShader(prog, shader(g.VERTEX_SHADER, VS));
  g.attachShader(prog, shader(g.FRAGMENT_SHADER, FS));
  g.linkProgram(prog);
  const loc = {
    position: g.getAttribLocation(prog, "position"),
    viewProj: g.getUniformLocation(prog, "viewProj"),
    model: g.getUniformLocation(prog, "model"),
    eye: g.getUniformLocation(prog, "eye"),
    color: g.getUniformLocation(prog, "color"),
  };
  GL = { canvas, g, prog, loc };
  return GL;
}

/** The meshes of one robot, uploaded once. The .bin holds, mesh after mesh,
    float32 positions then uint32 triangles: the same buffer serves as vertex
    and as index data, at each mesh's own offsets. */
function buffers(entry) {
  if (entry.buffers) return entry.buffers;
  const { g } = gl();
  const vbo = g.createBuffer();
  g.bindBuffer(g.ARRAY_BUFFER, vbo);
  g.bufferData(g.ARRAY_BUFFER, entry.blob, g.STATIC_DRAW);
  const ibo = g.createBuffer();
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ibo);
  g.bufferData(g.ELEMENT_ARRAY_BUFFER, entry.blob, g.STATIC_DRAW);
  entry.buffers = { vbo, ibo };
  return entry.buffers;
}

/** Column-major 4x4 of a pose (position p, row-major rotation R). */
const pose4 = (p, R) => new Float32Array([R[0], R[3], R[6], 0, R[1], R[4], R[7], 0,
                                          R[2], R[5], R[8], 0, p[0], p[1], p[2], 1]);

/** Column-major view-projection of a MuJoCo camera, for a picture w x h. */
function viewProj(data, cam, aspect) {
  const { pos, fwd, right, up } = cameraFrame(cam);
  const f = 1 / Math.tan((data.fovy * Math.PI) / 360), n = 0.02, far = 60;
  const V = [right, up, v3.mul(fwd, -1)];
  const t = V.map((r) => -v3.dot(r, pos));
  const P = [f / aspect, f, (far + n) / (n - far), (2 * far * n) / (n - far)];
  const m = new Float32Array(16);
  for (let c = 0; c < 3; c++) {
    m[c * 4 + 0] = P[0] * V[0][c];
    m[c * 4 + 1] = P[1] * V[1][c];
    m[c * 4 + 2] = P[2] * V[2][c];
    m[c * 4 + 3] = -V[2][c];
  }
  m[12] = P[0] * t[0];
  m[13] = P[1] * t[1];
  m[14] = P[2] * t[2] + P[3];
  m[15] = -t[2];
  return m;
}

/**
 * Draw configuration q seen by `cam` into the offscreen canvas (w x h px).
 *
 * `paint(bodyIndex)` may answer a colour of its own for a body. `only`, a set
 * of body indices, writes the COLOUR of those bodies alone while every other
 * body still writes its DEPTH: the picture then holds those bodies as the
 * machine really shows them, hidden where something passes in front, and
 * nothing else. Fading a picture like that over a full one is how a lecture
 * steps the machine back without turning it to glass.
 */
function render(entry, q, cam, w, h, paint, only) {
  const { canvas, g, prog, loc } = gl();
  const { vbo, ibo } = buffers(entry);
  const data = entry.data;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  g.viewport(0, 0, w, h);
  g.clearColor(0, 0, 0, 0);
  g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
  g.enable(g.DEPTH_TEST);
  g.useProgram(prog);
  g.bindBuffer(g.ARRAY_BUFFER, vbo);
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ibo);
  g.uniformMatrix4fv(loc.viewProj, false, viewProj(data, cam, w / h));
  g.uniform3fv(loc.eye, cameraFrame(cam).pos);
  g.enableVertexAttribArray(loc.position);
  g.disable(g.BLEND);
  const { bodies } = kinematics(data, q);
  for (const geom of data.model.geoms) {
    const b = bodies[geom.body], mesh = data.model.meshes[geom.mesh];
    const R = qmat(qnorm(qmul(b.quat, geom.quat)));
    // Colour for the bodies asked for, depth for all of them.
    const show = !only || only.has(geom.body);
    g.colorMask(show, show, show, show);
    g.uniformMatrix4fv(loc.model, false, pose4(v3.add(b.p, mv(b.R, geom.pos)), R));
    g.uniform3fv(loc.color, (paint && paint(geom.body)) || geom.rgba.slice(0, 3));
    g.vertexAttribPointer(loc.position, 3, g.FLOAT, false, 0, mesh.vertices[0]);
    g.drawElements(g.TRIANGLES, mesh.faces[1] * 3, g.UNSIGNED_INT, mesh.faces[0]);
  }
  g.colorMask(true, true, true, true);
  return canvas;
}

// --- the robot on a slide ---------------------------------------------------

/**
 * The robot in a box on the slide (the aspect of the film it replaces), at
 * instant `t` of its motion, seen by camera `cam`.
 *
 * Everything a lecture draws over it goes through `point3(p)`, or through the
 * helpers below, which answer where a body, a mesh, a frame or a joint falls
 * ON THE SLIDE — the surface the film had.
 */
export class Robot3D extends Mobject {
  constructor(entry, {
    width = 10.4, at = [0, 0], t = 0, cam = null, paint = null, play = false,
    solid = null, dim = 0.18,
  } = {}) {
    super();
    this.entry = entry;
    this.data = entry.data;
    this.w = width;
    this.h = width / this.data.aspect;
    this.c = at.slice();
    this.t = t;
    this.cam = cam ? { ...cam } : { ...this.data.camera };
    this.paint = paint;
    this.pose = null;          // a configuration set by hand, instead of `t`
    // `play`: the motion runs on its own, off the wall clock, as the film it
    // replaces did. Everything else about the robot stays deterministic --
    // the camera, the pose, what is drawn over it -- and only the instant of
    // a looping movement is left to the clock, exactly as a <video> was.
    this.play = play;
    this.t0 = play ? performance.now() / 1000 - t : 0;
    // `solid`: the names of the bodies that stay in front. The machine is
    // then drawn TWICE -- once whole and faded to `dim`, once holding those
    // bodies alone, where the picture really shows them. Each pass is an
    // ordinary solid render, so no back face ever comes through: what steps
    // back is the PICTURE, not the surfaces.
    this.solid = solid;
    this.dim = dim;
  }

  /** The instant on screen. */
  get now() { return this.play ? performance.now() / 1000 - this.t0 : this.t; }

  /** Stand still where it is / start moving again: what `hold()` and `run()`
      were on the film, so a lecture that names parts on a still machine and
      then lets it go reads the same. */
  hold() { this.t = this.now; this.play = false; return this; }
  run() { this.t0 = performance.now() / 1000 - this.t; this.play = true; return this; }

  /** Show the same instant as another robot (a second copy of the same
      machine, picked out differently). */
  syncTo(other) {
    this.play = false;
    this.t = other.now;
    return this;
  }

  mapPoints(fn) { this.c = fn(this.c); }
  onScale(k) { this.w *= k; this.h *= k; }
  boundsPoints() {
    const hw = this.w / 2, hh = this.h / 2;
    return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map((p) => add(this.c, p));
  }

  /** The configuration on screen right now: the pose set by hand, or the
      motion at this instant (it loops, as the film did). */
  q() {
    if (this.pose) return this.pose;
    const rows = this.data.motion;
    if (!rows || !rows.length) return [];
    const x = this.now * this.data.rate;
    const i = ((Math.floor(x) % rows.length) + rows.length) % rows.length;
    const j = (i + 1) % rows.length;
    return lerp(rows[i], rows[j], x - Math.floor(x));
  }

  /** Where every body and joint is, for the configuration on screen. */
  state() { return kinematics(this.data, this.q()); }

  /** The index of a body by name. */
  bodyId(name) {
    return this.data.model.bodies.findIndex((b) => b.name === name);
  }

  /** A frame the model welds away, kept by the exporter under a name of its
      own (the effector a closed chain's two branches share): where it is in
      the world, or null if the robot has no such site. */
  site(name) {
    const st = (this.data.model.sites || []).find((x) => x.name === name);
    if (!st) return null;
    const b = this.state().bodies[st.body];
    if (!b) return null;
    const R = qmat(qnorm(qmul(b.quat, st.quat)));
    return { p: v3.add(b.p, mv(b.R, st.pos)), R };
  }

  /** A picture point (u, v) on the slide. */
  point(uv) {
    return [this.c[0] + (uv[0] - 0.5) * this.w, this.c[1] - (uv[1] - 0.5) * this.h];
  }
  /** A world point on the slide, through this robot's camera. */
  point3(p) { return this.point(projectUV(this.data, this.cam, p)); }

  /** Where a body's ORIGIN is — which sits on its joint, not in the middle of
      what one sees. For an arrow, `middle` is almost always the one. */
  at(name) {
    const i = typeof name === "number" ? name : this.bodyId(name);
    const b = this.state().bodies[i];
    if (b) return this.point3(b.p);
    const st = typeof name === "string" ? this.site(name) : null;
    return st ? this.point3(st.p) : this.c.slice();
  }

  /** The centre of what the body actually SHOWS, from its meshes. */
  middle(name) {
    const i = typeof name === "number" ? name : this.bodyId(name);
    const { bodies } = this.state();
    const b = bodies[i];
    if (!b) return this.at(name);          // a site has no mesh of its own
    const centres = [];
    for (const g of this.data.model.geoms) {
      if (g.body !== i) continue;
      const box = meshBox(this.entry, g.mesh);
      const R = qmat(qnorm(qmul(b.quat, g.quat)));
      centres.push(v3.add(v3.add(b.p, mv(b.R, g.pos)), mv(R, box.centre)));
    }
    if (!centres.length) return this.point3(b.p);
    const m = centres.reduce((a, p) => v3.add(a, p), [0, 0, 0]);
    return this.point3(v3.mul(m, 1 / centres.length));
  }

  /** Where a body's three axes POINT, on the slide: the tips of x, y and z as
      the picture shows them, so a frame drawn on a body turns with it. */
  axes(name, len = null) {
    const i = typeof name === "number" ? name : this.bodyId(name);
    const b = this.state().bodies[i]
      || (typeof name === "string" ? this.site(name) : null);
    if (!b) return null;
    const k = len || this.cam.distance * 0.06;
    return [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
      .map((e) => this.point3(v3.add(b.p, mv(b.R, v3.mul(e, k)))));
  }

  /** A joint: where it is and the tip of its axis, on the slide — to draw the
      axis and the arrow that turns about it. */
  joint(name, len = null) {
    const j = this.state().joints[name];
    if (!j) return null;
    const k = len || this.cam.distance * 0.06;
    return { at: this.point3(j.anchor),
             axis: this.point3(v3.add(j.anchor, v3.mul(v3.norm(j.axis), k))) };
  }

  /** The joint angles of the configuration on screen, in the model's order. */
  angles() { return this.q(); }

  drawSelf(r, alpha) {
    const w = Math.max(2, Math.round(this.w * r.S)), h = Math.max(2, Math.round(this.h * r.S));
    const q = this.q();
    const { ctx } = r;
    const [x, y] = r.toDevice([this.c[0] - this.w / 2, this.c[1] + this.h / 2]);
    const put = (picture, a) => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = a;
      ctx.drawImage(picture, x, y, this.w * r.S, this.h * r.S);
      ctx.restore();
    };
    if (!this.solid || !this.solid.length) {
      put(render(this.entry, q, this.cam, w, h, this.paint), alpha);
      return;
    }
    // The machine, faded; then the bodies that stay in front, at full
    // strength. Two solid renders, composited -- not one see-through one.
    put(render(this.entry, q, this.cam, w, h, this.paint), alpha * this.dim);
    const only = new Set(this.solid.map((b) => (typeof b === "number" ? b : this.bodyId(b))));
    put(render(this.entry, q, this.cam, w, h, this.paint, only), alpha);
  }
}

/** The box of a mesh in its own frame, measured once. */
const boxes = new Map();
function meshBox(entry, m) {
  const key = `${entry.data.model.meshes[m].vertices[0]}`;
  if (boxes.has(key)) return boxes.get(key);
  const mesh = entry.data.model.meshes[m];
  const v = new Float32Array(entry.blob, mesh.vertices[0], mesh.vertices[1] * 3);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], v[i + k]);
      hi[k] = Math.max(hi[k], v[i + k]);
    }
  }
  const box = { lo, hi, centre: [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) };
  boxes.set(key, box);
  return box;
}

export const robot3d = (entry, opts) => new Robot3D(entry, opts);
