// Scenes and the player that runs them.
//
// A scene is an async function that plays animations and calls
// `await s.nextSlide()` to pause, exactly like a manim-slides Slide. The
// player runs it either LIVE (animations play in real time, driven by
// requestAnimationFrame) or INSTANTLY (every animation jumps to its final
// state, nothing is drawn). Instant replay from the beginning of a scene is
// what makes jumping to any slide — forwards or backwards — immediate.

import { Mobject } from "./mobject.js";
import { AnimationGroup, Animation } from "./anim.js";

export class Scene {
  constructor(player, def) {
    this.player = player;
    this.def = def;
    this.mobjects = [];
    this.blockIndex = 0;
    this.seekTo = Infinity;   // blocks before this one are played instantly
    this.blockPlays = [];     // plays of the current block (for looping slides)
    this.blockContent = [];   // does block i contain anything?
    this.blockOpts = [{}];
    this.haltAt = Infinity;   // Player.still: the construct parks after this block
    this.onHalt = null;
  }

  // --- content --------------------------------------------------------------

  /** Adding a group drops its members from the top level, so nothing is ever
      drawn (or removed) twice. The group takes the place of its first
      member, keeping the drawing order. */
  add(...mobs) {
    for (const m of mobs.flat()) {
      if (!m || this.mobjects.some((x) => x.contains(m))) continue;
      const at = this.mobjects.findIndex((x) => m.contains(x));
      this.mobjects = this.mobjects.filter((x) => !m.contains(x));
      if (at >= 0) this.mobjects.splice(at, 0, m);
      else this.mobjects.push(m);
    }
    return this;
  }

  /** Removing a group also removes members added on their own — and members
      of a group that STAYS: without this, fading out one piece of a group
      leaves it on screen, since finish() puts its opacity back. */
  remove(...mobs) {
    const flat = mobs.flat().filter(Boolean);
    if (!flat.length) return this;
    this.mobjects = this.mobjects.filter((m) => !flat.some((x) => x.contains(m)));
    const doomed = new Set(flat);
    const prune = (m) => {
      if (!m.children || !m.children.length) return;
      if (m.children.some((c) => doomed.has(c))) {
        m.children = m.children.filter((c) => !doomed.has(c));
      }
      m.children.forEach(prune);
    };
    this.mobjects.forEach(prune);
    return this;
  }

  bringToBack(m) {
    this.remove(m);
    this.mobjects.unshift(m);
    return this;
  }

  clear() { this.mobjects = []; return this; }

  update() { for (const m of this.mobjects) m.update(); }

  draw(r) {
    const sorted = [...this.mobjects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const m of sorted) m.draw(r, 1);
  }

  // --- playing --------------------------------------------------------------

  /** play(anim, anim, ..., {runTime, rateFunc}) */
  play(...args) {
    let opts = {};
    if (args.length && !(args[args.length - 1] instanceof Animation)) opts = args.pop();
    const anims = args.flat().filter(Boolean);
    for (const a of anims) {
      if (opts.runTime !== undefined) a.runTime = opts.runTime;
      if (opts.rateFunc !== undefined) a.rateFunc = opts.rateFunc;
    }
    this.markContent();
    if (this.blockIndex < this.seekTo) {
      this.runInstant(anims);
      return Promise.resolve();
    }
    this.blockPlays.push(anims);
    return this.player.runLive(this, anims);
  }

  /** Hold the current picture for `t` seconds. */
  wait(t = 1) {
    this.markContent();
    if (this.blockIndex < this.seekTo) return Promise.resolve();
    this.blockPlays.push({ wait: t });
    return this.player.runWait(this, t);
  }

  /** End the current slide. `loop` makes the NEXT slide replay for ever,
      `autoNext` moves on by itself once it is done. */
  nextSlide(opts = {}) {
    this.lastBlockPlays = this.blockPlays;
    this.blockIndex += 1;
    this.blockOpts[this.blockIndex] = opts;
    this.blockPlays = [];
    if (this.blockIndex > this.haltAt) {
      if (this.onHalt) this.onHalt();
      return NEVER;
    }
    if (this.blockIndex <= this.seekTo) return Promise.resolve();
    return this.player.pause(this);
  }

  markContent() { this.blockContent[this.blockIndex] = true; }

  runInstant(anims) {
    for (const a of anims) {
      // begin() first: an animation may build the mobject its hook adds to
      // the scene (TransformMatching's morph).
      a.begin();
      for (const sub of flatten(a)) {
        if (sub.mobject) this.add(sub.mobject);
        sub.onBegin(this);
      }
      a.update(1);
      const doomed = doomedBy(a);
      a.finish();
      if (doomed.length) this.remove(...doomed);
      for (const sub of flatten(a)) sub.onFinish(this);
    }
    this.update();
  }
}

/** An animation and, recursively, the animations of a group. */
export function flatten(a) {
  return a instanceof AnimationGroup ? a.anims.flatMap(flatten) : [a];
}

/**
 * What leaves the scene when `a` ends — collected BEFORE finish() runs.
 * finish() restores the mobject from a copy, which replaces its children
 * with fresh ones; asking afterwards which mobjects belong to it would
 * match nothing and leave the faded-out content on screen.
 */
function doomedBy(a) {
  const out = [];
  for (const sub of flatten(a)) {
    if (sub.remover && sub.mobject) for (const m of sub.mobject.walk()) out.push(m);
  }
  return out;
}

/** A mobject rebuilt from scratch on every frame (manim's always_redraw).
    Unlike manim's, it can be faded: the opacity lives on the wrapper. */
export class Redraw extends Mobject {
  constructor(fn) {
    super();
    this.fn = fn;
    this.rebuild();
    this.addUpdater((m) => m.rebuild(), { call: false });
  }

  rebuild() {
    const made = this.fn();
    this.children = made ? [made] : [];
  }

  /** A plain, frozen copy of the current picture (to fade it out). */
  freeze() { return this.fn(); }
}

export const redraw = (fn) => new Redraw(fn);

// --- the player -------------------------------------------------------------

/** Handed to a scene the player has left: its construct parks here for good. */
const NEVER = new Promise(() => {});

export class Player {
  constructor(renderer, scenes) {
    this.renderer = renderer;
    this.scenes = scenes;      // [{ name, construct }]
    this.slides = [];          // [{ scene, block, opts }]
    this.scene = null;
    this.sceneIndex = -1;
    this.block = -1;
    this.pending = null;       // the live play in progress
    this.paused = null;        // resolver of the current slide pause
    this.looping = false;
    this.index = 0;
    this.backdrop = null;      // drawn behind every slide (see background.js)
    this.onAutoNext = () => {};
    this.onSlideEnd = null;    // (index) => ..., once a slide played live is over
  }

  /** Run every scene instantly to discover how many slides it holds. */
  async indexSlides() {
    this.slides = [];
    for (let i = 0; i < this.scenes.length; i++) {
      const scene = new Scene(this, this.scenes[i]);
      scene.seekTo = Infinity;
      await this.scenes[i].construct(scene);
      const blocks = Math.max(scene.blockIndex + 1, scene.blockContent.length);
      for (let b = 0; b < blocks; b++) {
        if (scene.blockContent[b]) {
          this.slides.push({ scene: i, block: b, opts: scene.blockOpts[b] || {} });
        }
      }
    }
    return this.slides.length;
  }

  /** Show slide `index`, playing its animations. */
  async goTo(index) {
    index = Math.max(0, Math.min(index, this.slides.length - 1));
    const { scene: sceneIndex, block } = this.slides[index];
    // Going backwards must not trigger the auto-advance of the slide we land
    // on, otherwise it bounces forward and cannot be stepped past.
    this.goingBack = index < this.index;
    this.index = index;

    // Finish whatever is running so the construct can move on.
    this.stopPlay();
    const sameScene = sceneIndex === this.sceneIndex && this.scene;
    if (sameScene && block > this.block) {
      this.block = block;
      this.scene.seekTo = block;
      const resume = this.paused;
      this.paused = null;
      if (resume) resume();
      return;
    }
    // New scene, or a jump backwards: replay the scene from its start.
    this.paused = null;
    this.sceneIndex = sceneIndex;
    this.block = block;
    const scene = new Scene(this, this.scenes[sceneIndex]);
    scene.seekTo = block;
    this.scene = scene;
    this.run = this.scenes[sceneIndex].construct(scene).catch((e) => console.error(e))
      // The last slide of a scene ends with its construct, not with a pause.
      .then(() => { if (this.scene === scene && this.onSlideEnd) this.onSlideEnd(this.index); });
  }

  /**
   * The picture slide `index` ENDS on, with nothing played: every animation
   * up to the end of the slide is run instantly, and the construct parks
   * there. The text mode (engine/reader.js) draws a figure with it; `goTo`
   * afterwards replays the scene as usual.
   */
  async still(index) {
    index = Math.max(0, Math.min(index, this.slides.length - 1));
    const { scene: sceneIndex, block } = this.slides[index];
    this.stopPlay();
    this.paused = null;
    this.loopSource = null;
    this.index = index;
    this.sceneIndex = -1;      // whatever comes next replays the scene
    this.block = block;
    const scene = new Scene(this, this.scenes[sceneIndex]);
    scene.seekTo = Infinity;
    scene.haltAt = block;
    this.scene = scene;
    const halted = new Promise((resolve) => { scene.onHalt = resolve; });
    await Promise.race([halted, this.scenes[sceneIndex].construct(scene).catch((e) => console.error(e))]);
  }

  /** Called by Scene.play when the animations must be seen. */
  runLive(scene, anims) {
    if (this.left(scene)) return NEVER;
    for (const a of anims) {
      a.begin();     // before the hooks: see Scene.runInstant
      for (const sub of flatten(a)) {
        if (sub.mobject) scene.add(sub.mobject);
        sub.onBegin(scene);
      }
      a.update(0);
    }
    const runTime = Math.max(0.001, ...anims.map((a) => a.runTime));
    return new Promise((resolve) => {
      this.pending = { scene, anims, runTime, t: 0, resolve };
    });
  }

  runWait(scene, seconds) {
    if (this.left(scene)) return NEVER;
    return new Promise((resolve) => {
      this.pending = { scene, anims: [], runTime: seconds, t: 0, resolve };
    });
  }

  /** Called by Scene.nextSlide when the slide is over. */
  pause(scene) {
    if (this.left(scene)) return NEVER;
    const opts = scene.blockOpts[scene.blockIndex - 1] || {};
    this.loopQueue = null;
    this.loopSource = opts.loop ? scene.lastBlockPlays.filter((p) => p) : null;
    if (opts.autoNext && !this.goingBack) queueMicrotask(() => this.onAutoNext());
    if (this.onSlideEnd) {
      const index = this.index;
      queueMicrotask(() => { if (!this.left(scene)) this.onSlideEnd(index); });
    }
    return new Promise((resolve) => { this.paused = resolve; });
  }

  /**
   * True for a scene the player has moved on from.
   *
   * A construct is an async function and CANNOT be cancelled: leaving a scene
   * (a new one, or the same one replayed after a jump backwards) starts a new
   * construct while the old one is still parked on an `await`. Skipping an
   * animation resolves that await, so the old construct wakes up one step
   * later and calls play() or nextSlide() again -- on the player both scenes
   * share.
   *
   * It would then take `pending` or `paused` for itself, and the slide on
   * screen would wait for ever on a promise nobody resolves any more: the
   * next slide arrives with its title and stays empty. So a scene we have
   * left is answered with a promise that never settles -- its construct parks
   * on the spot and is collected with the scene.
   */
  left(scene) { return scene !== this.scene; }

  /** Finish the running animation immediately (used when the user skips). */
  stopPlay() {
    if (this.loopQueue) {   // drop the rest of a looping slide
      this.loopQueue = null;
      this.loopSource = null;
    }
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.endPlay(p, true);
  }

  endPlay(p, resolve = true) {
    for (const a of p.anims) {
      a.update(1);
      const doomed = doomedBy(a);
      a.finish();
      if (doomed.length) p.scene.remove(...doomed);
      for (const sub of flatten(a)) sub.onFinish(p.scene);
    }
    p.scene.update();
    if (resolve) p.resolve();
  }

  /** One frame: advance the running animation, then draw. */
  tick(dt) {
    const p = this.pending;
    if (p) {
      p.t += dt;
      const alpha = Math.min(1, p.t / p.runTime);
      for (const a of p.anims) a.update(alpha);
      p.scene.update();
      if (alpha >= 1) {
        this.pending = null;
        this.endPlay(p);
      }
    } else if (this.scene) {
      this.scene.update();
      if (this.loopSource && this.paused) this.stepLoop();
    }
    if (this.scene) {
      this.renderer.begin();
      if (this.backdrop) this.backdrop(this.renderer, dt);
      this.scene.draw(this.renderer);
      this.renderer.end();
    }
  }

  /** Looping slide: replay its animations, over and over, until the user
      moves on. Each pass re-begins the animations, so a rotation of TAU or
      an increment of TAU picks up seamlessly where the last pass left off. */
  stepLoop() {
    if (!this.loopQueue || !this.loopQueue.length) this.loopQueue = [...this.loopSource];
    const next = this.loopQueue.shift();
    if (!next) { this.loopSource = null; return; }
    if (next.wait) {
      this.pending = { scene: this.scene, anims: [], runTime: next.wait, t: 0, resolve: () => {} };
      return;
    }
    for (const a of next) { a.begin(); a.update(0); }
    this.pending = {
      scene: this.scene, anims: next, t: 0, resolve: () => {},
      runTime: Math.max(0.001, ...next.map((a) => a.runTime)),
    };
  }
}
