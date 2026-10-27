// ─── IMAGE HELPER — WebP <picture> element generator ───
// Used by designs.htm and other JS-rendered galleries
function pictureTag(src, alt, sizes, opts) {
  opts = opts || {};
  var dot = src.lastIndexOf('.');
  var base = src.substring(0, dot);
  var loading = opts.loading || 'lazy';
  var decode = loading === 'lazy' ? ' decoding="async"' : '';
  var prio = opts.fetchpriority ? ' fetchpriority="' + opts.fetchpriority + '"' : '';
  var dims = (opts.width && opts.height) ? ' width="' + opts.width + '" height="' + opts.height + '"' : '';
  alt = String(alt == null ? '' : alt).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  var cls = opts.cls ? ' class="' + opts.cls + '"' : '';
  var onerror = opts.onerror ? ' onerror="' + opts.onerror + '"' : '';
  var srcset = [
    base + '-400w.webp 400w',
    base + '-800w.webp 800w',
    base + '.webp 2048w'
  ].join(', ');
  return '<picture>' +
    '<source type="image/webp" srcset="' + srcset + '" sizes="' + sizes + '">' +
    '<img src="' + src + '" alt="' + alt + '"' + cls +
    dims + ' loading="' + loading + '"' + decode + prio + onerror + '>' +
    '</picture>';
}

// ─── COMPONENTS — Studio Luminant ───
// Injects nav, footer, cursor elements
// Each page sets: data-lang, data-lang-url, and optionally data-base

(function() {
  const navEl = document.getElementById('site-nav');
  const footerEl = document.getElementById('site-footer');
  if (!navEl) return;

  const lang = navEl.getAttribute('data-lang') || 'en';
  const langUrl = navEl.getAttribute('data-lang-url') || '#';
  const base = navEl.getAttribute('data-base') || '';
  // Hide the language switcher on twin-less pages (no valid data-lang-url) rather than rendering a broken link.
  const hasTwin = !!langUrl && langUrl !== '#';

  // ─── THEME COLOR & COLOR SCHEME ───
  if (!document.querySelector('meta[name="theme-color"]')) {
    const tc = document.createElement('meta');
    tc.name = 'theme-color';
    tc.content = '#EFE8D5';
    document.head.appendChild(tc);
  }
  document.documentElement.style.colorScheme = 'light';

  // ─── FAVICON ───
  if (!document.querySelector('link[rel="icon"]')) {
    const favSvg = document.createElement('link');
    favSvg.rel = 'icon';
    favSvg.href = base + 'favicon.svg';
    favSvg.type = 'image/svg+xml';
    favSvg.setAttribute('sizes', 'any');
    document.head.appendChild(favSvg);
    const fav = document.createElement('link');
    fav.rel = 'icon';
    fav.href = base + 'favicon.ico';
    fav.type = 'image/x-icon';
    fav.setAttribute('sizes', '16x16 32x32 48x48');
    document.head.appendChild(fav);
    const apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    apple.href = base + 'apple-touch-icon.png';
    document.head.appendChild(apple);
  }

  // ─── ORGANIZATION JSON-LD ───
  // Single-sourced as static markup in the homepage <head> (canonical brand entity, full
  // NAP + telephone + @id) to avoid duplicate/conflicting Organization nodes. Intentionally
  // NOT injected per-page here — the brand entity only needs to exist once, on the homepage.

  // ─── LABELS (Two Doors Copy v1 §1–3; DEC-02 open: each label is one constant, so a ruling is a one-line change) ───
  const LABELS = {
    tr: {
      doorBespoke: 'Özel Üretim',
      doorStudio: 'Atölye Tasarımları',
      gallery: 'Galeri',          // DEC-02 Q1 default (not «Projeler» yet)
      architects: 'Mimarlar İçin', // DEC-02 Q5 default
      materials: 'Malzeme',
      ctaBespoke: 'Çiziminizi gönderin',
      ctaStudio: 'Duvar yerleşimi isteyin', // DEC-02 Q2 ruled 2026-10-23
      tagline: 'Döküm rölyef duvarlar · Sapanca',
      footerCtaTitle: 'Yeni proje',
      about: 'Hakkımızda'
    },
    en: {
      doorBespoke: 'Bespoke',
      doorStudio: 'Studio Designs',
      gallery: 'Gallery',
      architects: 'For Architects',
      materials: 'Materials',
      ctaBespoke: 'Send your drawing',
      ctaStudio: 'Request a wall layout', // DEC-02 Q2 ruled 2026-10-23
      tagline: 'Cast relief walls · Sapanca',
      footerCtaTitle: 'Start a project',
      about: 'About'
    }
  };
  const L = LABELS[lang === 'tr' ? 'tr' : 'en'];

  // The About page (AB-05) is not built yet: the footer link renders only once this is set.
  const ABOUT_HREF = { tr: 'hakkimizda.htm', en: 'about.htm' };

  // DEC-12: the WhatsApp Business number goes here (international format). Empty = email only:
  // the contact pages' [data-contact-phone] row stays hidden. Also add it to the schema and llms.txt.
  const CONTACT_PHONE = '';
  if (CONTACT_PHONE) {
    const waDigits = CONTACT_PHONE.replace(/\D/g, '');
    document.querySelectorAll('[data-contact-phone]').forEach(row => {
      const dd = row.querySelector('dd');
      if (dd) dd.innerHTML = `<a href="https://wa.me/${waDigits}" target="_blank" rel="noopener">${CONTACT_PHONE}</a>`;
      row.hidden = false;
    });
  }

  // ─── DOOR (one primary CTA per door; Copy v1 §3) ───
  // Studio Designs pages: the index and every design page (tasarim-dosyasi is the Specifier Kit, not a design).
  // Everything else is the Bespoke door.
  const pageFile = location.pathname.split('/').pop() || 'index.html';
  const isStudioDoor = /^(tasarimlar|designs|tasarim-(?!dosyasi)|design-)/.test(pageFile);
  const doorCta = isStudioDoor
    ? { text: L.ctaStudio, href: lang === 'tr' ? 'iletisim.htm' : 'contact.htm' }
    : { text: L.ctaBespoke, href: lang === 'tr' ? 'iletisim.htm' : 'contact.htm' };

  // ─── NAV ───
  const navLinks = lang === 'tr' ? {
    home: { href: '/', alt: 'Studio Luminant' },
    // Order is the ruling (Özel Üretim first).
    items: [
      { href: 'surec.htm', text: L.doorBespoke },
      { href: 'tasarimlar.htm', text: L.doorStudio },
      { href: 'galeri.htm', text: L.gallery },
      { href: 'mimarlar.htm', text: L.architects }
    ],
    langLabel: 'EN',
    hamburgerOpen: 'Menüyü aç',
    hamburgerClose: 'Menüyü kapat',
    mobileLabel: 'Mobil menü'
  } : {
    home: { href: '/en/', alt: 'Studio Luminant' },
    items: [
      { href: 'process.htm', text: L.doorBespoke },
      { href: 'designs.htm', text: L.doorStudio },
      { href: 'gallery.htm', text: L.gallery },
      { href: 'architects.htm', text: L.architects }
    ],
    langLabel: 'TR',
    hamburgerOpen: 'Open menu',
    hamburgerClose: 'Close menu',
    mobileLabel: 'Mobile menu'
  };

  const imgBase = base + 'images/studio-luminant-logo-ink.svg';
  const imgBaseNight = base + 'images/studio-luminant-logo-white.svg';

  const navItemsHtml = navLinks.items.map(i => `<li><a href="${i.href}">${i.text}</a></li>`).join('\n      ');
  const mobileItemsHtml = navLinks.items.map(i => `  <a href="${i.href}">${i.text}</a>`).join('\n');

  navEl.outerHTML = `
<a href="#main" class="skip-link">${lang === 'tr' ? 'İçeriğe geç' : 'Skip to content'}</a>
<div class="cursor-dot" id="cursorDot"></div>
<div class="cursor-ring" id="cursorRing"></div>

<nav id="mainNav">
  <a href="${navLinks.home.href}" class="nav-logo">
    <img src="${imgBase}" alt="${navLinks.home.alt}" class="nav-logo-img" width="31" height="25">
  </a>
  <ul class="nav-links">
      ${navItemsHtml}
  </ul>
  <div class="nav-right">
    ${hasTwin ? `<a href="${langUrl}" class="nav-lang" hreflang="${lang === 'tr' ? 'en' : 'tr'}" lang="${lang === 'tr' ? 'en' : 'tr'}">${navLinks.langLabel}</a>` : ''}
    <button class="nav-hamburger" aria-label="${navLinks.hamburgerOpen}" aria-expanded="false" aria-controls="mobileMenu">
      <span></span>
    </button>
    <a href="${doorCta.href}" class="nav-cta">${doorCta.text}</a>
  </div>
</nav>

<div class="nav-mobile-menu" id="mobileMenu" role="navigation" aria-label="${navLinks.mobileLabel}">
${mobileItemsHtml}
  ${hasTwin ? `<a href="${langUrl}" class="nav-mobile-lang" hreflang="${lang === 'tr' ? 'en' : 'tr'}" lang="${lang === 'tr' ? 'en' : 'tr'}">${navLinks.langLabel}</a>` : ''}
</div>`;

  // ─── ACTIVE NAV LINK ───
  document.querySelectorAll('.nav-links a, .nav-mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && pageFile === href) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  // ─── MOBILE MENU ───
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    const mobileLinks = mobileMenu.querySelectorAll('a');

    hamburger.addEventListener('click', () => {
      const open = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !open);
      hamburger.setAttribute('aria-label', open ? navLinks.hamburgerOpen : navLinks.hamburgerClose);
      mobileMenu.classList.toggle('open', !open);
      document.body.style.overflow = open ? '' : 'hidden';
      // Focus trap: move focus to first link when opening
      if (!open && mobileLinks.length) {
        setTimeout(() => mobileLinks[0].focus(), 50);
      }
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', navLinks.hamburgerOpen);
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
        hamburger.focus();
      });
    });

    // Trap focus within mobile menu when open
    mobileMenu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', navLinks.hamburgerOpen);
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
        hamburger.focus();
        return;
      }
      if (e.key === 'Tab' && mobileLinks.length) {
        const first = mobileLinks[0];
        const last = mobileLinks[mobileLinks.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
  }


  // ─── NAV SCROLL ───
  const mainNav = document.getElementById('mainNav');
  if (mainNav) {
    window.addEventListener('scroll', () => {
      mainNav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  // ─── CURSOR HOVER (for injected nav elements) ───
  if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(hover: none)').matches) {
    const ring = document.getElementById('cursorRing');
    if (ring) {
      document.querySelectorAll('#mainNav a, #mainNav button, .nav-mobile-menu a').forEach(el => {
        el.addEventListener('mouseenter', () => ring.classList.add('hover'));
        el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
      });
    }
  }

  // ─── FOOTER ───
  if (!footerEl) return;

  const footerContent = lang === 'tr' ? {
    homeHref: '/',
    tagline: L.tagline,
    hqTitle: 'Stüdyo &amp; Atölye',
    locationLabel: 'Konum',
    locationNote: "Sapanca'dan Türkiye'ye ve yurt dışına teslimat",
    materialsHref: 'urunler.htm',
    copyright: '© 2026 Studio Luminant. Tüm Hakları Saklıdır.',
    journalHref: 'makaleler.htm',
    journalText: 'Makaleler',
    sitemapHref: 'site-haritasi.htm',
    sitemapText: 'Site Haritası',
    igLabel: "Instagram'da Studio Luminant",
    liLabel: "LinkedIn'de Studio Luminant",
    bimHref: '',
    bimText: '',
    legalEntity: 'Studio Luminant İleri İmalat ve Yapı Çözümleri Ltd. Şti. · MERSİS: 0781115737600001 · Ortabayır Mah. Talatpaşa Cad. No: 21/501, Kağıthane / İstanbul',
    privacyHref: 'gizlilik.htm',
    privacyText: 'Aydınlatma Metni',
    cookieHref: 'cerez-politikasi.htm',
    cookieText: 'Çerez Politikası',
    cookieSettingsText: 'Çerez tercihleri'
  } : {
    homeHref: '/en/',
    tagline: L.tagline,
    hqTitle: 'Studio &amp; Workshop',
    locationLabel: 'Location',
    locationNote: 'Delivered from Sapanca, in Turkey and abroad',
    materialsHref: 'products.htm',
    copyright: '© 2026 Studio Luminant. All Rights Reserved.',
    journalHref: 'journal.htm',
    journalText: 'Journal',
    sitemapHref: 'site-map.htm',
    sitemapText: 'Site Map',
    igLabel: 'Studio Luminant on Instagram',
    liLabel: 'Studio Luminant on LinkedIn',
    bimHref: '',
    bimText: '',
    legalEntity: 'Studio Luminant İleri İmalat ve Yapı Çözümleri Ltd. Şti. · MERSİS: 0781115737600001 · Ortabayır Mah. Talatpaşa Cad. No: 21/501, Kağıthane / İstanbul, Türkiye',
    privacyHref: 'privacy.htm',
    privacyText: 'Privacy Notice',
    cookieHref: 'cookie-policy.htm',
    cookieText: 'Cookie Policy',
    cookieSettingsText: 'Cookie preferences'
  };

  footerEl.outerHTML = `
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="${footerContent.homeHref}" class="logo">
          <img src="${imgBaseNight}" alt="Studio Luminant" class="footer-logo-img" width="64" height="52">
        </a>
        <p class="footer-tagline">${footerContent.tagline}</p>
        <div class="footer-social">
          <a href="https://www.instagram.com/studio_luminant" target="_blank" rel="noopener" aria-label="${footerContent.igLabel}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" stroke-width="1.5"></rect>
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.5"></circle>
              <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"></circle>
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/studioluminant" target="_blank" rel="noopener" aria-label="${footerContent.liLabel}">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3.2 9h3.56v11.5H3.2zM9.2 9h3.41v1.57h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.32h-3.56v-5.6c0-1.34-.03-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96v5.7H9.2z"></path>
            </svg>
          </a>
        </div>
      </div>
      <div>
        <div class="footer-col-title">${footerContent.hqTitle}</div>
        <span class="footer-location-eyebrow">${footerContent.locationLabel}</span>
        <div class="footer-location-name">Rüstempaşa Mah. İstasyon Cad.<br>No: 58, PK 54600<br>Sapanca / Sakarya</div>
        <p class="footer-location-note">${footerContent.locationNote}</p>
      </div>
      <div class="footer-cta-block">
        <div class="footer-col-title">${L.footerCtaTitle}</div>
        <a href="${doorCta.href}">
          ${doorCta.text}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
        </a>
        <p>info@studioluminant.com.tr</p>
      </div>
    </div>
    <div class="footer-bottom">
      <ul class="footer-links">
        <li><a href="${footerContent.materialsHref}">${L.materials}</a></li>
        <li><a href="${footerContent.journalHref}">${footerContent.journalText}</a></li>
        ${ABOUT_HREF[lang === 'tr' ? 'tr' : 'en'] ? `<li><a href="${ABOUT_HREF[lang === 'tr' ? 'tr' : 'en']}">${L.about}</a></li>` : ''}
        <li><a href="${footerContent.sitemapHref}">${footerContent.sitemapText}</a></li>
        ${footerContent.bimText ? `<li><a href="${footerContent.bimHref}">${footerContent.bimText}</a></li>` : ''}
        <li><a href="${footerContent.privacyHref}">${footerContent.privacyText}</a></li>
        <li><a href="${footerContent.cookieHref}">${footerContent.cookieText}</a></li>
        <li data-cookie-item><button type="button" data-cookie-settings>${footerContent.cookieSettingsText}</button></li>
      </ul>
    </div>
    <p class="footer-legal-entity">${footerContent.legalEntity}</p>
    <p class="footer-copy">${footerContent.copyright}</p>
  </div>
</footer>`;

  // cookie-settings is an action: keep it only where consent.js (loaded after this file) is present
  window.addEventListener('load', () => {
    if (!window.slConsent) document.querySelectorAll('[data-cookie-item]').forEach(li => li.remove());
  });

  // ─── INIT CURSOR (after elements are injected) ───
  if (typeof initCursor === 'function') initCursor();

  // ─── RE-OBSERVE REVEAL ELEMENTS (injected content) ───
  if (typeof observer !== 'undefined') {
    document.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) observer.observe(el);
    });
  }

})();
