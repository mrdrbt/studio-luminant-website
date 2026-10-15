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

  function showStatus(el, text, isError) {
    el.textContent = text;
    el.classList.toggle('is-error', isError);
    el.hidden = false;
  }

  function wire(form) {
    var btn = form.querySelector('button[type="submit"]');
    var status = form.querySelector('.ct-status');
    var idleLabel = btn.innerHTML;
    var msg = form.dataset;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = msg.msgSending;
      status.hidden = true;
      var data = leadPayload(form);
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } }).catch(function () {});
      try {
        if (typeof window.slLeadPost !== 'function') throw new Error('slLeadPost missing');
        var res = await window.slLeadPost(data);
        if (!res.ok) throw new Error('lead-intake ' + res.status);
        trackLead(msg.formType, data.source);
        showStatus(status, msg.msgOk, false);
        form.reset();
        btn.textContent = msg.msgSent;
      } catch (err) {
        showStatus(status, msg.msgError, true);
        btn.disabled = false;
        btn.innerHTML = idleLabel;
      }
    });
  }

  document.querySelectorAll('form[data-form-type]').forEach(wire);
})();
