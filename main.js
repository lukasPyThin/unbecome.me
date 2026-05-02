// ==========================================================================
// Mobile nav toggle
// ==========================================================================

const navToggle = document.querySelector('.nav__toggle');
const navLinks = document.querySelector('.nav__links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('active');
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ==========================================================================
// Accessibility - reduced motion preference
// ==========================================================================

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ==========================================================================
// Smooth scroll - CSS scroll-margin-top obsługuje offset; behavior zależny od preferencji
// ==========================================================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const href = anchor.getAttribute('href');
    if (href === '#' || href.length < 2) return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    }
  });
});

// ==========================================================================
// Fade-in na scroll (Intersection Observer)
// - skip animacji jeśli user preferuje reduced motion
// ==========================================================================

const fadeElements = document.querySelectorAll(
  '.section, .offer, .about__text, .about__image, .form'
);

if (prefersReducedMotion) {
  fadeElements.forEach(el => el.classList.add('fade-in', 'visible'));
} else {
  const fadeObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in', 'visible');
          fadeObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
  );

  fadeElements.forEach(el => {
    el.classList.add('fade-in');
    fadeObserver.observe(el);
  });
}

// ==========================================================================
// Nav background na scroll
// ==========================================================================

const nav = document.getElementById('nav');

if (nav) {
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        nav.classList.toggle('nav--scrolled', window.scrollY > 80);
        ticking = false;
      });
      ticking = true;
    }
  });
}
