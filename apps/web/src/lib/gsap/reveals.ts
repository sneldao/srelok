/**
 * Reveal animation system using free GSAP plugins only.
 *
 * Marketing reveals stay ~0.8–1s. Interactive surfaces do not use this file.
 */
import gsap from "gsap";
import { prefersReducedMotion } from "./init";

/**
 * Split text into words wrapped in overflow-hidden containers.
 */
function splitWords(el: HTMLElement): HTMLSpanElement[] {
  const text = el.textContent || "";
  el.innerHTML = "";
  const words = text.split(/\s+/);
  const containers: HTMLSpanElement[] = [];

  words.forEach((word, i) => {
    const wrapper = document.createElement("span");
    wrapper.style.display = "inline-block";
    wrapper.style.overflow = "hidden";
    wrapper.style.verticalAlign = "top";

    const inner = document.createElement("span");
    inner.style.display = "inline-block";
    inner.textContent = word;
    wrapper.appendChild(inner);

    el.appendChild(wrapper);
    if (i < words.length - 1) {
      el.appendChild(document.createTextNode(" "));
    }
    containers.push(inner);
  });

  return containers;
}

function showImmediately(selector: string) {
  document.querySelectorAll(selector).forEach((el) => {
    gsap.set(el, { clearProps: "all", autoAlpha: 1, y: 0, yPercent: 0 });
  });
}

/**
 * Reveal headings word-by-word with y-translate from below.
 */
export function revealHeadings() {
  document.querySelectorAll("[data-reveal='heading']").forEach((el) => {
    const words = splitWords(el as HTMLElement);

    gsap.from(words, {
      yPercent: 110,
      duration: 0.9,
      stagger: 0.04,
      ease: "expo.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });
  });
}

/**
 * Reveal paragraphs with a simple fade + y-translate.
 */
export function revealParagraphs() {
  document.querySelectorAll("[data-reveal='paragraph']").forEach((el) => {
    gsap.fromTo(
      el,
      { y: 24, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.7,
        ease: "expo.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
      }
    );
  });
}

/**
 * Fade-up reveal for cards, images, and general elements.
 */
export function revealElements() {
  document.querySelectorAll("[data-reveal='element']").forEach((el) => {
    gsap.fromTo(
      el,
      { y: 28, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          once: true,
        },
      }
    );
  });
}

/**
 * Staggered reveal for groups (galleries, card lists).
 */
export function revealGroups() {
  document.querySelectorAll("[data-reveal='group']").forEach((group) => {
    const items = group.querySelectorAll("[data-reveal='group-item']");
    gsap.fromTo(
      items,
      { y: 32, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.65,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: {
          trigger: group,
          start: "top 85%",
          once: true,
        },
      }
    );
  });
}

/**
 * Counter animation — chunky stepped increments.
 */
export function revealCounters() {
  document.querySelectorAll("[data-reveal='counter']").forEach((el) => {
    const target = parseInt((el as HTMLElement).dataset.target || "0", 10);
    if (target === 0) return;

    const obj = { value: 0 };

    gsap.to(obj, {
      value: target,
      duration: 1.6,
      ease: "steps(12)",
      scrollTrigger: {
        trigger: el,
        start: "top 80%",
        once: true,
      },
      onUpdate: () => {
        (el as HTMLElement).textContent = Math.round(obj.value).toLocaleString();
      },
    });
  });
}

/**
 * Initialize all reveals.
 */
export function initReveals() {
  if (prefersReducedMotion()) {
    showImmediately("[data-reveal]");
    document.querySelectorAll("[data-reveal='counter']").forEach((el) => {
      const target = (el as HTMLElement).dataset.target;
      if (target) (el as HTMLElement).textContent = Number(target).toLocaleString();
    });
    return;
  }

  revealHeadings();
  revealParagraphs();
  revealElements();
  revealGroups();
  revealCounters();
}
