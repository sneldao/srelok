/**
 * One pinned scroll: aperture opens, six verbs fire inside the hole.
 */
import gsap from "gsap";
import { prefersReducedMotion } from "./gsap/init";

const VERB_COUNT = 6;

export function initTelescope() {
  const hero = document.querySelector<HTMLElement>(".hero");
  if (!hero) return;

  const verbs = [...hero.querySelectorAll<HTMLElement>("[data-verb]")];

  const apply = (p: number) => {
    hero.style.setProperty("--progress", String(p));
    hero.classList.toggle("is-open", p > 0.08);
    hero.classList.toggle("is-wide", p > 0.78);
    const i = Math.min(VERB_COUNT - 1, Math.floor(p * VERB_COUNT));
    verbs.forEach((el, n) => el.classList.toggle("is-on", n === i));
  };

  if (prefersReducedMotion()) {
    apply(1);
    return;
  }

  gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: "top top",
      end: "+=240%",
      scrub: 0.55,
      pin: true,
      onUpdate: (self) => {
        apply(gsap.parseEase("power2.inOut")(self.progress));
      },
    },
  });
}
