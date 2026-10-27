# Deploying PuneBuzz

- **API + Postgres:** [Render](https://render.com), defined in `render.yaml` at the repo root.
- **Client:** [Vercel](https://vercel.com), configured by `client/vercel.json`.

The order matters, because each side needs the other's URL:

1. Deploy the API and database on Render. Note the API URL.
2. Deploy the client on Vercel with `VITE_API_URL` pointing at that API. Note the client URL.
3. Set `CORS_ORIGIN` on Render to the client URL.
4. Run the checklist at the end.

Push the repo to GitHub (or GitLab/Bitbucket) first; both services deploy from git.

---

## 1. API + Postgres on Render

### Option A: Blueprint (recommended)

`render.yaml` describes both resources, so one flow creates and wires them together.

1. Render dashboard → **New** → **Blueprint** → connect your repo → pick the branch.
2. Render reads `render.yaml` and shows two resources: **punebuzz-api** (web service) and **punebuzz-db** (Postgres).
3. It prompts for the one value marked `sync: false`, which is **`CORS_ORIGIN`**. You don't have the Vercel URL yet, so enter a placeholder such as `https://example.invalid` and fix it in step 3.
4. Click **Apply**. Render creates the database, then builds and starts the API.

What the Blueprint sets up:

| Setting | Value | Why |
| --- | --- | --- |
| Root directory | `server` | Only the API is built here |
| Build command | `npm ci` | Clean install from the lockfile |
| Start command | `npm run migrate && npm start` | Migrations run on every start. They're idempotent and use an advisory lock, so this is safe, and it works on the free plan |
| Health check | `/api/v1/health` | Render waits for this to return 200 before routing traffic. It also checks the database |
| Region | `singapore` | Closest Render region to Pune |
| Node | 22.x | From `"engines"` in `server/package.json` |

### Option B: by hand in the dashboard

1. **New → Postgres.** Name `punebuzz-db`, database `pune_events`, region Singapore. Create it, then copy its **Internal Database URL**.
2. **New → Web Service** → your repo, then set:
   - Root Directory: `server`
   - Runtime: Node
   - Build Command: `npm ci`
   - Start Command: `npm run migrate && npm start`
   - Health Check Path (under Advanced): `/api/v1/health`
3. Add the environment variables from the table below, then **Create Web Service**.

### API environment variables

| Variable | Value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Also makes the seed script refuse to run |
| `DATABASE_URL` | The **Internal** Database URL | Set automatically by the Blueprint. The internal URL stays on Render's private network and needs no SSL |
| `JWT_SECRET` | Long random string | The Blueprint generates one. By hand: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. The app refuses to start if it's under 32 characters. Changing it logs everyone out |
| `JWT_EXPIRES_IN` | `7d` | |
| `TRUST_PROXY` | `1` | Render puts a proxy in front of your app. See the checklist for how to verify this |
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://punebuzz.vercel.app` | Exact origin: `https://`, no trailing slash, no path. Separate several with commas |
| `PORT` | Don't set it | Render provides it, and the app reads it |
| `AUTH_LOGIN_MAX`, `AUTH_REGISTER_MAX`, `RSVP_MAX` | Optional | Rate limits. Defaults are 10, 10 and 20 |

Once it's live, note the API URL, e.g. `https://punebuzz-api.onrender.com`. Check it:

```bash
curl https://punebuzz-api.onrender.com/api/v1/health
# {"status":"ok","db":"ok","clientIp":"<your IP>"}
```

Swagger UI is at `https://punebuzz-api.onrender.com/api/docs`.

### Demo data (optional, only on an empty database)

`npm run seed` **wipes every table**, and it refuses to run when `NODE_ENV=production`. To load the demo data once into a brand-new database, run it from your machine against the **External** Database URL (Render dashboard → database → Connect):

```bash
cd server
DATABASE_URL='postgresql://...external-host.../pune_events?sslmode=require' npm run seed
```

External connections need SSL, hence `sslmode=require`. If you get a certificate error, use `sslmode=no-verify`: still encrypted, but without certificate checking, which is acceptable for a one-off run. Never run this against a database with real users.

---

## 2. Client on Vercel

1. Vercel dashboard → **Add New… → Project** → import the repo.
2. **Root Directory: `client`.** Vercel detects **Vite**, with build `npm run build` and output `dist`. Leave those as they are.
3. **Environment Variables:**

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | `https://punebuzz-api.onrender.com/api/v1` (your Render URL **plus `/api/v1`**) |

   Vite bakes `VITE_*` variables into the JavaScript **at build time**. If you change this later, redeploy; a running site won't pick it up. If it's missing, the app fails on load with an error that names `VITE_API_URL`, which beats silently calling the wrong host.
4. **Deploy.** Note the URL, e.g. `https://punebuzz.vercel.app`.

`client/vercel.json` rewrites every path to `index.html`, so deep links such as `/events/12` or `/me?tab=organizing` work on refresh. Without it Vercel returns 404, because those routes only exist in React Router. Real files under `dist/` (JS, CSS, the favicon) are still served directly.

---

## 3. Connect them: CORS

Back on Render, go to **punebuzz-api → Environment** and set:

```text
CORS_ORIGIN=https://punebuzz.vercel.app
```

Saving restarts the service.

How CORS works here:

- The browser loads the client from `https://punebuzz.vercel.app` and calls the API on `https://punebuzz-api.onrender.com`, a different origin. The browser only allows that if the API answers with `Access-Control-Allow-Origin: https://punebuzz.vercel.app`.
- The API sends that header only for origins listed in `CORS_ORIGIN`. Any other site gets no header, so a browser on that site can't read the API's responses.
- Auth is a `Bearer` token header, not cookies, so no credentials or cookie settings are needed.
- **Custom domain:** add it to the list, e.g. `CORS_ORIGIN=https://punebuzz.vercel.app,https://punebuzz.in`.
- **Vercel preview deployments** get a different URL per branch and commit, which won't be in the list, so their API calls are blocked. Either test on production, or add a specific preview URL temporarily. Avoid allowing `*`.

---

## 4. Post-deploy checklist

- [ ] `GET /api/v1/health` returns `"db":"ok"`. Migrations ran: the Render logs show `Applied 001_init.sql` and `Applied 002_queue_order.sql` on the first boot, and `Database is up to date.` after that.
- [ ] **`TRUST_PROXY` is right.** Open `/api/v1/health` in your browser and compare `clientIp` with your public IP (e.g. from whatismyip.com).
  - **They match:** correct.
  - **It shows an internal or private address** (`10.x`, `172.16–31.x`, or a Render/Cloudflare IP): the proxy is still in front. Raise `TRUST_PROXY` to `2` and check again. Otherwise every user shares one rate-limit bucket, and one person's failed logins would lock everyone out.
  - **Never set it higher than needed.** Clients could then fake their IP with an `X-Forwarded-For` header and dodge the limits.
- [ ] Open the Vercel URL. Events load, and the browser console shows no CORS errors.
- [ ] Register, log in, RSVP, then refresh on `/events/<id>`. That last step tests the SPA rewrite.
- [ ] `/api/docs` loads.
- [ ] Response headers include `strict-transport-security` and `content-security-policy` (from helmet).

---

## Free-tier caveats (Render)

Check Render's [free tier page](https://render.com/docs/free) for current terms. At the time of writing:

- **Free web services spin down after 15 minutes without traffic.** The next request wakes the service, which takes up to about a minute, so the first page load after a quiet spell is slow. That's fine for a demo; use a paid instance for anything real.
- **Free Postgres expires 30 days after creation,** followed by a 14-day grace period to upgrade before the data is deleted. Only one free database is allowed per workspace.
- **750 free instance hours per workspace per month.**
- **Rate-limit counters are in memory,** so they reset when the service sleeps or restarts. They aren't shared if you scale to several instances (that would need Redis).

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Console: *blocked by CORS policy: No 'Access-Control-Allow-Origin' header* | `CORS_ORIGIN` doesn't exactly match the site's origin. Check for a trailing slash or a `www`/`http` mismatch, and remember the restart |
| Client calls `undefined/events` or fails on load mentioning `VITE_API_URL` | The env var wasn't set **before the build**. Set it and redeploy |
| Requests go to `…onrender.com/events` and get 404 | `VITE_API_URL` is missing the `/api/v1` suffix |
| 404 when refreshing `/events/12` on Vercel | Root Directory isn't `client`, so `client/vercel.json` wasn't picked up |
| Render deploy fails health check | Check the logs: usually `Invalid environment configuration` (a missing or short `JWT_SECRET`, or no `DATABASE_URL`) or a migration error |
| First request takes about a minute | Free instance waking from sleep (see above) |
| Everyone gets `RATE_LIMITED` together | `TRUST_PROXY` is too low (see the checklist) |
