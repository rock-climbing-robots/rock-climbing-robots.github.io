// A tick box beside every step of a practical, remembered in this browser,
// with the step's number under it ("7/15"). Ticking a step throws a few
// green sparks out of its box -- a nod, not a party (none for a reader who
// asked for less motion).

(() => {
  const key = `${location.pathname}-checked`;
  let done = {};
  try { done = JSON.parse(localStorage.getItem(key)) || {}; } catch { done = {}; }

  const sparks = (box) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = box.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * (i + Math.random() * 0.6)) / n;
      const d = 16 + Math.random() * 14;
      const el = document.createElement("span");
      el.className = "spark";
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      document.body.appendChild(el);
      el.animate([
        { transform: `rotate(${a}rad) translateX(7px) scaleX(1)`, opacity: 1 },
        { transform: `rotate(${a}rad) translateX(${0.7 * d}px) scaleX(0.8)`, opacity: 1, offset: 0.5 },
        { transform: `rotate(${a}rad) translateX(${d}px) scaleX(0.3)`, opacity: 0 },
      ], { duration: 420 + Math.random() * 180, easing: "cubic-bezier(.2,.7,.4,1)" })
        .finished.then(() => el.remove(), () => el.remove());
    }
  };

  const steps = document.querySelectorAll(".step");
  steps.forEach((step, i) => {
    step.id = `step-${i}`;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "step-checkbox";
    box.checked = !!done[i];
    step.classList.toggle("done", box.checked);
    box.addEventListener("change", () => {
      done[i] = box.checked;
      step.classList.toggle("done", box.checked);
      if (box.checked) sparks(box);
      try { localStorage.setItem(key, JSON.stringify(done)); } catch { /* private mode */ }
    });
    const num = document.createElement("span");
    num.className = "step-num";
    num.textContent = `${i + 1}/${steps.length}`;
    step.prepend(box, num);
  });
})();
