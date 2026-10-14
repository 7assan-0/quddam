"use client";
import { useEffect } from "react";

/** Preview-only hero flag: ?hero=sun or ?hero=night; NEXT_PUBLIC_QUDDAM_SUN_HERO=1 sets the default. */
export function HeaderSurfaceSync() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".quddam-sun-hero");
    const header = document.querySelector<HTMLElement>(".header");
    if (!hero || !header) return;
    const applyTheme = () => {
      const requested = new URLSearchParams(window.location.search).get("hero");
      const fallback = process.env.NEXT_PUBLIC_QUDDAM_SUN_HERO === "1" ? "sun" : "night";
      hero.dataset.heroTheme = requested === "sun" || requested === "night" ? requested : fallback;
    };
    const update = () => {
      document.body.dataset.heroVisible = hero.getBoundingClientRect().bottom > header.getBoundingClientRect().bottom ? "true" : "false";
    };
    const observer = new IntersectionObserver(update, { threshold: [0, 1] });
    applyTheme();
    observer.observe(hero);
    window.addEventListener("popstate", applyTheme);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", applyTheme);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      delete document.body.dataset.heroVisible;
    };
  }, []);
  return null;
}
