# garth-site

Garth's home page, getgarth.com: a home page, pricing (Garth is free) and
contact. Astro, static, published to GitHub Pages by `.github/workflows/pages.yml`
on a push to `main`; the domain is `public/CNAME`.

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # dist/
```

Every claim on the site comes from the product's README, `docs/design.md` or a
release note. Nothing is promised that those don't say.

## The tour

The home page's `#tour` section plays `public/video/garth-tour.mp4` over its
poster, `public/video/garth-tour.jpg`, with captions (`garth-tour.vtt`) and a
transcript (`garth-tour-transcript.txt`) when those are there. Until the mp4
exists the section says the tour is being filmed. `scripts/sync-video.sh <dir>`
copies a take in.

## Addresses

`src/links.ts` holds the addresses more than one page uses: the mail addresses,
the docs, and Toft's site. There is no public playground, so "Request a
sandbox" is an email.
