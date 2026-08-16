/**
 * GSAP initialization — register free plugins.
 *
 * Note: SplitText and Flip are GSAP Club plugins (paid).
 * We implement text splitting manually and use CSS-based reveals.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

gsap.defaults({
  ease: "expo.out",
});

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export { gsap, ScrollTrigger };
