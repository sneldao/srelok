import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const gates = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/gates" }),
  schema: z.object({
    order: z.number(),
    label: z.string(),
    for: z.string(),
    stamp: z.string(),
    hint: z.string(),
    detail: z.string(),
    aside: z.string().optional(),
  }),
});

export const collections = { gates };
