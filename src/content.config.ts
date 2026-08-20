import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const sermons = defineCollection({
  loader: glob({ base: "./src/content/sermons", pattern: "**/*.md" }),
  schema: z.object({
    archiveId: z.number().int().positive(),
    sermonDate: z.string(),
    title: z.string(),
    preacher: z.string(),
    language: z.string(),
    theme: z.string().nullable(),
    scriptureReference: z.string().nullable(),
    liturgicalDay: z.string().nullable(),
    sermonType: z.string().nullable(),
    startSeconds: z.number().nullable(),
    endSeconds: z.number().nullable(),
    sourceVideoId: z.string(),
    sourceVideoUrl: z.string().url(),
    sourceVideoTitle: z.string(),
    tags: z.array(z.string())
  })
});

export const collections = { sermons };
