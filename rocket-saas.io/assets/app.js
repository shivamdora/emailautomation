const root = document.body;
const header = document.querySelector("[data-header]");
const navToggle = document.querySelector("[data-nav-toggle]");
const navPanel = document.querySelector("[data-nav-panel]");
const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
const sections = Array.from(document.querySelectorAll("[data-section]"));
const heroVideo = document.querySelector("[data-hero-video]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const mobileNav = window.matchMedia("(max-width: 820px)");

function syncReducedMotionState(mediaQuery) {
  root.classList.toggle("reduce-motion", mediaQuery.matches);
}

function syncHeaderState() {
  if (!header) {
    return;
  }

  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

function closeNav() {
  if (!navToggle || !navPanel) {
    return;
  }

  root.classList.remove("nav-open");
  navToggle.setAttribute("aria-expanded", "false");
  syncNavAccessibility();
}

function toggleNav() {
  if (!navToggle || !navPanel) {
    return;
  }

  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!isOpen));
  root.classList.toggle("nav-open", !isOpen);
  syncNavAccessibility();
}

function syncNavAccessibility() {
  if (!navPanel || !navToggle) {
    return;
  }

  const isMobile = mobileNav.matches;
  const isOpen = root.classList.contains("nav-open");

  if (isMobile) {
    navPanel.inert = !isOpen;
    navPanel.setAttribute("aria-hidden", String(!isOpen));
  } else {
    navPanel.inert = false;
    navPanel.removeAttribute("aria-hidden");
    root.classList.remove("nav-open");
    navToggle.setAttribute("aria-expanded", "false");
  }
}

function handleReveal() {
  if (reduceMotion.matches || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    },
  );

  revealItems.forEach((item) => observer.observe(item));
}

function handleSectionTracking() {
  if (!("IntersectionObserver" in window) || navLinks.length === 0 || sections.length === 0) {
    return;
  }

  const linkMap = new Map(navLinks.map((link) => [link.getAttribute("href")?.slice(1), link]));

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const activeEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!activeEntry) {
        return;
      }

      const activeName = activeEntry.target.getAttribute("data-section");

      navLinks.forEach((link) => {
        const isCurrent = link.getAttribute("href") === `#${activeName}`;
        link.classList.toggle("is-current", isCurrent);
        if (isCurrent) {
          link.setAttribute("aria-current", "page");
        } else {
          link.removeAttribute("aria-current");
        }
      });

      if (activeName === "top") {
        navLinks.forEach((link) => link.classList.remove("is-current"));
      }

      const activeLink = linkMap.get(activeName);
      if (activeLink) {
        activeLink.classList.add("is-current");
        activeLink.setAttribute("aria-current", "page");
      }
    },
    {
      rootMargin: "-30% 0px -45% 0px",
      threshold: [0.1, 0.35, 0.6],
    },
  );

  sections.forEach((section) => sectionObserver.observe(section));
}

function handleHeroVideo() {
  if (!heroVideo || reduceMotion.matches) {
    root.classList.add("video-fallback");
    return;
  }

  const playback = heroVideo.play();

  if (playback && typeof playback.catch === "function") {
    playback.catch(() => {
      root.classList.add("video-fallback");
    });
  }

  heroVideo.addEventListener("error", () => {
    root.classList.add("video-fallback");
  });
}

syncReducedMotionState(reduceMotion);
reduceMotion.addEventListener("change", (event) => {
  syncReducedMotionState(event.currentTarget);
});

syncHeaderState();
syncNavAccessibility();
handleReveal();
handleSectionTracking();
handleHeroVideo();

window.addEventListener("scroll", syncHeaderState, { passive: true });
window.addEventListener("resize", syncNavAccessibility);

if (navToggle) {
  navToggle.addEventListener("click", toggleNav);
}

navLinks.forEach((link) => {
  link.addEventListener("click", closeNav);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeNav();
  }
});

document.addEventListener("click", (event) => {
  if (!root.classList.contains("nav-open") || !navPanel || !navToggle) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (!navPanel.contains(target) && !navToggle.contains(target)) {
    closeNav();
  }
});
