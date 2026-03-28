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

  // ─── NAV ───
  const navLinks = lang === 'tr' ? {
    home: { href: 'Studio Luminant — Özel Mimari Elemanlar.htm', alt: 'Studio Luminant' },
    items: [
      { href: 'koleksiyon.htm', text: 'Koleksiyon' },
      { href: 'urunler.htm', text: 'Malzeme & Teknik' },
      { href: 'surec.htm', text: 'Nasıl Çalışırız' },
      { href: 'galeri.htm', text: 'Galeri' },
      { href: 'kaynaklar.htm', text: 'Kaynaklar' }
    ],
    langLabel: 'EN',
    ctaText: 'Proje Başlat',
    ctaHref: 'iletisim.htm',
    hamburgerOpen: 'Menüyü aç',
    hamburgerClose: 'Menüyü kapat',
    mobileLabel: 'Mobil menü'
  } : {
    home: { href: 'Studio Luminant — Bespoke Architectural Elements.htm', alt: 'Studio Luminant' },
    items: [
      { href: 'collection.htm', text: 'Collection' },
      { href: 'products.htm', text: 'Materials & Specs' },
      { href: 'process.htm', text: 'How We Work' },
      { href: 'gallery.htm', text: 'Gallery' },
      { href: 'resources.htm', text: 'Resources' }
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

  const betaDismissed = sessionStorage.getItem('beta-dismissed');
  const betaBannerHtml = betaDismissed ? '' : `
<div class="beta-banner" id="betaBanner">
  <span>${lang === 'tr' ? 'Beta — Bu site geliştirme aşamasındadır' : 'Beta — This site is under active development'}</span>
  <button class="beta-close" aria-label="${lang === 'tr' ? 'Kapat' : 'Close'}">&times;</button>
</div>`;

  navEl.outerHTML = `
${betaBannerHtml}
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
    <a href="${langUrl}" class="nav-lang">${navLinks.langLabel}</a>
    <button class="nav-hamburger" aria-label="${navLinks.hamburgerOpen}" aria-expanded="false" aria-controls="mobileMenu">
      <span></span>
    </button>
    <a href="${navLinks.ctaHref}" class="nav-cta">${navLinks.ctaText}</a>
  </div>
</nav>

<div class="nav-mobile-menu" id="mobileMenu" role="navigation" aria-label="${navLinks.mobileLabel}">
${mobileItemsHtml}
  <a href="${langUrl}" class="nav-mobile-lang">${navLinks.langLabel}</a>
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

  // ─── BETA BANNER DISMISS ───
  const betaBanner = document.getElementById('betaBanner');
  if (betaBanner) {
    betaBanner.querySelector('.beta-close').addEventListener('click', () => {
      betaBanner.style.display = 'none';
      sessionStorage.setItem('beta-dismissed', '1');
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
    homeHref: 'Studio Luminant — Özel Mimari Elemanlar.htm',
    tagline: 'Özel mimari elemanlar — tasarlanır, dökülür, özenle bitirilir.',
    hqTitle: 'Genel Merkez',
    locationLabel: 'Konum',
    locationNote: 'Küresel Dağıtım ve Montaj Hazır',
    productionTitle: 'Üretim Atölyesi',
    productionLocation: 'Sakarya / Türkiye',
    ctaTitle: 'Proje Başlat',
    ctaBtn: 'Proje Başlat',
    ctaHref: 'iletisim.htm',
    copyright: '© 2026 Studio Luminant. Tüm Hakları Saklıdır.',
    bimHref: 'kaynaklar.htm',
    bimText: 'BIM Dosyaları'
  } : {
    homeHref: 'Studio Luminant — Bespoke Architectural Elements.htm',
    tagline: 'Bespoke architectural elements — sculpted, cast, and finished to spec.',
    hqTitle: 'Headquarter',
    locationLabel: 'Location',
    locationNote: 'Global Distribution &amp; Installation Ready',
    productionTitle: 'Production Studio',
    productionLocation: 'Sakarya / Turkey',
    ctaTitle: 'Start a Project',
    ctaBtn: 'Initiate Project',
    ctaHref: 'contact.htm',
    copyright: '© 2026 Studio Luminant. All Rights Reserved.',
    bimHref: 'resources.htm',
    bimText: 'BIM Assets'
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
      </div>
      <div>
        <div class="footer-col-title">${footerContent.hqTitle}</div>
        <span class="footer-location-eyebrow">${footerContent.locationLabel}</span>
        <div class="footer-location-name">Levent Plaza, Ortabayır Mah.<br>Talatpaşa Cad. No: 21, İç Kapı No: 501<br>Kağıthane / İstanbul</div>
        <p class="footer-location-note">${footerContent.locationNote}</p>
        <div class="footer-col-title" style="margin-top:1.2em">${footerContent.productionTitle}</div>
        <div class="footer-location-name">${footerContent.productionLocation}</div>
      </div>
      <div class="footer-cta-block">
        <div class="footer-col-title">${footerContent.ctaTitle}</div>
        <a href="${footerContent.ctaHref}">
          ${footerContent.ctaBtn}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"></path>
          </svg>
        </a>
        <p>strategy@studioluminant.com</p>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">${footerContent.copyright}</p>
      <ul class="footer-links">
        <li><a href="${footerContent.bimHref}">${footerContent.bimText}</a></li>
      </ul>
    </div>
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
