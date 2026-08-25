// ─── IMAGE HELPER — WebP <picture> element generator ───
// Used by collection.htm and other JS-rendered galleries
function pictureTag(src, alt, sizes, opts) {
  opts = opts || {};
  var dot = src.lastIndexOf('.');
  var base = src.substring(0, dot);
  var loading = opts.loading || 'lazy';
  var decode = loading === 'lazy' ? ' decoding="async"' : '';
  var prio = opts.fetchpriority ? ' fetchpriority="' + opts.fetchpriority + '"' : '';
  var cls = opts.cls ? ' class="' + opts.cls + '"' : '';
  var onerror = opts.onerror ? ' onerror="' + opts.onerror + '"' : '';
  var srcset = [
    base + '-400w.webp 400w',
    base + '-800w.webp 800w',
    base + '-1600w.webp 1600w',
    base + '.webp 2048w'
  ].join(', ');
  return '<picture>' +
    '<source type="image/webp" srcset="' + srcset + '" sizes="' + sizes + '">' +
    '<img src="' + src + '" alt="' + alt + '"' + cls +
    ' loading="' + loading + '"' + decode + prio + onerror + '>' +
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
    tc.content = '#0C0C0E';
    document.head.appendChild(tc);
  }
  document.documentElement.style.colorScheme = 'dark';

  // ─── FAVICON ───
  if (!document.querySelector('link[rel="icon"]')) {
    const fav = document.createElement('link');
    fav.rel = 'icon';
    fav.href = base + 'favicon.ico';
    fav.type = 'image/x-icon';
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

  // ─── NAV ───
  const navLinks = lang === 'tr' ? {
    home: { href: '/', alt: 'Studio Luminant' },
    items: [
      { href: 'koleksiyon.htm', text: 'Konsept Çalışmaları' },
      { href: 'urunler.htm', text: 'Malzeme & Teknik' },
      { href: 'surec.htm', text: 'Nasıl Çalışırız' },
      { href: 'galeri.htm', text: 'Galeri' },
      { href: 'makaleler.htm', text: 'Makaleler' },
      { href: 'mimarlar.htm', text: 'Mimarlar' }
      // { href: 'kaynaklar.htm', text: 'Kaynaklar' } // temporarily hidden
    ],
    langLabel: 'EN',
    ctaText: 'Proje Başlat',
    ctaHref: 'iletisim.htm',
    hamburgerOpen: 'Menüyü aç',
    hamburgerClose: 'Menüyü kapat',
    mobileLabel: 'Mobil menü'
  } : {
    home: { href: '/en/', alt: 'Studio Luminant' },
    items: [
      { href: 'collection.htm', text: 'Concept Work' },
      { href: 'products.htm', text: 'Materials & Specs' },
      { href: 'process.htm', text: 'How We Work' },
      { href: 'gallery.htm', text: 'Gallery' },
      { href: 'journal.htm', text: 'Journal' },
      { href: 'architects.htm', text: 'For Architects' }
      // { href: 'resources.htm', text: 'Resources' } // temporarily hidden
    ],
    langLabel: 'TR',
    ctaText: 'Initiate Project',
    ctaHref: 'contact.htm',
    hamburgerOpen: 'Open menu',
    hamburgerClose: 'Close menu',
    mobileLabel: 'Mobile menu'
  };

  const imgBase = base + 'images/studio-luminant-logo-white-transparent.png';

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
    ${hasTwin ? `<a href="${langUrl}" class="nav-lang">${navLinks.langLabel}</a>` : ''}
    <button class="nav-hamburger" aria-label="${navLinks.hamburgerOpen}" aria-expanded="false" aria-controls="mobileMenu">
      <span></span>
    </button>
    <a href="${navLinks.ctaHref}" class="nav-cta">${navLinks.ctaText}</a>
  </div>
</nav>

<div class="nav-mobile-menu" id="mobileMenu" role="navigation" aria-label="${navLinks.mobileLabel}">
${mobileItemsHtml}
  ${hasTwin ? `<a href="${langUrl}" class="nav-mobile-lang">${navLinks.langLabel}</a>` : ''}
</div>`;

  // ─── ACTIVE NAV LINK ───
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && currentPage === href) {
      a.classList.add('active');
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
    });
  }

  // ─── CURSOR HOVER (for injected nav elements) ───
  if (window.matchMedia('(pointer: fine)').matches) {
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
    tagline: 'Özel mimari elemanlar — tasarlanır, dökülür, özenle bitirilir.',
    hqTitle: 'Stüdyo &amp; Atölye',
    locationLabel: 'Konum',
    locationNote: 'Küresel Dağıtım ve Montaj Hazır',
    ctaTitle: 'Proje Başlat',
    ctaBtn: 'Proje Başlat',
    ctaHref: 'iletisim.htm',
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
    tagline: 'Bespoke architectural elements — sculpted, cast, and finished to spec.',
    hqTitle: 'Studio &amp; Workshop',
    locationLabel: 'Location',
    locationNote: 'Global Distribution &amp; Installation Ready',
    ctaTitle: 'Start a Project',
    ctaBtn: 'Initiate Project',
    ctaHref: 'contact.htm',
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
          <img src="${imgBase}" alt="Studio Luminant" class="footer-logo-img" width="64" height="52">
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
        <div class="footer-col-title">${footerContent.ctaTitle}</div>
        <a href="${footerContent.ctaHref}">
          ${footerContent.ctaBtn}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
        </a>
        <p>info@studioluminant.com.tr</p>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">${footerContent.copyright}</p>
      <ul class="footer-links">
        <li><a href="${footerContent.journalHref}">${footerContent.journalText}</a></li>
        <li><a href="${footerContent.sitemapHref}">${footerContent.sitemapText}</a></li>
        ${footerContent.bimText ? `<li><a href="${footerContent.bimHref}">${footerContent.bimText}</a></li>` : ''}
        <li><a href="${footerContent.privacyHref}">${footerContent.privacyText}</a></li>
        <li><a href="${footerContent.cookieHref}">${footerContent.cookieText}</a></li>
        <li><a href="#" data-cookie-settings>${footerContent.cookieSettingsText}</a></li>
      </ul>
    </div>
    <p class="footer-legal-entity">${footerContent.legalEntity}</p>
  </div>
</footer>`;

  // ─── INIT CURSOR (after elements are injected) ───
  if (typeof initCursor === 'function') initCursor();

  // ─── RE-OBSERVE REVEAL ELEMENTS (injected content) ───
  if (typeof observer !== 'undefined') {
    document.querySelectorAll('.reveal').forEach(el => {
      if (!el.classList.contains('visible')) observer.observe(el);
    });
  }

})();
