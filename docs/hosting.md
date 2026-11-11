# Hosting — static, HTTPS, free, alive until 29 January 2027

AIR-N-13 (cahier §10) fixes four conditions and nothing else:

1. **HTTPS**, because `getUserMedia` is refused on a plain `http://` origin
   except on `localhost` — without TLS there is no camera, so no instrument.
2. **Static**: no server code, no database, no function runtime. The page is
   `apps/web/dist` plus `public/models/` (§11.9).
3. **Free**, and reachable **until 29 January 2027 at least** — a rule of the
   competition, not a preference.
4. And it has to carry the vision model **from the same origin**: several
   megabytes, with a long cache, no third-party request (AIR-N-01, §11.9).

The last point does the sorting. A CDN that only serves HTML and CSS, while the
model has to come from a bucket elsewhere, is disqualified: it would introduce a
second origin, and the "nothing leaves your browser / no third-party request"
claim would need an asterisk. The model must be a file in the deployed bundle.

## What has to be served

| Path | Content | Weight | Cache |
|---|---|---|---|
| `index.html` | The shell | small | short (must-revalidate) |
| `assets/*.js`, `assets/*.css` | Bundled app, hashed names | from the build | **one year, immutable** — the name changes when the bytes change |
| `models/hand_landmarker.task` | The hand model | **several MB — `TODO(mesure)`**, read after `npm run fetch-model` and recorded in `docs/latency.md` | **one year, immutable** |
| `models/*.wasm`, `models/*.js` | MediaPipe runtime | **`TODO(mesure)`** | **one year, immutable** |

Two consequences for the choice:

- **Content-hashed assets want a long cache**, and the model wants it even more:
  it is the single largest download of the first visit, it never changes for a
  given release, and re-downloading it is what would break the "under thirty
  seconds to the first note" objective (O1, §4).
- **The site must let the host set those headers.** That is the real difference
  between the three candidates below, not the deploy button.

## The three candidates

| | GitHub Pages | Netlify (free) | Cloudflare Pages (free) |
|---|---|---|---|
| HTTPS | Automatic, certificate managed by GitHub | Automatic, managed certificate | Automatic, managed certificate |
| Custom `Cache-Control` / `_headers` file | **No.** The host decides; a `_headers` file is ignored, so the long cache on the model cannot be declared. Assets are still cached by the browser, with the host's own policy | **Yes**, via a `_headers` file at the publish root | **Yes**, via a `_headers` file at the publish root |
| Cache long on several-MB model | Not declarable — the controlling header is the host's | Yes | Yes, plus immutable semantics on hashed paths |
| Third-party request | None | None | None |
| Weight limits | Soft: repository and site size limits (1 GB site, recommended); a several-MB model is fine | 100 GB bandwidth per month on the free tier | Requests and bandwidth not metered on the free tier |
| Builds | GitHub Actions or a branch | 300 build minutes per month | 500 builds per month |
| Free-tier longevity risk | Tied to the repository and the account staying public and active — the natural home for a hackathon entry | Free sites can be **paused for inactivity**; `TODO(vérifier)` the exact current policy before relying on it | No inactivity pause known for free projects; `TODO(vérifier)` before relying on it |
| Deploy from CI | Actions, `pages` job | CLI or Actions | CLI (`wrangler`) or Actions |
| Private/unlisted preview URLs | Public only (per-repo) | Deploy previews per PR | Deploy previews per branch |

Sources of the numbers above: public free-tier pages read at briefing time.
Anything not re-read on the day is marked `TODO(vérifier)` — no figure here is
invented, and the two longevity items are exactly the ones that decide whether
the address is still up on 29 January 2027.

## Recommendation

**Cloudflare Pages as the host, GitHub Pages as the standing fallback.**

Why Cloudflare Pages:

1. It is the only candidate that satisfies all four conditions *and* lets the
   project declare the long cache on the model itself, through a `_headers` file
   committed next to the site. Neither "several megabytes every visit" nor
   "revalidate the biggest file on every load" is acceptable for objective O1.
2. Requests and bandwidth are not metered on the free tier: a jury, a class, or
   a front page does not turn into a bill or a suspended site.
3. Preview URLs per branch are useful during the build: a lot can show its
   branch without touching the address the judges were given.

Why GitHub Pages anyway, and permanently:

1. It is the fallback with the least moving parts — the same repository that
   holds the code, no second account, no CLI, no token in CI. If a host were to
   change its free-tier policy before 29 January 2027, the entry still has a home
   one setting away.
2. Its one weakness is honest and known: the cache policy is the host's, so the
   model is revalidated more often than ideal. That costs seconds on a repeat
   visit; it does not break a requirement.

Netlify is not recommended: the `_headers` file is there, but the free tier's
pause-on-inactivity policy is the one risk that can silently take the address
down between the submission and the judging date, which is precisely what
AIR-N-13 forbids.

## Doing it, step by step

### 1. Build locally, once, and check what will be served

```bash
npm ci                                        # Node 22 or later
npm run fetch-model                           # writes public/models/ — not versioned (.gitignore)
npm run build                                 # vite build apps/web → apps/web/dist
ls -la apps/web/dist apps/web/dist/assets apps/web/dist/models
```

`fetch-model` prints the model weight; copy it into `docs/latency.md` (§11.9).

### 2. Declare the cache, in the published folder

Create `apps/web/public/_headers` (Vite copies `public/` verbatim into `dist`).
That file is part of lot B4's perimeter, so this lot only states what it must
contain:

```text
/models/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: public, max-age=0, must-revalidate

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(self), microphone=(), geolocation=()
```

The `Permissions-Policy` line is the hosting-side twin of AIR-F-56: it tells the
browser the microphone is not merely unused but forbidden for this origin.

### 3. Publish to Cloudflare Pages

Two ways; the second is the one to use once CI is stable.

```bash
# a. from a laptop, once the folder exists
npx wrangler pages deploy apps/web/dist --project-name thin-air

# b. from CI, with the repository's own token (a secret, never in a file)
npx wrangler pages deploy apps/web/dist --project-name thin-air --branch main
```

Authentication is by `CLOUDFLARE_API_TOKEN` in the environment, set as a
repository secret by whoever owns the account. **No key, no token and no
account id belongs in this repository**, and none is written here.

Then, in the dashboard, attach the custom domain if any, and check the three
things that matter:

```bash
# certificate present, no mixed content
curl -sI https://<the-address>/ | head -5
# the model is served from the site's own origin, with the long cache
curl -sI https://<the-address>/models/hand_landmarker.task | grep -iE 'cache-control|content-type|content-length'
# the page and its assets come from the same origin as the model
curl -s https://<the-address>/ | grep -o 'https\?://[^"'"'"' ]*' | sort -u
```

The last command must print only the site's own origin: that is the practical
test of "no third-party request" (AIR-N-01), and it is the same check that
`build.yml` runs on the built bundle before any deploy.

### 4. Standing fallback: GitHub Pages

```bash
npm run build
npx gh-pages -d apps/web/dist          # or: push dist/ to the gh-pages branch from CI
```

Then in the repository settings, Pages → source: `gh-pages` branch, and enable
"Enforce HTTPS". Note the base path problem: a project page is served under
`/<repo>/`, so the site must be built with a matching `base`; an apex or `www`
custom domain avoids that entirely.

### 5. What to verify the day before submission (§18, recette)

- [ ] The address answers over HTTPS and the certificate is valid.
- [ ] The camera prompt appears once, and only after a press on **Start**
      (AIR-F-01).
- [ ] The network panel shows **zero** request after load, and **zero** request
      to a third-party origin (AIR-N-01).
- [ ] `models/hand_landmarker.task` is served by the site itself, with the long
      cache header, and its weight is recorded in `docs/latency.md`.
- [ ] No audio file is served: `find apps/web/dist -type f` shows only `.html`,
      `.js`, `.css`, the model and its runtime.
- [ ] The site works with the network cut after the first visit (AIR-F-54).
- [ ] `TODO(mesure)`: time from first click to first correct note, on a common
      connection, against the thirty-second objective of §4.

## Cost and duration

All three free tiers are free of charge for this usage: one small site, a few
hundred visitors, a handful of deployments. Nothing here needs a paid plan. The
commitment is therefore not financial but procedural: keep the account active,
keep the repository public, and re-check the address in the last week of January
2027 — the fallback in step 4 exists so that this re-check can end, if needed,
with a two-minute switch rather than a scramble.
