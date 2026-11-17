// @ts-check
import { defineConfig } from "astro/config";

// Garth's home page: a few static pages, published to GitHub Pages at
// getgarth.com (public/CNAME). SITE_URL overrides the address for a preview.
export default defineConfig({
  site: process.env.SITE_URL ?? "https://getgarth.com",
});
