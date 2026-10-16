// ─── CONTACT FORMS — iletisim.htm / en/contact.htm ───
// Wires every <form data-form-type> on the page (the project form and the sample-box form).
// Each submit posts to Formspree (the form's own action; email backup, never awaited) and to the
// CRM through window.slLeadPost (defined inline on the page, next to the lead-intake endpoint).
// A captured lead fires GA4 `generate_lead` with `form_type` (project | sample) and `source` —
// see docs/ga4-events.md. Each state's copy lives on the form as data-msg-* attributes, so TR and
// EN share this file.
(function () {
  function trackLead(formType, source) {
    if (typeof gtag === 'function') gtag('event', 'generate_lead', { form_type: formType, source: source || '' });
    if (typeof fbq === 'function') fbq('track', 'Lead');
  }

  // lead-intake has no drawing_link column: carry the link inside the message so the CRM task shows it.
  function leadPayload(form) {
    var data = Object.fromEntries(new FormData(form).entries());
    if (data.drawing_link) {
      data.message = (data.message ? data.message + '\n\n' : '') + form.dataset.linkLabel + ': ' + data.drawing_link;
    }
    return data;
  }

  // The status node is an always-present live region: it is emptied at load and only its text changes.
  // (A `hidden` attribute from the markup is dropped so the region exists in the a11y tree from the start;
  // contact.css collapses it while empty.)
  function showStatus(el, text, isError) {
    el.classList.toggle('is-error', isError);
    el.textContent = '';
    // set the text on the next frame so assistive tech sees a change, not an insertion
    requestAnimationFrame(function () {
      el.textContent = text;
      el.focus({ preventScroll: true });
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  function wire(form) {
    var btn = form.querySelector('button[type="submit"]');
    var status = form.querySelector('.ct-status');
    // the button holds label text + an arrow svg: only the text node is ever rewritten
    var labelNode = Array.prototype.find.call(btn.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); });
    var idleLabel = labelNode ? labelNode.nodeValue : '';
    function setLabel(t) { if (labelNode) labelNode.nodeValue = t; }
    var msg = form.dataset;
    var busy = false;

    status.hidden = false;
    status.textContent = '';
    status.setAttribute('tabindex', '-1');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (busy) return;           // double-submit guard; the button keeps focus (aria-disabled, not disabled)
      busy = true;
      btn.setAttribute('aria-disabled', 'true');
      setLabel(msg.msgSending);
      status.textContent = '';
      var data = leadPayload(form);
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } }).catch(function () {});
      try {
        if (typeof window.slLeadPost !== 'function') throw new Error('slLeadPost missing');
        var res = await window.slLeadPost(data);
        if (!res.ok) throw new Error('lead-intake ' + res.status);
        trackLead(msg.formType, data.source);
        showStatus(status, msg.msgOk, false);
        form.reset();
        setLabel(msg.msgSent);
      } catch (err) {
        showStatus(status, msg.msgError, true);
        setLabel(idleLabel);
      } finally {
        busy = false;
        btn.removeAttribute('aria-disabled');   // re-enabled after success as well as failure
      }
    });
  }

  document.querySelectorAll('form[data-form-type]').forEach(wire);
})();
