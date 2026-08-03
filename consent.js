/* ─────────────────────────────────────────────────────────────
   consent.js — KVKK cookie consent banner + tracker gate

   Contract with the rest of the site:
   - GA4 and the Meta Pixel must NOT be inlined in any page <head>.
     This file injects them, and only after the matching consent.
   - Anything with [data-cookie-settings] re-opens the panel.

   Categories: necessary (always on) · analytics · marketing
   Nothing is pre-ticked. Reject is as prominent as accept.
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
    title: 'Cookies on this site',
    body: 'We use strictly necessary cookies to make the site work. With your consent we also measure how the site is used and how our promotion performs. You can change your mind at any time.',
    necessary: 'Strictly necessary',
    necessaryNote: 'Always active — required for the site to function.',
    analytics: 'Analytics',
    analyticsNote: 'Visitor numbers, pages viewed, time on site (Google Analytics).',
    marketing: 'Marketing',
    marketingNote: 'Measuring the effect of our promotion (Meta).',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    save: 'Save my choice',
    policy: 'Cookie Policy',
    policyHref: '/en/cookie-policy.htm',
    aria: 'Cookie consent'
  } : {
    title: 'Bu sitede çerezler',
    body: 'Sitenin çalışması için zorunlu çerezleri kullanıyoruz. Onay vermeniz halinde ayrıca sitenin nasıl kullanıldığını ve tanıtım faaliyetlerimizin etkisini ölçüyoruz. Tercihinizi dilediğiniz zaman değiştirebilirsiniz.',
    necessary: 'Zorunlu',
    necessaryNote: 'Her zaman aktif — sitenin çalışması için gereklidir.',
    analytics: 'Analitik',
    analyticsNote: 'Ziyaretçi sayısı, görüntülenen sayfalar, sitede geçirilen süre (Google Analytics).',
    marketing: 'Pazarlama',
    marketingNote: 'Tanıtım faaliyetlerimizin etkisinin ölçülmesi (Meta).',
    acceptAll: 'Tümünü kabul et',
    rejectAll: 'Tümünü reddet',
    save: 'Tercihimi kaydet',
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
    'border-top:1px solid rgba(201,168,76,0.25);padding:26px 32px;',
    "font-family:'Jost',system-ui,sans-serif;color:#B9B4AC;",
    'box-shadow:0 -20px 60px rgba(0,0,0,0.5)}',
    '#sl-consent .sl-c-inner{max-width:1080px;margin:0 auto;display:grid;',
    'grid-template-columns:1fr auto;gap:32px;align-items:start}',
    "#sl-consent h2{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;",
    'color:#EDE9E3;margin:0 0 10px}',
    '#sl-consent p{font-size:13px;line-height:1.7;font-weight:300;margin:0 0 4px}',
    '#sl-consent a{color:#C9A84C;text-decoration:none;border-bottom:1px solid rgba(201,168,76,0.3)}',
    '#sl-consent .sl-c-cats{margin:18px 0 0;display:grid;gap:10px}',
    '#sl-consent .sl-c-cat{display:flex;gap:12px;align-items:flex-start;font-size:12.5px;line-height:1.6}',
    '#sl-consent .sl-c-cat input{margin-top:3px;accent-color:#C9A84C;width:15px;height:15px}',
    '#sl-consent .sl-c-cat b{color:#EDE9E3;font-weight:500;display:block}',
    '#sl-consent .sl-c-cat span{opacity:0.75}',
    '#sl-consent .sl-c-actions{display:flex;flex-direction:column;gap:10px;min-width:210px}',
    '#sl-consent button{font-family:inherit;font-size:10px;letter-spacing:0.22em;',
    'text-transform:uppercase;padding:14px 22px;cursor:pointer;transition:all .3s;',
    'border:1px solid rgba(201,168,76,0.4);background:transparent;color:#B9B4AC}',
    '#sl-consent button:hover{border-color:#C9A84C;color:#C9A84C}',
    '#sl-consent button.sl-c-primary{background:#C9A84C;border-color:#C9A84C;color:#12100E;font-weight:500}',
    '#sl-consent button.sl-c-primary:hover{background:#D9BC66;color:#12100E}',
    '@media(max-width:820px){#sl-consent{padding:22px 20px}',
    '#sl-consent .sl-c-inner{grid-template-columns:1fr;gap:20px}',
    '#sl-consent .sl-c-actions{min-width:0}}'
  ].join('');

  var el = null;

  function close() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }

  function open(current) {
    if (el) return;
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
        '<div>' +
          '<h2>' + t.title + '</h2>' +
          '<p>' + t.body + ' <a href="' + t.policyHref + '">' + t.policy + '</a></p>' +
          '<div class="sl-c-cats">' +
            '<label class="sl-c-cat"><input type="checkbox" checked disabled>' +
              '<span><b>' + t.necessary + '</b><span>' + t.necessaryNote + '</span></span></label>' +
            '<label class="sl-c-cat"><input type="checkbox" id="sl-c-analytics"' + a + '>' +
              '<span><b>' + t.analytics + '</b><span>' + t.analyticsNote + '</span></span></label>' +
            '<label class="sl-c-cat"><input type="checkbox" id="sl-c-marketing"' + m + '>' +
              '<span><b>' + t.marketing + '</b><span>' + t.marketingNote + '</span></span></label>' +
          '</div>' +
        '</div>' +
        '<div class="sl-c-actions">' +
          '<button type="button" class="sl-c-primary" id="sl-c-accept">' + t.acceptAll + '</button>' +
          '<button type="button" id="sl-c-reject">' + t.rejectAll + '</button>' +
          '<button type="button" id="sl-c-save">' + t.save + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    function commit(prefs) { write(prefs); apply(prefs); close(); }

    el.querySelector('#sl-c-accept').addEventListener('click', function () {
      commit({ analytics: true, marketing: true });
    });
    el.querySelector('#sl-c-reject').addEventListener('click', function () {
      commit({ analytics: false, marketing: false });
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
      open(read());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Let page code check consent before firing conversion events.
  window.slConsent = { get: read, open: function () { open(read()); } };
})();
