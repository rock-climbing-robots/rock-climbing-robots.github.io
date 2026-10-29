// Reading geometry out of an SVG, the same way in every browser.
//
// `getScreenCTM()` cannot be trusted on a NESTED <svg> element: Chrome folds
// the element's own viewBox transform into the result, Firefox does not, so
// MathJax's stretchy pieces (brace and arrow extenders, big delimiters) land
// in the wrong place in one of the two. The transform chain is therefore
// composed by hand from the DOM, which is unambiguous.

/** The viewport transform an <svg> element establishes for its children. */
function viewportMatrix(el) {
  const x = el.x ? el.x.baseVal.value : 0;
  const y = el.y ? el.y.baseVal.value : 0;
  const m = new DOMMatrix().translateSelf(x, y);
  const vb = el.viewBox && el.viewBox.baseVal;
  if (!vb || !vb.width || !vb.height) return m;
  const w = el.width.baseVal.value, h = el.height.baseVal.value;
  let sx = w / vb.width, sy = h / vb.height;
  // preserveAspectRatio: anything but "none" scales uniformly (SVG_PRESERVEASPECTRATIO_NONE = 1).
  const par = el.preserveAspectRatio && el.preserveAspectRatio.baseVal;
  if (!par || par.align !== 1) sx = sy = Math.min(sx, sy);
  return m.scaleSelf(sx, sy).translateSelf(-vb.x, -vb.y);
}

/** The `transform` attribute of an element, as a matrix. */
function ownTransform(el) {
  const list = el.transform && el.transform.baseVal;
  if (!list || !list.numberOfItems) return null;
  const c = list.consolidate();
  if (!c) return null;
  const m = c.matrix;
  return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]);
}

/**
 * Matrix mapping `el`'s own coordinates to the user coordinates of `root`
 * (an <svg>, whose own viewport transform is NOT included).
 */
export function matrixTo(el, root) {
  const chain = [];
  for (let n = el; n && n !== root; n = n.parentNode) chain.push(n);
  chain.reverse();
  let m = new DOMMatrix();
  for (const n of chain) {
    if (!n.tagName) continue;
    const t = ownTransform(n);
    if (t) m = m.multiply(t);
    if (n.tagName.toLowerCase() === "svg") m = m.multiply(viewportMatrix(n));
  }
  return m;
}

/** Bounding box of `el`, in `root` coordinates. */
export function boxIn(el, root, m = matrixTo(el, root)) {
  const b = el.getBBox();
  const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height],
               [b.x + b.width, b.y + b.height]]
    .map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  return {
    x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])),
    y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])),
  };
}
