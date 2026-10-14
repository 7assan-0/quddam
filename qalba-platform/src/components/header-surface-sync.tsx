"use client";
import { useEffect } from "react";

/** Keeps the existing sticky header legible when the Sun hero leaves the viewport. */
export function HeaderSurfaceSync() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".quddam-sun-hero");
    const header = document.querySelector<HTMLElement>(".header");
    if (!hero || !header) return;
    const update = () => {
      const heroBottom = hero.getBoundingClientRect().bottom;
      document.body.dataset.heroVisible = heroBottom > header.getBoundingClientRect().bottom ? "true" : "false";
    };
    const observer = new IntersectionObserver(update, { threshold: [0, 1] });
    observer.observe(hero);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      delete document.body.dataset.heroVisible;
    };
  }, []);
  return null;
}
