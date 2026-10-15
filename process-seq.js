/* ─── PROCESS SEQUENCE — crossfades the sticky stage's layers as the steps scroll past (process.css) ───
 * Layer i (i ≥ 1) fades in while step i's top crosses an anchor line: 55% down the viewport on wide screens,
 * halfway between the pinned stage and the bottom on phones. Opacity only, so no layout shift. Under
 * prefers-reduced-motion the layers swap at the midpoint without a fade.
 */
(function () {
  'use strict';
  var sec = document.querySelector('[data-pseq]');
  if (!sec) return;
  var stage = sec.querySelector('.pseq__stage');
  var layers = sec.querySelectorAll('.pseq__layer');
  var caps = sec.querySelectorAll('.pseq__cap');
  var steps = sec.querySelectorAll('.pseq__step');
  var relief = sec.querySelector('[data-relief-light]');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NARROW = window.matchMedia('(orientation: portrait), (max-width: 820px)');
  var BAND = 0.12;  // crossfade half-width, fraction of the viewport height
  var queued = false;

  function ease(e0, e1, x) {
    var t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return REDUCED ? (t >= 0.5 ? 1 : 0) : t * t * (3 - 2 * t);
  }

  function update() {
    queued = false;
    var vh = window.innerHeight, band = vh * BAND;
    var anchor = NARROW.matches ? (stage.getBoundingClientRect().bottom + vh) / 2 : vh * 0.55;
    var f = [1], active = -1;
    for (var i = 1; i < steps.length; i++) f[i] = ease(-band, band, anchor - steps[i].getBoundingClientRect().top);
    for (i = 0; i < steps.length; i++) {
      if (steps[i].getBoundingClientRect().top < anchor) active = i;
      if (layers[i]) layers[i].style.opacity = f[i];
      if (caps[i]) caps[i].style.opacity = f[i] * (1 - (f[i + 1] || 0));
    }
    for (i = 0; i < steps.length; i++) steps[i].classList.toggle('is-active', i === active);
    // the live relief sleeps while its layer is transparent
    if (relief && relief.reliefLight && relief.reliefLight.hold) relief.reliefLight.hold(!(f[layers.length - 1] > 0.01));
  }

  function request() {
    if (!queued) { queued = true; window.requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  if (relief) relief.addEventListener('relieflight:ready', request);
  update();
})();
