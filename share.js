/* Share a design (tools/build_designs.py). On a design page the Paylaş panel builds a link to the design's plain share view;
   an optional project name and preparer ride in the URL hash, so they never reach a server log. On the share view they are
   filled in as text (never HTML) and the page prints to PDF. */
(function () {
  "use strict";
  var LIMIT = 80;

  function clean(v) { return (v || "").replace(/\s+/g, " ").trim().slice(0, LIMIT); }

  function shareLink(href, form, print) {
    var url = new URL(href, location.href), h = new URLSearchParams();
    ["p", "by"].forEach(function (k) { var v = clean(form.elements[k].value); if (v) h.set(k, v); });
    if (print) h.set("print", "1");
    url.hash = h.toString();
    return url.href;
  }

  // design page: the Paylaş button and its panel
  var open = document.querySelector("[data-shr-href]"), dlg = document.getElementById("shr-dialog");
  if (open && dlg) {
    var href = open.getAttribute("data-shr-href");
    if (!dlg.showModal) {
      open.addEventListener("click", function () { location.href = href; });
    } else {
      var form = dlg.querySelector("form"), status = dlg.querySelector("[data-copied]"), send = dlg.querySelector("[data-shr-send]");
      var copy = function () {
        var url = shareLink(href, form);
        if (!navigator.clipboard) { status.textContent = url; return; }
        navigator.clipboard.writeText(url).then(
          function () { status.textContent = status.getAttribute("data-copied"); },
          function () { status.textContent = url; });  // clipboard refused: show the link to copy by hand
      };
      if (navigator.share) send.hidden = false;
      open.addEventListener("click", function () { status.textContent = ""; dlg.showModal(); });
      send.addEventListener("click", function () {
        navigator.share({ title: document.title, url: shareLink(href, form) }).catch(function (e) {
          if (e.name !== "AbortError") copy();  // the user closing the share sheet is not an error
        });
      });
      dlg.querySelector("[data-shr-copy]").addEventListener("click", copy);
      dlg.querySelector("[data-shr-pdf]").addEventListener("click", function () {
        window.open(shareLink(href, form, true), "_blank", "noopener");
      });
    }
  }

  // share view: project name and preparer from the hash, the PDF button, and the print a PDF request opened it for
  var meta = document.querySelector(".shr-meta");
  if (meta) {
    var h = new URLSearchParams(location.hash.slice(1)), shown = [];
    ["p", "by"].forEach(function (k) {
      var v = clean(h.get(k)), row = meta.querySelector('[data-shr="' + k + '"]');
      if (!v) return;
      row.querySelector("dd").textContent = v;
      row.hidden = false;
      shown.push(v);
    });
    meta.hidden = !shown.length;
    if (h.get("p")) document.title = clean(h.get("p")) + " — " + document.title;  // names the saved PDF
    document.querySelector("[data-shr-print]").addEventListener("click", function () { window.print(); });
    if (h.get("print") === "1") {
      if (document.readyState === "complete") window.print();
      else window.addEventListener("load", function () { window.print(); });
    }
  }
})();
