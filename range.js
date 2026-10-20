// 20/40 range page: the design cards open one design large (SLModal lightbox) with its other views
// (in situ, surface, drawing) as thumbnails, and a link into the composer.
// Data: <script type="application/json" id="rg-designs-data"> on the page (labels + one entry per design).
(function () {
  'use strict';
  var dataEl = document.getElementById('rg-designs-data');
  if (!dataEl || typeof SLModal === 'undefined') return;
  var data = JSON.parse(dataEl.textContent);
  var designs = data.designs;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function html(i, m) {
    var d = designs[i], L = data.labels, v = d.media[m];
    var specs = d.specs.map(function (s) {
      return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>';
    }).join('');
    var thumbs = d.media.map(function (t, k) {
      return '<button type="button" class="rg-lb__thumb" data-media="' + k + '"' + (k === m ? ' aria-current="true"' : '') +
        ' aria-label="' + esc(t.label) + '"><img src="' + esc(t.thumb) + '" alt=""><span>' + esc(t.label) + '</span></button>';
    }).join('');
    return '<div class="rg-lb">' +
      '<div class="rg-lb__image">' +
        '<div class="rg-lb__main"><img src="' + esc(v.src) + '" srcset="' + esc(v.srcset) + '" sizes="(orientation: portrait) 100vw, 66vw" alt="' + esc(v.alt) + '"></div>' +
        '<div class="rg-lb__thumbs">' + thumbs + '</div>' +
      '</div>' +
      '<div class="rg-lb__details">' +
        '<p class="rg-lb__num">' + esc(d.num) + '</p>' +
        '<h2 class="rg-lb__name">' + esc(d.name || data.line + ' ' + d.num) + '</h2>' +
        '<p class="rg-lb__text">' + esc(d.text) + '</p>' +
        '<dl class="rg-lb__spec">' + specs + '</dl>' +
        '<p class="rg-lb__note">' + esc(L.render) + '</p>' +
        '<a class="btn-primary" href="' + esc(d.composer) + '">' + esc(L.compose) + '</a>' +
        '<a class="sys-link" href="' + esc(L.sampleHref) + '">' + esc(L.sample) + '</a>' +
        '<div class="rg-lb__nav">' +
          '<button type="button" class="rg-lb__prev" aria-label="' + esc(L.prev) + '">←</button>' +
          '<span>' + (i + 1) + ' / ' + designs.length + '</span>' +
          '<button type="button" class="rg-lb__next" aria-label="' + esc(L.next) + '">→</button>' +
        '</div>' +
      '</div></div>';
  }

  function open(i, m) {
    m = m || 0;
    SLModal.open({ mode: 'lightbox', html: html(i, m), title: designs[i].name || data.line + ' ' + designs[i].num });
    var body = document.querySelector('.sl-modal-body');
    body.querySelector('.rg-lb__prev').addEventListener('click', function () { open((i + designs.length - 1) % designs.length); });
    body.querySelector('.rg-lb__next').addEventListener('click', function () { open((i + 1) % designs.length); });
    body.querySelectorAll('.rg-lb__thumb').forEach(function (t) {
      t.addEventListener('click', function () { var k = t.dataset.media; open(i, Number(k)); refocus(k); });
    });
  }

  function refocus(k) {
    var t = document.querySelector('.sl-modal-body [data-media="' + k + '"]');
    if (t) t.focus();
  }

  document.querySelectorAll('.rg-card').forEach(function (btn) {
    btn.addEventListener('click', function () { open(Number(btn.dataset.index)); });
  });
  document.addEventListener('keydown', function (e) {
    var dlg = document.querySelector('.sl-modal[open] .rg-lb');
    if (!dlg) return;
    if (e.key === 'ArrowLeft') dlg.querySelector('.rg-lb__prev').click();
    if (e.key === 'ArrowRight') dlg.querySelector('.rg-lb__next').click();
  });
})();
