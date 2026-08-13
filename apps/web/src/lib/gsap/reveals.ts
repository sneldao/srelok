/**
 * Reveal animation system using free GSAP plugins only.
 *
 * Text splitting is done manually via span wrapping.
 * ScrollTrigger drives all reveal timing.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Split text into chars wrapped in spans for animation.
 */
function splitChars(el: HTMLElement): HTMLSpanElement[] {
  const text = el.textContent || "";
  el.innerHTML = "";
  const chars: HTMLSpanElement[] = [];

  for (const char of text) {
    const span = document.createElement("span");
    span.className = "char";
    span.style.display = "inline-block";
    span.style.overflow = "hidden";
    span.textContent = char === " " ? "\u00A0" : char;
    el.appendChild(span);
    chars.push(span);
  }
  return chars;
}

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

/**
 * Reveal headings word-by-word with y-translate from below.
 */
export function revealHeadings() {
  document.querySelectorAll("[data-reveal='heading']").forEach((el) => {
    const words = splitWords(el as HTMLElement);

    gsap.from(words, {
      yPercent: 110,
      duration: 1,
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
      { y: 30, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.9,
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
      { yPercent: 30, autoAlpha: 0 },
      {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.8,
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
      { yPercent: 50, autoAlpha: 0 },
      {
        yPercent: 0,
        autoAlpha: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
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
      duration: 2.5,
      ease: "steps(14)",
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
  revealHeadings();
  revealParagraphs();
  revealElements();
  revealGroups();
  revealCounters();
}
