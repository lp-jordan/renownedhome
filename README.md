# renownedhome

Full-stack rebuild scaffold for the Renowned site.

## What is included

- Public routes for `home`, `buy`, `connect`, `meet`, `read`, `issue-1`, `issue-2`, `one-shot`, `letters`, and `/go`
- Secure admin login with autosaving editors
- Postgres-ready content repository with local JSON fallback for development
- Letter submission + moderation flow
- Redirect management
- Asset registry plus Railway/S3-style private bucket upload support

## Local development

```powershell
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`
- Default local admin login: `admin` / `renownedhome-dev`

Local edits persist in `runtime/content-store.json`.

## Production-oriented environment variables

Optional for local development, recommended for deployment:

- `DATABASE_URL`
- `PORT`
- `NODE_ENV=production`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`
- `SESSION_TTL_SECONDS` optional, defaults to `604800`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` if using a custom S3-compatible endpoint
- `S3_FORCE_PATH_STYLE=true` if required by the provider
- `ASSET_URL_SIGN_TTL_SECONDS` optional, defaults to `900`

If `DATABASE_URL` is not set, the app uses the local runtime JSON store.
If the S3 variables are not set, asset uploads stay in external-URL mode.
When bucket storage is configured, uploaded assets are stored privately and served through app URLs like `/api/assets/:id`, which redirect to short-lived signed object-storage URLs. This works well with Railway buckets and other private S3-compatible providers.

## Railway checklist

Before putting the app live on Railway:

1. Create a Railway Postgres database and set its connection string as `DATABASE_URL`.
2. Set `NODE_ENV=production`.
3. For the first deploy, set `ADMIN_USERNAME` and either `ADMIN_PASSWORD` or `ADMIN_PASSWORD_HASH`.
4. After the first successful boot creates your admin user, remove the plain `ADMIN_PASSWORD` if you want and keep only `ADMIN_PASSWORD_HASH`.
5. If you want private uploads, also configure the `S3_*` variables for your Railway bucket or another S3-compatible provider.

Production boots now fail fast when `DATABASE_URL` is missing, and a fresh production database requires an explicit admin bootstrap instead of relying on a known default login.

## Other scripts

```powershell
npm run build
npm run start
npm run lint
```
