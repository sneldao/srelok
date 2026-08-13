// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  integrations: [tailwind()],
  vite: {
    build: {
      // Allow gsap imports
      commonjsOptions: {
        include: [/gsap/],
      },
    },
  },
});
