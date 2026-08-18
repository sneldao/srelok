/**
 * Paper-slip between folio leaves.
 * Applied with transition:animate on <main> while html uses "none".
 */
const easeOut = "cubic-bezier(0.16, 1, 0.3, 1)";
const easeIn = "cubic-bezier(0.87, 0, 0.13, 1)";

export const turn = {
  forwards: {
    old: { name: "folio-out", duration: "0.42s", easing: easeIn, fillMode: "both" as const },
    new: { name: "folio-in", duration: "0.58s", easing: easeOut, fillMode: "both" as const },
  },
  backwards: {
    old: {
      name: "folio-in",
      duration: "0.42s",
      easing: easeIn,
      direction: "reverse" as const,
      fillMode: "both" as const,
    },
    new: {
      name: "folio-out",
      duration: "0.58s",
      easing: easeOut,
      direction: "reverse" as const,
      fillMode: "both" as const,
    },
  },
};
