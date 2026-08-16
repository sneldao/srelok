/**
 * Lenis smooth scroll initialization.
 * Pairs with GSAP ScrollTrigger for synchronized scroll-driven animations.
 */
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReducedMotion } from "./gsap/init";

const reduced = prefersReducedMotion();

const lenis = new Lenis({
  duration: reduced ? 0 : 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  touchMultiplier: 2,
});

lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

export { lenis };
