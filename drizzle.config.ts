import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: [
    "./db/schema.ts",
    "./db/review-workflow-schema.ts",
    "./db/content-source-schema.ts",
  ],
  dialect: "sqlite",
});
