/* ─────────────────────────────────────────────────────────────
   consent.js — KVKK cookie consent banner + tracker gate

   Contract with the rest of the site:
   - GA4 and the Meta Pixel must NOT be inlined in any page <head>.
     This file injects them, and only after the matching consent.
   - Anything with [data-cookie-settings] re-opens the panel.

   Categories: necessary (always on) · analytics · marketing
   Nothing is pre-ticked. The first layer shows Settings and Accept only
   (Burak 2026-10-27); refusing is Settings, then Save with nothing ticked.
   No cookie wall — dismissing without choosing loads nothing.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var COOKIE = 'sl_cookie_consent';
  var VERSION = 1;
  var MAX_AGE_DAYS = 180;
  var GA4_ID = 'G-PZ0SGLKLH0';
  var META_PIXEL_ID = '1437127258139677';

  var isEN = document.documentElement.lang === 'en';

  var t = isEN ? {
    body: 'With your consent, we use cookies to measure how the site is used and how our promotion performs.',
    necessary: 'Strictly necessary',
    necessaryNote: 'Always active — required for the site to function.',
    analytics: 'Analytics',
    analyticsNote: 'Visitor numbers, pages viewed, time on site (Google Analytics).',
    marketing: 'Marketing',
    marketingNote: 'Measuring the effect of our promotion (Meta).',
    acceptAll: 'Accept',
    settings: 'Settings',
    save: 'Save',
    policy: 'Cookie Policy',
    policyHref: '/en/cookie-policy.htm',
    aria: 'Cookie consent'
  } : {
    body: 'Onayınızla, sitenin nasıl kullanıldığını ve tanıtımlarımızın etkisini ölçen çerezler kullanıyoruz.',
    necessary: 'Zorunlu',
    necessaryNote: 'Her zaman aktif — sitenin çalışması için gereklidir.',
    analytics: 'Analitik',
    analyticsNote: 'Ziyaretçi sayısı, görüntülenen sayfalar, sitede geçirilen süre (Google Analytics).',
    marketing: 'Pazarlama',
    marketingNote: 'Tanıtım faaliyetlerimizin etkisinin ölçülmesi (Meta).',
    acceptAll: 'Kabul et',
    settings: 'Ayarlar',
    save: 'Kaydet',
    policy: 'Çerez Politikası',
    policyHref: '/cerez-politikasi.htm',
    aria: 'Çerez onayı'
  };

  // ─── STORAGE ───────────────────────────────────────────────
  function read() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    try {
      var v = JSON.parse(decodeURIComponent(m[1]));
      return v && v.v === VERSION ? v : null;
    } catch (e) {
      return null;
    }
  }

  function write(prefs) {
    var value = encodeURIComponent(JSON.stringify({
      v: VERSION,
      analytics: !!prefs.analytics,
      marketing: !!prefs.marketing
    }));
    var expires = new Date(Date.now() + MAX_AGE_DAYS * 864e5).toUTCString();
    document.cookie = COOKIE + '=' + value + '; path=/; expires=' + expires +
      '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }

  // Best-effort removal of provider cookies when consent is withdrawn.
  // Third-party cookies set on another host cannot be deleted from here;
  // withholding the script on the next load is what actually stops them.
  function clearCookies(names) {
    var host = location.hostname;
    var domains = ['', host, '.' + host];
    var bare = host.split('.').slice(-2).join('.');
    if (bare !== host) domains.push('.' + bare);
    document.cookie.split('; ').forEach(function (pair) {
      var name = pair.split('=')[0];
      var hit = names.some(function (n) {
        return n.slice(-1) === '*' ? name.indexOf(n.slice(0, -1)) === 0 : name === n;
      });
      if (!hit) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' +
          (d ? '; domain=' + d : '');
      });
    });
  }

  // ─── TRACKERS ──────────────────────────────────────────────
  var loaded = { analytics: false, marketing: false };

  // Internal-traffic opt-out, carried over from the previous inline blocks:
  // local development and anyone who has set sl_internal are never measured.
  function isInternal() {
    try {
      var h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '') return true;
      // ?internal=1 once per browser stops measurement; ?internal=0 re-enables it.
      var flag = new URLSearchParams(location.search).get('internal');
      if (flag === '1') localStorage.setItem('sl_internal', '1');
      else if (flag === '0') localStorage.removeItem('sl_internal');
      if (localStorage.getItem('sl_internal') === '1') return true;
    } catch (e) { /* storage blocked — treat as external */ }
    return false;
  }

  function loadAnalytics() {
    if (loaded.analytics || isInternal()) return;
    loaded.analytics = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
  }

  function loadMarketing() {
    if (loaded.marketing || isInternal()) return;
    loaded.marketing = true;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function apply(prefs) {
    if (prefs.analytics) loadAnalytics(); else clearCookies(['_ga', '_ga_*', '_gid', '_gat*']);
    if (prefs.marketing) loadMarketing(); else clearCookies(['_fbp', 'fr']);
  }

  // ─── UI ────────────────────────────────────────────────────
  var STYLE = [
    '#sl-consent{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#12100E;',
    'border-top:1px solid rgba(212,146,111,0.25);padding:14px 32px;',
    "font-family:'Jost',system-ui,sans-serif;color:#B9B4AC;",
    'box-shadow:0 -12px 40px rgba(0,0,0,0.4)}',
    '#sl-consent .sl-c-inner{max-width:1080px;margin:0 auto}',
    '#sl-consent .sl-c-bar{display:flex;align-items:center;gap:24px}',
    '#sl-consent p{flex:1;font-size:13px;line-height:1.6;font-weight:300;margin:0}',
    '#sl-consent a{color:#D4926F;text-decoration:none;border-bottom:1px solid rgba(212,146,111,0.3)}',
    '#sl-consent .sl-c-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#sl-consent button{font-family:inherit;font-size:10px;letter-spacing:0.22em;',
    'text-transform:uppercase;padding:11px 0;width:132px;cursor:pointer;transition:border-color .3s,color .3s,background-color .3s;',
    'border:1px solid rgba(212,146,111,0.4);background:transparent;color:#B9B4AC}',
    '#sl-consent button:hover{border-color:#D4926F;color:#D4926F}',
    '#sl-consent button.sl-c-primary{background:#D4926F;border-color:#D4926F;color:#12100E;font-weight:500}',
    '#sl-consent button.sl-c-primary:hover{background:#E3AA8A;color:#12100E}',
    '#sl-consent button.sl-c-link{width:auto;border:0;padding:11px 6px;color:#B9B4AC;',
    'text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(212,146,111,0.4)}',
    '#sl-consent button.sl-c-link:hover{color:#D4926F}',
    '#sl-consent .sl-c-panel{display:flex;align-items:flex-end;gap:24px;margin-top:14px;padding-top:14px;',
    'border-top:1px solid rgba(212,146,111,0.15)}',
    '#sl-consent .sl-c-panel[hidden]{display:none}',
    '#sl-consent .sl-c-cats{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}',
    '#sl-consent .sl-c-cat{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.55}',
    '#sl-consent .sl-c-cat input{margin-top:2px;accent-color:#D4926F;width:15px;height:15px;flex-shrink:0}',
    '#sl-consent .sl-c-cat b{color:#EDE9E3;font-weight:500;display:block}',
    '#sl-consent .sl-c-cat span{opacity:0.75}',
    '#sl-consent :focus-visible{outline:2px solid #EDE9E3;outline-offset:3px}',
    '@media(max-width:820px){#sl-consent{padding:8px 16px;max-height:80vh;overflow-y:auto}',
    '#sl-consent .sl-c-bar{flex-direction:column;align-items:stretch;gap:8px}',
    '#sl-consent p{font-size:11px;line-height:1.4;font-weight:400;color:#C9C4BC}',
    '#sl-consent .sl-c-actions{display:grid;grid-template-columns:auto 1fr 1fr;gap:8px}',
    '#sl-consent button{width:auto;padding:0 8px;min-height:38px;font-size:10px;letter-spacing:0.16em;font-weight:400}',
    '#sl-consent button.sl-c-primary{font-weight:400}',
    '#sl-consent button.sl-c-link{padding:0 4px}',
    '#sl-consent .sl-c-panel{flex-direction:column;align-items:stretch;gap:12px;margin-top:10px;padding-top:10px}',
    '#sl-consent .sl-c-cats{grid-template-columns:1fr;gap:8px}}'
  ].join('');

  var el = null;
  var returnFocus = null;

  function close() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  function open(current, expanded) {
    if (el) return;
    returnFocus = document.activeElement !== document.body ? document.activeElement : null;
    if (!document.getElementById('sl-consent-style')) {
      var st = document.createElement('style');
      st.id = 'sl-consent-style';
      st.textContent = STYLE;
      document.head.appendChild(st);
    }
    var a = current && current.analytics ? ' checked' : '';
    var m = current && current.marketing ? ' checked' : '';

    el = document.createElement('div');
    el.id = 'sl-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', t.aria);
    el.innerHTML =
      '<div class="sl-c-inner">' +
        '<div class="sl-c-bar">' +
          '<p>' + t.body + ' <a href="' + t.policyHref + '">' + t.policy + '</a></p>' +
          '<div class="sl-c-actions">' +
            '<button type="button" class="sl-c-link" id="sl-c-settings" aria-controls="sl-c-panel"' +
              ' aria-expanded="' + !!expanded + '">' + t.settings + '</button>' +
            '<button type="button" class="sl-c-primary" id="sl-c-accept">' + t.acceptAll + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="sl-c-panel" id="sl-c-panel"' + (expanded ? '' : ' hidden') + '>' +
          '<div class="sl-c-cats">' +
            '<label class="sl-c-cat"><input type="checkbox" checked disabled>' +
              '<span><b>' + t.necessary + '</b><span>' + t.necessaryNote + '</span></span></label>' +
            '<label class="sl-c-cat"><input type="checkbox" id="sl-c-analytics"' + a + '>' +
              '<span><b>' + t.analytics + '</b><span>' + t.analyticsNote + '</span></span></label>' +
            '<label class="sl-c-cat"><input type="checkbox" id="sl-c-marketing"' + m + '>' +
              '<span><b>' + t.marketing + '</b><span>' + t.marketingNote + '</span></span></label>' +
          '</div>' +
          '<button type="button" id="sl-c-save">' + t.save + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    // Re-opened from a footer link: move focus in. First visit: leave focus on the page.
    if (returnFocus) el.querySelector(expanded ? '#sl-c-analytics' : '#sl-c-accept').focus();

    function commit(prefs) { write(prefs); apply(prefs); close(); }

    var toggle = el.querySelector('#sl-c-settings');
    var panel = el.querySelector('#sl-c-panel');
    toggle.addEventListener('click', function () {
      var show = panel.hidden;
      panel.hidden = !show;
      toggle.setAttribute('aria-expanded', String(show));
    });
    el.querySelector('#sl-c-accept').addEventListener('click', function () {
      commit({ analytics: true, marketing: true });
    });
    el.querySelector('#sl-c-save').addEventListener('click', function () {
      commit({
        analytics: el.querySelector('#sl-c-analytics').checked,
        marketing: el.querySelector('#sl-c-marketing').checked
      });
    });
  }

  // ─── BOOT ──────────────────────────────────────────────────
  function boot() {
    var saved = read();
    if (saved) apply(saved); else open(null);

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (!trigger) return;
      e.preventDefault();
      open(read(), true);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Let page code check consent before firing conversion events.
  window.slConsent = { get: read, open: function () { open(read(), true); } };
})();
