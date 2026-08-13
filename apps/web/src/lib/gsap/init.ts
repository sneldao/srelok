/**
 * GSAP initialization — register free plugins.
 *
 * Note: SplitText and Flip are GSAP Club plugins (paid).
 * We implement text splitting manually and use CSS-based reveals.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Default ease for the whole site
gsap.defaults({
  ease: "expo.out",
  duration: 1,
});

export { gsap, ScrollTrigger };
