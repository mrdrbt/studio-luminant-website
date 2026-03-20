// ─── COMPONENTS — Studio Luminant ───
// Injects nav, footer, cursor elements, and coord-tag
// Each page sets: data-lang, data-lang-url, and optionally data-base

(function() {
  const navEl = document.getElementById('site-nav');
  const footerEl = document.getElementById('site-footer');
  if (!navEl) return;

  const lang = navEl.getAttribute('data-lang') || 'en';
  const langUrl = navEl.getAttribute('data-lang-url') || '#';
  const base = navEl.getAttribute('data-base') || '';

  // ─── NAV ───
  const navLinks = lang === 'tr' ? {
    home: { href: 'Studio Luminant — Özel Mimari Elemanlar.htm', alt: 'Studio Luminant' },
    items: [
      { href: 'urunler.htm', text: 'Ürünler' },
      { href: 'koleksiyon.htm', text: 'Koleksiyon' },
      { href: 'surec.htm', text: 'Süreç' },
      { href: 'galeri.htm', text: 'Galeri' },
      { href: 'kaynaklar.htm', text: 'Kaynaklar' },
      { href: 'iletisim.htm', text: 'İletişim' }
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
      { href: 'products.htm', text: 'Products' },
      { href: 'collection.htm', text: 'Collection' },
      { href: 'process.htm', text: 'Process' },
      { href: 'gallery.htm', text: 'Gallery' },
      { href: 'resources.htm', text: 'Resources' },
      { href: 'contact.htm', text: 'Contact' }
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
<div class="cursor-dot" id="cursorDot"></div>
<div class="cursor-ring" id="cursorRing"></div>

<nav id="mainNav">
  <a href="${navLinks.home.href}" class="nav-logo">
    <img src="${imgBase}" alt="${navLinks.home.alt}" class="nav-logo-img">
  </a>
  <ul class="nav-links">
      ${navItemsHtml}
  </ul>
  <a href="${langUrl}" class="nav-lang">${navLinks.langLabel}</a>
  <button class="nav-hamburger" aria-label="${navLinks.hamburgerOpen}" aria-expanded="false" aria-controls="mobileMenu">
    <span></span>
  </button>
  <a href="${navLinks.ctaHref}" class="nav-cta">${navLinks.ctaText}</a>
</nav>

<div class="nav-mobile-menu" id="mobileMenu" role="navigation" aria-label="${navLinks.mobileLabel}">
${mobileItemsHtml}
  <a href="${langUrl}" class="nav-mobile-lang">${navLinks.langLabel}</a>
</div>`;

  // ─── MOBILE MENU ───
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !open);
      hamburger.setAttribute('aria-label', open ? navLinks.hamburgerOpen : navLinks.hamburgerClose);
      mobileMenu.classList.toggle('open', !open);
      document.body.style.overflow = open ? '' : 'hidden';
    });
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', navLinks.hamburgerOpen);
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
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
    hqTitle: 'Üretim Merkezi',
    locationLabel: 'Konum',
    locationNote: 'Küresel Dağıtım ve Montaj Hazır',
    ctaTitle: 'Proje Başlat',
    ctaBtn: 'Proje Başlat',
    copyright: '© 2026 Studio Luminant. Tüm Hakları Saklıdır.',
    bimHref: '../resources.htm',
    bimText: 'BIM Dosyaları',
    privacyHref: 'iletisim.htm',
    privacyText: 'Gizlilik',
    complianceHref: 'iletisim.htm',
    complianceText: 'Uyumluluk'
  } : {
    homeHref: 'Studio Luminant — Bespoke Architectural Elements.htm',
    tagline: 'Bespoke architectural elements — sculpted, cast, and finished to spec.',
    hqTitle: 'Manufacturing HQ',
    locationLabel: 'Location',
    locationNote: 'Global Distribution &amp; Installation Ready',
    ctaTitle: 'Start a Project',
    ctaBtn: 'Initiate Project',
    copyright: '© 2026 Studio Luminant. All Rights Reserved.',
    bimHref: 'resources.htm',
    bimText: 'BIM Assets',
    privacyHref: 'contact.htm',
    privacyText: 'Privacy',
    complianceHref: 'contact.htm',
    complianceText: 'Compliance'
  };

  footerEl.outerHTML = `
<footer>
  <div class="footer-inner">
    <div class="footer-top">
      <div class="footer-brand">
        <a href="${footerContent.homeHref}" class="logo">
          <img src="${imgBase}" alt="Studio Luminant" class="footer-logo-img">
        </a>
        <p class="footer-tagline">${footerContent.tagline}</p>
      </div>
      <div>
        <div class="footer-col-title">${footerContent.hqTitle}</div>
        <span class="footer-location-eyebrow">${footerContent.locationLabel}</span>
        <div class="footer-location-name">Sakarya / Sapanca<br>Türkiye</div>
        <p class="footer-location-note">${footerContent.locationNote}</p>
      </div>
      <div class="footer-cta-block">
        <div class="footer-col-title">${footerContent.ctaTitle}</div>
        <a href="mailto:strategy@studioluminant.com">
          ${footerContent.ctaBtn}
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
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
        <li><a href="${footerContent.privacyHref}">${footerContent.privacyText}</a></li>
        <li><a href="${footerContent.complianceHref}">${footerContent.complianceText}</a></li>
      </ul>
    </div>
  </div>
</footer>

<div class="coord-tag">40.7°N — 30.4°E — Sakarya, TR</div>`;

})();
